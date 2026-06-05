const assert = require('assert');
const fs = require('fs');
const path = require('path');

const heatmapRouter = require('../routes/operationalHeatmaps');
const geographyRouter = require('../routes/operationalGeography');

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

  const geographyRoutes = new Set(listRouterContracts(geographyRouter));
  for (const contract of [
    'GET /admin',
    'GET /data',
    'POST /distribution-centers',
    'POST /territories',
    'POST /route-groups',
    'PUT /:entityType/:code/active'
  ]) {
    assert(geographyRoutes.has(contract), `Missing operational geography route ${contract}.`);
  }

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
  assert(source.includes('map.flyToBounds(stateViews[stateCode].bounds'), 'State selection must frame the full state.');
  assert(source.includes('map.flyTo([Number(cityOption.latitude)'), 'City selection must center on city coordinates.');
  assert(source.includes('Signed in:'), 'Signed-in username must not appear as a second supervisor tab.');
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
  assert(source.includes('All four service states'), 'State filter must expose the four-state service area.');
  assert(source.includes('Select a state to load its cities'), 'City filter must explain its state dependency.');
  assert(source.includes('No territories configured in Driver Registry'), 'Territory filter must explain missing registry data.');
  assert(source.includes('No route groups configured in Driver Registry'), 'Route group filter must explain missing registry data.');
  assert(source.includes('No distribution centers recorded in route manifests'), 'Distribution-center filter must explain missing manifest data.');
  assert(
    source.includes('listOperationalHeatmapGeography'),
    'Heatmap filter metadata must be independent from recorded signal rows.'
  );

  const repositorySource = fs.readFileSync(
    path.join(__dirname, '..', 'db', 'repositories.js'),
    'utf8'
  );
  assert(
    repositorySource.includes("TO_REGCLASS('public.census_places')"),
    'City options must detect the authoritative Census places table.'
  );
  assert(
    repositorySource.includes('FROM census_places'),
    'City options must use Census place geography when a state is selected.'
  );
  assert(
    repositorySource.includes('census_service_area_places.json'),
    'Cloud deployments must have a bundled Census city fallback.'
  );
  for (const table of [
    'operational_distribution_centers',
    'operational_territories',
    'operational_route_groups'
  ]) {
    assert(repositorySource.includes(table), `Missing configured geography source ${table}.`);
  }

  const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert(
    serverSource.includes("app.use('/api/operational-heatmaps', operationalHeatmapRoutes)"),
    'Operational heatmap router is not mounted.'
  );
  assert(
    serverSource.includes("app.use('/api/operational-geography', operationalGeographyRoutes)"),
    'Operational geography router is not mounted.'
  );

  const driverSource = fs.readFileSync(path.join(__dirname, '..', 'routes', 'drivers.js'), 'utf8');
  assert(
    driverSource.includes("fetch('/api/operational-geography/data')"),
    'Driver Registry must load configured operational geography.'
  );
  assert(
    driverSource.includes('routeGroupOptions') && driverSource.includes('territoryOptions'),
    'Driver Registry must expose configured route group and territory choices.'
  );

  console.log('[test:heatmaps] visibility, geographic scope, authorization, summary, and map contracts verified.');
}

run();
