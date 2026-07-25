require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const postgres = require('../db/postgres');

const APPLY = process.argv.includes('--apply');
const APPROVAL = String(process.env.OWNER_APPROVED_LEGACY_PUBLIC_URL_CLEANUP || '').toLowerCase() === 'true';
const EXPECTED_COUNT = Number.parseInt(process.env.LEGACY_PUBLIC_URL_CLEANUP_EXPECTED_COUNT || '5', 10);
const BACKUP_DIR = process.env.LEGACY_PUBLIC_URL_CLEANUP_BACKUP_DIR
  || path.join(__dirname, '..', '.tmp_legacy_public_url_cleanup');

function cleanText(value, maxLength = 1200) {
  return String(value || '').trim().slice(0, maxLength);
}

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function getMediaIdentity(note, photo, index) {
  return {
    noteId: note.id,
    organizationId: note.organization_id,
    index,
    mediaId: cleanText(photo.id, 300),
    storageProvider: cleanText(photo.storageProvider || photo.storage_provider, 120),
    storageKey: cleanText(photo.storageKey || photo.storage_key, 1200),
    mediaClassification: cleanText(photo.mediaClassification || photo.media_classification, 120),
    type: cleanText(photo.type || photo.mediaType || photo.mimeType || photo.mime_type, 120),
    createdAt: cleanText(photo.createdAt || photo.created_at, 120),
    updatedAt: cleanText(photo.updatedAt || photo.updated_at, 120),
    legacyPublicUrl: cleanText(photo.legacyPublicUrl || photo.legacy_public_url, 2000)
  };
}

function redactForReport(identity) {
  return {
    noteId: identity.noteId,
    organizationId: identity.organizationId,
    index: identity.index,
    mediaId: identity.mediaId,
    storageProvider: identity.storageProvider,
    storageKeyHash: stableHash(identity.storageKey),
    mediaClassification: identity.mediaClassification,
    type: identity.type,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
    legacyPublicUrlHash: stableHash(identity.legacyPublicUrl)
  };
}

function assertIdentityUnchanged(before, after, label) {
  const fields = [
    'noteId',
    'organizationId',
    'index',
    'mediaId',
    'storageProvider',
    'storageKey',
    'mediaClassification',
    'type',
    'createdAt',
    'updatedAt'
  ];
  for (const field of fields) {
    if (before[field] !== after[field]) {
      throw new Error(`${label} changed unexpectedly for ${field}. Refusing cleanup.`);
    }
  }
}

function removeLegacyPublicUrl(photo) {
  const next = { ...photo };
  delete next.legacyPublicUrl;
  delete next.legacy_public_url;
  return next;
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
  if (!(await tableExists(client, 'delivery_notes'))) {
    throw new Error('Expected delivery_notes table is missing.');
  }
  const requiredColumns = ['id', 'organization_id', 'photos'];
  const missingColumns = [];
  for (const columnName of requiredColumns) {
    if (!(await columnExists(client, 'delivery_notes', columnName))) {
      missingColumns.push(`delivery_notes.${columnName}`);
    }
  }
  if (missingColumns.length) {
    throw new Error(`Expected delivery_notes identity/photos columns are missing: ${missingColumns.join(', ')}.`);
  }
  if (!(await tableExists(client, 'lifecycle_object_references'))) {
    throw new Error('Expected lifecycle_object_references table is missing.');
  }
}

async function loadCandidateNotes(client) {
  const result = await client.query(`
    SELECT id, organization_id, photos, created_at, updated_at
    FROM delivery_notes
    WHERE jsonb_typeof(photos) = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(photos) AS item
        WHERE item ? 'legacyPublicUrl'
           OR item ? 'legacy_public_url'
      )
    ORDER BY id
  `);
  return result.rows;
}

function collectCandidates(notes) {
  const candidates = [];
  for (const note of notes) {
    const photos = Array.isArray(note.photos) ? note.photos : [];
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      if (photo && (Object.prototype.hasOwnProperty.call(photo, 'legacyPublicUrl')
        || Object.prototype.hasOwnProperty.call(photo, 'legacy_public_url'))) {
        candidates.push({
          note,
          index,
          before: getMediaIdentity(note, photo, index)
        });
      }
    }
  }
  return candidates;
}

async function lifecycleSnapshot(client) {
  const result = await client.query(`
    SELECT count(*)::int AS total,
           md5(COALESCE(string_agg(
             id || ':' || organization_id || ':' || owner_table || ':' || owner_id || ':' ||
             object_kind || ':' || storage_provider || ':' || storage_key || ':' || lifecycle_status,
             ',' ORDER BY id
           ), '')) AS checksum
    FROM lifecycle_object_references
  `);
  return {
    total: Number(result.rows[0]?.total || 0),
    checksum: result.rows[0]?.checksum || ''
  };
}

async function remainingLegacyCount(client) {
  const result = await client.query(`
    WITH media_items AS (
      SELECT item
      FROM delivery_notes,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(photos) = 'array' THEN photos ELSE '[]'::jsonb END) item
    )
    SELECT count(*)::int AS count
    FROM media_items
    WHERE item ? 'legacyPublicUrl'
       OR item ? 'legacy_public_url'
  `);
  return Number(result.rows[0]?.count || 0);
}

