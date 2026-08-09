/**
 * USM CubeSat — Drive Upload Bridge
 *
 * Google Apps Script web app that receives base64-encoded files from the
 * CubeSat web client and stores them in a shared Drive folder, organized
 * by task / project. Replaces Firebase Storage with a free Drive-backed
 * storage layer.
 *
 * Deploy:
 *   1. Open https://script.google.com → New project → paste this file
 *   2. Replace FOLDER_ID and SHARED_SECRET below
 *   3. Deploy → New deployment → Type: Web app
 *      - Execute as: Me (your account)
 *      - Who has access: Anyone
 *   4. Copy the deployment URL into VITE_DRIVE_UPLOAD_URL
 *   5. Copy SHARED_SECRET into VITE_DRIVE_UPLOAD_SECRET
 */

const FOLDER_ID = 'PUT_YOUR_DRIVE_FOLDER_ID_HERE';
const SHARED_SECRET = 'PUT_A_LONG_RANDOM_STRING_HERE';
const ALLOWED_EMAIL_PATTERN = /^[a-zA-Z0-9._%+\-]+@(sansano\.)?usm\.cl$/i;
const MAX_FILE_BYTES = 35 * 1024 * 1024;

// Firebase project id — used to validate the audience (aud) / issuer of ID tokens.
const FIREBASE_PROJECT_ID = 'usmcubesateam-1e3f4';

// When true, upload/delete REQUIRE a valid Firebase ID token and the trusted email is
// derived from it, ignoring any client-supplied userEmail. The shipped web client
// (FileService.ts / BotService.ts) already attaches params.idToken on every upload/delete
// call, so the spoofable userEmail fallback is now pure attack surface: without this gate a
// caller who holds the shared secret could pass an arbitrary victim email and delete files
// they do not own (handleDelete gates on uploader email). Enforced to close that hole.
const REQUIRE_ID_TOKEN = true;

// Per-caller rate limiting. The shared secret is distributed to every signed-in member via
// Firestore (system_config/keys) and is fetched into the browser, so it cannot on its own
// protect anything: treat it as a bot-filter, never as authorization. The verified ID token
// proves the caller is institutional, but any single member could still hammer an endpoint
// and burn the team's paid Gemini quota (financial DoS), use it as a free unmetered LLM, or
// exhaust the Drive quota of the account this script runs as. These caps bound requests per
// verified email and reject oversized payloads.
const RATE_WINDOW_SECONDS = 60;
const CHAT_RATE_MAX_PER_WINDOW = 15;
const UPLOAD_RATE_MAX_PER_WINDOW = 20;
const DELETE_RATE_MAX_PER_WINDOW = 30;
const CHAT_MAX_CONTENTS_CHARS = 200000;
const CHAT_MAX_OUTPUT_TOKENS = 1200;

// Base64 inflates bytes by ~4/3. Reject obviously oversized payloads *before* decoding them,
// so a caller cannot force the script to materialize hundreds of MB in memory just to have
// the decoded-length check reject it afterwards.
const MAX_FILE_BASE64_CHARS = Math.ceil((35 * 1024 * 1024) * 4 / 3) + 1024;

// Depth guard for the folder-containment walk in isInsideManagedFolder_.
const MAX_PARENT_WALK = 64;

// Allowlist of Gemini model identifiers accepted by handleChat
const ALLOWED_MODELS = [
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

// Allowlist of permitted MIME types to prevent executable file uploads
const ALLOWED_MIME_TYPES = [
  // image/svg+xml intentionally excluded: SVG can carry embedded scripts (stored XSS).
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-zip-compressed',
];

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents || '{}');

    if (params.secret !== SHARED_SECRET) {
      return jsonResponse({ error: 'unauthorized' });
    }

    if (!params.userEmail || !ALLOWED_EMAIL_PATTERN.test(params.userEmail)) {
      return jsonResponse({ error: 'institutional email required' });
    }

    if (params.action === 'upload') return jsonResponse(handleUpload(params));
    if (params.action === 'delete') return jsonResponse(handleDelete(params));
    if (params.action === 'chat') return jsonResponse(handleChat(params));

    return jsonResponse({ error: 'invalid action' });
  } catch (err) {
    return jsonResponse({ error: err && err.message ? err.message : 'server error' });
  }
}

