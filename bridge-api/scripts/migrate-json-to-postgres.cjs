const fs = require('fs');
const path = require('path');
require('dotenv').config();

const postgres = require('../db/postgres');
const repositories = require('../db/repositories');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJsonArray(filename) {
  const fullPath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fullPath)) return [];

  const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error(`${filename} must contain a JSON array`);
  }
  return parsed;
}

async function migrateBatch(records, handler, label, batchSize = 500) {
  let imported = 0;
  for (let index = 0; index < records.length; index += batchSize) {
    const batch = records.slice(index, index + batchSize);
    for (const record of batch) {
      await handler(record);
      imported += 1;
    }
    console.log(`[db:migrate] ${label}: ${imported}/${records.length}`);
  }
  return imported;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Add it to .env before running this migration.');
  }

  await postgres.ensureSchema();

  const manualHazards = readJsonArray('manual_hazards.json');
  const deliveryNotes = readJsonArray('delivery_notes.json');
  const recentDestinations = readJsonArray('recent_destinations.json');
  const lowBridges = readJsonArray('low_clearance_bridges.json');
  const noTruckZones = readJsonArray('no_truck_zones.json');
  const residentialZones = readJsonArray('residential_zones.json');

  console.log('[db:migrate] starting JSON to PostgreSQL import');
  console.log(`[db:migrate] manual hazards: ${manualHazards.length}`);
  console.log(`[db:migrate] delivery notes: ${deliveryNotes.length}`);
  console.log(`[db:migrate] recent destinations: ${recentDestinations.length}`);
  console.log(`[db:migrate] low bridges: ${lowBridges.length}`);
  console.log(`[db:migrate] no-truck zones: ${noTruckZones.length}`);
  console.log(`[db:migrate] residential zones: ${residentialZones.length}`);

  await migrateBatch(manualHazards, repositories.upsertManualHazard, 'manual hazards', 250);
  await migrateBatch(deliveryNotes, repositories.upsertDeliveryNote, 'delivery notes', 100);
  await migrateBatch(
    recentDestinations,
    (record) => repositories.saveRecentDestination(record, 12),
    'recent destinations',
    25
  );
  await migrateBatch(lowBridges, repositories.upsertStaticBridge, 'low bridges', 500);
  await migrateBatch(noTruckZones, (record) => repositories.upsertStaticZone(record, 'no_truck'), 'no-truck zones', 500);
  await migrateBatch(residentialZones, (record) => repositories.upsertStaticZone(record, 'residential'), 'residential zones', 500);

  console.log('[db:migrate] complete');
}

main()
  .catch((error) => {
    console.error('[db:migrate] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
