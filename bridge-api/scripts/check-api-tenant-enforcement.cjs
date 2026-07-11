const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assertContains(source, text, label) {
  assert(source.includes(text), `${label} missing expected text: ${text}`);
}

const authorization = read('middleware/authorization.js');
const server = read('server.js');
const places = read('routes/places.js');
const routeManifests = read('routes/routeManifests.js');
const deliveryNotes = read('routes/deliveryNotes.js');
const repositories = read('db/repositories.js');
const auditLog = read('services/auditLog.js');

assertContains(server, "authorization.enforceApiTenantPolicy", 'Server tenant enforcement middleware');
assertContains(authorization, 'function enforceApiTenantPolicy', 'Central API tenant policy');
assertContains(authorization, 'function permissionForRequest', 'Route permission classification');
assertContains(authorization, 'unauthenticated_access_attempt', 'Unauthenticated audit event');
assertContains(authorization, 'permission_denial', 'Permission denial audit event');
assertContains(authorization, 'cross_tenant_access_denial', 'Cross-tenant audit event');

assertContains(places, "router.get('/autocomplete', requirePlacesAuth", 'Places autocomplete auth');
assertContains(places, "router.get('/details', requirePlacesAuth", 'Places details auth');
assertContains(places, "router.get('/street-view', requirePlacesAuth", 'Street View auth');
assertContains(places, "router.get('/photo', requirePlacesAuth", 'Place photo auth');
assertContains(places, "router.post('/recent-destinations', requirePlacesAuth", 'Recent destination write auth');
assertContains(repositories, 'WHERE organization_id = $1', 'Recent destinations tenant filter');
assertContains(repositories, 'const key = `${tenantContext.organizationId}:${localKey}`;', 'Recent destination tenant cache key');

assertContains(routeManifests, 'req.warehouseAuth = {', 'Warehouse auth context attached');
assertContains(routeManifests, 'WAREHOUSE_CONFIRM', 'Warehouse permission enforcement');
assertContains(deliveryNotes, "router.get('/photos/:filename', requireAdminAuth", 'Delivery photo route protected');
assertContains(auditLog, 'recordSecurityEvent', 'Security audit event writer');

console.log('API tenant-enforcement checks passed');
