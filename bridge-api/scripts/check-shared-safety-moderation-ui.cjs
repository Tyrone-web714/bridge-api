const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(`[shared-safety-ui] ${message}`);
}

function assertContains(text, pattern, message) {
  assert(text.includes(pattern), `${message}: missing "${pattern}"`);
}

const routes = read('routes/sharedSafety.js');
const service = read('services/sharedSafety.js');
const dashboard = read('routes/adminDashboard.js');
const auditLog = read('services/auditLog.js');

assertContains(routes, "router.get('/admin'", 'Moderation queue page route');
assertContains(routes, "router.get('/admin/candidates/:id'", 'Candidate detail page route');
assertContains(routes, 'requirePlatformAdminPage', 'Platform Admin page enforcement');
assertContains(routes, 'csrfTokenForSession', 'CSRF token generation');
assertContains(routes, 'requireCsrf', 'CSRF action guard');
assertContains(routes, 'PRIVATE SOURCE', 'Private source section');
assertContains(routes, 'Sanitized Shared Record Preview', 'Sanitized preview section');
assertContains(routes, 'filterSourceOrg', 'Source Organization filter');
assertContains(routes, 'filterSubmittedFrom', 'Submitted date filter');
assertContains(routes, 'filterSeverity', 'Severity filter');
assertContains(routes, 'Map Preview', 'Map preview section');
assertContains(routes, 'Audit Trail', 'Audit trail section');
assertContains(routes, '/correction', 'Correction endpoint');
assertContains(routes, '/merge', 'Merge/link endpoint');
assertContains(routes, '/supersede', 'Supersede endpoint');
assertContains(routes, 'shared_safety_correction_requested', 'Correction audit event');
assertContains(routes, 'shared_safety_merge_link_completed', 'Merge audit event');
assertContains(routes, 'shared_safety_superseded', 'Supersede audit event');
assertContains(routes, 'shared_safety_csrf_denial', 'CSRF audit event');
assertContains(routes, 'shared_safety_invalid_content_type', 'Invalid content-type audit event');
assertContains(routes, 'Moderation actions require application/json', 'Moderation action content-type enforcement');

[
  "sharedSafety.sanitizeCandidate",
  "sharedSafety.approveCandidate",
  "sharedSafety.rejectCandidate",
  "sharedSafety.requestCandidateCorrection",
  "sharedSafety.markDuplicate",
  "sharedSafety.mergeCandidateIntoSharedRecord",
  "sharedSafety.retireSharedRecord",
  "sharedSafety.supersedeSharedRecord"
].forEach((pattern) => assertContains(routes, pattern, 'Moderation action route'));

[
  'getModerationCandidateDetail',
  'requestCandidateCorrection',
  'mergeCandidateIntoSharedRecord',
  'supersedeSharedRecord',
  'listModerationAuditEvents',
  'REJECTION_REASON_REQUIRED',
  'RETIRE_REASON_REQUIRED',
  'SUPERSEDE_REASON_REQUIRED'
].forEach((pattern) => assertContains(service, pattern, 'Moderation service support'));

assertContains(auditLog, '...(event.metadata', 'Audit metadata support');
assertContains(dashboard, 'Shared Safety Moderation', 'Dashboard navigation entry');
assertContains(dashboard, 'PLATFORM_ADMIN', 'Dashboard Platform Admin visibility');

const sharedRead = service.match(/async function listSharedRecords[\s\S]*?return result\.rows\.map/)?.[0] || '';
assert(!sharedRead.includes('source_organization_id'), 'Shared read must not expose source organization');
assert(!sharedRead.includes('private_context'), 'Shared read must not expose private context');
assert(!sharedRead.includes('metadata'), 'Shared read must not expose metadata');

console.log('[shared-safety-ui] moderation UI checks passed');
