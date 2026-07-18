require('dotenv').config();

const { Pool } = require('pg');
const postgres = require('../db/postgres');

function assertDatabaseConfigured() {
  if (!postgres.isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is required for production media metadata assessment.');
  }
}

async function tableExists(client, tableName) {
  const result = await client(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function columnExists(client, tableName, columnName) {
  const result = await client(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    ) AS exists`,
    [tableName, columnName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function summarizeJsonMediaArray(client, tableName, columnName) {
  if (!(await tableExists(client, tableName)) || !(await columnExists(client, tableName, columnName))) {
    return {
      recordType: tableName,
      column: columnName,
      tableExists: false,
      totalRecords: 0,
      recordsWithMedia: 0,
      mediaItems: 0,
      r2DevReferences: 0,
      legacyPublicUrlFields: 0,
      directPublicCurrentUrls: 0,
      authenticatedAccessPaths: 0,
      mediaClassificationFields: 0,
      storageKeyFields: 0,
      storageProviderFields: 0
    };
  }

  const result = await client(`
    WITH records AS (
      SELECT ${columnName} AS media
      FROM ${tableName}
    ),
    media_items AS (
      SELECT item
      FROM records,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(media) = 'array' THEN media ELSE '[]'::jsonb END) item
    )
    SELECT
      (SELECT count(*)::int FROM records) AS total_records,
      (SELECT count(*)::int FROM records WHERE jsonb_typeof(media) = 'array' AND jsonb_array_length(media) > 0) AS records_with_media,
      count(*)::int AS media_items,
      count(*) FILTER (WHERE (item->>'url' ILIKE '%r2.dev%' OR item->>'legacyPublicUrl' ILIKE '%r2.dev%' OR item->>'publicUrl' ILIKE '%r2.dev%'))::int AS r2_dev_references,
      count(*) FILTER (WHERE item ? 'legacyPublicUrl')::int AS legacy_public_url_fields,
      count(*) FILTER (WHERE item->>'url' ILIKE 'http%://%r2.dev%')::int AS direct_public_current_urls,
      count(*) FILTER (WHERE item->>'url' ILIKE '%/api/media/%' OR item->>'accessPath' ILIKE '%/api/media/%')::int AS authenticated_access_paths,
      count(*) FILTER (WHERE item ? 'mediaClassification' OR item ? 'media_classification')::int AS media_classification_fields,
      count(*) FILTER (WHERE item ? 'storageKey' OR item ? 'storage_key')::int AS storage_key_fields,
      count(*) FILTER (WHERE item ? 'storageProvider' OR item ? 'storage_provider')::int AS storage_provider_fields
    FROM media_items
  `);

  const row = result.rows[0] || {};
  return {
    recordType: tableName,
    column: columnName,
    tableExists: true,
    totalRecords: Number(row.total_records || 0),
    recordsWithMedia: Number(row.records_with_media || 0),
    mediaItems: Number(row.media_items || 0),
    r2DevReferences: Number(row.r2_dev_references || 0),
    legacyPublicUrlFields: Number(row.legacy_public_url_fields || 0),
    directPublicCurrentUrls: Number(row.direct_public_current_urls || 0),
    authenticatedAccessPaths: Number(row.authenticated_access_paths || 0),
    mediaClassificationFields: Number(row.media_classification_fields || 0),
    storageKeyFields: Number(row.storage_key_fields || 0),
    storageProviderFields: Number(row.storage_provider_fields || 0)
  };
}

async function summarizeLifecycleObjectReferences(client) {
  if (!(await tableExists(client, 'lifecycle_object_references'))) {
    return { tableExists: false, totalReferences: 0, byObjectKind: [] };
  }

  const total = await client('SELECT count(*)::int AS count FROM lifecycle_object_references');
  const byObjectKind = await client(`
    SELECT object_kind, storage_provider, count(*)::int AS count
    FROM lifecycle_object_references
    GROUP BY object_kind, storage_provider
    ORDER BY object_kind, storage_provider
  `);

  return {
    tableExists: true,
    totalReferences: Number(total.rows[0]?.count || 0),
    byObjectKind: byObjectKind.rows.map((row) => ({
      objectKind: row.object_kind || 'unknown',
      storageProvider: row.storage_provider || 'unknown',
      count: Number(row.count || 0)
    }))
  };
}

async function main() {
  assertDatabaseConfigured();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: Number.parseInt(process.env.PG_IDLE_TIMEOUT_MS, 10) || 30000,
    connectionTimeoutMillis: Number.parseInt(process.env.PG_CONNECTION_TIMEOUT_MS, 10) || 5000,
    ssl: process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined
  });
  const activeClient = await pool.connect();
  const client = (text, params = []) => activeClient.query(text, params);

  try {
    await client('BEGIN READ ONLY');
    const mediaSummaries = [
      await summarizeJsonMediaArray(client, 'delivery_notes', 'photos'),
      await summarizeJsonMediaArray(client, 'private_hazard_submissions', 'photo_metadata'),
      await summarizeJsonMediaArray(client, 'shared_safety_records', 'sanitized_media')
    ];
    const lifecycleObjectReferences = await summarizeLifecycleObjectReferences(client);
    await client('ROLLBACK');

    const affectedRecordTypes = mediaSummaries
      .filter((item) => item.mediaItems > 0 || item.r2DevReferences > 0 || item.legacyPublicUrlFields > 0)
      .map((item) => item.recordType);
    const totalR2DevReferences = mediaSummaries.reduce((sum, item) => sum + item.r2DevReferences, 0);
    const totalDirectPublicCurrentUrls = mediaSummaries.reduce((sum, item) => sum + item.directPublicCurrentUrls, 0);
    const totalLegacyPublicUrlFields = mediaSummaries.reduce((sum, item) => sum + item.legacyPublicUrlFields, 0);
    const totalAuthenticatedAccessPaths = mediaSummaries.reduce((sum, item) => sum + item.authenticatedAccessPaths, 0);

    console.log(JSON.stringify({
      ok: true,
      readOnly: true,
      metadataOnly: true,
      urlsAndObjectKeysRedacted: true,
      mediaSummaries,
      lifecycleObjectReferences,
      aggregate: {
        affectedRecordTypes,
        totalR2DevReferences,
        totalDirectPublicCurrentUrls,
        totalLegacyPublicUrlFields,
        totalAuthenticatedAccessPaths,
        migrationOrCompatibilityPlanRequired: totalR2DevReferences > 0 || totalDirectPublicCurrentUrls > 0 || totalLegacyPublicUrlFields > 0,
        publicAccessCanBeDisabledImmediately: totalR2DevReferences === 0 && totalDirectPublicCurrentUrls === 0
      }
    }, null, 2));
  } catch (error) {
    try {
      await client('ROLLBACK');
    } catch {
      // ignored
    }
    throw error;
  } finally {
    activeClient.release();
    await pool.end();
    await postgres.closePool();
  }
}

main().catch(async (error) => {
  console.error(`[production-media-metadata] ${error.message}`);
  await postgres.closePool();
  process.exit(1);
});
