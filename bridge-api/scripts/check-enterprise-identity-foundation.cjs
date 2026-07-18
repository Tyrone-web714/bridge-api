const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repoRoot = path.join(root, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(`[enterprise-identity] ${message}`);
}

function assertContains(content, pattern, message) {
  assert(content.includes(pattern), `${message}: missing ${pattern}`);
}

const migration = read('migrations/010_enterprise_identity_foundation.sql');
const service = read('services/enterpriseIdentity.js');
const routes = read('routes/enterpriseIdentity.js');
const rbac = read('services/rbac.js');
const auth = read('middleware/authorization.js');
const server = read('server.js');
const productionRollout = read('scripts/validate-production-rollout.cjs');
const packageJson = JSON.parse(read('package.json'));
const docsDir = path.join(repoRoot, 'docs', 'implementation', 'enterprise-identity-foundation');

[
  'CREATE TABLE IF NOT EXISTS organization_memberships',
  'CREATE TABLE IF NOT EXISTS organization_identity_providers',
  'CREATE TABLE IF NOT EXISTS verified_organization_domains',
  'CREATE TABLE IF NOT EXISTS federated_identities',
  'CREATE TABLE IF NOT EXISTS identity_claim_mappings',
  'CREATE TABLE IF NOT EXISTS sso_authentication_transactions',
  'CREATE TABLE IF NOT EXISTS scim_configurations',
  'CREATE TABLE IF NOT EXISTS scim_provisioning_events',
  'CREATE TABLE IF NOT EXISTS enterprise_identity_break_glass_records',
  'CREATE TABLE IF NOT EXISTS identity_security_events',
  'ON DELETE RESTRICT',
  'organizations_sso_policy_state_check',
  'federated_identities_provider_subject_unique_idx',
  'identity_claim_mappings_no_platform_admin_check'
].forEach((pattern) => assertContains(migration, pattern, 'migration contract'));

[
  "IDENTITY_PROVIDER_VIEW: 'identity.provider.view'",
  "IDENTITY_PROVIDER_MANAGE: 'identity.provider.manage'",
  "IDENTITY_DOMAIN_MANAGE: 'identity.domain.manage'",
  "IDENTITY_MAPPING_MANAGE: 'identity.mapping.manage'",
  "IDENTITY_SSO_POLICY_MANAGE: 'identity.sso_policy.manage'",
  "IDENTITY_ACCOUNT_LINK_MANAGE: 'identity.account_link.manage'",
  "IDENTITY_SCIM_MANAGE: 'identity.scim.manage'",
  "IDENTITY_BREAK_GLASS_MANAGE: 'identity.break_glass.manage'",
  "PLATFORM_IDENTITY_SUPPORT: 'platform.identity.support'"
].forEach((pattern) => assertContains(rbac, pattern, 'RBAC permissions'));

[
  'createIdentityProvider',
  'listIdentityProviders',
  'rotateSecretReference',
  'createVerifiedDomain',
  'verifyDomainChallenge',
  'discoverIdentityProvider',
  'createAuthenticationTransaction',
  'authenticateFederatedIdentity',
  'linkFederatedIdentity',
  'EMAIL_ONLY_LINKING_PROHIBITED',
  'PLATFORM_ADMIN_MAPPING_DENIED',
  'SSO_TRANSACTION_REPLAY_DENIED',
  'SSO_STATE_MISMATCH',
  'SSO_NONCE_MISMATCH',
  'recordScimProvisioningEvent',
  'createBreakGlassRecord',
  'redactObject',
  'NOT_PROVIDER_VERIFIED'
].forEach((pattern) => assertContains(service, pattern, 'service contract'));

