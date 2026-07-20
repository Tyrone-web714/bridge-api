import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { getDriverTenantContext } from './driverSession';
import { normalizeImageAsset } from './mobileMediaSelection';
import {
  cleanTenantValue,
  isTrustedTenantContext,
  operationMatchesTenant,
  safeStoragePart,
  tenantScopedStorageKey,
} from './tenantContext';

const NOTE_COMPOSER_PREFIX = '@truck-safe-routing/note-composer/v1';
const NOTE_COMPOSER_DIRECTORY = new Directory(Paths.document, 'note-composer-drafts');
const NOTE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const PHOTO_UPLOAD_PENDING = 'PENDING';
const PHOTO_UPLOAD_UPLOADING = 'UPLOADING';
const PHOTO_UPLOAD_FAILED = 'FAILED';

function requireIdentity() {
  const identity = getDriverTenantContext();
  if (!isTrustedTenantContext(identity)) {
    throw new Error('A trusted driver Organization context is required before saving note photos.');
  }
  return identity;
}

function nowIso() {
  return new Date().toISOString();
}

function safeUriScheme(uri) {
  return String(uri || '').split(':')[0] || 'unknown';
}

function ensureDirectory(directory) {
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
}

function fileSize(file) {
  const size = Number(file?.size);
  return Number.isFinite(size) ? size : null;
}

