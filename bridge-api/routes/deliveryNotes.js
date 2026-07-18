const express = require('express');
const fs = require('fs');
const path = require('path');
const repositories = require('../db/repositories');
const photoStorage = require('../services/photoStorage');
const adminAuth = require('../services/adminAuth');
const driverAuth = require('../services/driverAuth');

const router = express.Router();

const NOTES_FILE = path.join(__dirname, '..', 'data', 'delivery_notes.json');
const MAX_PHOTOS_PER_NOTE = Math.max(1, Math.min(8, Number.parseInt(process.env.DELIVERY_NOTE_MAX_PHOTOS, 10) || 4));
const MAX_PHOTO_BYTES = Math.max(250_000, Number.parseInt(process.env.DELIVERY_NOTE_MAX_PHOTO_BYTES, 10) || 6_000_000);
const MAX_BASE64_CHARS = Math.ceil(MAX_PHOTO_BYTES * 1.38);

function cleanText(value, maxLength = 200) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanLongText(value, maxLength = 2500) {
  return String(value || '').trim().slice(0, maxLength);
}

function isSupportedImageMimeType(mimeType) {
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(cleanText(mimeType, 40).toLowerCase());
}

function detectImageMimeType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function readNotes() {
  try {
    if (!fs.existsSync(NOTES_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('delivery-notes read error:', error.message);
    return [];
  }
}

function writeNotes(records) {
  fs.mkdirSync(path.dirname(NOTES_FILE), { recursive: true });
  fs.writeFileSync(NOTES_FILE, JSON.stringify(records, null, 2));
}

async function listStoredNotes(options = {}) {
  if (repositories.isDatabaseEnabled()) {
    return repositories.listDeliveryNotes(options);
  }
  return readNotes();
}

async function saveStoredNote(note, options = {}) {
  if (repositories.isDatabaseEnabled()) {
    return repositories.upsertDeliveryNote({ ...note, tenantContext: options.tenantContext });
  }

  const existing = readNotes().filter((record) => record.id !== note.id);
  const nextRecords = [note, ...existing].slice(0, 500);
  writeNotes(nextRecords);
  return note;
}

async function removeStoredNote(id) {
  if (repositories.isDatabaseEnabled()) {
    return repositories.deleteDeliveryNote(id);
  }

  const records = readNotes();
  const existing = records.find((record) => record.id === id);
  if (!existing) return null;
  const nextRecords = records.filter((record) => record.id !== id);
  writeNotes(nextRecords);
  return existing;
}

function getAdminPassword() {
  return adminAuth.getAdminPassword();
}

function getAdminSecret() {
  return adminAuth.getAdminSecret();
}

function getAdminSession(req) {
  return adminAuth.getAdminSession(req);
}

function requireAdminAuth(req, res, next) {
  if (!getAdminPassword() || !getAdminSecret()) {
    return res.status(503).send('Admin dashboard password is not configured.');
  }

  const session = getAdminSession(req);
  if (session) {
    req.adminSession = session;
    return next();
  }
  return res.redirect('/api/routing/manual-hazards/admin/login');
}

function getRequestTenantContext(req) {
  return req.authContext?.organizationId
    ? req.authContext
    : req.driverAuth?.organizationId
      ? { organizationId: req.driverAuth.organizationId }
      : req.adminSession?.organizationId
        ? { organizationId: req.adminSession.organizationId }
        : undefined;
}

async function normalizeBase64Photo(photo, noteId, index, req) {
  const rawData = String(photo?.base64 || photo?.data || '').trim();
  const dataUri = String(photo?.dataUri || photo?.uri || '').trim();
  const match = dataUri.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  const mimeType = cleanText(photo?.mimeType || photo?.type || match?.[1] || 'image/jpeg', 40).toLowerCase();
  const base64 = (match?.[2] || rawData).replace(/\s+/g, '');

  if (!base64 || !isSupportedImageMimeType(mimeType)) {
    return null;
  }

  if (base64.length > MAX_BASE64_CHARS) {
    const error = new Error(`photo ${index} is too large`);
    error.status = 413;
    throw error;
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    const error = new Error(`photo ${index} is not valid base64`);
    error.status = 415;
    throw error;
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_PHOTO_BYTES) {
    const error = new Error(`photo ${index} exceeds ${MAX_PHOTO_BYTES} bytes`);
    error.status = 413;
    throw error;
  }
  const detectedMimeType = detectImageMimeType(buffer);
  const normalizedMimeType = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  if (!detectedMimeType || detectedMimeType !== normalizedMimeType) {
    const error = new Error(`photo ${index} content does not match ${mimeType}`);
    error.status = 415;
    throw error;
  }

  return photoStorage.saveDeliveryNotePhoto({
    req,
    buffer,
    mimeType: detectedMimeType,
    noteId,
    index,
    originalName: photo?.fileName || photo?.filename || photo?.name
  });
}

function normalizeExistingPhoto(photo, req) {
  const filename = path.basename(cleanText(photo?.filename, 160));
  const url = cleanLongText(photo?.url, 1000);
  if (!filename && !url) return null;

  return {
    id: cleanText(photo?.id, 160) || filename || url,
    filename: filename || null,
    storageProvider: cleanText(photo?.storageProvider, 40) || (filename ? 'local' : null),
    storageKey: cleanText(photo?.storageKey, 500) || filename || null,
    mediaClassification: cleanText(photo?.mediaClassification || photo?.media_classification, 80) || null,
    sizeBytes: Number.isFinite(Number(photo?.sizeBytes)) ? Number(photo.sizeBytes) : null,
    originalName: cleanText(photo?.originalName, 180) || null,
    mimeType: cleanText(photo?.mimeType, 40) || 'image/jpeg',
    url: photoStorage.normalizeExistingPhotoUrl(req, { ...photo, filename, url }),
    legacyPublicUrl: cleanLongText(photo?.legacyPublicUrl || (photo?.storageProvider === 's3' ? url : ''), 1000) || null,
    uploadedAt: cleanText(photo?.uploadedAt, 80) || null
  };
}

async function deletePhotoFiles(photos = []) {
  try {
    await photoStorage.deleteDeliveryNotePhotos(photos);
  } catch (error) {
    console.warn('delivery-notes photo cleanup warning:', error.message);
  }
}

function getPhotoIdentity(photo) {
  return cleanText(photo?.storageKey || photo?.filename || photo?.id || photo?.url, 500);
}

async function buildNoteFromInput(input, req, existing = null) {
  const now = new Date().toISOString();
  const noteId = cleanText(input?.id || existing?.id, 80) || `delivery-note-${Date.now()}`;
  const destination = cleanText(input?.destination ?? existing?.destination, 240);
  const instructions = cleanLongText(input?.instructions ?? input?.comments ?? existing?.instructions, 2500);

  if (!destination && !instructions) {
    const error = new Error('destination or instructions are required');
    error.status = 400;
    throw error;
  }

  const keptPhotos = Array.isArray(input?.existingPhotos)
    ? input.existingPhotos
      .slice(0, MAX_PHOTOS_PER_NOTE)
      .map((photo) => normalizeExistingPhoto(photo, req))
      .filter(Boolean)
    : Array.isArray(existing?.photos)
      ? existing.photos
        .slice(0, MAX_PHOTOS_PER_NOTE)
        .map((photo) => normalizeExistingPhoto(photo, req))
        .filter(Boolean)
      : [];

  const remainingSlots = Math.max(0, MAX_PHOTOS_PER_NOTE - keptPhotos.length);
  const newPhotos = Array.isArray(input?.photos)
    ? (await Promise.all(input.photos.slice(0, remainingSlots)
      .map((photo, index) => normalizeBase64Photo(photo, noteId, keptPhotos.length + index + 1, req))))
      .filter(Boolean)
    : [];

  return {
    id: noteId,
    accountNumber: cleanText(input?.accountNumber ?? input?.account_number ?? existing?.accountNumber, 120) || null,
    placeId: cleanText(input?.placeId ?? existing?.placeId, 160) || null,
    destination: destination || 'Unspecified destination',
    address: cleanText(input?.address ?? existing?.address, 240) || destination || null,
    accountName: cleanText(input?.accountName ?? existing?.accountName, 160) || null,
    customerName: cleanText(input?.customerName ?? existing?.customerName, 160) || null,
    instructions,
    driverName: cleanText(input?.driverName ?? existing?.driverName, 120) || 'driver_app',
    routeContext: cleanText(input?.routeContext ?? existing?.routeContext, 240) || null,
    photos: [...keptPhotos, ...newPhotos].slice(0, MAX_PHOTOS_PER_NOTE),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function filterNotes(records, query) {
  const accountNumber = cleanText(query.accountNumber || query.account_number, 120).toLowerCase();
  const placeId = cleanText(query.placeId, 160);
  const destination = cleanText(query.destination, 240).toLowerCase();

  if (!accountNumber && !placeId && !destination) return records;

  return records.filter((record) => {
    if (accountNumber && String(record.accountNumber || '').toLowerCase() === accountNumber) return true;
    if (placeId && record.placeId && record.placeId === placeId) return true;
    if (!destination) return false;

    const haystack = [
      record.destination,
      record.accountName,
      record.customerName,
      record.address
    ].filter(Boolean).join(' ').toLowerCase();

    return haystack.includes(destination) || destination.includes(String(record.destination || '').toLowerCase());
  });
}

router.get('/', driverAuth.requireDriverAuth, async (req, res) => {
  const notes = filterNotes(await listStoredNotes({ tenantContext: getRequestTenantContext(req) }), req.query)
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

  return res.json({
    count: notes.length,
    notes
  });
});

router.post('/', driverAuth.requireDriverAuth, async (req, res) => {
  try {
    const identity = driverAuth.getDriverIdentity(req);
    const note = await buildNoteFromInput({
      ...(req.body || {}),
      driverName: req.body?.driverName || identity.driverName,
      driverId: identity.driverId
    }, req);
    await saveStoredNote(note, { tenantContext: getRequestTenantContext(req) });

    return res.status(201).json({ note });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status === 413
        ? 'One of the attached delivery photos is too large. Attach fewer or smaller photos.'
        : 'Unable to save delivery note',
      detail: error.message
    });
  }
});

router.put('/:id', driverAuth.requireDriverAuth, async (req, res) => {
  try {
    const id = cleanText(req.params.id, 80);
    const records = await listStoredNotes({ tenantContext: getRequestTenantContext(req) });
    const existing = records.find((record) => record.id === id);

    if (!existing) {
      return res.status(404).json({ error: `delivery note not found: ${id}` });
    }

    const updated = await buildNoteFromInput({ ...(req.body || {}), id }, req, existing);
    const keptPhotoKeys = new Set((updated.photos || []).map(getPhotoIdentity).filter(Boolean));
    const removedPhotos = (existing.photos || []).filter((photo) => {
      const identity = getPhotoIdentity(photo);
      return identity && !keptPhotoKeys.has(identity);
    });
    await deletePhotoFiles(removedPhotos);

    await saveStoredNote(updated, { tenantContext: getRequestTenantContext(req) });
    return res.json({ note: updated });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status === 413
        ? 'One of the attached delivery photos is too large. Attach fewer or smaller photos.'
        : 'Unable to update delivery note',
      detail: error.message
    });
  }
});

