const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rbac = require('../services/rbac');

const root = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const mobileRouteManifestApi = read('apps/mobile/src/app/services/routeManifestApi.js');
const server = read('bridge-api/server.js');
const authorization = read('bridge-api/middleware/authorization.js');
const aiRoute = read('bridge-api/routes/ai.js');
const migration004 = read('bridge-api/migrations/004_authentication_rbac_foundation.sql');

assert(
  mobileRouteManifestApi.includes('askDriverCopilot') &&
    mobileRouteManifestApi.includes('jsonApiHeaders(driverOverrideHeaders(options))'),
  'mobile Driver Copilot requests must use the canonical authenticated JSON header helper'
);
assert(
  server.includes("app.use('/api/ai', hydrateDriverBearerIfPresent);") &&
    server.indexOf("app.use('/api/ai', hydrateDriverBearerIfPresent);") <
      server.indexOf("app.use('/api', authorization.attachAuthContext);"),
  'server must hydrate driver Bearer auth for /api/ai before tenant enforcement'
);
assert(
  authorization.includes("path.startsWith('/api/ai/driver-copilot')") &&
    authorization.indexOf("path.startsWith('/api/ai/driver-copilot')") <
      authorization.indexOf("if (path.startsWith('/api/ai')) return rbac.PERMISSIONS.DASHBOARD_VIEW;"),
  'driver-copilot must have endpoint-specific permission before generic dashboard AI classification'
);
assert.strictEqual(
  rbac.PERMISSIONS.DRIVER_COPILOT_USE,
  'ai.driver_copilot.use',
  'driver-copilot permission must be narrow and explicit'
);
assert(
  rbac.hasPermission({ approvedRole: rbac.ROLES.DRIVER }, rbac.PERMISSIONS.DRIVER_COPILOT_USE),
  'Driver role must be authorized to use Driver Copilot'
);
assert(
  !rbac.hasPermission({ approvedRole: rbac.ROLES.DRIVER }, rbac.PERMISSIONS.DASHBOARD_VIEW),
  'Driver role must not gain broad dashboard access for Copilot'
);
assert(
  migration004.includes("('DRIVER', 'ai.driver_copilot.use')"),
  'RBAC migration seed must include Driver Copilot permission for Driver role'
);
assert(
  aiRoute.includes("router.post('/driver-copilot', requireAiAccess, requireAiConfigured") &&
    aiRoute.includes('tenantContext: req.authContext'),
  'driver-copilot route must authenticate through existing driver/admin auth and use authenticated tenant context'
);
assert(!mobileRouteManifestApi.includes('EXPO_PUBLIC_DRIVER_API_TOKEN'), 'Driver Copilot must not use a shared mobile token');

console.log('[test:driver-copilot-auth] driver Copilot authentication and authorization contracts verified.');
