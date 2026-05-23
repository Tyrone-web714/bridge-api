require('dotenv').config();

const fs = require('fs');
const path = require('path');
const postgres = require('../db/postgres');
const repositories = require('../db/repositories');
const photoStorage = require('../services/photoStorage');

const NOTES_FILE = path.join(__dirname, '..', 'data', 'delivery_notes.json');
const DRY_RUN = String(process.env.PHOTO_MIGRATION_DRY_RUN || '').toLowerCase() === 'true';

function readJsonNotes() {
  if (!fs.existsSync(NOTES_FILE)) return [];
  const parsed = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

function writeJsonNotes(notes) {
  fs.mkdirSync(path.dirname(NOTES_FILE), { recursive: true });
  fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
}

async function listNotes() {
  if (repositories.isDatabaseEnabled()) {
    await postgres.ensureSchema();
    return repositories.listDeliveryNotes();
  }
  return readJsonNotes();
}

async function saveNote(note) {
  if (repositories.isDatabaseEnabled()) {
    return repositories.upsertDeliveryNote(note);
  }

  const notes = readJsonNotes();
  const nextNotes = notes.map((record) => (record.id === note.id ? note : record));
  writeJsonNotes(nextNotes);
  return note;
}

function getLocalFilename(photo) {
  const raw = photo?.storageProvider === 'local'
    ? photo.storageKey || photo.filename
    : photo?.filename && !photo?.storageProvider
      ? photo.filename
      : null;
  const filename = path.basename(String(raw || '').trim());
  return filename || null;
}

async function migratePhoto(note, photo, index) {
  if (photo?.storageProvider === 's3') {
    return { photo, status: 'already_s3' };
  }

  const filename = getLocalFilename(photo);
  if (!filename) {
    return { photo, status: 'skipped_non_local' };
  }

  const fullPath = photoStorage.getLocalPhotoPath(filename);
  if (!fullPath || !fs.existsSync(fullPath)) {
    return { photo, status: 'missing_file', filename };
  }

  const buffer = await fs.promises.readFile(fullPath);
  if (DRY_RUN) {
    return {
      photo,
      status: 'would_migrate',
      filename,
      sizeBytes: buffer.length
    };
  }

  const migrated = await photoStorage.saveDeliveryNotePhoto({
    buffer,
    mimeType: photo?.mimeType || 'image/jpeg',
    noteId: note.id,
    index: index + 1,
    originalName: photo?.originalName || photo?.filename || filename
  });

  if (String(process.env.PHOTO_MIGRATION_DELETE_LOCAL || '').toLowerCase() === 'true') {
    await fs.promises.rm(fullPath, { force: true });
  }

  return {
    photo: {
      ...photo,
      ...migrated,
      migratedFrom: {
        storageProvider: photo?.storageProvider || 'local',
        filename
      }
    },
    status: 'migrated',
    filename
  };
}

async function main() {
  const provider = photoStorage.getProvider();
  if (provider !== 's3') {
    throw new Error('Set PHOTO_STORAGE_PROVIDER=s3 before migrating local delivery-note photos.');
  }

  const notes = await listNotes();
  let migratedCount = 0;
  let wouldMigrateCount = 0;
  let missingCount = 0;
  let changedNotes = 0;

  for (const note of notes) {
    const photos = Array.isArray(note.photos) ? note.photos : [];
    if (!photos.length) continue;

    const migratedPhotos = [];
    let changed = false;

    for (let index = 0; index < photos.length; index += 1) {
      const result = await migratePhoto(note, photos[index], index);
      migratedPhotos.push(result.photo);
      if (result.status === 'migrated') {
        migratedCount += 1;
        changed = true;
      }
      if (result.status === 'would_migrate') {
        wouldMigrateCount += 1;
        console.log(`[photo:migrate] would migrate note ${note.id}: ${result.filename} (${result.sizeBytes} bytes)`);
      }
      if (result.status === 'missing_file') {
        missingCount += 1;
        console.warn(`[photo:migrate] missing local file for note ${note.id}: ${result.filename}`);
      }
    }

    if (changed && !DRY_RUN) {
      changedNotes += 1;
      await saveNote({
        ...note,
        photos: migratedPhotos,
        updatedAt: new Date().toISOString()
      });
    }
  }

  console.log(`[photo:migrate] notes scanned: ${notes.length}`);
  console.log(`[photo:migrate] notes updated: ${changedNotes}`);
  console.log(`[photo:migrate] photos migrated: ${migratedCount}`);
  console.log(`[photo:migrate] photos that would migrate: ${wouldMigrateCount}`);
  console.log(`[photo:migrate] missing local files: ${missingCount}`);
  if (DRY_RUN) {
    console.log('[photo:migrate] dry run only; no notes or files were changed.');
  }
}

main()
  .catch((error) => {
    console.error(`[photo:migrate] failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
