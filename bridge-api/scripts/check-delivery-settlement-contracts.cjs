const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const postgresSource = read('db/postgres.js');
const repositorySource = read('db/repositories.js');
const routeSource = read('routes/routeManifests.js');

const requiredSchemaFragments = [
  'CREATE TABLE IF NOT EXISTS delivery_settlements',
  'CREATE TABLE IF NOT EXISTS delivery_settlement_items',
  'CREATE TABLE IF NOT EXISTS route_closeout_documents',
  'supervisor_review_required BOOLEAN',
  'missing_quantity NUMERIC',
  'returned_quantity NUMERIC',
];

const requiredRepositoryFragments = [
  'getDriverStopDeliverySettlement',
  'saveDriverStopDeliverySettlement',
  'Complete the item-level delivery settlement before closing this stop.',
  'plannedQuantity - accountedQuantity',
  'settlementAdditional',
  'saveRouteCloseoutDocument',
  'getRouteCloseoutDocumentForDriver',
];

const requiredRouteFragments = [
  "router.get('/driver/stops/:stopId/delivery'",
  "router.put('/driver/stops/:stopId/delivery'",
  'getDailyRouteManifestWithAccountIntelligence',
  "router.get('/driver/routes/:manifestId/closeout'",
  'buildRouteCloseoutPayload',
];

for (const fragment of requiredSchemaFragments) {
  if (!postgresSource.includes(fragment)) {
    throw new Error(`Missing delivery settlement schema contract: ${fragment}`);
  }
}
for (const fragment of requiredRepositoryFragments) {
  if (!repositorySource.includes(fragment)) {
    throw new Error(`Missing delivery settlement repository contract: ${fragment}`);
  }
}
for (const fragment of requiredRouteFragments) {
  if (!routeSource.includes(fragment)) {
    throw new Error(`Missing delivery settlement route contract: ${fragment}`);
  }
}

console.log('[test:delivery-settlement] schema, accounting, route closeout, completion guard, and driver endpoint contracts verified.');
