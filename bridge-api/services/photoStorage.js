const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const LOCAL_PHOTO_DIR = path.resolve(process.env.PHOTO_STORAGE_LOCAL_DIR || path.join(__dirname, '..', 'data', 'delivery_note_photos'));
const SUPPORTED_PROVIDERS = new Set(['local', 's3']);

let s3Client = null;

function cleanText(value, maxLength = 200) {
  return String(value || '').trim().slice(0, maxLength);
}

function getProvider() {
  return cleanText(process.env.PHOTO_STORAGE_PROVIDER || 'local', 40).toLowerCase();
}

function validateStorageConfig() {
  const provider = getProvider();
  const issues = [];

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    issues.push(`PHOTO_STORAGE_PROVIDER must be one of: ${Array.from(SUPPORTED_PROVIDERS).join(', ')}`);
  }

  if (provider === 'local') {
    if (!LOCAL_PHOTO_DIR) {
      issues.push('PHOTO_STORAGE_LOCAL_DIR could not be resolved');
    }
  }

  if (provider === 's3') {
    if (!cleanText(process.env.PHOTO_STORAGE_BUCKET, 200)) {
      issues.push('PHOTO_STORAGE_BUCKET is required when PHOTO_STORAGE_PROVIDER=s3');
    }
    if (!cleanText(process.env.PHOTO_STORAGE_REGION || process.env.AWS_REGION, 120)) {
      issues.push('PHOTO_STORAGE_REGION or AWS_REGION is required when PHOTO_STORAGE_PROVIDER=s3');
    }
    const hasPartialCredentials =
      Boolean(process.env.PHOTO_STORAGE_ACCESS_KEY_ID) !==
      Boolean(process.env.PHOTO_STORAGE_SECRET_ACCESS_KEY);
    if (hasPartialCredentials) {
      issues.push('PHOTO_STORAGE_ACCESS_KEY_ID and PHOTO_STORAGE_SECRET_ACCESS_KEY must be set together');
    }
  }

  return {
    provider,
    configured: issues.length === 0,
    durable: provider === 's3',
    issues
  };
}

