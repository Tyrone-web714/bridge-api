import { Directory, File, Paths } from 'expo-file-system';
import { getDriverTenantContext } from './driverSession';
import { isTrustedTenantContext, safeStoragePart } from './tenantContext';

const PHOTO_DIRECTORY = new Directory(Paths.document, 'delivery-note-photos');
const LOCAL_MEDIA_ERROR_CODE = 'LOCAL_MEDIA_UNREADABLE';

function createLocalMediaError(message, metadata = {}) {
  const error = new Error(message);
  error.code = LOCAL_MEDIA_ERROR_CODE;
  error.isLocalMediaError = true;
  error.photoMetadata = metadata;
  return error;
}

export function isLocalMediaUploadError(error) {
  return Boolean(error?.isLocalMediaError || error?.code === LOCAL_MEDIA_ERROR_CODE);
}

function ensureDirectory(directory) {
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
}

function currentTenantPhotoDirectory() {
  const identity = getDriverTenantContext();
  if (!isTrustedTenantContext(identity)) {
    throw new Error('A trusted driver Organization context is required before saving delivery photos offline.');
  }
  const organizationDirectory = new Directory(PHOTO_DIRECTORY, safeStoragePart(identity.organizationId));
  const driverDirectory = new Directory(organizationDirectory, safeStoragePart(identity.internalDriverId));
  ensureDirectory(PHOTO_DIRECTORY);
  ensureDirectory(organizationDirectory);
  ensureDirectory(driverDirectory);
  return driverDirectory;
}

function safeExtension(fileName, mimeType) {
  const match = String(fileName || '').match(/(\.[a-z0-9]{2,5})$/i);
  if (match) return match[1].toLowerCase();
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function safeUriScheme(uri) {
  return String(uri || '').split(':')[0] || 'unknown';
}

function fileSize(file) {
  const size = Number(file?.size);
  return Number.isFinite(size) ? size : null;
}

function assertReadableFile(file, label, source = {}) {
  if (!file?.exists) {
    throw createLocalMediaError(`${label} photo file is no longer available. Attach the photo again.`, {
      source: source.mediaSource || 'unknown',
      scheme: safeUriScheme(source.localUri || source.uri),
      fileName: source.fileName || file?.name || null,
    });
  }

  const size = fileSize(file);
  if (size === 0) {
    throw createLocalMediaError(`${label} photo file is empty. Attach the photo again.`, {
      source: source.mediaSource || 'unknown',
      scheme: safeUriScheme(source.localUri || source.uri),
      fileName: source.fileName || file?.name || null,
      sizeBytes: 0,
    });
  }
}

function isTsrControlledPhoto(asset = {}) {
  const localUri = asset.localUri || asset.uri;
  return Boolean(localUri && String(localUri).startsWith(Paths.document.uri));
}

export function photoSourceDiagnostics(asset = {}, stage = 'unknown') {
  const localUri = asset.localUri || asset.uri;
  let exists = false;
  let sizeBytes = Number.isFinite(Number(asset.sizeBytes)) ? Number(asset.sizeBytes) : null;
  try {
    if (localUri) {
      const file = new File(localUri);
      exists = Boolean(file.exists);
      sizeBytes = fileSize(file);
    }
  } catch {
    exists = false;
  }
  return {
    source: asset.mediaSource || 'unknown',
    exists,
    sizeBytes,
    mimeType: asset.mimeType || 'image/jpeg',
    stage,
  };
}

export function persistDeliveryPhoto(asset = {}) {
  if (!asset.uri) throw new Error('The selected photo has no readable file.');
  const directory = currentTenantPhotoDirectory();
  if (isTsrControlledPhoto(asset)) {
    const stableFile = new File(asset.localUri || asset.uri);
    assertReadableFile(stableFile, 'Stored delivery', asset);
    return {
      ...asset,
      clientPhotoId: asset.clientPhotoId || `client-photo-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
      uri: stableFile.uri,
      localUri: stableFile.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      fileName: asset.fileName || stableFile.name,
      mediaSource: asset.mediaSource || 'unknown',
      sizeBytes: fileSize(stableFile),
      sourceUriScheme: asset.sourceUriScheme || safeUriScheme(stableFile.uri),
      photoDiagnostics: photoSourceDiagnostics({ ...asset, uri: stableFile.uri, localUri: stableFile.uri }, 'stable-copy-verified'),
    };
  }
  const source = new File(asset.uri);
  assertReadableFile(source, 'Selected delivery', asset);

  const extension = safeExtension(asset.fileName, asset.mimeType);
  const destination = new File(
    directory,
    `delivery-photo-${Date.now()}-${Math.random().toString(16).slice(2, 10)}${extension}`
  );
  try {
    source.copy(destination);
  } catch (error) {
    throw createLocalMediaError('Selected photo could not be copied into Truck-Safe storage. Attach the photo again.', {
      source: asset.mediaSource || 'unknown',
      scheme: safeUriScheme(asset.uri),
      fileName: asset.fileName || null,
      cause: error.message || null,
    });
  }
  assertReadableFile(destination, 'Stored delivery', {
    ...asset,
    uri: destination.uri,
    localUri: destination.uri,
  });

  return {
    clientPhotoId: asset.clientPhotoId || `client-photo-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    uri: destination.uri,
    localUri: destination.uri,
    mimeType: asset.mimeType || 'image/jpeg',
    fileName: asset.fileName || destination.name,
    mediaSource: asset.mediaSource || 'unknown',
    sizeBytes: fileSize(destination),
    sourceUriScheme: safeUriScheme(asset.uri),
    photoDiagnostics: photoSourceDiagnostics({ ...asset, uri: destination.uri, localUri: destination.uri }, 'stable-copy-created'),
  };
}

export async function prepareDeliveryPhotoForUpload(photo = {}) {
  if (photo.base64) return photo;
  const localUri = photo.localUri || photo.uri;
  if (!localUri) return photo;

  const file = new File(localUri);
  assertReadableFile(file, 'Stored delivery', photo);

  try {
    return {
      base64: await file.base64(),
      clientPhotoId: photo.clientPhotoId || null,
      mimeType: photo.mimeType || 'image/jpeg',
      fileName: photo.fileName || file.name,
      mediaSource: photo.mediaSource || 'unknown',
      sourceUriScheme: photo.sourceUriScheme || safeUriScheme(localUri),
      sizeBytes: fileSize(file),
    };
  } catch (error) {
    throw createLocalMediaError('Stored delivery photo could not be read for upload. Attach the photo again.', {
      source: photo.mediaSource || 'unknown',
      scheme: safeUriScheme(localUri),
      fileName: photo.fileName || file.name || null,
      cause: error.message || null,
    });
  }
}

export function deleteLocalDeliveryPhotos(photos = []) {
  for (const photo of photos) {
    const localUri = photo?.localUri || photo?.uri;
    if (!localUri || !String(localUri).startsWith(Paths.document.uri)) continue;
    try {
      const file = new File(localUri);
      if (file.exists) file.delete();
    } catch {
      // A stale local file must not block note synchronization or deletion.
    }
  }
}
