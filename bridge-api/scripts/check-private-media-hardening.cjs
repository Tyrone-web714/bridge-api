const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const photoStorage = read('services/photoStorage.js');
const mediaRoute = read('routes/media.js');
const deliveryNotes = read('routes/deliveryNotes.js');
const server = read('server.js');
const repositories = read('db/repositories.js');
const sharedSafety = read('services/sharedSafety.js');
const lifecycleMigration = read('migrations/009_data_lifecycle_foundation.sql');

assert(photoStorage.includes("mediaClassification: 'ORGANIZATION_PRIVATE'"), 'new S3 media must be classified organization-private');
assert(photoStorage.includes('accessPath'), 'new S3 media must expose controlled access path');
assert(photoStorage.includes('legacyPublicUrl'), 'legacy public URL must be retained as compatibility metadata');
assert(photoStorage.includes('getPrivateMediaUrl(req, id)'), 'new private media URL must not be direct R2 public URL when request context is available');
assert(photoStorage.includes('GetObjectCommand'), 'private media route must be able to read exact S3 object');
assert(photoStorage.includes('readS3Object'), 'photo storage must expose controlled object read helper');

assert(server.includes("const mediaRoutes = require('./routes/media')"), 'server must mount authenticated media route');
assert(server.includes("app.use('/api/media', mediaRoutes)"), 'server must mount /api/media');
assert(mediaRoute.includes("router.get('/:mediaId', authorization.requireAuthentication"), 'media route must require authentication');
assert(mediaRoute.includes('canViewMedia'), 'media route must check permissions');
assert(mediaRoute.includes('repositories.listDeliveryNotes({ tenantContext: context })'), 'media route must load media through tenant-scoped repository query');
assert(mediaRoute.includes('media.storageKey.includes'), 'media route must reject unsafe object keys');
assert(mediaRoute.includes('object.Body.pipe(res)'), 'media route must stream object through the application');
assert(!mediaRoute.includes('req.query.storageKey'), 'media route must not accept arbitrary object key input');
assert(!mediaRoute.includes('req.query.organization'), 'media route must not accept client-supplied organization scope');

assert(repositories.includes('organizationId: row.organization_id'), 'delivery notes must expose organization ownership');
assert(repositories.includes('routeStopId: raw.routeStopId'), 'delivery note responses must hydrate route-stop identity from persisted raw metadata');
assert(repositories.includes('internalDriverId: raw.internalDriverId'), 'delivery note responses must hydrate internal driver identity from persisted raw metadata');
assert(repositories.includes('organization_id = EXCLUDED.organization_id'), 'delivery note upsert must preserve organization ownership');
assert(repositories.includes('upsertDeliveryNoteMediaLifecycleReferences'), 'new private delivery-note media must register lifecycle object references');
assert(repositories.includes('lifecycle_object_references'), 'delivery-note media lifecycle registration must target ODR-019 object references');
assert(repositories.includes("'delivery_note_photo'"), 'delivery-note media lifecycle registration must classify object kind');
assert(repositories.includes('legal_hold_eligible'), 'delivery-note media lifecycle registration must keep legal-hold eligibility');
assert(deliveryNotes.includes('photoStorage.normalizeExistingPhotoUrl'), 'legacy media compatibility path must normalize URLs');
assert(deliveryNotes.includes('legacyPublicUrl'), 'delivery note normalization must retain legacy URL metadata');
assert(deliveryNotes.includes('routeStopId') && deliveryNotes.includes('routeManifestId'), 'delivery note route must save route/run/stop metadata');
assert(deliveryNotes.includes('internalDriverId') && deliveryNotes.includes('companyDriverNumber'), 'delivery note route must save authenticated driver identity metadata');
assert(deliveryNotes.includes('recordRouteStopId') && deliveryNotes.includes('return false'), 'delivery note filtering must avoid returning other stop-scoped notes for a mismatched stop');
assert(sharedSafety.includes('sanitizeSharedMedia'), 'shared safety media must remain sanitized before publication');
assert(sharedSafety.includes('UNSANITIZED_SHARED_MEDIA'), 'shared safety media must reject private operational references before publication');
assert(lifecycleMigration.includes('lifecycle_object_references'), 'ODR-019 object lifecycle reference table must remain available');

console.log('[test:private-media] authenticated private media contracts verified.');