function doGet() {
  return jsonResponse({ ok: true, service: 'USM CubeSat Drive Bridge' });
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function resolveTargetFolder(root, params) {
  if (params.taskId) {
    const tasksFolder = getOrCreateFolder(root, 'tasks');
    return getOrCreateFolder(tasksFolder, String(params.taskId));
  }
  if (params.projectId) {
    const projectsFolder = getOrCreateFolder(root, 'projects');
    return getOrCreateFolder(projectsFolder, String(params.projectId));
  }
  return getOrCreateFolder(root, 'general');
}

/**
 * Verifies a Firebase ID token via Google's tokeninfo endpoint and returns the
 * institutional email it asserts, or null if the token is missing/invalid.
 * Validates audience (this Firebase project), issuer, verified email and domain.
 */
function verifyIdToken_(idToken) {
  if (!idToken) return null;
  try {
    const resp = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(idToken)),
      { muteHttpExceptions: true }
    );
    if (resp.getResponseCode() !== 200) return null;
    const claims = JSON.parse(resp.getContentText());
    if (claims.aud !== FIREBASE_PROJECT_ID) return null;
    if (claims.iss && claims.iss !== 'https://securetoken.google.com/' + FIREBASE_PROJECT_ID) return null;
    if (claims.email_verified !== true && claims.email_verified !== 'true') return null;
    const email = String(claims.email || '').trim().toLowerCase();
    if (!ALLOWED_EMAIL_PATTERN.test(email)) return null;
    return email;
  } catch (err) {
    return null;
  }
}

/**
 * Resolves the trusted email for an upload/delete request. Prefers the verified ID
 * token; falls back to the (spoofable) client-supplied email only while
 * REQUIRE_ID_TOKEN is false, for backward compatibility with older clients.
 */
function resolveTrustedEmail_(params) {
  const tokenEmail = verifyIdToken_(params.idToken);
  if (tokenEmail) return tokenEmail;
  if (REQUIRE_ID_TOKEN) {
    throw new Error('valid Firebase ID token required');
  }
  return String(params.userEmail || '').trim().toLowerCase();
}

function handleUpload(params) {
  // Authenticate FIRST. This used to run at the very end of the function, *after* the blob had
  // already been written to Drive and shared with anyone-who-has-the-link: an unauthenticated
  // caller got an error response, but their file was created and world-readable all the same.
  // Resolving the trusted email up front makes the token the actual gate on the write.
  const uploaderEmail = resolveTrustedEmail_(params);

  // Bound how often one verified member can write to the team Drive, so a single account
  // cannot exhaust the owner's storage quota with a loop of small uploads.
  if (!withinRateLimit_('upload', uploaderEmail, UPLOAD_RATE_MAX_PER_WINDOW)) {
    throw new Error('rate limit exceeded: too many uploads, retry in a minute');
  }

  if (!params.fileBase64 || !params.fileName) {
    throw new Error('missing fileBase64 or fileName');
  }

  // Reject oversized payloads before decoding (see MAX_FILE_BASE64_CHARS).
  if (String(params.fileBase64).length > MAX_FILE_BASE64_CHARS) {
    throw new Error('file exceeds 35 MB limit');
  }

  // Sanitize fileName: only allow safe characters to prevent path traversal / injection
  const sanitizedFileName = String(params.fileName)
    .replace(/[^a-zA-Z0-9._\-\s]/g, '_')
    .trim()
    .substring(0, 255);
  if (!sanitizedFileName) {
    throw new Error('invalid fileName');
  }

  // Validate MIME type against allowlist
  const mimeType = String(params.mimeType || '').toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error('file type not allowed: ' + mimeType);
  }

  const root = DriveApp.getFolderById(FOLDER_ID);
  const target = resolveTargetFolder(root, params);

  const decoded = Utilities.base64Decode(params.fileBase64);
  if (decoded.length > MAX_FILE_BYTES) {
    throw new Error('file exceeds 35 MB limit');
  }

  const blob = Utilities.newBlob(decoded, mimeType, sanitizedFileName);
  const file = target.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Store the trusted uploader email (resolved from the verified ID token above) plus the
  // deliverableId in the description, for ownership verification on delete.
  const descParts = ['uploader:' + uploaderEmail];
  if (params.deliverableId) descParts.push('deliverable:' + params.deliverableId);
  file.setDescription(descParts.join(';'));

  return {
    id: file.getId(),
    name: file.getName(),
    viewURL: 'https://drive.google.com/file/d/' + file.getId() + '/view?usp=sharing',
    downloadURL: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
    size: file.getSize(),
    mimeType: file.getMimeType(),
  };
}

