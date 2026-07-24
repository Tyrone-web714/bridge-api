const assert = require('assert');
const Module = require('module');

const sentCommands = [];
const originalLoad = Module._load;

class MockPutObjectCommand {
  constructor(input) {
    this.input = input;
    this.kind = 'PutObjectCommand';
  }
}

class MockGetObjectCommand {
  constructor(input) {
    this.input = input;
    this.kind = 'GetObjectCommand';
  }
}

class MockDeleteObjectCommand {
  constructor(input) {
    this.input = input;
    this.kind = 'DeleteObjectCommand';
  }
}

class MockS3Client {
  async send(command) {
    sentCommands.push(command);
    return { ok: true, Body: { pipe() {} } };
  }
}

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@aws-sdk/client-s3') {
    return {
      DeleteObjectCommand: MockDeleteObjectCommand,
      GetObjectCommand: MockGetObjectCommand,
      PutObjectCommand: MockPutObjectCommand,
      S3Client: MockS3Client
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

process.env.PHOTO_STORAGE_PROVIDER = 's3';
process.env.PHOTO_STORAGE_BUCKET = 'private-media-test-bucket';
process.env.PHOTO_STORAGE_REGION = 'auto';
delete process.env.PHOTO_STORAGE_PUBLIC_BASE_URL;

const photoStorage = require('../services/photoStorage');

function requestStub() {
  return {
    protocol: 'https',
    get(header) {
      return String(header || '').toLowerCase() === 'host' ? 'truck-safe-routing-api.test' : '';
    }
  };
}

async function main() {
  const validation = photoStorage.validateStorageConfig();
  assert.strictEqual(validation.configured, true, 'private S3 storage must configure without PHOTO_STORAGE_PUBLIC_BASE_URL');
  assert.deepStrictEqual(validation.issues, [], 'private S3 storage must not report public base URL issues');

  const saved = await photoStorage.saveDeliveryNotePhoto({
    req: requestStub(),
    buffer: Buffer.from('private-media-fixture'),
    mimeType: 'image/jpeg',
    noteId: 'private-r2-shutdown-fixture',
    index: 1,
    originalName: 'fixture.jpg'
  });

  assert.strictEqual(saved.storageProvider, 's3', 'saved media must use s3 provider');
  assert(saved.storageKey, 'saved media must persist storage key');
  assert.strictEqual(saved.mediaClassification, 'ORGANIZATION_PRIVATE', 'saved media must remain organization-private');
  assert(saved.accessPath.startsWith('/api/media/'), 'saved media must expose authenticated access path');
  assert(saved.url.includes('/api/media/'), 'saved media primary URL must use authenticated media route');
  assert(!Object.prototype.hasOwnProperty.call(saved, 'legacyPublicUrl'), 'new private media must not include legacyPublicUrl');
  assert(!String(saved.url).includes('r2.dev'), 'new private media primary URL must not be an r2.dev URL');

  const put = sentCommands.find((command) => command.kind === 'PutObjectCommand');
  assert(put, 'save must issue a PutObjectCommand');
  assert.strictEqual(put.input.Bucket, 'private-media-test-bucket', 'put must target configured bucket');
  assert.strictEqual(put.input.CacheControl, 'private, max-age=0, no-store', 'private media must not use public immutable cache control');

  await photoStorage.readS3Object(saved);
  const get = sentCommands.find((command) => command.kind === 'GetObjectCommand');
  assert(get, 'authenticated media read must issue a GetObjectCommand');
  assert.strictEqual(get.input.Key, saved.storageKey, 'authenticated media read must use the stored object key');

  console.log('[test:private-r2-shutdown] private media upload without public URL metadata verified.');
}

main().catch((error) => {
  console.error('[test:private-r2-shutdown] failed:', error.message);
  process.exitCode = 1;
});
