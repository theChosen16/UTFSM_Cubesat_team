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
const ALLOWED_EMAIL_PATTERN = /@(sansano\.)?usm\.cl$/i;
const MAX_FILE_BYTES = 35 * 1024 * 1024;

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

function handleUpload(params) {
  if (!params.fileBase64 || !params.fileName) {
    throw new Error('missing fileBase64 or fileName');
  }

  const root = DriveApp.getFolderById(FOLDER_ID);
  const target = resolveTargetFolder(root, params);

  const decoded = Utilities.base64Decode(params.fileBase64);
  if (decoded.length > MAX_FILE_BYTES) {
    throw new Error('file exceeds 35 MB limit');
  }

  const blob = Utilities.newBlob(decoded, params.mimeType || 'application/octet-stream', params.fileName);
  const file = target.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  if (params.deliverableId) file.setDescription('deliverable:' + params.deliverableId);

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
  file.setTrashed(true);
  return { ok: true };
}