function handleDelete(params) {
  if (!params.fileId) {
    throw new Error('missing fileId');
  }

  // Authenticate before resolving the file id at all.
  const requesterEmail = resolveTrustedEmail_(params);

  if (!withinRateLimit_('delete', requesterEmail, DELETE_RATE_MAX_PER_WINDOW)) {
    return { error: 'rate limit exceeded: too many delete requests, retry in a minute' };
  }

  let file;
  try {
    file = DriveApp.getFileById(params.fileId);
  } catch (err) {
    return { error: 'file not found' };
  }

  // CONTAINMENT (the important part). The web app executes as the Drive owner, so
  // DriveApp.getFileById() happily resolves *any* file that account can reach — including
  // their private, non-CubeSat documents. Previously the only guard was the `uploader:` tag,
  // and files without one were trashed unconditionally "for backward compatibility". Since no
  // file outside this app ever carries that tag, any caller could pass an arbitrary Drive file
  // id and have the owner's personal files moved to the trash. Refuse to touch anything that
  // does not live under the managed root folder.
  if (!isInsideManagedFolder_(file)) {
    return { error: 'unauthorized: file is outside the CubeSat repository folder' };
  }

  // Verify ownership: only the original uploader may delete through the bridge. The requester
  // email comes from the verified Firebase ID token (spoof-resistant) whenever one is present,
  // and REQUIRE_ID_TOKEN makes it mandatory. Untagged files now fail CLOSED — a legacy file
  // with no recorded uploader has to be removed by hand from Drive by an owner.
  const description = file.getDescription() || '';
  const uploaderMatch = description.match(/uploader:([^;]+)/);
  if (!uploaderMatch) {
    return { error: 'unauthorized: file has no recorded uploader; remove it directly from Drive' };
  }
  if (uploaderMatch[1].trim().toLowerCase() !== requesterEmail) {
    return { error: 'unauthorized: you can only delete files you uploaded' };
  }

  file.setTrashed(true);
  return { ok: true };
}

/**
 * Fixed-window per-key rate limiter backed by the script CacheService. Returns true when the
 * call is within budget, false when the caller has exhausted `max` calls in the current
 * window. Fails open only if the cache backend is unavailable, never on a clean hit.
 *
 * `bucket` namespaces the counter so the chat, upload and delete budgets are independent.
 */
function withinRateLimit_(bucket, key, max) {
  try {
    const cache = CacheService.getScriptCache();
    if (!cache) return true;
    const cacheKey = bucket + '_rl_' + key;
    const current = parseInt(cache.get(cacheKey) || '0', 10) || 0;
    if (current >= max) {
      return false;
    }
    cache.put(cacheKey, String(current + 1), RATE_WINDOW_SECONDS);
    return true;
  } catch (err) {
    return true;
  }
}

