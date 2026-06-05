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

  const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert(
    serverSource.includes("app.use('/api/operational-heatmaps', operationalHeatmapRoutes)"),
    'Operational heatmap router is not mounted.'
  );

  console.log('[test:heatmaps] admin, data, category, and map-rendering contracts verified.');
}

run();