function getPublicBaseUrl(req) {
  const configured = cleanText(process.env.BACKEND_PUBLIC_URL || process.env.PUBLIC_API_BASE_URL, 500).replace(/\/+$/, '');
  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}`;
}

function getLocalPhotoUrl(req, filename) {
  return `${getPublicBaseUrl(req)}/api/delivery-notes/photos/${encodeURIComponent(filename)}`;
}

function getExtension(mimeType) {
  const normalized = cleanText(mimeType, 80).toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  return 'jpg';
}

function buildObjectKey({ noteId, index, extension, folder = 'delivery-notes' }) {
  const safeNoteId = cleanText(noteId, 80).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'delivery-note';
  const safeFolder = cleanText(folder, 80).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'delivery-notes';
  const suffix = crypto.randomBytes(6).toString('hex');
  return `${safeFolder}/${safeNoteId}/${Date.now()}-${index}-${suffix}.${extension}`;
}

function getS3Client() {
  if (s3Client) return s3Client;

  const region = process.env.PHOTO_STORAGE_REGION || process.env.AWS_REGION || 'us-east-1';
  const endpoint = cleanText(process.env.PHOTO_STORAGE_ENDPOINT, 500) || undefined;

  s3Client = new S3Client({
    region,
    endpoint,
    forcePathStyle: String(process.env.PHOTO_STORAGE_FORCE_PATH_STYLE || '').toLowerCase() === 'true',
    credentials: process.env.PHOTO_STORAGE_ACCESS_KEY_ID && process.env.PHOTO_STORAGE_SECRET_ACCESS_KEY
      ? {
        accessKeyId: process.env.PHOTO_STORAGE_ACCESS_KEY_ID,
        secretAccessKey: process.env.PHOTO_STORAGE_SECRET_ACCESS_KEY
      }
      : undefined
  });

  return s3Client;
}

function getS3Config() {
  const bucket = cleanText(process.env.PHOTO_STORAGE_BUCKET, 200);

  if (!bucket) {
    throw new Error('PHOTO_STORAGE_BUCKET is required when PHOTO_STORAGE_PROVIDER=s3');
  }

  return { bucket };
}

async function saveLocalPhoto({ req, buffer, mimeType, noteId, index, originalName, folder }) {
  const extension = getExtension(mimeType);
  const key = buildObjectKey({ noteId, index, extension, folder });
  const filename = key.replace(/[\\/]+/g, '__');
  const fullPath = path.join(LOCAL_PHOTO_DIR, filename);

  fs.mkdirSync(LOCAL_PHOTO_DIR, { recursive: true });
  await fs.promises.writeFile(fullPath, buffer);

  return {
    id: `${noteId}-photo-${index}-${crypto.randomBytes(4).toString('hex')}`,
    filename,
    storageProvider: 'local',
    storageKey: filename,
    mimeType,
    sizeBytes: buffer.length,
    originalName: cleanText(originalName, 180) || null,
    url: getLocalPhotoUrl(req, filename),
    uploadedAt: new Date().toISOString()
  };
}

async function saveS3Photo({ req, buffer, mimeType, noteId, index, originalName, folder }) {
  const { bucket } = getS3Config();
  const extension = getExtension(mimeType);
  const key = buildObjectKey({ noteId, index, extension, folder });
  const id = `${noteId}-photo-${index}-${crypto.randomBytes(4).toString('hex')}`;
  const accessPath = `/api/media/${encodeURIComponent(id)}`;

  await getS3Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    CacheControl: 'private, max-age=0, no-store'
  }));

  return {
    id,
    filename: path.basename(key),
    storageProvider: 's3',
    storageKey: key,
    bucket,
    mediaClassification: 'ORGANIZATION_PRIVATE',
    accessPath,
    mimeType,
    sizeBytes: buffer.length,
    originalName: cleanText(originalName, 180) || null,
    url: req ? getPrivateMediaUrl(req, id) : accessPath,
    uploadedAt: new Date().toISOString()
  };
}

async function saveDeliveryNotePhoto(input) {
  const validation = validateStorageConfig();
  if (!validation.configured) {
    throw new Error(`Photo storage is not configured: ${validation.issues.join('; ')}`);
  }

  const provider = getProvider();
  if (provider === 'local') return saveLocalPhoto(input);
  if (provider === 's3') return saveS3Photo(input);
  throw new Error(`Unsupported PHOTO_STORAGE_PROVIDER: ${provider}`);
}

async function saveHazardReportPhoto(input) {
  return saveDeliveryNotePhoto({
    ...input,
    folder: 'hazard-reports'
  });
}

async function deleteLocalPhoto(photo) {
  const filename = path.basename(cleanText(photo?.storageKey || photo?.filename, 220));
  if (!filename) return;

  const fullPath = path.join(LOCAL_PHOTO_DIR, filename);
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(LOCAL_PHOTO_DIR)) return;

  await fs.promises.rm(resolved, { force: true });
}

async function deleteS3Photo(photo) {
  const storageKey = cleanText(photo?.storageKey, 500);
  if (!storageKey) return;

  const { bucket } = getS3Config();
  await getS3Client().send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: storageKey
  }));
}

async function readS3Object(photo) {
  const storageKey = cleanText(photo?.storageKey, 500);
  if (!storageKey || storageKey.includes('..')) {
    const error = new Error('Invalid storage key.');
    error.status = 400;
    throw error;
  }

  const { bucket } = getS3Config();
  return getS3Client().send(new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey
  }));
}

function getPrivateMediaUrl(req, mediaId) {
  const id = cleanText(mediaId, 220);
  if (!id) return '';
  return `${getPublicBaseUrl(req)}/api/media/${encodeURIComponent(id)}`;
}

async function deleteDeliveryNotePhoto(photo) {
  const provider = cleanText(photo?.storageProvider || (photo?.storageKey ? getProvider() : 'local'), 40).toLowerCase();
  if (provider === 'local') return deleteLocalPhoto(photo);
  if (provider === 's3') return deleteS3Photo(photo);
}

async function deleteDeliveryNotePhotos(photos = []) {
  for (const photo of photos) {
    await deleteDeliveryNotePhoto(photo);
  }
}

function normalizeExistingPhotoUrl(req, photo) {
  const filename = path.basename(cleanText(photo?.filename, 220));
  const storageProvider = cleanText(photo?.storageProvider, 40).toLowerCase();
  const id = cleanText(photo?.id, 220);
  if (storageProvider === 's3' && id) return getPrivateMediaUrl(req, id);
  if (storageProvider === 'local' && filename) return getLocalPhotoUrl(req, filename);
  if (filename && !photo?.url) return getLocalPhotoUrl(req, filename);
  return cleanText(photo?.url, 1000);
}

function getLocalPhotoPath(filename) {
  const cleanFilename = path.basename(cleanText(filename, 220));
  if (!cleanFilename) return null;

  const fullPath = path.resolve(path.join(LOCAL_PHOTO_DIR, cleanFilename));
  if (!fullPath.startsWith(LOCAL_PHOTO_DIR)) return null;
  return fullPath;
}

function getStorageStatus() {
  const validation = validateStorageConfig();
  return {
    provider: validation.provider,
    configured: validation.configured,
    durable: validation.durable,
    issues: validation.issues,
    localPhotoDir: validation.provider === 'local' ? LOCAL_PHOTO_DIR : null,
    bucket: validation.provider === 's3' ? cleanText(process.env.PHOTO_STORAGE_BUCKET, 200) : null,
    publicBaseUrl: validation.provider === 's3'
      ? cleanText(process.env.PHOTO_STORAGE_PUBLIC_BASE_URL, 500).replace(/\/+$/, '')
      : null
  };
}

module.exports = {
  deleteDeliveryNotePhotos,
  getPrivateMediaUrl,
  getLocalPhotoPath,
  getProvider,
  getStorageStatus,
  normalizeExistingPhotoUrl,
  readS3Object,
  saveHazardReportPhoto,
  saveDeliveryNotePhoto,
  validateStorageConfig
};