/**
 * True when `file` lives somewhere under the app's managed root folder (FOLDER_ID).
 *
 * DriveApp resolves ANY file id the executing account can reach — the web app runs as the
 * Drive owner, so that includes their entire personal Drive, not just the CubeSat folder.
 * Every mutating operation must therefore prove containment before touching a file.
 * Walks parents breadth-first (Drive allows multiple parents) with a depth guard.
 */
function isInsideManagedFolder_(file) {
  const visited = {};
  const queue = [];
  const parents = file.getParents();
  while (parents.hasNext()) queue.push(parents.next());

  let steps = 0;
  while (queue.length > 0 && steps < MAX_PARENT_WALK) {
    steps++;
    const folder = queue.shift();
    const id = folder.getId();
    if (id === FOLDER_ID) return true;
    if (visited[id]) continue;
    visited[id] = true;
    const up = folder.getParents();
    while (up.hasNext()) queue.push(up.next());
  }
  return false;
}

function handleChat(params) {
  if (!params.model || !params.contents) {
    throw new Error('missing model or contents');
  }

  // Authenticate the caller with a verified Firebase ID token. Chat ALWAYS requires a
  // valid institutional token — there is intentionally no fallback to the client-supplied
  // email here (unlike upload/delete, which keep a transitional fallback for older clients).
  // Rationale: the shared secret is distributed to every signed-in member through Firestore
  // (system_config/keys) and is fetched into the browser, so it cannot on its own protect
  // the server-side Gemini API key. Without this check, anyone who reads the bundle/secret
  // could use the team's Gemini key as a free, unrestricted LLM proxy (arbitrary
  // systemInstruction/contents), bypassing the "solo Cubesat" guardrail and burning quota.
  const callerEmail = verifyIdToken_(params.idToken);
  if (!callerEmail) {
    throw new Error('valid Firebase ID token required for chat');
  }

  // Rate limit per verified email. A valid institutional token proves *who* the caller is but
  // not that their usage is bounded; without this a single member could exhaust the team's
  // paid Gemini quota or run the key as an unmetered LLM. Keyed by email so it survives across
  // browser sessions/devices for the same person.
  if (!withinRateLimit_('chat', callerEmail, CHAT_RATE_MAX_PER_WINDOW)) {
    return { error: 'rate limit exceeded: too many chat requests, retry in a minute' };
  }

  // Bound the request payload. Gemini prices per token, so an attacker-controlled giant
  // `contents` array is a cost-amplification vector even under the rate limit.
  const contentsSize = JSON.stringify(params.contents || '').length;
  if (contentsSize > CHAT_MAX_CONTENTS_CHARS) {
    return { error: 'payload too large' };
  }

  // Validate model against allowlist to prevent path injection / unintended API access
  const modelName = String(params.model);
  if (!ALLOWED_MODELS.includes(modelName)) {
    throw new Error('model not allowed: ' + modelName);
  }

  // Retrieve API Key securely from Script Properties
  const apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_AI_KEY');
  if (!apiKey) {
    throw new Error('Google AI API Key not configured in Apps Script properties.');
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + apiKey;

  const payload = {
    contents: params.contents
  };

  if (params.systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: params.systemInstruction }]
    };
  }

  if (params.tools) {
    payload.tools = params.tools;
  }

  if (params.generationConfig) {
    payload.generationConfig = params.generationConfig;
  }

  // Clamp maxOutputTokens server-side regardless of what the client requested, so the proxy
  // cannot be steered into generating (and billing for) unbounded output.
  payload.generationConfig = payload.generationConfig || {};
  if (!payload.generationConfig.maxOutputTokens ||
      payload.generationConfig.maxOutputTokens > CHAT_MAX_OUTPUT_TOKENS) {
    payload.generationConfig.maxOutputTokens = CHAT_MAX_OUTPUT_TOKENS;
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    return {
      error: 'Gemini API returned status ' + responseCode,
      details: responseText
    };
  }

  return JSON.parse(responseText);
}