function safeExtension(asset = {}) {
  const fileName = String(asset.fileName || asset.uri || '').toLowerCase();
  const match = fileName.match(/(\.[a-z0-9]{2,5})(?:\?.*)?$/i);
  if (match) return match[1].toLowerCase();
  if (asset.mimeType === 'image/png') return '.png';
  if (asset.mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function createNoteDraftId(context = {}) {
  return [
    'note-draft',
    context.routeManifestId,
    context.routeStopId,
    context.accountNumber,
    context.destinationPlaceId,
    Date.now(),
    Math.random().toString(16).slice(2, 10),
  ].map((part) => safeStoragePart(part, 'none')).join('-');
}

function normalizeDraftContext(context = {}) {
  return {
    source: cleanTenantValue(context.source),
    returnRoute: cleanTenantValue(context.returnRoute),
    returnParams: context.returnParams || null,
    accountId: cleanTenantValue(context.accountId),
    accountNumber: cleanTenantValue(context.accountNumber),
    accountName: cleanTenantValue(context.accountName || context.destinationDetails?.name),
    destinationAddress: cleanTenantValue(context.destinationAddress),
    destinationPlaceId: cleanTenantValue(context.destinationPlaceId),
    routeManifestId: cleanTenantValue(context.routeManifestId),
    routeStopId: cleanTenantValue(context.routeStopId),
    routeDate: cleanTenantValue(context.routeDate),
    routeNumber: cleanTenantValue(context.routeNumber),
    driverId: cleanTenantValue(context.driverId),
    driverName: cleanTenantValue(context.driverName),
    destinationDetails: context.destinationDetails || null,
    routeParams: context,
  };
}

function noteDraftContextKey(context = {}) {
  return [
    context.routeManifestId,
    context.routeStopId,
    context.routeDate,
    context.routeNumber,
    context.accountNumber,
    context.destinationPlaceId,
    context.destinationAddress,
    context.source,
  ].map((part) => safeStoragePart(part, 'none')).join('-');
}

function draftKey(identity, context = {}) {
  return tenantScopedStorageKey(NOTE_COMPOSER_PREFIX, identity, 'draft', noteDraftContextKey(context));
}

function isFresh(record = {}) {
  const updatedAt = Date.parse(record.updatedAt || record.createdAt || '');
  return Number.isFinite(updatedAt) && Date.now() - updatedAt <= NOTE_DRAFT_TTL_MS;
}

async function readJson(key, fallback) {
  try {
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function draftDirectory(identity, noteDraftId) {
  const orgDirectory = new Directory(NOTE_COMPOSER_DIRECTORY, safeStoragePart(identity.organizationId));
  const driverDirectory = new Directory(orgDirectory, safeStoragePart(identity.internalDriverId));
  const noteDirectory = new Directory(driverDirectory, safeStoragePart(noteDraftId));
  ensureDirectory(NOTE_COMPOSER_DIRECTORY);
  ensureDirectory(orgDirectory);
  ensureDirectory(driverDirectory);
  ensureDirectory(noteDirectory);
  return noteDirectory;
}

function assertReadableSource(asset = {}) {
  const uri = asset.localUri || asset.uri;
  if (!uri) throw new Error('The selected photo has no readable file.');
  const source = new File(uri);
  if (!source.exists) {
    throw new Error('Selected photo is no longer available. Retake or choose the photo again.');
  }
  if (fileSize(source) === 0) {
    throw new Error('Selected photo is empty. Retake or choose the photo again.');
  }
  return source;
}

function isComposerControlledPhoto(asset = {}) {
  const localUri = asset.stableLocalUri || asset.localUri || asset.uri;
  return Boolean(localUri && String(localUri).startsWith(Paths.document.uri));
}

function deleteDraftPhotoFiles(photos = []) {
  for (const photo of photos) {
    const localUri = photo?.stableLocalUri || photo?.localUri || photo?.uri;
    if (!localUri || !String(localUri).startsWith(Paths.document.uri)) continue;
    try {
      const file = new File(localUri);
      if (file.exists) file.delete();
    } catch {
      // Draft cleanup must not block save or explicit discard.
    }
  }
}

export async function loadOrCreateNoteDraft(context = {}) {
  const identity = requireIdentity();
  const normalizedContext = normalizeDraftContext(context);
  const key = draftKey(identity, normalizedContext);
  const existing = await readJson(key, null);
  if (existing && operationMatchesTenant(existing, identity) && isFresh(existing)) {
    return existing;
  }

  const noteDraftId = createNoteDraftId(normalizedContext);
  const draft = {
    key,
    noteDraftId,
    organizationId: identity.organizationId,
    internalDriverId: identity.internalDriverId,
    companyDriverNumber: identity.companyDriverNumber,
    context: normalizedContext,
    text: {
      accountName: cleanTenantValue(context.accountName || context.destinationDetails?.name),
      customerName: '',
      driverName: cleanTenantValue(context.driverName),
      instructions: '',
    },
    photos: [],
    status: 'draft',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await writeJson(key, draft);
  return draft;
}

export async function readNoteDraft(context = {}) {
  const identity = requireIdentity();
  const normalizedContext = normalizeDraftContext(context);
  const draft = await readJson(draftKey(identity, normalizedContext), null);
  if (!draft || !operationMatchesTenant(draft, identity) || !isFresh(draft)) return null;
  return draft;
}

export async function saveNoteDraftText(context = {}, text = {}) {
  const draft = await loadOrCreateNoteDraft(context);
  const next = {
    ...draft,
    text: {
      ...draft.text,
      accountName: cleanTenantValue(text.accountName),
      customerName: cleanTenantValue(text.customerName),
      driverName: cleanTenantValue(text.driverName),
      instructions: String(text.instructions || ''),
    },
    updatedAt: nowIso(),
  };
  await writeJson(next.key, next);
  return next;
}

export async function attachPhotoToNoteDraft(context = {}, asset = {}, source = 'camera') {
  const identity = requireIdentity();
  const draft = await loadOrCreateNoteDraft(context);
  const normalized = normalizeImageAsset(asset, source);
  const sourceFile = assertReadableSource(normalized);
  const localPhotoId = normalized.localPhotoId || `note-photo-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const extension = safeExtension(normalized);
  let stableFile;
  if (isComposerControlledPhoto(normalized)) {
    stableFile = new File(normalized.stableLocalUri || normalized.localUri || normalized.uri);
  } else {
    stableFile = new File(draftDirectory(identity, draft.noteDraftId), `${safeStoragePart(localPhotoId)}${extension}`);
    sourceFile.copy(stableFile);
  }
  if (!stableFile.exists || fileSize(stableFile) === 0) {
    throw new Error('Captured photo could not be stored in Truck-Safe Routing. Retake the photo before saving.');
  }
  const photo = {
    localPhotoId,
    clientPhotoId: normalized.clientPhotoId || localPhotoId,
    uri: stableFile.uri,
    localUri: stableFile.uri,
    stableLocalUri: stableFile.uri,
    mimeType: normalized.mimeType || 'image/jpeg',
    fileName: normalized.fileName || stableFile.name,
    mediaSource: source,
    uploadStatus: PHOTO_UPLOAD_PENDING,
    sizeBytes: fileSize(stableFile),
    sourceUriScheme: safeUriScheme(normalized.uri),
    createdAt: nowIso(),
  };
  const existingPhotos = Array.isArray(draft.photos) ? draft.photos : [];
  const next = {
    ...draft,
    photos: [...existingPhotos, photo].slice(0, 4),
    status: 'draft',
    updatedAt: nowIso(),
  };
  await writeJson(next.key, next);
  return next;
}

export async function removePhotoFromNoteDraft(context = {}, localPhotoId) {
  const draft = await loadOrCreateNoteDraft(context);
  const removed = (draft.photos || []).filter((photo) => photo.localPhotoId === localPhotoId);
  const next = {
    ...draft,
    photos: (draft.photos || []).filter((photo) => photo.localPhotoId !== localPhotoId),
    updatedAt: nowIso(),
  };
  await writeJson(next.key, next);
  deleteDraftPhotoFiles(removed);
  return next;
}

export async function markNoteDraftSaving(context = {}) {
  const draft = await loadOrCreateNoteDraft(context);
  const next = {
    ...draft,
    photos: (draft.photos || []).map((photo) => ({
      ...photo,
      uploadStatus: photo.uploadStatus === PHOTO_UPLOAD_PENDING ? PHOTO_UPLOAD_UPLOADING : photo.uploadStatus,
    })),
    status: 'SAVING',
    updatedAt: nowIso(),
  };
  await writeJson(next.key, next);
  return next;
}

export async function markNoteDraftError(context = {}) {
  const draft = await loadOrCreateNoteDraft(context);
  const next = {
    ...draft,
    photos: (draft.photos || []).map((photo) => ({
      ...photo,
      uploadStatus: photo.uploadStatus === PHOTO_UPLOAD_UPLOADING ? PHOTO_UPLOAD_FAILED : photo.uploadStatus,
    })),
    status: 'ERROR',
    updatedAt: nowIso(),
  };
  await writeJson(next.key, next);
  return next;
}

export async function clearNoteDraft(context = {}) {
  const identity = requireIdentity();
  const normalizedContext = normalizeDraftContext(context);
  const key = draftKey(identity, normalizedContext);
  const draft = await readJson(key, null);
  await AsyncStorage.removeItem(key);
  if (draft && operationMatchesTenant(draft, identity)) {
    deleteDraftPhotoFiles(draft.photos || []);
  }
}
