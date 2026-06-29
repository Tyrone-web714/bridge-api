const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const dashboard = read('routes/adminDashboard.js');
const manifests = read('routes/routeManifests.js');
const intelligence = read('routes/accountIntelligence.js');

for (const fragment of [
  '/api/route-manifests/admin',
  '/api/drivers/admin',
  '/api/routing/manual-hazards/admin',
  '/api/routing/hazard-verification/admin',
  '/api/delivery-notes/admin',
  '/api/account-intelligence/admin',
  '/api/account-intelligence/insights/admin',
  '/api/supervisor-intelligence/admin',
  '/api/operational-heatmaps/admin',
  '/api/operational-geography/admin',
  '/api/account-intelligence/admin#ai-operations',
  '/api/routing/route-sessions/admin',
]) {
  if (!dashboard.includes(fragment)) {
    throw new Error(`Missing supervisor dashboard destination: ${fragment}`);
  }
}

if (!manifests.includes('Assign by company driver ID')) {
  throw new Error('Route assignment UI must identify company driver ID as the assignment key.');
}
if (!intelligence.includes("window.location.hash === '#ai-operations'")) {
  throw new Error('AI Operations deep link must load operational metrics.');
}

console.log('[test:dashboard] supervisor destinations, driver-ID assignment, and AI operations deep link verified.');
