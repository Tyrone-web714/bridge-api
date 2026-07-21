require('dotenv').config();

const { Pool } = require('pg');

function dbConfig() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for lifecycle reconciliation.');
  }
  return {
    connectionString: process.env.DATABASE_URL,
    max: 1,
    ssl: process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined
  };
}

async function tableExists(client, tableName) {
  const result = await client.query('SELECT to_regclass($1) AS table_name', [`public.${tableName}`]);
  return Boolean(result.rows[0]?.table_name);
}

function classify(row) {
  if (row.exactDuplicateReferenceGroups > 0 || row.ownershipMismatchReferences > 0) {
    return 'DUPLICATION_DEFECT_OR_OWNERSHIP_DEFECT';
  }
  if (row.referencesNotTiedToCurrentMedia > 0 || row.referencesWithMissingOwnerNote > 0) {
    return 'EXPECTED_HISTORICAL_RETENTION_PENDING_OWNER_REVIEW';
  }
  return 'EXPECTED_CURRENT_REFERENCES';
}

async function reconcile(client) {
  for (const table of ['lifecycle_object_references', 'delivery_notes']) {
    if (!(await tableExists(client, table))) {
      throw new Error(`Expected table is missing: ${table}`);
    }
  }

  const result = await client.query(`
    WITH refs AS (
      SELECT
        id,
        organization_id,
        owner_id,
        storage_key,
        COALESCE(metadata->>'mediaId', '') AS media_id
      FROM lifecycle_object_references
      WHERE owner_table = 'delivery_notes'
        AND object_kind = 'delivery_note_photo'
        AND lower(storage_provider) = 's3'
    ),
    current_media AS (
      SELECT
        dn.id AS note_id,
        dn.organization_id,
        item->>'id' AS media_id,
        item->>'storageKey' AS storage_key
      FROM delivery_notes dn
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(dn.photos, '[]'::jsonb)) item
      WHERE lower(COALESCE(item->>'storageProvider', '')) = 's3'
        AND COALESCE(item->>'storageKey', '') <> ''
    ),
    duplicate_ids AS (
      SELECT id
      FROM refs
      GROUP BY id
      HAVING count(*) > 1
    ),
    duplicate_storage AS (
      SELECT storage_key
      FROM refs
      WHERE COALESCE(storage_key, '') <> ''
      GROUP BY storage_key
      HAVING count(*) > 1
    ),
    refs_with_owner AS (
      SELECT refs.*, dn.organization_id AS note_organization_id
      FROM refs
      LEFT JOIN delivery_notes dn ON dn.id = refs.owner_id
    ),
    refs_with_current_match AS (
      SELECT DISTINCT refs.id
      FROM refs
      JOIN current_media current
        ON current.note_id = refs.owner_id
       AND current.organization_id = refs.organization_id
       AND current.storage_key = refs.storage_key
    )
    SELECT
      (SELECT count(*)::int FROM refs) AS total_references,
      (SELECT count(DISTINCT storage_key)::int FROM refs WHERE COALESCE(storage_key, '') <> '') AS unique_storage_objects,
      (SELECT count(DISTINCT organization_id || ':' || owner_id || ':' || COALESCE(NULLIF(media_id, ''), storage_key, ''))::int FROM refs) AS unique_delivery_note_media_identities,
      (SELECT count(*)::int FROM duplicate_ids) AS exact_duplicate_reference_groups,
      (SELECT count(*)::int FROM duplicate_storage) AS duplicate_storage_object_groups,
      (SELECT count(*)::int FROM refs_with_current_match) AS references_tied_to_current_media,
      (SELECT count(*)::int FROM refs WHERE id NOT IN (SELECT id FROM refs_with_current_match)) AS references_not_tied_to_current_media,
      (SELECT count(*)::int FROM refs_with_owner WHERE note_organization_id IS NULL) AS references_with_missing_owner_note,
      (SELECT count(*)::int FROM refs_with_owner WHERE note_organization_id IS NOT NULL AND note_organization_id <> organization_id) AS ownership_mismatch_references
  `);

  const row = result.rows[0] || {};
  const summary = {
    ok: true,
    readOnly: true,
    aggregateOnly: true,
    urlsAndObjectKeysRedacted: true,
    scope: 'lifecycle_object_references delivery_note_photo s3',
    totalReferences: Number(row.total_references || 0),
    uniqueStorageObjects: Number(row.unique_storage_objects || 0),
    uniqueDeliveryNoteMediaIdentities: Number(row.unique_delivery_note_media_identities || 0),
    exactDuplicateReferenceGroups: Number(row.exact_duplicate_reference_groups || 0),
    duplicateStorageObjectGroups: Number(row.duplicate_storage_object_groups || 0),
    referencesTiedToCurrentMedia: Number(row.references_tied_to_current_media || 0),
    referencesNotTiedToCurrentMedia: Number(row.references_not_tied_to_current_media || 0),
    referencesWithMissingOwnerNote: Number(row.references_with_missing_owner_note || 0),
    ownershipMismatchReferences: Number(row.ownership_mismatch_references || 0)
  };
  summary.classification = classify(summary);
  return summary;
}

async function main() {
  const pool = new Pool(dbConfig());
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const summary = await reconcile(client);
    await client.query('ROLLBACK');
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // Ignore rollback errors while reporting the original reconciliation failure.
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    readOnly: true,
    aggregateOnly: true,
    urlsAndObjectKeysRedacted: true,
    error: error.message
  }, null, 2));
  process.exitCode = 1;
});