router.delete('/:id', driverAuth.requireDriverAuth, async (req, res) => {
  const id = cleanText(req.params.id, 80);
  const existing = await removeStoredNote(id);

  if (!existing) {
    return res.status(404).json({ error: `delivery note not found: ${id}` });
  }

  await deletePhotoFiles(existing.photos || []);
  const count = (await listStoredNotes({ tenantContext: getRequestTenantContext(req) })).length;
  return res.json({ deleted: id, count });
});

router.get('/export', requireAdminAuth, async (req, res) => {
  const records = (await listStoredNotes({ tenantContext: getRequestTenantContext(req) }))
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0));
  const exportedAt = new Date().toISOString();

  res.set('Content-Type', 'application/json; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="truck-safe-delivery-notes-${exportedAt.slice(0, 10)}.json"`);
  return res.json({
    exportedAt,
    count: records.length,
    records
  });
});

function renderDeliveryNotesAdminPage(session = {}) {
  const adminRole = cleanText(session.role || 'supervisor', 40);
  const adminUser = cleanText(session.username || 'supervisor', 80);
  const adminBadge = adminUser.toLowerCase() === adminRole.toLowerCase()
    ? adminUser
    : `${adminUser} - ${adminRole}`;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Truck-Safe Delivery Notes Admin</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: linear-gradient(145deg, #8fc2df 0%, #eef7ff 38%, #fff0f3 100%); color: #102033; }
    header { background: linear-gradient(135deg, #8f0d14 0%, #d62828 50%, #0d47a1 100%); color: #fff; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; box-shadow: 0 14px 34px rgba(12,38,64,0.22); }
    main { max-width: 1280px; margin: 0 auto; padding: 20px; }
    section { background: rgba(255,255,255,0.94); border: 2px solid #5e9fcb; border-left: 7px solid #d62828; border-radius: 14px; padding: 16px; margin-bottom: 16px; box-shadow: 0 10px 26px rgba(21, 101, 192, 0.12); }
    h1, h2 { margin: 0 0 12px; }
    .header-copy { min-width: 0; }
    .eyebrow { margin: 0 0 4px; color: #aee4ff; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .header-subtitle { margin: -4px 0 0; color: #ffe8ec; font-size: 14px; font-weight: 700; }
    .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
    .role-badge { border-radius: 999px; padding: 9px 12px; color: #fff; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.36); font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .logout { background: rgba(255,255,255,0.18); color: #fff; border: 1px solid rgba(255,255,255,0.42); border-radius: 999px; }
    .admin-tabs { max-width: 1280px; margin: 16px auto 0; padding: 0 20px; display: flex; gap: 10px; flex-wrap: wrap; }
    .tab { min-height: 44px; border-radius: 999px; padding: 0 18px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; font-weight: 900; text-transform: uppercase; font-size: 12px; color: #102033; background: rgba(255,255,255,0.78); border: 2px solid #5e9fcb; }
    .tab.hazard { background: #1565c0; color: #fff; border-color: #aee4ff; }
    .tab.active { color: #fff; background: #c8131f; border-color: #ffffff; box-shadow: 0 8px 18px rgba(200,19,31,0.24); }
    .hero-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
    .hero-tile { border-radius: 14px; padding: 14px; color: #fff; background: linear-gradient(135deg, #c8131f, #8f0d14); box-shadow: 0 8px 20px rgba(143,13,20,0.18); }
    .hero-tile.blue { background: linear-gradient(135deg, #1565c0, #0d47a1); }
    .hero-tile.light { color: #102033; background: linear-gradient(135deg, #e2f2fb, #ffffff); border: 2px solid #5e9fcb; }
    .hero-value { font-size: 22px; font-weight: 900; }
    .hero-label { margin-top: 4px; font-size: 12px; font-weight: 800; text-transform: uppercase; opacity: 0.9; }
    input, textarea { width: 100%; box-sizing: border-box; border: 2px solid #5e9fcb; border-radius: 10px; padding: 10px; font-size: 14px; background: #f7fcff; }
    textarea { min-height: 90px; resize: vertical; }
    button { border: 0; border-radius: 8px; padding: 9px 11px; font-weight: 800; cursor: pointer; }
    .blue { background: #1565c0; color: #fff; }
    .red { background: #d62828; color: #fff; }
    .gray { background: #e8f5ff; color: #24506f; }
    .filters { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: end; }
    .message { min-height: 18px; margin: 10px 0; font-weight: 800; color: #1565c0; }
    .section-tools { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: space-between; margin: 12px 0; }
    .table-wrap { overflow-x: auto; border-radius: 12px; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; overflow: hidden; border-radius: 12px; }
    th, td { border-bottom: 1px solid #d4e8f6; padding: 9px; text-align: left; vertical-align: top; }
    th { color: #ffffff; background: #1565c0; text-transform: uppercase; font-size: 11px; }
    tr:nth-child(even) td { background: #f7fcff; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; min-width: 150px; }
    .photos { display: flex; gap: 6px; flex-wrap: wrap; max-width: 230px; }
    .photos img { width: 78px; height: 62px; object-fit: cover; border-radius: 10px; border: 2px solid #b8dcf7; box-shadow: 0 5px 12px rgba(21,101,192,0.18); }
    .small { color: #4d6478; font-size: 12px; line-height: 1.35; }
    .modal[hidden] { display: none; }
    .modal { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 22px; background: rgba(8,24,42,0.55); }
    .modal-card { width: min(820px, 100%); max-height: calc(100vh - 44px); overflow: auto; border-radius: 18px; border: 2px solid #aee4ff; background: linear-gradient(145deg, #ffffff, #edf8ff); box-shadow: 0 24px 70px rgba(8,24,42,0.38); }
    .modal-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 16px 18px; color: #fff; background: linear-gradient(135deg, #8f0d14, #1565c0); }
    .modal-body { padding: 16px 18px; }
    .edit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .edit-photos { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
    .edit-photo { width: 132px; border-radius: 14px; padding: 8px; background: #fff; border: 2px solid #b8dcf7; box-shadow: 0 8px 18px rgba(21,101,192,0.12); }
    .edit-photo.removed { opacity: 0.42; border-color: #d62828; }
    .edit-photo img { width: 100%; height: 86px; object-fit: cover; border-radius: 10px; display: block; margin-bottom: 8px; cursor: zoom-in; }
    .photo-preview { width: min(760px, 100%); max-height: 80vh; object-fit: contain; border-radius: 14px; background: #102033; }
    @media (max-width: 860px) { table { font-size: 12px; } .filters, .hero-strip { grid-template-columns: 1fr; } header { align-items: flex-start; flex-direction: column; } }
    @media (max-width: 720px) { .edit-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <div class="header-copy">
      <p class="eyebrow">Supervisor Console</p>
      <h1>Truck-Safe Delivery Notes</h1>
      <p class="header-subtitle">Review account instructions, customer photos, and driver handoff notes.</p>
    </div>
    <div class="header-actions">
      <div class="role-badge">${adminBadge}</div>
      <form method="post" action="/api/routing/manual-hazards/admin/logout"><button class="logout" type="submit">Log Out</button></form>
    </div>
  </header>
  <nav class="admin-tabs">
    <a class="tab hazard" href="/api/routing/manual-hazards/admin">Hazard Review</a>
    <a class="tab active" href="/api/delivery-notes/admin">Delivery Notes</a>
    <a class="tab" href="/api/route-manifests/admin">Route Manifests</a>
    <a class="tab" href="/api/drivers/admin">Driver Registry</a>
    <a class="tab" href="/api/admin">Supervisor Dashboard</a>
  </nav>
  <main>
    <div class="hero-strip">
      <div class="hero-tile"><div class="hero-value">Accounts</div><div class="hero-label">Customer-specific delivery notes</div></div>
      <div class="hero-tile blue"><div class="hero-value">Photos</div><div class="hero-label">Visual arrival guidance</div></div>
      <div class="hero-tile light"><div class="hero-value">Handoff</div><div class="hero-label">Shared knowledge for future drivers</div></div>
    </div>
    <section>
      <h2>Search Notes</h2>
      <div class="filters">
        <input id="search" placeholder="Search by account, customer, address, or destination" />
        <button class="blue" onclick="loadNotes()">Search</button>
      </div>
      <div class="section-tools">
        <div class="small"><strong>Delivery notes</strong> are tied to the destination/account and are shown to future drivers.</div>
        <button class="gray" onclick="exportNotes()">Export Delivery Notes</button>
      </div>
      <div id="message" class="message"></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Account</th><th>Destination</th><th>Instructions</th><th>Photos</th><th>Actions</th></tr></thead>
          <tbody id="notes"></tbody>
        </table>
      </div>
    </section>
  </main>
  <div id="editorOverlay" class="modal" hidden>
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <p class="eyebrow">Edit Delivery Note</p>
          <h2 id="editorTitle">Delivery note</h2>
        </div>
        <button class="logout" onclick="closeEditor()">Close</button>
      </div>
      <div class="modal-body">
        <div class="edit-grid">
          <div><label>Account or business</label><input id="editAccountName" /></div>
          <div><label>Customer / contact</label><input id="editCustomerName" /></div>
          <div><label>Driver name</label><input id="editDriverName" /></div>
          <div><label>Address</label><input id="editAddress" /></div>
        </div>
        <label>Destination</label><input id="editDestination" />
        <label>Instructions</label><textarea id="editInstructions"></textarea>
        <label>Saved Photos</label>
        <div id="editPhotos" class="edit-photos"></div>
        <div class="actions">
          <button class="blue" onclick="saveEditedNote()">Save Changes</button>
          <button class="gray" onclick="closeEditor()">Cancel</button>
        </div>
      </div>
    </div>
  </div>
  <div id="photoOverlay" class="modal" hidden onclick="closePhotoPreview()">
    <img id="photoPreview" class="photo-preview" alt="Delivery note photo preview" />
  </div>
  <script>
    const api = '/api/delivery-notes';
    let notes = [];
    let editingNoteId = null;
    let removedPhotoIds = new Set();
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, function (char) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
      });
    }
    function inputValue(id) { return document.getElementById(id).value.trim(); }
    function setInputValue(id, value) { document.getElementById(id).value = value || ''; }
    function setMessage(text) { document.getElementById('message').textContent = text || ''; }
    function exportNotes() { window.location.href = api + '/export'; }
    function filteredNotes() {
      const term = document.getElementById('search').value.trim().toLowerCase();
      if (!term) return notes;
      return notes.filter((note) => [note.accountName, note.customerName, note.destination, note.address, note.instructions].join(' ').toLowerCase().includes(term));
    }
    async function loadNotes() {
      const response = await fetch(api);
      const data = await response.json();
      notes = data.notes || [];
      render();
    }
    function render() {
      const rows = filteredNotes().map((note) => {
        const photos = (note.photos || []).map((photo) => '<img src="' + escapeHtml(photo.url) + '" onclick="openPhotoPreview(' + escapeHtml(JSON.stringify(photo.url)) + ')" />').join('');
        return '<tr>' +
          '<td><strong>' + escapeHtml(note.accountName || 'Unassigned') + '</strong><br><span class="small">' + escapeHtml(note.customerName || '') + '<br>Driver: ' + escapeHtml(note.driverName || '') + '</span></td>' +
          '<td>' + escapeHtml(note.destination || '') + '<br><span class="small">' + escapeHtml(note.address || '') + '<br>' + escapeHtml(note.createdAt || '') + '</span></td>' +
          '<td>' + escapeHtml(note.instructions || '') + '</td>' +
          '<td><div class="photos">' + photos + '</div></td>' +
          '<td><div class="actions"><button class="blue" onclick="editNote(&quot;' + escapeHtml(note.id) + '&quot;)">Edit</button><button class="red" onclick="deleteNote(&quot;' + escapeHtml(note.id) + '&quot;)">Delete</button></div></td>' +
          '</tr>';
      }).join('');
      document.getElementById('notes').innerHTML = rows || '<tr><td colspan="5">No delivery notes found.</td></tr>';
    }
    function getNote(id) {
      return notes.find((item) => item.id === id);
    }
    function openPhotoPreview(url) {
      document.getElementById('photoPreview').src = url;
      document.getElementById('photoOverlay').hidden = false;
    }
    function closePhotoPreview() {
      document.getElementById('photoOverlay').hidden = true;
      document.getElementById('photoPreview').src = '';
    }
    function renderEditorPhotos(note) {
      const photos = note.photos || [];
      const rows = photos.map((photo, index) => {
        const photoId = photo.id || photo.filename || String(index);
        const removed = removedPhotoIds.has(photoId);
        return '<div class="edit-photo ' + (removed ? 'removed' : '') + '">' +
          '<img src="' + escapeHtml(photo.url) + '" onclick="openPhotoPreview(' + escapeHtml(JSON.stringify(photo.url)) + ')" />' +
          '<button class="' + (removed ? 'blue' : 'red') + '" onclick="togglePhotoRemoval(' + escapeHtml(JSON.stringify(photoId)) + ')">' + (removed ? 'Keep Photo' : 'Remove Photo') + '</button>' +
          '</div>';
      }).join('');
      document.getElementById('editPhotos').innerHTML = rows || '<div class="small">No saved photos for this note.</div>';
    }
    function togglePhotoRemoval(photoId) {
      if (removedPhotoIds.has(photoId)) {
        removedPhotoIds.delete(photoId);
      } else {
        removedPhotoIds.add(photoId);
      }
      const note = getNote(editingNoteId);
      if (note) renderEditorPhotos(note);
    }
    function editNote(id) {
      const note = notes.find((item) => item.id === id);
      if (!note) return;
      editingNoteId = id;
      removedPhotoIds = new Set();
      document.getElementById('editorTitle').textContent = note.accountName || note.destination || 'Delivery note';
      setInputValue('editAccountName', note.accountName);
      setInputValue('editCustomerName', note.customerName);
      setInputValue('editDriverName', note.driverName);
      setInputValue('editAddress', note.address);
      setInputValue('editDestination', note.destination);
      setInputValue('editInstructions', note.instructions);
      renderEditorPhotos(note);
      document.getElementById('editorOverlay').hidden = false;
    }
    function closeEditor() {
      editingNoteId = null;
      removedPhotoIds = new Set();
      document.getElementById('editorOverlay').hidden = true;
    }
    async function saveEditedNote() {
      const note = getNote(editingNoteId);
      if (!note) return;
      const existingPhotos = (note.photos || []).filter((photo, index) => {
        const photoId = photo.id || photo.filename || String(index);
        return !removedPhotoIds.has(photoId);
      });
      const response = await fetch(api + '/' + encodeURIComponent(editingNoteId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...note,
          accountName: inputValue('editAccountName'),
          customerName: inputValue('editCustomerName'),
          driverName: inputValue('editDriverName'),
          address: inputValue('editAddress'),
          destination: inputValue('editDestination'),
          instructions: inputValue('editInstructions'),
          existingPhotos,
          photos: []
        })
      });
      const data = await response.json();
      setMessage(response.ok ? 'Updated ' + editingNoteId : data.error);
      if (response.ok) {
        closeEditor();
        loadNotes();
      }
    }
    async function deleteNote(id) {
      if (!confirm('Delete this delivery note and its photos?')) return;
      const response = await fetch(api + '/' + encodeURIComponent(id), { method: 'DELETE' });
      const data = await response.json();
      setMessage(response.ok ? 'Deleted ' + id : data.error);
      loadNotes();
    }
    document.getElementById('search').addEventListener('input', render);
    loadNotes();
  </script>
</body>
</html>`;
}

router.get('/admin', requireAdminAuth, (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.send(renderDeliveryNotesAdminPage(req.adminSession));
});

router.get('/photos/:filename', requireAdminAuth, (req, res) => {
  const filename = path.basename(cleanText(req.params.filename, 160));
  const fullPath = photoStorage.getLocalPhotoPath(filename);

  if (!filename || !fullPath || !fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'photo not found' });
  }

  res.set('Cache-Control', 'public, max-age=86400');
  return res.sendFile(fullPath);
});

module.exports = router;
