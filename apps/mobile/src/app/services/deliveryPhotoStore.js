import { Directory, File, Paths } from 'expo-file-system';

const PHOTO_DIRECTORY = new Directory(Paths.document, 'delivery-note-photos');

function ensurePhotoDirectory() {
  if (!PHOTO_DIRECTORY.exists) {
    PHOTO_DIRECTORY.create({ intermediates: true, idempotent: true });
  }
}

function safeExtension(fileName, mimeType) {
  const match = String(fileName || '').match(/(\.[a-z0-9]{2,5})$/i);
  if (match) return match[1].toLowerCase();
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

export function persistDeliveryPhoto(asset = {}) {
  if (!asset.uri) throw new Error('The selected photo has no readable file.');
  ensurePhotoDirectory();

  const extension = safeExtension(asset.fileName, asset.mimeType);
  const destination = new File(
    PHOTO_DIRECTORY,
    `delivery-photo-${Date.now()}-${Math.random().toString(16).slice(2, 10)}${extension}`
  );
  new File(asset.uri).copy(destination);

  return {
    uri: destination.uri,
    localUri: destination.uri,
    mimeType: asset.mimeType || 'image/jpeg',
    fileName: asset.fileName || destination.name,
  };
}

export async function prepareDeliveryPhotoForUpload(photo = {}) {
  if (photo.base64) return photo;
  const localUri = photo.localUri || photo.uri;
  if (!localUri) return photo;

  const file = new File(localUri);
  if (!file.exists) {
    throw new Error(`Offline delivery photo is no longer available: ${photo.fileName || 'photo'}`);
  }

  return {
    base64: await file.base64(),
    mimeType: photo.mimeType || 'image/jpeg',
    fileName: photo.fileName || file.name,
  };
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
