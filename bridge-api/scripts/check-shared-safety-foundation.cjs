const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[shared-safety] ${message}`);
  }
}

function assertContains(text, pattern, message) {
  assert(text.includes(pattern), `${message}: missing "${pattern}"`);
}

const migration = read('migrations/005_shared_safety_foundation.sql');
const service = read('services/sharedSafety.js');
const routes = read('routes/sharedSafety.js');
const routing = read('routes/routing.js');
const rbac = read('services/rbac.js');
const authorization = read('middleware/authorization.js');
const server = read('server.js');
const docs = fs.existsSync(path.join(root, '..', 'docs', 'implementation', 'shared-safety-foundation', 'README.md'))
  ? read('../docs/implementation/shared-safety-foundation/README.md')
  : '';

[
  'private_hazard_submissions',
  'shared_safety_moderation_candidates',
  'shared_safety_records',
  'shared_safety_publication_sources'
].forEach((table) => assertContains(migration, table, 'Migration table'));

[
  'hazard.submit',
  'hazard.view.organization',
  'hazard.review.organization',
  'shared_safety.review',
  'shared_safety.approve',
  'shared_safety.reject',
  'shared_safety.publish',
  'shared_safety.retire'
].forEach((permission) => {
  assertContains(rbac, permission, 'RBAC permission');
  assertContains(migration, permission, 'Migration permission seed');
});

assertContains(routes, "authorization.requirePermission(rbac.PERMISSIONS.HAZARD_SUBMIT)", 'Private submission permission gate');
assertContains(routes, "authorization.requirePlatformAdmin", 'Platform Admin moderation gate');
assertContains(routes, "sharedSafety.sanitizeCandidate", 'Sanitization route');
assertContains(routes, "sharedSafety.approveCandidate", 'Approval route');
assertContains(routes, "sharedSafety.rejectCandidate", 'Rejection route');
assertContains(routes, "sharedSafety.markDuplicate", 'Duplicate route');
assertContains(routes, "sharedSafety.retireSharedRecord", 'Retirement route');
assertContains(routes, "router.get('/records'", 'Platform-global shared read path');
assertContains(server, "app.use('/api/shared-safety'", 'Shared Safety route mounted');
assertContains(server, "RATE_LIMIT_SHARED_SAFETY_MAX", 'Shared Safety rate limiter');

assertContains(service, 'assertSanitizedDescription', 'Sanitization guard');
assertContains(service, 'UNSANITIZED_PRIVATE_REFERENCE', 'Unsanitizable content guard');
assertContains(service, 'sanitizeSharedMedia', 'Shared media sanitization guard');
assertContains(service, 'UNSANITIZED_SHARED_MEDIA', 'Private shared media guard');
assertContains(service, "review_status !== 'pending_review' || candidate.sanitization_status !== 'sanitized'", 'Approval requires sanitization');
assertContains(service, 'shared_safety_publication_sources', 'Private source linkage kept out of shared record');
assertContains(service, 'source_organization_id', 'Private source organization retained for audit linkage');
assertContains(service, 'SELECT id, hazard_type, latitude, longitude, geometry, severity, verification_status', 'Shared read projection');
assert(!/SELECT \*/.test(service.match(/async function listSharedRecords[\s\S]*?return result\.rows\.map/)?.[0] || ''), 'Shared read must not SELECT *');
assert(!(service.match(/function sharedRecordFromRow[\s\S]*?}\n/)?.[0] || '').includes('sourceOrganizationId'), 'Shared record response must not expose source organization');
assert(!(service.match(/function sharedRecordFromRow[\s\S]*?}\n/)?.[0] || '').includes('metadata'), 'Shared record response must not expose publication metadata');

assertContains(authorization, "path.startsWith('/api/shared-safety/moderation')", 'Moderation authorization classification');
assertContains(authorization, "path.includes('/nominate')", 'Nomination authorization classification');
assertContains(authorization, "path.startsWith('/api/routing/manual-hazards/report')", 'Legacy mobile hazard report remains submit-classified');
assertContains(authorization, 'platformScoped', 'Platform scoped moderation policy');

assertContains(routing, 'createPrivateSubmissionFromDriverReport', 'Legacy mobile hazard submission mirror');
assertContains(routing, 'message: \'Hazard report saved as pending. It will not affect routing until confirmed.\'', 'Legacy mobile response preserved');

[
  'hazard_submission',
  'nomination_for_moderation',
  'moderation_opened',
  'sanitization_completed',
  'shared_safety_approval',
  'shared_safety_publish',
  'shared_safety_rejection',
  'shared_safety_duplicate_decision',
  'shared_safety_retire',
  'unauthorized_moderation_attempt',
  'cross_tenant_access_denial'
].forEach((eventType) => assertContains(routes, eventType, 'Audit event'));

assert(docs.includes('The platform shares knowledge, not customer operations.') || docs.length === 0, 'Shared Safety documentation principle');

console.log('[shared-safety] foundation checks passed');
