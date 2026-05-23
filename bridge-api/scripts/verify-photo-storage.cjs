require('dotenv').config();

const photoStorage = require('../services/photoStorage');

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

function buildLocalRequestStub() {
  const publicUrl = String(
    process.env.BACKEND_PUBLIC_URL ||
    process.env.PUBLIC_API_BASE_URL ||
    `http://127.0.0.1:${process.env.PORT || 5000}`
  ).replace(/\/+$/, '');
  const parsed = new URL(publicUrl);

  return {
    protocol: parsed.protocol.replace(':', ''),
    get(header) {
      return String(header || '').toLowerCase() === 'host' ? parsed.host : '';
    }
  };
}

async function main() {
  const status = photoStorage.getStorageStatus();
  console.log(`[photos] provider=${status.provider}`);
  console.log(`[photos] configured=${status.configured}`);
  console.log(`[photos] durable=${status.durable}`);

  if (status.issues?.length) {
    for (const issue of status.issues) {
      console.log(`[photos] issue=${issue}`);
    }
  }

  if (!status.configured) {
    throw new Error('Photo storage is not configured.');
  }

  const photo = await photoStorage.saveDeliveryNotePhoto({
    req: buildLocalRequestStub(),
    buffer: TINY_PNG,
    mimeType: 'image/png',
    noteId: 'storage-verification',
    index: 1,
    originalName: 'storage-verification.png'
  });

  console.log(`[photos] uploaded=${photo.storageProvider}:${photo.storageKey}`);
  console.log(`[photos] url=${photo.url}`);

  await photoStorage.deleteDeliveryNotePhotos([photo]);
  console.log('[photos] cleanup=deleted test object');
  console.log('[photos] storage verification passed.');
}

main().catch((error) => {
  console.error(`[photos] storage verification failed: ${error.message}`);
  process.exitCode = 1;
});