assert(!/\beval\s*\(/.test(service), 'service must not use eval().');
assert(!/new Function\s*\(/.test(service), 'service must not use new Function().');
assert(!/access_token|refresh_token|rawAssertion|clientSecret/.test(routes), 'routes must not expose raw provider tokens or secrets by name.');
assert(!/DELETE FROM\s+(admin_users|drivers|daily_route|audit_events|kpi_|logistics_|fleet_score_|shared_safety)/i.test(service), 'service must not hard-delete identity or operational history.');
assert(!/provider verified/i.test(service.replace(/NOT_PROVIDER_VERIFIED/g, '')), 'service must not falsely claim provider verification.');

[
  "router.post('/discover'",
  "router.post('/oidc/initiate'",
  "router.post('/oidc/callback'",
  "router.post('/saml/acs'",
  "router.post('/providers'",
  "router.post('/domains'",
  "router.post('/claim-mappings'",
  "router.post('/account-links'",
  "router.post('/sso-policy'",
  "router.post('/scim/configurations'",
  "router.post('/break-glass/requests'",
  'requireAdminCsrfIfCookie',
  'requireJsonMutation'
].forEach((pattern) => assertContains(routes, pattern, 'route contract'));

assertContains(auth, "path.startsWith('/api/enterprise-identity')", 'private-by-default identity mapping');
assertContains(auth, "path === '/api/enterprise-identity/discover'", 'SSO discovery must be isolated public auth entry');
assertContains(server, "const enterpriseIdentityRoutes = require('./routes/enterpriseIdentity')", 'server route import');
assertContains(server, "app.use('/api/enterprise-identity', enterpriseIdentityRoutes)", 'server route mount');
assertContains(productionRollout, '010_enterprise_identity_foundation.sql', 'production rollout validator must include migration 010');
assertContains(packageJson.scripts.test, 'test:enterprise-identity', 'full test suite must include enterprise identity contracts');
assert(packageJson.scripts['validate:enterprise-identity'], 'runtime enterprise identity validation script must be defined.');

const requiredDocs = [
  'README.md',
  'CURRENT_IDENTITY_AUDIT.md',
  'IMPLEMENTED_IDENTITY_MODEL.md',
  'ORGANIZATION_IDP_CONFIGURATION.md',
  'FEDERATED_IDENTITY_MAPPING.md',
  'TENANT_DISCOVERY_AND_DOMAIN_VERIFICATION.md',
  'AUTHENTICATION_TRANSACTION_SECURITY.md',
  'OIDC_FOUNDATION.md',
  'SAML_FOUNDATION.md',
  'AUTHENTICATION_VS_AUTHORIZATION.md',
  'CLAIM_AND_ROLE_MAPPING.md',
  'JIT_PROVISIONING.md',
  'ACCOUNT_LINKING.md',
  'SSO_ENFORCEMENT.md',
  'MFA_AND_ASSURANCE.md',
  'SCIM_FOUNDATION.md',
  'SESSION_LIFECYCLE.md',
  'WEB_SSO_INTEGRATION.md',
  'MOBILE_SSO_INTEGRATION.md',
  'SECRETS_AND_KEY_MANAGEMENT.md',
  'BREAK_GLASS_ACCESS.md',
  'IDENTITY_AUDIT_EVENTS.md',
  'TENANT_ISOLATION.md',
  'IMPLEMENTATION_THREAT_ASSESSMENT.md',
  'PROVIDER_VERIFICATION_STATUS.md',
  'DATABASE_MIGRATION.md',
  'TEST_RESULTS.md',
  'ROLLBACK_PROCEDURE.md',
  'OWNER_DECISIONS_REQUIRED.md',
  'OPERATIONAL_VERIFICATION_REQUIRED.md',
  'REMAINING_ENTERPRISE_IDENTITY_WORK.md',
  'FINAL_VALIDATION_REPORT.md'
];
for (const file of requiredDocs) {
  assert(fs.existsSync(path.join(docsDir, file)), `required implementation doc missing: ${file}`);
}

console.log('[test:enterprise-identity] foundation schema, service, route, permission, and documentation contracts verified.');
