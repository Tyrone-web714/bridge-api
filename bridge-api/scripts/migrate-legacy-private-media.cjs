require('dotenv').config();

const crypto = require('crypto');
const { Pool } = require('pg');
const postgres = require('../db/postgres');

const APPLY = process.argv.includes('--apply');
const APPROVAL = String(process.env.OWNER_APPROVED_LEGACY_MEDIA_MIGRATION || '').toLowerCase() === 'true';
const ORGANIZATION_SCOPE = String(process.env.LEGACY_MEDIA_MIGRATION_ORGANIZATION_ID || '').trim();

const CLASSIFICATIONS = {
  READY_TO_MIGRATE: 'READY_TO_MIGRATE',
  ALREADY_MIGRATED: 'ALREADY_MIGRATED',
  MISSING_REQUIRED_METADATA: 'MISSING_REQUIRED_METADATA',
  AMBIGUOUS: 'AMBIGUOUS',
  BLOCKED: 'BLOCKED'
};

function cleanText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function isR2DevUrl(value) {
  return /^https?:\/\/[^/]+\.r2\.dev\//i.test(cleanText(value, 1200));
}

function isAuthenticatedMediaUrl(value) {
  return /\/api\/media\/[^/?#]+/i.test(cleanText(value, 1200));
}

function isUnsafeStorageKey(value) {
  const key = cleanText(value, 1200);
  return !key || key.includes('..') || key.startsWith('/') || /^[a-z]+:\/\//i.test(key);
}

function deterministicMediaId(noteId, index, storageKey) {
  const digest = crypto.createHash('sha256')
    .update(['delivery_notes', noteId, index, storageKey].join(':'))
    .digest('hex')
    .slice(0, 32);
  return `${noteId}-legacy-photo-${index}-${digest}`;
}

function deterministicLifecycleReferenceId(organizationId, noteId, mediaId) {
  const stableKey = [organizationId, 'delivery_notes', noteId, mediaId].join(':');
  return `media-${crypto.createHash('sha256').update(stableKey).digest('hex').slice(0, 48)}`;
}

function accessPathFor(mediaId) {
  return `/api/media/${encodeURIComponent(mediaId)}`;
}

function primaryUrlFor(mediaId) {
  const baseUrl = cleanText(process.env.BACKEND_PUBLIC_URL || process.env.PUBLIC_API_BASE_URL, 500).replace(/\/+$/, '');
  return baseUrl ? `${baseUrl}${accessPathFor(mediaId)}` : accessPathFor(mediaId);
}

async function tableExists(client, tableName) {
  const result = await client.query("SELECT to_regclass($1) AS table_name", [`public.${tableName}`]);
  return Boolean(result.rows[0]?.table_name);
}

async function columnExists(client, tableName, columnName) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS exists
  `, [tableName, columnName]);
  return Boolean(result.rows[0]?.exists);
}

async function assertExpectedSchema(client) {
  const required = [
    ['delivery_notes', 'id'],
    ['delivery_notes', 'organization_id'],
    ['delivery_notes', 'photos'],
    ['delivery_notes', 'raw'],
    ['delivery_notes', 'updated_at']
  ];

  if (!(await tableExists(client, 'delivery_notes'))) {
    throw new Error('Expected delivery_notes table is missing. Refusing migration assessment.');
  }
  if (!(await tableExists(client, 'lifecycle_object_references'))) {
    throw new Error('Expected lifecycle_object_references table is missing. Refusing migration assessment.');
  }
  if (APPLY && !(await tableExists(client, 'audit_events'))) {
    throw new Error('Expected audit_events table is missing. Refusing write-mode migration.');
  }

  const missing = [];
  for (const [tableName, columnName] of required) {
    if (!(await columnExists(client, tableName, columnName))) {
      missing.push(`${tableName}.${columnName}`);
    }
  }
  if (missing.length) {
    throw new Error(`Expected schema columns missing: ${missing.join(', ')}. Refusing migration assessment.`);
  }
}

async function loadDeliveryNotes(client) {
  const params = [];
  const where = ["jsonb_typeof(photos) = 'array'", "jsonb_array_length(photos) > 0"];
  if (ORGANIZATION_SCOPE) {
    params.push(ORGANIZATION_SCOPE);
    where.push(`organization_id = $${params.length}`);
  }
  const result = await client.query(`
    SELECT id, organization_id, photos
    FROM delivery_notes
    WHERE ${where.join(' AND ')}
    ORDER BY id
  `, params);
  return result.rows;
}

async function lifecycleReferenceExists(client, id) {
  if (!(await tableExists(client, 'lifecycle_object_references'))) return false;
  const result = await client.query('SELECT 1 FROM lifecycle_object_references WHERE id = $1', [id]);
  return Boolean(result.rows[0]);
}

async function classifyItem(client, note, photo, index) {
  const storageProvider = cleanText(photo.storageProvider || photo.storage_provider, 80).toLowerCase();
  const storageKey = cleanText(photo.storageKey || photo.storage_key, 1200);
  const currentUrl = cleanText(photo.url, 1200);
  const legacyPublicUrl = cleanText(photo.legacyPublicUrl || photo.legacy_public_url, 1200);
  const currentIsPublic = isR2DevUrl(currentUrl);
  const legacyIsPublic = isR2DevUrl(legacyPublicUrl);
  const hasAuthenticatedAccess = isAuthenticatedMediaUrl(currentUrl) || isAuthenticatedMediaUrl(photo.accessPath || photo.access_path);
  const mediaId = cleanText(photo.id, 220) || deterministicMediaId(note.id, index, storageKey);
  const lifecycleId = note.organization_id
    ? deterministicLifecycleReferenceId(note.organization_id, note.id, mediaId)
    : null;
  const lifecycleExists = lifecycleId ? await lifecycleReferenceExists(client, lifecycleId) : false;
  const missing = [];

  if (!note.id) missing.push('delivery_note_id');
  if (!note.organization_id) missing.push('organization_id');
  if (!storageProvider) missing.push('storage_provider');
  if (!storageKey) missing.push('storage_key');
  if (!currentUrl && !legacyPublicUrl) missing.push('public_url_reference');

  let classification = CLASSIFICATIONS.BLOCKED;
  let reason = '';

  if (!(await tableExists(client, 'lifecycle_object_references'))) {
    reason = 'lifecycle_object_references table is missing';
  } else if (missing.length) {
    classification = CLASSIFICATIONS.MISSING_REQUIRED_METADATA;
    reason = `missing ${missing.join(',')}`;
  } else if (storageProvider !== 's3') {
    classification = CLASSIFICATIONS.AMBIGUOUS;
    reason = 'storage provider is not s3';
  } else if (isUnsafeStorageKey(storageKey)) {
    classification = CLASSIFICATIONS.BLOCKED;
    reason = 'unsafe or missing storage key';
  } else if (hasAuthenticatedAccess && lifecycleExists) {
    classification = CLASSIFICATIONS.ALREADY_MIGRATED;
    reason = 'authenticated access and lifecycle reference already present';
  } else if (currentIsPublic || legacyIsPublic) {
    classification = CLASSIFICATIONS.READY_TO_MIGRATE;
    reason = 'eligible legacy public R2 media reference';
  } else if (hasAuthenticatedAccess && !lifecycleExists) {
    classification = CLASSIFICATIONS.READY_TO_MIGRATE;
    reason = 'authenticated access present but lifecycle reference missing';
  } else {
    classification = CLASSIFICATIONS.AMBIGUOUS;
    reason = 'media is neither a verified public legacy reference nor already migrated';
  }

  return {
    classification,
    reason,
    index,
    mediaId,
    lifecycleId,
    storageProvider,
    storageKey,
    currentIsPublic,
    legacyIsPublic,
    hasAuthenticatedAccess,
    missingMetadata: missing.length
  };
}

function normalizePhoto(note, photo, classified) {
  const legacyPublicUrl = cleanText(photo.legacyPublicUrl || photo.legacy_public_url || (classified.currentIsPublic ? photo.url : ''), 1200) || null;
  return {
    ...photo,
    id: classified.mediaId,
    storageProvider: classified.storageProvider,
    storageKey: classified.storageKey,
    mediaClassification: 'ORGANIZATION_PRIVATE',
    accessPath: accessPathFor(classified.mediaId),
    url: primaryUrlFor(classified.mediaId),
    legacyPublicUrl
  };
}

async function upsertLifecycleReference(client, note, normalizedPhoto, classified) {
  const metadata = {
    migration: 'legacy-private-media-migration',
    mediaId: classified.mediaId,
    mediaClassification: 'ORGANIZATION_PRIVATE',
    legacyPublicUrlPresent: Boolean(normalizedPhoto.legacyPublicUrl),
    accessPathPresent: Boolean(normalizedPhoto.accessPath),
    dryRunDefault: true
  };
  await client.query(`
    INSERT INTO lifecycle_object_references (
      id, organization_id, owner_table, owner_id, object_kind, storage_provider,
      storage_key, contains_personal_data, legal_hold_eligible, lifecycle_status, metadata
    )
    VALUES ($1, $2, 'delivery_notes', $3, 'delivery_note_photo', $4, $5, true, true, 'ACTIVE', $6::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      owner_table = EXCLUDED.owner_table,
      owner_id = EXCLUDED.owner_id,
      object_kind = EXCLUDED.object_kind,
      storage_provider = EXCLUDED.storage_provider,
      storage_key = EXCLUDED.storage_key,
      contains_personal_data = EXCLUDED.contains_personal_data,
      legal_hold_eligible = EXCLUDED.legal_hold_eligible,
      lifecycle_status = CASE
        WHEN lifecycle_object_references.lifecycle_status = 'PURGED' THEN lifecycle_object_references.lifecycle_status
        ELSE EXCLUDED.lifecycle_status
      END,
      metadata = EXCLUDED.metadata
  `, [
    classified.lifecycleId,
    note.organization_id,
    note.id,
    classified.storageProvider,
    classified.storageKey,
    JSON.stringify(metadata)
  ]);
}

async function recordAuditEvent(client, counts) {
  await client.query(`
    INSERT INTO audit_events (
      actor_type, actor_id, method, path, status_code, organization_id,
      event_type, outcome, metadata
    )
    VALUES (
      'system', 'legacy-private-media-migration', 'SYSTEM',
      'scripts/migrate-legacy-private-media.cjs', 200, NULL,
      'legacy_private_media_migration', 'metadata_updated', $1::jsonb
    )
  `, [JSON.stringify({
    urlsAndObjectKeysRedacted: true,
    counts
  })]);
}

async function migrateReadyItems(client, notes, items) {
  const byNote = new Map();
  for (const item of items.filter((entry) => entry.classification === CLASSIFICATIONS.READY_TO_MIGRATE)) {
    if (!byNote.has(item.note.id)) byNote.set(item.note.id, []);
    byNote.get(item.note.id).push(item);
  }

  for (const [noteId, noteItems] of byNote.entries()) {
    const note = notes.find((row) => row.id === noteId);
    const photos = Array.isArray(note.photos) ? [...note.photos] : [];
    for (const item of noteItems) {
      const normalized = normalizePhoto(note, photos[item.index], item);
      photos[item.index] = normalized;
      await upsertLifecycleReference(client, note, normalized, item);
    }
    await client.query(`
      UPDATE delivery_notes
      SET photos = $2::jsonb,
          raw = COALESCE(raw, '{}'::jsonb) || jsonb_build_object('legacyPrivateMediaMigration', jsonb_build_object('status', 'metadata_updated')),
          updated_at = NOW()
      WHERE id = $1
    `, [note.id, JSON.stringify(photos)]);
  }
}

async function main() {
  if (!postgres.isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is required.');
  }
  if (APPLY && !APPROVAL) {
    throw new Error('Production writes require --apply and OWNER_APPROVED_LEGACY_MEDIA_MIGRATION=true.');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: Number.parseInt(process.env.PG_IDLE_TIMEOUT_MS, 10) || 30000,
    connectionTimeoutMillis: Number.parseInt(process.env.PG_CONNECTION_TIMEOUT_MS, 10) || 5000,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });
  const activeClient = await pool.connect();

  try {
    await activeClient.query(APPLY ? 'BEGIN' : 'BEGIN READ ONLY');
    await assertExpectedSchema(activeClient);
    const notes = await loadDeliveryNotes(activeClient);
    const items = [];
    for (const note of notes) {
      const photos = Array.isArray(note.photos) ? note.photos : [];
      for (let index = 0; index < photos.length; index += 1) {
        const classified = await classifyItem(activeClient, note, photos[index], index);
        if (classified.currentIsPublic || classified.legacyIsPublic || classified.hasAuthenticatedAccess) {
          items.push({ ...classified, note });
        }
      }
    }

    const counts = Object.values(CLASSIFICATIONS).reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    let missingMetadataCount = 0;
    for (const item of items) {
      counts[item.classification] += 1;
      if (item.missingMetadata) missingMetadataCount += 1;
    }

    if (APPLY) {
      await migrateReadyItems(activeClient, notes, items);
      await recordAuditEvent(activeClient, counts);
      await activeClient.query('COMMIT');
    } else {
      await activeClient.query('ROLLBACK');
    }

    console.log(JSON.stringify({
      ok: true,
      dryRun: !APPLY,
      readOnly: !APPLY,
      urlsAndObjectKeysRedacted: true,
      scope: {
        recordType: 'delivery_notes.photos',
        organizationScoped: Boolean(ORGANIZATION_SCOPE)
      },
      totalLegacyCandidates: items.length,
      readyToMigrate: counts.READY_TO_MIGRATE,
      alreadyMigrated: counts.ALREADY_MIGRATED,
      blocked: counts.BLOCKED,
      ambiguous: counts.AMBIGUOUS,
      missingRequiredMetadata: counts.MISSING_REQUIRED_METADATA,
      missingMetadataCount,
      knownProductionReferenceCountMatches: items.length === 3,
      writeModeExecuted: APPLY
    }, null, 2));
  } catch (error) {
    try {
      await activeClient.query('ROLLBACK');
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
  console.error(`[legacy-private-media-migration] ${error.message}`);
  await postgres.closePool();
  process.exit(1);
});
