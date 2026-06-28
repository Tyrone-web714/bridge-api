const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const postgres = require('../db/postgres');

async function main() {
  if (!postgres.isDatabaseConfigured()) {
    console.log('[migrate] DATABASE_URL is not configured; skipping database migrations');
    return;
  }

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort();

  await postgres.rawQuery(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const filename of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const existing = await postgres.rawQuery(
      'SELECT checksum FROM schema_migrations WHERE filename = $1',
      [filename]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Applied migration changed: ${filename}`);
      }
      console.log(`[migrate] already applied ${filename}`);
      continue;
    }

    await postgres.withTransaction(async (client) => {
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
        [filename, checksum]
      );
    });
    console.log(`[migrate] applied ${filename}`);
  }
}

main()
  .catch((error) => {
    console.error(`[migrate] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => postgres.closePool());
