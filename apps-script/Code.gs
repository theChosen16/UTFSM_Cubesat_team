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
// derived from it, ignoring any client-supplied userEmail. Leave false until the updated
// web client (which sends params.idToken) is fully deployed, then flip to true to fully
// close file impersonation. While false, a valid token is still preferred when present.
const REQUIRE_ID_TOKEN = false;

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
  if (!params.fileBase64 || !params.fileName) {
    throw new Error('missing fileBase64 or fileName');
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

  // Store the trusted uploader email (from the verified ID token when available) plus the
  // deliverableId in the description, for ownership verification on delete.
  const uploaderEmail = resolveTrustedEmail_(params);
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
  const file = DriveApp.getFileById(params.fileId);

  // Verify ownership: only the original uploader may delete via the bridge. The requester
  // email is derived from the verified Firebase ID token when available (spoof-resistant);
  // it falls back to the client-supplied email only while REQUIRE_ID_TOKEN is false.
  // Files uploaded before this check existed (no uploader tag) are allowed through for
  // backward compatibility.
  const description = file.getDescription() || '';
  const uploaderMatch = description.match(/uploader:([^;]+)/);
  if (uploaderMatch) {
    const uploaderEmail = uploaderMatch[1].trim().toLowerCase();
    const requesterEmail = resolveTrustedEmail_(params);
    if (uploaderEmail !== requesterEmail) {
      return { error: 'unauthorized: you can only delete files you uploaded' };
    }
  }

  file.setTrashed(true);
  return { ok: true };
}

function handleChat(params) {
  if (!params.model || !params.contents) {
    throw new Error('missing model or contents');
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

