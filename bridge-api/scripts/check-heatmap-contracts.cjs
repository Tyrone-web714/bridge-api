const assert = require('assert');
const fs = require('fs');
const path = require('path');

const heatmapRouter = require('../routes/operationalHeatmaps');

function listRouterContracts(router) {
  return router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) => Object.keys(layer.route.methods)
      .filter((method) => layer.route.methods[method])
      .map((method) => `${method.toUpperCase()} ${layer.route.path}`));
}

function run() {
  const routes = new Set(listRouterContracts(heatmapRouter));
  assert(routes.has('GET /admin'), 'Missing operational heatmap admin page.');
  assert(routes.has('GET /data'), 'Missing operational heatmap data endpoint.');

  const source = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'operationalHeatmaps.js'),
    'utf8'
  );
  for (const category of [
    'delay',
    'delivery_failure',
    'deduction',
    'hazard',
    'route_event',
    'revenue'
  ]) {
    assert(source.includes(`${category}:`), `Missing heatmap category ${category}.`);
  }
  assert(source.includes('L.heatLayer'), 'Heatmap page must render weighted heat layers.');
  assert(source.includes('L.circleMarker'), 'Heatmap page must render inspectable signal points.');
  assert(source.includes('Signal Category'), 'Signal point details must label the signal category.');
  assert(source.includes('Account / Destination'), 'Signal point details must show account or destination.');
  assert(source.includes('Route Number'), 'Signal point details must show route number.');
  assert(source.includes('Event Weight'), 'Signal point details must show event weight.');
  assert(source.includes('Date and Time'), 'Signal point details must show date and time.');
  assert(source.includes('select option'), 'Lookback options must have explicit readable colors.');
  for (const filterId of [
    'stateCode',
    'city',
    'territory',
    'routeGroup',
    'distributionCenter'
  ]) {
    assert(source.includes(`id="${filterId}"`), `Missing geographic filter ${filterId}.`);
  }
  assert(source.includes('supervisorUsername'), 'Heatmap data must enforce supervisor-team scoping.');
  assert(source.includes('regionalAccess'), 'Heatmap must distinguish regional and supervisor access.');
  assert(source.includes('fourStateBounds'), 'Regional map must support the four-state overview.');
  assert(source.includes('byState'), 'Heatmap response must include state summaries.');
  assert(source.includes('byTerritory'), 'Heatmap response must include territory summaries.');
  assert(source.includes('frameOperatingArea'), 'Map must automatically frame the selected operating area.');

  const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert(
    serverSource.includes("app.use('/api/operational-heatmaps', operationalHeatmapRoutes)"),
    'Operational heatmap router is not mounted.'
  );

  console.log('[test:heatmaps] visibility, geographic scope, authorization, summary, and map contracts verified.');
}

run();