function writeBackup(candidates, lifecycleBefore) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(BACKUP_DIR, `legacy-public-url-backup-${stamp}.json`);
  const backup = {
    createdAt: new Date().toISOString(),
    warning: 'Sensitive backup. Do not commit. Contains legacyPublicUrl values and storage keys.',
    scope: 'delivery_notes.photos legacyPublicUrl cleanup',
    expectedCount: EXPECTED_COUNT,
    lifecycleBefore,
    records: candidates.map((candidate) => candidate.before)
  };
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
  return filePath;
}

async function updateCandidates(client, notes, candidates) {
  const candidatesByNote = new Map();
  for (const candidate of candidates) {
    if (!candidatesByNote.has(candidate.note.id)) candidatesByNote.set(candidate.note.id, []);
    candidatesByNote.get(candidate.note.id).push(candidate);
  }

  for (const [noteId, noteCandidates] of candidatesByNote.entries()) {
    const note = notes.find((row) => row.id === noteId);
    const photos = Array.isArray(note.photos) ? [...note.photos] : [];
    for (const candidate of noteCandidates) {
      photos[candidate.index] = removeLegacyPublicUrl(photos[candidate.index]);
      const after = getMediaIdentity(note, photos[candidate.index], candidate.index);
      assertIdentityUnchanged(candidate.before, after, `delivery_note ${note.id} photo ${candidate.index}`);
    }
    await client.query('UPDATE delivery_notes SET photos = $2::jsonb, updated_at = NOW() WHERE id = $1', [
      note.id,
      JSON.stringify(photos)
    ]);
  }
}

async function loadPostCleanupIdentities(client, beforeCandidates) {
  const result = await client.query(`
    SELECT id, organization_id, photos
    FROM delivery_notes
    WHERE id = ANY($1::text[])
    ORDER BY id
  `, [[...new Set(beforeCandidates.map((candidate) => candidate.before.noteId))]]);
  const notesById = new Map(result.rows.map((row) => [row.id, row]));
  return beforeCandidates.map((candidate) => {
    const note = notesById.get(candidate.before.noteId);
    const photo = Array.isArray(note?.photos) ? note.photos[candidate.before.index] : null;
    if (!photo) throw new Error(`Expected media item disappeared for note ${candidate.before.noteId}.`);
    return getMediaIdentity(note, photo, candidate.before.index);
  });
}

async function main() {
  if (!postgres.isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is required.');
  }
  if (APPLY && !APPROVAL) {
    throw new Error('Production writes require --apply and OWNER_APPROVED_LEGACY_PUBLIC_URL_CLEANUP=true.');
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
    const lifecycleBefore = await lifecycleSnapshot(activeClient);
    const notes = await loadCandidateNotes(activeClient);
    const candidates = collectCandidates(notes);

    if (candidates.length !== EXPECTED_COUNT) {
      throw new Error(`Expected exactly ${EXPECTED_COUNT} legacyPublicUrl media item(s), found ${candidates.length}. Refusing cleanup.`);
    }

    const backupPath = writeBackup(candidates, lifecycleBefore);

    let postCleanupIdentities = [];
    let lifecycleAfter = lifecycleBefore;
    let remainingCount = candidates.length;
    if (APPLY) {
      await updateCandidates(activeClient, notes, candidates);
      postCleanupIdentities = await loadPostCleanupIdentities(activeClient, candidates);
      for (let i = 0; i < candidates.length; i += 1) {
        assertIdentityUnchanged(candidates[i].before, postCleanupIdentities[i], `post-cleanup candidate ${i}`);
        if (postCleanupIdentities[i].legacyPublicUrl) {
          throw new Error(`legacyPublicUrl remains for post-cleanup candidate ${i}.`);
        }
      }
      lifecycleAfter = await lifecycleSnapshot(activeClient);
      if (lifecycleAfter.total !== lifecycleBefore.total || lifecycleAfter.checksum !== lifecycleBefore.checksum) {
        throw new Error('Lifecycle object references changed unexpectedly. Rolling back cleanup.');
      }
      remainingCount = await remainingLegacyCount(activeClient);
      if (remainingCount !== 0) {
        throw new Error(`Expected 0 remaining legacyPublicUrl fields after cleanup, found ${remainingCount}. Rolling back cleanup.`);
      }
      await activeClient.query('COMMIT');
    } else {
      await activeClient.query('ROLLBACK');
    }

    console.log(JSON.stringify({
      ok: true,
      dryRun: !APPLY,
      readOnly: !APPLY,
      urlsAndObjectKeysRedacted: true,
      backupPath,
      recordsFound: candidates.length,
      recordsModified: APPLY ? candidates.length : 0,
      remainingLegacyPublicUrlCount: remainingCount,
      storageKeyChanges: 0,
      storageProviderChanges: 0,
      lifecycleChanges: lifecycleAfter.total === lifecycleBefore.total && lifecycleAfter.checksum === lifecycleBefore.checksum ? 0 : 'unexpected',
      organizationChanges: 0,
      mediaIdChanges: 0,
      backupPreview: candidates.map((candidate) => redactForReport(candidate.before))
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
  console.error(`[legacy-public-url-cleanup] ${error.message}`);
  await postgres.closePool();
  process.exit(1);
});
