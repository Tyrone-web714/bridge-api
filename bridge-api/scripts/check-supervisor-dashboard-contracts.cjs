const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const dashboard = read('routes/adminDashboard.js');
const manifests = read('routes/routeManifests.js');
const intelligence = read('routes/accountIntelligence.js');
const drivers = read('routes/drivers.js');

for (const fragment of [
  '/api/route-manifests/admin',
  '/api/drivers/admin',
  '/api/drivers/teams/admin',
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
if (!manifests.includes("cache: 'no-store'") || !manifests.includes("routeDateFilter').value = ''")) {
  throw new Error('Route manifest page must reload all persisted routes without a restored stale date filter.');
}
if (!manifests.includes("window.addEventListener('pageshow'") || !manifests.includes('must-revalidate')) {
  throw new Error('Route manifest page must refresh after browser history restoration and disable page caching.');
}
if (!intelligence.includes("window.location.hash === '#ai-operations'")) {
  throw new Error('AI Operations deep link must load operational metrics.');
}
for (const fragment of [
  "router.get('/teams/admin'",
  "router.get('/team-roster'",
  "router.post('/team-roster/swap'",
  "router.put('/:driverId/team'",
  'Supervisors may only view drivers assigned to their team.',
  'updateDriverTeamAssignment',
  'swapDriverTeamAssignments',
]) {
  if (!drivers.includes(fragment)) {
    throw new Error(`Missing supervisor team roster contract: ${fragment}`);
  }
}

console.log('[test:dashboard] supervisor destinations, driver-ID assignment, team rosters, and AI operations deep link verified.');
