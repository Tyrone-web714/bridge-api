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
  'CREATE TABLE IF NOT EXISTS route_inventory_closeouts',
  'CREATE TABLE IF NOT EXISTS product_barcodes',
  'CREATE TABLE IF NOT EXISTS route_truck_inventory_additions',
  'CREATE TABLE IF NOT EXISTS route_truck_inventory_allocations',
  'CREATE TABLE IF NOT EXISTS warehouse_employees',
  'CREATE TABLE IF NOT EXISTS route_departure_inventory_confirmations',
  'print_confirmation_token TEXT',
  'actual_duration_minutes INTEGER',
  "supervisor_status TEXT NOT NULL DEFAULT 'pending_review'",
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
  'prepareRouteInventoryCloseoutForDriver',
  'confirmRouteInventoryCloseoutPrintForDriver',
  'reviewRouteInventoryCloseout',
  'driver.active = true',
  'inventory_closeout.printed_at IS NULL',
  'lookupProductByBarcodeOrSku',
  'addRouteTruckInventoryForDriver',
  'exceeds available scanned truck inventory',
  'Final inventory counts exceed warehouse-loaded plus scanned truck inventory.',
  'SUM(delivered_quantity + added_quantity)',
  'prepareDepartureInventoryConfirmation',
  'confirmDepartureInventoryPrint',
  'Warehouse inventory confirmation and successful pre-departure print are required before route execution.',
];

const requiredRouteFragments = [
  "router.get('/driver/stops/:stopId/delivery'",
  "router.put('/driver/stops/:stopId/delivery'",
  'getDailyRouteManifestWithAccountIntelligence',
  "router.get('/driver/routes/:manifestId/closeout'",
  "router.put('/driver/routes/:manifestId/inventory-closeout'",
  "router.put('/driver/routes/:manifestId/inventory-closeout/confirm-print'",
  "router.put('/inventory-closeouts/:manifestId/review'",
  "router.get('/driver/products/lookup'",
  "router.get('/driver/routes/:manifestId/truck-inventory'",
  "router.post('/driver/routes/:manifestId/truck-inventory/additions'",
  "router.get('/warehouse-employees'",
  "router.post('/warehouse-employees'",
  "router.post('/driver/routes/:manifestId/departure-inventory/confirm'",
  "router.put('/driver/routes/:manifestId/departure-inventory/confirm-print'",
  'adminAuth.verifyPassword(pin, employee.pin_hash)',
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
