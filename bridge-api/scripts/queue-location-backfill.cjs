const dotenv = require('dotenv');
const repositories = require('../db/repositories');
const postgres = require('../db/postgres');

dotenv.config();

async function main() {
  const category = String(process.env.LOCATION_BACKFILL_CATEGORY || 'all').trim().toLowerCase();
  const categories = category === 'all'
    ? ['low_bridge', 'no_truck', 'residential']
    : [category];
  const limit = Math.min(Math.max(Number(process.env.LOCATION_BACKFILL_LIMIT) || 500, 1), 2000);
  const serviceAreaOnly = String(process.env.LOCATION_BACKFILL_SCOPE || 'service').trim().toLowerCase() !== 'all';
  const state = process.env.LOCATION_BACKFILL_STATE || null;

  await postgres.ensureSchema();

  let total = 0;
  for (const item of categories) {
    const rows = await repositories.enqueueStaticHazardLocationBackfill({
      category: item,
      limit: Math.ceil(limit / categories.length),
      serviceAreaOnly,
      state
    });
    total += rows.length;
    console.log(`[locations:queue] ${item}: queued/requeued ${rows.length}`);
  }

  const stats = await repositories.getStaticHazardLocationBackfillStats();
  console.log(`[locations:queue] total queued/requeued ${total}`);
  console.log(JSON.stringify(stats, null, 2));
}

main()
  .catch((error) => {
    console.error('[locations:queue] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
