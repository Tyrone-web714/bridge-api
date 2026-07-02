// routes/routing.js
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('@googlemaps/google-maps-services-js');
const repositories = require('../db/repositories');
const adminAuth = require('../services/adminAuth');
const driverAuth = require('../services/driverAuth');
const photoStorage = require('../services/photoStorage');
const router = express.Router();

const client = new Client({});

// DATA
const bridges = require('../data/low_clearance_bridges.json');        // [{id, latitude, longitude, clearance_ft, ...}]
let noTruckZones = [];
let residentialZones = [];
const MANUAL_HAZARDS_FILE = path.join(__dirname, '..', 'data', 'manual_hazards.json');
let manualHazardsDbCache = null;
const MAX_HAZARD_REPORT_PHOTOS = 4;
const MAX_HAZARD_PHOTO_BYTES = 4_000_000;
const MAX_HAZARD_BASE64_CHARS = Math.ceil(MAX_HAZARD_PHOTO_BYTES * 1.38);

// Safe fallbacks if files not present
try { noTruckZones = require('../data/no_truck_zones.json'); } catch {}
try { residentialZones = require('../data/residential_zones.json'); } catch {}

// ------- helpers -------

function readAllManualHazards() {
  if (repositories.isDatabaseEnabled() && Array.isArray(manualHazardsDbCache)) {
    return manualHazardsDbCache;
  }

  try {
    if (!fs.existsSync(MANUAL_HAZARDS_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(MANUAL_HAZARDS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('manual-hazards read error:', error.message);
    return [];
  }
}

function readManualHazards() {
  return readAllManualHazards().filter((hazard) => (
    hazard.enabled === true &&
    hazard.status === 'confirmed'
  ));
}

function writeManualHazards(records) {
  if (repositories.isDatabaseEnabled()) {
    manualHazardsDbCache = Array.isArray(records) ? records : [];
    return;
  }

  fs.mkdirSync(path.dirname(MANUAL_HAZARDS_FILE), { recursive: true });
  fs.writeFileSync(MANUAL_HAZARDS_FILE, JSON.stringify(records, null, 2));
}

async function readAllManualHazardsAsync(options = {}) {
  if (repositories.isDatabaseEnabled()) {
    const records = await repositories.listManualHazards({ includeAll: true, ...options });
    if (!options.status && !options.category && !options.source) {
      manualHazardsDbCache = records;
    }
    return records;
  }

  let records = readAllManualHazards();
  if (options.status && ['pending', 'confirmed', 'rejected'].includes(options.status)) {
    records = records.filter((record) => record.status === options.status);
  }
  if (options.category) {
    records = records.filter((record) => record.category === options.category);
  }
  if (options.source) {
    records = records.filter((record) => normalizeManualSource(record.report_source, 'manual_admin') === options.source);
  }
  return records;
}

async function readManualHazardsAsync() {
  if (repositories.isDatabaseEnabled()) {
    const records = await repositories.listManualHazards({ includeAll: false });
    manualHazardsDbCache = await repositories.listManualHazards({ includeAll: true });
    return records;
  }
  return readManualHazards();
}

async function saveManualHazardRecord(hazard) {
  if (repositories.isDatabaseEnabled()) {
    await repositories.upsertManualHazard(hazard);
    manualHazardsDbCache = await repositories.listManualHazards({ includeAll: true });
    return hazard;
  }

  const existingRecords = readAllManualHazards();
  const nextRecords = [hazard, ...existingRecords.filter((record) => record.id !== hazard.id)];
  writeManualHazards(nextRecords);
  return hazard;
}

async function deleteManualHazardRecord(id) {
  if (repositories.isDatabaseEnabled()) {
    const deleted = await repositories.deleteManualHazard(id);
    manualHazardsDbCache = await repositories.listManualHazards({ includeAll: true });
    return deleted;
  }

  const existingRecords = readAllManualHazards();
  const existing = existingRecords.find((record) => record.id === id);
  if (!existing) return null;
  writeManualHazards(existingRecords.filter((record) => record.id !== id));
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

function setAdminSessionCookie(req, res, username, role, sessionVersion) {
  adminAuth.setAdminSessionCookie(req, res, username, role, sessionVersion);
}

function clearAdminSessionCookie(res) {
  adminAuth.clearAdminSessionCookie(res);
}

function requireAdminAuth(req, res, next) {
  const wantsAdminHtml = req.method === 'GET' && (
    req.originalUrl.includes('/manual-hazards/admin') ||
    req.originalUrl.includes('/hazard-verification/admin') ||
    req.originalUrl.includes('/route-sessions/admin')
  );

  if (!getAdminPassword() || !getAdminSecret()) {
    if (wantsAdminHtml) {
      return res.status(503).send(renderAdminLoginPage({
        setupRequired: true
      }));
    }
    return res.status(503).json({
      error: 'Admin dashboard password is not configured on the backend.'
    });
  }

  const session = getAdminSession(req);
  if (session) {
    req.adminSession = session;
    return next();
  }

  if (wantsAdminHtml) {
    return res.redirect('/api/routing/manual-hazards/admin/login');
  }
  return res.status(401).json({ error: 'Supervisor admin login required.' });
}

function requireAdminRole(req, res, next) {
  return requireAdminAuth(req, res, () => {
    if (req.adminSession?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required for this action.' });
    }
    return next();
  });
}

function cleanManualText(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanNullableText(value, maxLength = 180) {
  const cleaned = cleanManualText(value, maxLength);
  return cleaned || null;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectHazardPhotoMimeType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (
    buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return 'image/png';
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp';
  return null;
}

async function saveHazardReportPhotos(photos, hazardId, req) {
  const submitted = Array.isArray(photos) ? photos.slice(0, MAX_HAZARD_REPORT_PHOTOS) : [];
  const saved = [];
  for (const [index, photo] of submitted.entries()) {
    const base64 = String(photo?.base64 || '').replace(/\s+/g, '');
    if (!base64) continue;
    if (
      base64.length > MAX_HAZARD_BASE64_CHARS
      || base64.length % 4 !== 0
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)
    ) {
      const error = new Error(`hazard photo ${index + 1} is invalid or too large`);
      error.status = 413;
      throw error;
    }
    const buffer = Buffer.from(base64, 'base64');
    const detectedMimeType = detectHazardPhotoMimeType(buffer);
    if (!detectedMimeType || buffer.length > MAX_HAZARD_PHOTO_BYTES) {
      const error = new Error(`hazard photo ${index + 1} must be a JPEG, PNG, or WebP image under 4 MB`);
      error.status = detectedMimeType ? 413 : 415;
      throw error;
    }
    saved.push(await photoStorage.saveHazardReportPhoto({
      req,
      buffer,
      mimeType: detectedMimeType,
      noteId: hazardId,
      index: index + 1,
      originalName: photo?.fileName || photo?.filename || null
    }));
  }
  return saved;
}

async function saveDriverReportForStaticVerification(hazard, photos = []) {
  const raw = {
    ...hazard,
    manual_hazard_id: hazard.id,
    report_source: 'driver_report',
    verification_status: 'needs_review',
    photos
  };
  if (hazard.category === 'low_bridge') {
    await repositories.upsertStaticBridge(raw);
  } else {
    await repositories.upsertStaticZone(raw, hazard.category);
  }
  return repositories.updateStaticHazardVerification(hazard.category, hazard.id, {
    verification_status: 'needs_review',
    verification_notes: hazard.notes || 'Driver-submitted hazard awaiting supervisor verification.',
    location_address: hazard.nearby_address || null,
    location_description: hazard.notes || hazard.name || null,
    active: false
  });
}

function normalizeManualCategory(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['low_bridge', 'low_clearance', 'bridge'].includes(normalized)) return 'low_bridge';
  if (['no_truck', 'no_truck_zone', 'truck_restricted', 'restricted_road'].includes(normalized)) return 'no_truck';
  if (['residential', 'residential_zone', 'residential_restriction'].includes(normalized)) return 'residential';
  return null;
}

function normalizeManualSource(value, fallback = 'manual_admin') {
  if (!value && !fallback) return null;
  const normalized = cleanManualText(value || fallback, 40).toLowerCase().replace(/[\s-]+/g, '_');
  if (['driver_report', 'driver', 'driver_app'].includes(normalized)) return 'driver_report';
  if (['manual_admin', 'admin', 'supervisor'].includes(normalized)) return 'manual_admin';
  return 'manual_admin';
}

function normalizeConfidence(value, fallback = null) {
  const normalized = cleanManualText(value || fallback, 20).toLowerCase();
  if (['low', 'medium', 'high'].includes(normalized)) return normalized;
  return null;
}

function normalizeBooleanOrNull(value, fallback = null) {
  if (value === true || value === false) return value;
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', 'yes', '1', 'on-route', 'on_route'].includes(normalized)) return true;
  if (['false', 'no', '0', 'off-route', 'off_route'].includes(normalized)) return false;
  return fallback;
}

function normalizeManualPointList(points) {
  if (!Array.isArray(points)) return [];

  return points
    .map((point) => {
      const lat = Number(point?.lat ?? point?.latitude);
      const lng = Number(point?.lng ?? point?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    })
    .filter(Boolean);
}

function normalizeManualHazardInput(input, existing = {}) {
  const category = normalizeManualCategory(input?.category ?? existing.category);
  if (!category) {
    const error = new Error('category must be low_bridge, no_truck, or residential');
    error.status = 400;
    throw error;
  }

  const latitude = Number(input?.latitude ?? input?.lat ?? existing.latitude);
  const longitude = Number(input?.longitude ?? input?.lng ?? existing.longitude);
  const geometry = normalizeManualPointList(input?.geometry ?? existing.geometry);
  const polygon = normalizeManualPointList(input?.polygon ?? existing.polygon);

  if (
    (!Number.isFinite(latitude) || !Number.isFinite(longitude)) &&
    geometry.length < 2 &&
    polygon.length < 3
  ) {
    const error = new Error('manual hazard requires latitude/longitude, geometry, or polygon');
    error.status = 400;
    throw error;
  }

  const now = new Date().toISOString();
  const id = cleanManualText(input?.id || existing.id || `manual-${category}-${Date.now()}`, 80);
  const clearance = Number(input?.clearance_ft ?? input?.clearanceFt ?? existing.clearance_ft);
  const rawStatus = cleanManualText(input?.status ?? existing.status ?? 'confirmed', 30).toLowerCase();
  const status = ['pending', 'confirmed', 'rejected'].includes(rawStatus) ? rawStatus : 'pending';
  const enabled = input?.enabled === undefined
    ? status === 'confirmed'
    : Boolean(input.enabled) && status === 'confirmed';
  const inputReviewedBy = cleanNullableText(input?.reviewed_by, 120);
  const existingReviewedBy = cleanNullableText(existing.reviewed_by, 120);
  const reviewedBy = inputReviewedBy ?? existingReviewedBy;
  const shouldStampReview =
    ['confirmed', 'rejected'].includes(status) &&
    (status !== existing.status || inputReviewedBy || input?.review_notes || input?.rejection_reason);

  return {
    id,
    category,
    name: cleanManualText(input?.name ?? existing.name) || `Manual ${category.replace(/_/g, ' ')} hazard`,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    clearance_ft: Number.isFinite(clearance) ? clearance : null,
    restriction: cleanNullableText(input?.restriction ?? existing.restriction, 300),
    notes: cleanNullableText(input?.notes ?? existing.notes, 500),
    reported_by: cleanNullableText(input?.reported_by ?? existing.reported_by, 120),
    source: 'manual_override',
    report_source: normalizeManualSource(input?.report_source ?? input?.source_type ?? existing.report_source, 'manual_admin'),
    status,
    enabled,
    driver_id: cleanNullableText(input?.driver_id ?? existing.driver_id, 120),
    driver_name: cleanNullableText(input?.driver_name ?? existing.driver_name, 120),
    route_destination: cleanNullableText(input?.route_destination ?? existing.route_destination, 240),
    reported_at: cleanNullableText(input?.reported_at ?? existing.reported_at, 80),
    reported_speed_mph: numberOrNull(input?.reported_speed_mph ?? input?.speed_mph ?? existing.reported_speed_mph),
    reported_heading: numberOrNull(input?.reported_heading ?? input?.heading ?? existing.reported_heading),
    route_deviation_m: numberOrNull(input?.route_deviation_m ?? existing.route_deviation_m),
    was_on_route: normalizeBooleanOrNull(input?.was_on_route, existing.was_on_route ?? null),
    nearby_address: cleanNullableText(input?.nearby_address ?? existing.nearby_address, 240),
    reviewed_by: reviewedBy,
    reviewed_at: cleanNullableText(input?.reviewed_at ?? existing.reviewed_at, 80) || (shouldStampReview ? now : null),
    review_notes: cleanNullableText(input?.review_notes ?? existing.review_notes, 500),
    rejection_reason: cleanNullableText(input?.rejection_reason ?? existing.rejection_reason, 300),
    confidence: normalizeConfidence(input?.confidence, existing.confidence),
    geometry,
    polygon,
    created_at: existing.created_at || now,
    updated_at: now
  };
}

function normalizeDriverHazardReport(input) {
  return normalizeManualHazardInput({
    ...input,
    id: input?.id || `report-${Date.now()}`,
    status: 'pending',
    enabled: false,
    report_source: 'driver_report',
    reported_at: input?.reported_at || new Date().toISOString(),
    reported_by: cleanManualText(input?.reported_by || 'driver', 120),
    notes: cleanManualText(input?.notes || input?.description || 'Driver-submitted hazard report', 500)
  });
}

function splitManualHazards(records = readManualHazards()) {
  return {
    lowBridges: records.filter((hazard) => hazard.category === 'low_bridge'),
    noTruckZones: records.filter((hazard) => hazard.category === 'no_truck'),
    residentialZones: records.filter((hazard) => hazard.category === 'residential')
  };
}

function getBoundsForPoints(points) {
  const normalizedPoints = (Array.isArray(points) ? points : [])
    .map(normalizeLatLng)
    .filter(Boolean);

  if (!normalizedPoints.length) return null;

  return normalizedPoints.reduce((bounds, point) => ({
    north: Math.max(bounds.north, point.lat),
    south: Math.min(bounds.south, point.lat),
    east: Math.max(bounds.east, point.lng),
    west: Math.min(bounds.west, point.lng)
  }), {
    north: normalizedPoints[0].lat,
    south: normalizedPoints[0].lat,
    east: normalizedPoints[0].lng,
    west: normalizedPoints[0].lng
  });
}

function expandBoundsByMeters(bounds, meters) {
  if (!bounds) return null;

  const latitudePadding = meters / 111320;
  const centerLatitude = (bounds.north + bounds.south) / 2;
  const longitudeMetersPerDegree = Math.max(
    25000,
    111320 * Math.cos((centerLatitude * Math.PI) / 180)
  );
  const longitudePadding = meters / longitudeMetersPerDegree;

  return {
    north: Math.min(90, bounds.north + latitudePadding),
    south: Math.max(-90, bounds.south - latitudePadding),
    east: Math.min(180, bounds.east + longitudePadding),
    west: Math.max(-180, bounds.west - longitudePadding)
  };
}

async function getHazardDatasetsForBounds(bounds, limits = {}) {
  const manualRecords = await readManualHazardsAsync();
  const manualHazards = splitManualHazards(manualRecords);

  if (!repositories.isDatabaseEnabled()) {
    return {
      bridges: [...bridges, ...manualHazards.lowBridges],
      noTruckZones: [...noTruckZones, ...manualHazards.noTruckZones],
      residentialZones: [...residentialZones, ...manualHazards.residentialZones],
      source: 'json-fallback'
    };
  }

  const [bridgeRecords, noTruckRecords, residentialRecords] = await Promise.all([
    repositories.listStaticBridgesInBounds(bounds, limits.bridgeLimit || 8000),
    repositories.listStaticZonesInBounds('no_truck', bounds, limits.noTruckLimit || 16000),
    repositories.listStaticZonesInBounds('residential', bounds, limits.residentialLimit || 24000)
  ]);
  const postgisEnabled = await repositories.isPostgisEnabled();

  return {
    bridges: [...bridgeRecords, ...manualHazards.lowBridges],
    noTruckZones: [...noTruckRecords, ...manualHazards.noTruckZones],
    residentialZones: [...residentialRecords, ...manualHazards.residentialZones],
    source: postgisEnabled ? 'postgis' : 'postgres'
  };
}

async function getHazardDatasetsForRoute(points, opts = {}) {
  const maxBufferMeters = Math.max(
    Number(opts.bridgeBufferMeters) || 120,
    Number(opts.restrictedRoadBufferMeters) || 45,
    500
  );
  const manualRecords = await readManualHazardsAsync();
  const manualHazards = splitManualHazards(manualRecords);

  if (repositories.isDatabaseEnabled() && await repositories.isPostgisEnabled()) {
    const [bridgeRecords, noTruckRecords, residentialRecords] = await Promise.all([
      repositories.listStaticBridgesNearRoute(points, Number(opts.bridgeBufferMeters) || 120, 12000),
      repositories.listStaticZonesNearRoute('no_truck', points, Number(opts.restrictedRoadBufferMeters) || 45, 26000),
      repositories.listStaticZonesNearRoute('residential', points, Number(opts.restrictedRoadBufferMeters) || 45, 36000)
    ]);

    return {
      bridges: [...(bridgeRecords || []), ...manualHazards.lowBridges],
      noTruckZones: [...(noTruckRecords || []), ...manualHazards.noTruckZones],
      residentialZones: [...(residentialRecords || []), ...manualHazards.residentialZones],
      source: 'postgis'
    };
  }

  const bounds = expandBoundsByMeters(getBoundsForPoints(points), maxBufferMeters);
  return getHazardDatasetsForBounds(bounds, {
    bridgeLimit: 12000,
    noTruckLimit: 26000,
    residentialLimit: 36000
  });
}

function renderAdminLoginPage(options = {}) {
  const { error = '', setupRequired = false } = options;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Truck-Safe Supervisor Login</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; background: linear-gradient(145deg, #eef7ff, #fff5f6); color: #102033; }
    .card { width: min(420px, calc(100vw - 32px)); border-radius: 18px; padding: 24px; background: #ffffff; border: 1px solid #cfe8ff; box-shadow: 0 18px 42px rgba(21, 101, 192, 0.16); }
    .brand { min-height: 8px; border-radius: 999px; background: linear-gradient(90deg, #d62828, #ffffff, #1565c0); margin-bottom: 18px; }
    h1 { margin: 0; font-size: 24px; line-height: 30px; color: #b5121b; }
    p { margin: 8px 0 0; color: #4d6478; line-height: 1.45; }
    label { display: block; margin: 16px 0 6px; font-size: 12px; font-weight: 900; color: #24506f; text-transform: uppercase; }
    input { width: 100%; box-sizing: border-box; min-height: 46px; border-radius: 10px; border: 1px solid #b8dcf7; padding: 10px 12px; font-size: 16px; }
    button { width: 100%; min-height: 48px; margin-top: 18px; border: 0; border-radius: 12px; background: #d62828; color: #fff; font-size: 14px; font-weight: 900; text-transform: uppercase; cursor: pointer; }
    .message { margin-top: 12px; border-radius: 10px; padding: 10px; font-weight: 800; }
    .error { background: #ffe3e3; color: #a11b1b; }
    .setup { background: #fff3cd; color: #7a4f00; }
    code { display: block; margin-top: 8px; padding: 10px; border-radius: 8px; background: #102033; color: #fff; white-space: pre-wrap; }
  </style>
</head>
<body>
  <main class="card">
    <div class="brand"></div>
    <h1>Supervisor Dashboard</h1>
    <p>Sign in to review pending driver hazard reports and manage confirmed route restrictions.</p>
    ${setupRequired ? `<div class="message setup">Admin login is not configured. Add this to <strong>C:\\dev\\bridge-api\\bridge-api\\.env</strong>, then restart the backend:<code>ADMIN_DASHBOARD_PASSWORD=choose-a-strong-password
ADMIN_DASHBOARD_SECRET=choose-a-long-random-secret</code></div>` : ''}
    ${error ? `<div class="message error">${error}</div>` : ''}
    <form method="post" action="/api/routing/manual-hazards/admin/login">
      <label>Username</label>
      <input name="username" autocomplete="username" placeholder="supervisor" value="supervisor" />
      <label>Password</label>
      <input name="password" type="password" autocomplete="current-password" autofocus />
      <button type="submit">Log In</button>
    </form>
  </main>
</body>
</html>`;
}

function renderAdminBadgeText(session = {}) {
  const adminRole = cleanManualText(session.role || 'supervisor', 40);
  const adminUser = cleanManualText(session.username || 'supervisor', 80);
  return adminUser.toLowerCase() === adminRole.toLowerCase()
    ? adminUser
    : `${adminUser} - ${adminRole}`;
}

function renderAdminUsersPage(session = {}) {
  const adminBadge = renderAdminBadgeText(session);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Truck-Safe Supervisor Accounts</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: linear-gradient(145deg, #8fc2df 0%, #eef7ff 42%, #fff0f3 100%); color: #102033; }
    header { background: linear-gradient(135deg, #8f0d14 0%, #d62828 50%, #0d47a1 100%); color: #fff; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; box-shadow: 0 14px 34px rgba(12,38,64,0.22); }
    main { max-width: 1120px; margin: 0 auto; padding: 20px; }
    section { background: rgba(255,255,255,0.94); border: 2px solid #5e9fcb; border-left: 7px solid #d62828; border-radius: 14px; padding: 16px; margin-bottom: 16px; box-shadow: 0 10px 26px rgba(21,101,192,0.12); }
    h1, h2 { margin: 0 0 12px; }
    .eyebrow { margin: 0 0 4px; color: #aee4ff; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .header-subtitle { margin: -4px 0 0; color: #ffe8ec; font-size: 14px; font-weight: 700; }
    .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
    .role-badge { border-radius: 999px; padding: 9px 12px; color: #fff; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.36); font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .logout { background: rgba(255,255,255,0.18); color: #fff; border: 1px solid rgba(255,255,255,0.42); border-radius: 999px; }
    .admin-tabs { max-width: 1120px; margin: 16px auto 0; padding: 0 20px; display: flex; gap: 10px; flex-wrap: wrap; }
    .tab { min-height: 44px; border-radius: 999px; padding: 0 18px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; font-weight: 900; text-transform: uppercase; font-size: 12px; color: #102033; background: rgba(255,255,255,0.78); border: 2px solid #5e9fcb; }
    .tab.active { color: #fff; background: #c8131f; border-color: #ffffff; box-shadow: 0 8px 18px rgba(200,19,31,0.24); }
    .tab.delivery { background: #1565c0; color: #fff; border-color: #aee4ff; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    label { display: block; font-size: 12px; font-weight: 900; color: #0d47a1; text-transform: uppercase; margin: 10px 0 4px; }
    input, select { width: 100%; box-sizing: border-box; border: 2px solid #5e9fcb; border-radius: 10px; padding: 10px; font-size: 15px; background: #f7fcff; }
    button { border: 0; border-radius: 8px; padding: 10px 12px; font-weight: 800; cursor: pointer; }
    .primary { background: #d62828; color: #fff; }
    .blue { background: #1565c0; color: #fff; }
    .danger { background: #ffe3e3; color: #a11b1b; }
    .gray { background: #e8f5ff; color: #24506f; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .message { min-height: 20px; margin-bottom: 12px; font-weight: 900; color: #1565c0; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; overflow: hidden; border-radius: 12px; }
    th, td { border-bottom: 1px solid #d4e8f6; padding: 10px; text-align: left; vertical-align: top; }
    th { color: #fff; background: #1565c0; text-transform: uppercase; font-size: 11px; }
    tr:nth-child(even) td { background: #f7fcff; }
    .pill { display: inline-block; border-radius: 999px; padding: 4px 9px; font-weight: 900; font-size: 11px; text-transform: uppercase; }
    .active-pill { background: #dff4e7; color: #146c2e; }
    .inactive-pill { background: #ffe3e3; color: #a11b1b; }
    .small { color: #4d6478; font-size: 12px; line-height: 1.35; }
    @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } header { align-items: flex-start; flex-direction: column; } table { font-size: 12px; } }
  </style>
</head>
<body>
  <header>
    <div>
      <p class="eyebrow">Administrative Access</p>
      <h1>Supervisor Accounts</h1>
      <p class="header-subtitle">Create named accounts, assign roles, and control dashboard access.</p>
    </div>
    <div class="header-actions">
      <div class="role-badge">${adminBadge}</div>
      <form method="post" action="/api/routing/manual-hazards/admin/logout"><button class="logout" type="submit">Log Out</button></form>
    </div>
  </header>
  <nav class="admin-tabs">
    <a class="tab" href="/api/routing/manual-hazards/admin">Hazard Review</a>
    <a class="tab" href="/api/routing/hazard-verification/admin">Static Hazard Verification</a>
    <a class="tab" href="/api/routing/route-sessions/admin">Route Replay</a>
    <a class="tab delivery" href="/api/delivery-notes/admin">Delivery Notes</a>
    <a class="tab" href="/api/route-manifests/admin">Route Manifests</a>
    <a class="tab" href="/api/drivers/admin">Driver Registry</a>
    <a class="tab active" href="/api/routing/manual-hazards/admin-users/admin">Supervisor Accounts</a>
    <a class="tab" href="/api/admin">Supervisor Dashboard</a>
  </nav>
  <main>
    <section>
      <h2>Create or Update Account</h2>
      <div id="message" class="message"></div>
      <div class="grid">
        <div><label>Username</label><input id="username" placeholder="supervisor.name" /></div>
        <div><label>Display name</label><input id="displayName" placeholder="Supervisor Name" /></div>
        <div><label>Role</label><select id="role"><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></div>
        <div><label>New or Reset Password</label><input id="password" type="password" placeholder="12+ characters" /></div>
      </div>
      <div class="actions">
        <button class="primary" onclick="saveUser()">Save Account</button>
        <button class="gray" onclick="clearForm()">Clear</button>
      </div>
      <p class="small">The same account signs into the supervisor dashboard. Leave the password blank while editing to retain the current password.</p>
    </section>
    <section>
      <h2>Current Accounts</h2>
      <table>
        <thead><tr><th>Account</th><th>Role</th><th>Assigned Team</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
        <tbody id="users"></tbody>
      </table>
    </section>
  </main>
  <script>
    const api = '/api/routing/manual-hazards/admin-users';
    let users = [];
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, function (char) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
      });
    }
    function setMessage(value) { document.getElementById('message').textContent = value || ''; }
    function clearForm() {
      document.getElementById('username').value = '';
      document.getElementById('displayName').value = '';
      document.getElementById('role').value = 'supervisor';
      document.getElementById('password').value = '';
    }
    async function loadUsers() {
      const response = await fetch(api);
      const data = await response.json();
      users = data.users || [];
      renderUsers();
    }
    function editUser(username) {
      const user = users.find((item) => item.username === username);
      if (!user) return;
      document.getElementById('username').value = user.username;
      document.getElementById('displayName').value = user.displayName || '';
      document.getElementById('role').value = user.role || 'supervisor';
      document.getElementById('password').value = '';
      setMessage('Editing ' + user.username + '. Leave password blank to keep the current password.');
    }
    function renderUsers() {
      document.getElementById('users').innerHTML = users.map((user) => (
        '<tr>' +
          '<td><strong>' + escapeHtml(user.username) + '</strong><br><span class="small">' + escapeHtml(user.displayName || '') + '</span></td>' +
          '<td>' + escapeHtml(user.role || 'supervisor') + '</td>' +
          '<td><strong>' + escapeHtml(user.driverCount || 0) + ' drivers</strong><br><span class="small">' + escapeHtml(user.teamCount || 0) + ' teams</span></td>' +
          '<td><span class="pill ' + (user.active ? 'active-pill' : 'inactive-pill') + '">' + (user.active ? 'active' : 'inactive') + '</span></td>' +
          '<td>' + escapeHtml(user.lastLoginAt || 'No login recorded') + '</td>' +
          '<td><div class="actions"><button class="blue" onclick="editUser(' + JSON.stringify(user.username).replace(/"/g, '&quot;') + ')">Edit</button>' +
          '<button class="' + (user.active ? 'danger' : 'blue') + '" onclick="setActive(' + JSON.stringify(user.username).replace(/"/g, '&quot;') + ', ' + (!user.active) + ')">' + (user.active ? 'Deactivate' : 'Activate') + '</button></div></td>' +
        '</tr>'
      )).join('') || '<tr><td colspan="6">No supervisor accounts found.</td></tr>';
    }
    async function saveUser() {
      const payload = {
        username: document.getElementById('username').value.trim(),
        displayName: document.getElementById('displayName').value.trim(),
        role: document.getElementById('role').value,
        password: document.getElementById('password').value
      };
      const response = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      setMessage(response.ok ? 'Saved ' + data.user.username : data.error);
      if (response.ok) {
        clearForm();
        loadUsers();
      }
    }
    async function setActive(username, active) {
      const response = await fetch(api + '/' + encodeURIComponent(username) + '/active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      });
      const data = await response.json();
      setMessage(response.ok ? 'Updated ' + username : data.error);
      loadUsers();
    }
    loadUsers();
  </script>
</body>
</html>`;
}

function renderManualHazardAdminPage(session = {}) {
  const adminRole = cleanManualText(session.role || 'supervisor', 40);
  const adminUser = cleanManualText(session.username || 'supervisor', 80);
  const adminBadge = renderAdminBadgeText(session);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Truck-Safe Manual Hazards</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: linear-gradient(145deg, #8fc2df 0%, #eef7ff 38%, #fff0f3 100%); color: #102033; }
    header { background: linear-gradient(135deg, #8f0d14 0%, #d62828 50%, #0d47a1 100%); color: #fff; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; box-shadow: 0 14px 34px rgba(12,38,64,0.22); }
    main { max-width: 1280px; margin: 0 auto; padding: 20px; }
    section { background: rgba(255,255,255,0.94); border: 2px solid #5e9fcb; border-left: 7px solid #1565c0; border-radius: 14px; padding: 16px; margin-bottom: 16px; box-shadow: 0 10px 26px rgba(21, 101, 192, 0.12); }
    .add-card { border-left-color: #d62828; }
    .review-card { border-left-color: #1565c0; }
    h1, h2 { margin: 0 0 12px; }
    .header-copy { min-width: 0; }
    .eyebrow { margin: 0 0 4px; color: #aee4ff; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .header-subtitle { margin: -4px 0 0; color: #ffe8ec; font-size: 14px; font-weight: 700; }
    .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
    .role-badge { border-radius: 999px; padding: 9px 12px; color: #fff; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.36); font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .admin-tabs { max-width: 1280px; margin: 16px auto 0; padding: 0 20px; display: flex; gap: 10px; flex-wrap: wrap; }
    .tab { min-height: 44px; border-radius: 999px; padding: 0 18px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; font-weight: 900; text-transform: uppercase; font-size: 12px; color: #102033; background: rgba(255,255,255,0.78); border: 2px solid #5e9fcb; }
    .tab.active { color: #fff; background: #c8131f; border-color: #ffffff; box-shadow: 0 8px 18px rgba(200,19,31,0.24); }
    .tab.delivery { background: #1565c0; color: #fff; border-color: #aee4ff; }
    .tab.delivery.active { background: #0d47a1; }
    .hero-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
    .hero-tile { border-radius: 14px; padding: 14px; color: #fff; background: linear-gradient(135deg, #c8131f, #8f0d14); box-shadow: 0 8px 20px rgba(143,13,20,0.18); }
    .hero-tile.blue { background: linear-gradient(135deg, #1565c0, #0d47a1); }
    .hero-tile.light { color: #102033; background: linear-gradient(135deg, #e2f2fb, #ffffff); border: 2px solid #5e9fcb; }
    .hero-value { font-size: 22px; font-weight: 900; }
    .hero-label { margin-top: 4px; font-size: 12px; font-weight: 800; text-transform: uppercase; opacity: 0.9; }
    label { display: block; font-size: 12px; font-weight: 900; color: #0d47a1; text-transform: uppercase; margin: 10px 0 4px; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 2px solid #5e9fcb; border-radius: 10px; padding: 10px; font-size: 15px; background: #f7fcff; }
    textarea { min-height: 72px; resize: vertical; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .filters { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; align-items: end; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .queue-tools { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: space-between; margin: 12px 0; }
    button { border: 0; border-radius: 8px; padding: 10px 12px; font-weight: 800; cursor: pointer; }
    .logout { background: rgba(255,255,255,0.18); color: #fff; border: 1px solid rgba(255,255,255,0.42); border-radius: 999px; }
    .primary { background: #d62828; color: #fff; }
    .blue { background: #1565c0; color: #fff; }
    .gray { background: #e8f5ff; color: #24506f; }
    .danger { background: #ffe3e3; color: #a11b1b; }
    .gold { background: #fff0c2; color: #7a4f00; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; overflow: hidden; border-radius: 12px; }
    th, td { border-bottom: 1px solid #d4e8f6; padding: 9px; text-align: left; vertical-align: top; }
    th { color: #ffffff; background: #1565c0; text-transform: uppercase; font-size: 11px; }
    tr:nth-child(even) td { background: #f7fcff; }
    .pill { display: inline-block; border-radius: 999px; padding: 3px 8px; font-weight: 800; font-size: 11px; }
    .pending { background: #fff3cd; color: #7a4f00; }
    .confirmed { background: #dff4e7; color: #146c2e; }
    .rejected { background: #ffe3e3; color: #a11b1b; }
    .source { background: #e8f5ff; color: #24506f; }
    .meta { color: #4d6478; line-height: 1.35; }
    .small { font-size: 12px; color: #4d6478; }
    .message { min-height: 18px; margin-bottom: 10px; font-weight: 800; color: #1565c0; }
    .table-wrap { overflow-x: auto; }
    .row-actions { display: flex; gap: 6px; flex-wrap: wrap; min-width: 220px; }
    @media (max-width: 860px) { .grid, .filters, .hero-strip { grid-template-columns: 1fr; } table { font-size: 12px; } header { align-items: flex-start; flex-direction: column; } }
  </style>
</head>
<body>
  <header>
    <div class="header-copy">
      <p class="eyebrow">Supervisor Console</p>
      <h1>Truck-Safe Manual Hazards</h1>
      <p class="header-subtitle">Review driver reports, confirm route hazards, and manage active restrictions.</p>
    </div>
    <div class="header-actions">
      <div class="role-badge">${adminBadge}</div>
      <form method="post" action="/api/routing/manual-hazards/admin/logout"><button class="logout" type="submit">Log Out</button></form>
    </div>
  </header>
  <nav class="admin-tabs">
    <a class="tab active" href="/api/routing/manual-hazards/admin">Hazard Review</a>
    <a class="tab" href="/api/routing/hazard-verification/admin">Static Hazard Verification</a>
    <a class="tab" href="/api/routing/route-sessions/admin">Route Replay</a>
    <a class="tab delivery" href="/api/delivery-notes/admin">Delivery Notes</a>
    <a class="tab" href="/api/route-manifests/admin">Route Manifests</a>
    <a class="tab" href="/api/drivers/admin">Driver Registry</a>
    <a class="tab" href="/api/admin">Supervisor Dashboard</a>
  </nav>
  <main>
    <div class="hero-strip">
      <div class="hero-tile"><div class="hero-value">Live</div><div class="hero-label">Driver hazard queue</div></div>
      <div class="hero-tile blue"><div class="hero-value">Route</div><div class="hero-label">Restriction intelligence</div></div>
      <div class="hero-tile light"><div class="hero-value">Safe</div><div class="hero-label">Confirmed records only affect routing</div></div>
    </div>
    <section class="add-card">
      <h2>Add Confirmed Hazard</h2>
      <div class="grid">
        <div><label>Type</label><select id="category"><option value="low_bridge">Low bridge</option><option value="no_truck">No truck</option><option value="residential">Residential</option></select></div>
        <div><label>Name</label><input id="name" placeholder="Confirmed hazard name" /></div>
        <div><label>Latitude</label><input id="latitude" placeholder="29.4241" /></div>
        <div><label>Longitude</label><input id="longitude" placeholder="-98.4936" /></div>
      </div>
      <div class="grid">
        <div><label>Clearance ft</label><input id="clearance_ft" placeholder="12.5" /></div>
        <div><label>Restriction</label><input id="restriction" placeholder="No through trucks" /></div>
        <div><label>Reported by</label><input id="reported_by" placeholder="Admin / driver" /></div>
        <div><label>Status</label><select id="status"><option value="confirmed">Confirmed</option><option value="pending">Pending</option></select></div>
      </div>
      <div class="grid">
        <div><label>Confidence</label><select id="confidence"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
        <div><label>Reviewed by</label><input id="reviewed_by" placeholder="Supervisor name" /></div>
        <div><label>Route destination</label><input id="route_destination" placeholder="Optional destination context" /></div>
        <div><label>Nearby address</label><input id="nearby_address" placeholder="Optional address" /></div>
      </div>
      <label>Notes</label><textarea id="notes" placeholder="Evidence, source, driver notes"></textarea>
      <div class="actions"><button class="primary" onclick="createHazard()">Save Hazard</button><button class="gray" onclick="loadHazards()">Refresh</button></div>
    </section>
    <section class="review-card">
      <h2>Manual Hazard Review Queue</h2>
      <div class="filters">
        <div><label>Status</label><select id="filter_status" onchange="loadHazards()"><option value="">All</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="rejected">Rejected</option></select></div>
        <div><label>Hazard type</label><select id="filter_category" onchange="loadHazards()"><option value="">All</option><option value="low_bridge">Low bridge</option><option value="no_truck">No truck</option><option value="residential">Residential</option></select></div>
        <div><label>Source</label><select id="filter_source" onchange="loadHazards()"><option value="">All</option><option value="driver_report">Driver reported</option><option value="manual_admin">Manual admin</option></select></div>
        <div><button class="blue" onclick="loadHazards()">Apply Filters</button></div>
      </div>
      <div class="queue-tools">
        <div class="small"><strong>Pending driver reports</strong> stay out of routing until a supervisor confirms them.</div>
        <div class="actions">
          <button class="gold" onclick="showDriverReports()">Show Driver Reports</button>
          <button class="gray" onclick="exportHazards('all')">Export All Hazards</button>
          <button class="gray" onclick="exportHazards('driver_report')">Export Driver Reports</button>
        </div>
      </div>
      <div id="message" class="message"></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Status</th><th>Source</th><th>Type</th><th>Name</th><th>Location</th><th>Details</th><th>Driver / Route</th><th>Review</th><th>Actions</th></tr></thead>
          <tbody id="hazards"></tbody>
        </table>
      </div>
    </section>
  </main>
  <script>
    const api = '/api/routing/manual-hazards';
    function value(id) { return document.getElementById(id).value.trim(); }
    function setMessage(text) { document.getElementById('message').textContent = text || ''; }
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, function (char) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
      });
    }
    function display(value, fallback) {
      return escapeHtml(value ?? fallback ?? '');
    }
    function promptValue(label, currentValue) {
      const nextValue = window.prompt(label, currentValue ?? '');
      return nextValue === null ? currentValue : nextValue.trim();
    }
    function promptNumber(label, currentValue) {
      const nextValue = window.prompt(label, currentValue ?? '');
      if (nextValue === null || nextValue.trim() === '') return null;
      const parsed = Number(nextValue);
      return Number.isFinite(parsed) ? parsed : currentValue;
    }
    function buildQuery() {
      const params = new URLSearchParams({ includeAll: 'true' });
      const status = value('filter_status');
      const category = value('filter_category');
      const source = value('filter_source');
      if (status) params.set('status', status);
      if (category) params.set('category', category);
      if (source) params.set('source', source);
      return params.toString();
    }
    function showDriverReports() {
      document.getElementById('filter_source').value = 'driver_report';
      document.getElementById('filter_status').value = 'pending';
      loadHazards();
    }
    function exportHazards(source) {
      const params = new URLSearchParams();
      if (source && source !== 'all') params.set('source', source);
      const suffix = params.toString() ? ('?' + params.toString()) : '';
      window.location.href = api + '/export' + suffix;
    }
    async function loadHazards() {
      const res = await fetch(api + '?' + buildQuery());
      const data = await res.json();
      const rows = (data.hazards || []).map((h) => {
        const status = h.status || (h.enabled ? 'confirmed' : 'pending');
        const source = h.report_source || 'manual_admin';
        const locationDisplay = [
          h.nearby_address ? ('Address / landmark: ' + h.nearby_address) : '',
          (h.latitude !== null && h.latitude !== undefined && h.longitude !== null && h.longitude !== undefined)
            ? ('Coordinates: ' + h.latitude + ', ' + h.longitude)
            : ''
        ].filter(Boolean).map(escapeHtml).join('<br>') || 'No location detail';
        const driverRoute = [
          h.driver_name || h.driver_id || h.reported_by,
          h.route_destination ? ('Route: ' + h.route_destination) : '',
          Number.isFinite(Number(h.reported_speed_mph)) ? ('Speed: ' + Math.round(Number(h.reported_speed_mph)) + ' mph') : '',
          Number.isFinite(Number(h.reported_heading)) ? ('Heading: ' + Math.round(Number(h.reported_heading)) + ' deg') : '',
          Number.isFinite(Number(h.route_deviation_m)) ? ('Route deviation: ' + Math.round(Number(h.route_deviation_m)) + ' m') : '',
          h.was_on_route === true ? 'On route' : (h.was_on_route === false ? 'Off route' : ''),
          h.reported_at ? ('Reported: ' + h.reported_at) : ''
        ].filter(Boolean).map(escapeHtml).join('<br>');
        const review = [
          h.confidence ? ('Confidence: ' + h.confidence) : '',
          h.reviewed_by ? ('Reviewed by: ' + h.reviewed_by) : '',
          h.reviewed_at ? ('Reviewed: ' + h.reviewed_at) : '',
          h.review_notes ? ('Notes: ' + h.review_notes) : '',
          h.rejection_reason ? ('Reject reason: ' + h.rejection_reason) : ''
        ].filter(Boolean).map(escapeHtml).join('<br>');
        return '<tr>' +
          '<td><span class="pill ' + status + '">' + status + '</span></td>' +
          '<td><span class="pill source">' + display(source) + '</span></td>' +
          '<td>' + display(h.category) + '</td>' +
          '<td>' + display(h.name) + '<br><small>' + display(h.id) + '</small></td>' +
          '<td class="meta">' + locationDisplay + '</td>' +
          '<td>' + (h.clearance_ft ? ('Clearance: ' + display(h.clearance_ft) + ' ft<br>') : '') + display(h.restriction) + '<br><small>' + display(h.notes) + '</small></td>' +
          '<td class="meta">' + (driverRoute || '<span class="small">No driver metadata</span>') + '</td>' +
          '<td class="meta">' + (review || '<span class="small">Not reviewed</span>') + '</td>' +
          '<td><div class="row-actions"><button class="blue" onclick="confirmHazard(&quot;' + escapeHtml(h.id) + '&quot;)">Review Confirm</button>' +
          '<button class="danger" onclick="rejectHazard(&quot;' + escapeHtml(h.id) + '&quot;)">Reject</button>' +
          '<button class="gray" onclick="deleteHazard(&quot;' + escapeHtml(h.id) + '&quot;)">Delete</button></div></td>' +
          '</tr>';
      }).join('');
      document.getElementById('hazards').innerHTML = rows || '<tr><td colspan="9">No manual hazards match these filters.</td></tr>';
    }
    async function createHazard() {
      const payload = {
        category: value('category'), name: value('name'), latitude: Number(value('latitude')), longitude: Number(value('longitude')),
        clearance_ft: value('clearance_ft') ? Number(value('clearance_ft')) : null,
        restriction: value('restriction'), reported_by: value('reported_by'), status: value('status'), notes: value('notes'),
        report_source: 'manual_admin', confidence: value('confidence'), reviewed_by: value('reviewed_by'),
        route_destination: value('route_destination'), nearby_address: value('nearby_address')
      };
      const res = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      setMessage(res.ok ? 'Saved ' + data.hazard.id : data.error);
      if (res.ok) loadHazards();
    }
    async function getHazard(id) {
      const res = await fetch(api + '?includeAll=true');
      const data = await res.json();
      return (data.hazards || []).find(function (hazard) { return hazard.id === id; });
    }
    async function confirmHazard(id) {
      const h = await getHazard(id);
      if (!h) return setMessage('Hazard not found: ' + id);
      const payload = {
        status: 'confirmed',
        enabled: true,
        category: promptValue('Confirm hazard type: low_bridge, no_truck, or residential', h.category),
        name: promptValue('Hazard name', h.name),
        latitude: promptNumber('Latitude', h.latitude),
        longitude: promptNumber('Longitude', h.longitude),
        clearance_ft: promptNumber('Clearance ft, blank if not a low bridge', h.clearance_ft),
        restriction: promptValue('Restriction', h.restriction),
        notes: promptValue('Notes', h.notes),
        nearby_address: promptValue('Physical address or landmark description', h.nearby_address || ''),
        reviewed_by: promptValue('Reviewed by', h.reviewed_by || 'supervisor'),
        review_notes: promptValue('Review notes', h.review_notes || 'Confirmed after supervisor review.'),
        confidence: promptValue('Confidence: low, medium, or high', h.confidence || 'medium'),
        rejection_reason: ''
      };
      const res = await fetch(api + '/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      setMessage(res.ok ? 'Confirmed ' + id : data.error);
      loadHazards();
    }
    async function rejectHazard(id) {
      const h = await getHazard(id);
      if (!h) return setMessage('Hazard not found: ' + id);
      const payload = {
        status: 'rejected',
        enabled: false,
        reviewed_by: promptValue('Reviewed by', h.reviewed_by || 'supervisor'),
        review_notes: promptValue('Review notes', h.review_notes || ''),
        rejection_reason: promptValue('Rejection reason', h.rejection_reason || 'Unable to verify hazard.'),
        confidence: promptValue('Confidence: low, medium, or high', h.confidence || 'low')
      };
      const res = await fetch(api + '/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      setMessage(res.ok ? 'Rejected ' + id : data.error);
      loadHazards();
    }
    async function deleteHazard(id) {
      if (!window.confirm('Delete hazard ' + id + '?')) return;
      const res = await fetch(api + '/' + encodeURIComponent(id), { method: 'DELETE' });
      const data = await res.json();
      setMessage(res.ok ? 'Deleted ' + id : data.error);
      loadHazards();
    }
    loadHazards();
  </script>
</body>
</html>`;
}

function renderHazardVerificationAdminPage(session = {}) {
  const adminRole = cleanManualText(session.role || 'supervisor', 40);
  const adminUser = cleanManualText(session.username || 'supervisor', 80);
  const adminBadge = renderAdminBadgeText(session);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Truck-Safe Static Hazard Verification</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: linear-gradient(145deg, #102033 0%, #16476f 42%, #fff2f4 100%); color: #102033; }
    header { background: linear-gradient(135deg, #7c0b12 0%, #d62828 48%, #0d47a1 100%); color: #fff; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; box-shadow: 0 14px 34px rgba(12,38,64,0.28); }
    main { max-width: 1440px; margin: 0 auto; padding: 20px; }
    section { background: rgba(255,255,255,0.94); border: 2px solid #8fc2df; border-left: 8px solid #d62828; border-radius: 16px; padding: 16px; margin-bottom: 16px; box-shadow: 0 12px 30px rgba(12,38,64,0.18); }
    h1, h2 { margin: 0 0 12px; }
    .eyebrow { margin: 0 0 4px; color: #aee4ff; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .subtitle { margin: -4px 0 0; color: #ffe8ec; font-size: 14px; font-weight: 700; }
    .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
    .role-badge { border-radius: 999px; padding: 9px 12px; color: #fff; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.36); font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .admin-tabs { max-width: 1280px; margin: 16px auto 0; padding: 0 20px; display: flex; gap: 10px; flex-wrap: wrap; }
    .tab { min-height: 44px; border-radius: 999px; padding: 0 18px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; font-weight: 900; text-transform: uppercase; font-size: 12px; color: #102033; background: rgba(255,255,255,0.82); border: 2px solid #8fc2df; }
    .tab.active { color: #fff; background: #c8131f; border-color: #ffffff; box-shadow: 0 8px 18px rgba(200,19,31,0.24); }
    .tab.delivery { background: #1565c0; color: #fff; border-color: #aee4ff; }
    .logout { background: rgba(255,255,255,0.18); color: #fff; border: 1px solid rgba(255,255,255,0.42); border-radius: 999px; padding: 10px 12px; font-weight: 800; cursor: pointer; }
    .hero-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
    .hero-tile { border-radius: 16px; padding: 14px; color: #fff; background: linear-gradient(135deg, #c8131f, #8f0d14); box-shadow: 0 8px 20px rgba(143,13,20,0.18); }
    .hero-tile.blue { background: linear-gradient(135deg, #1565c0, #0d47a1); }
    .hero-tile.gold { background: linear-gradient(135deg, #ffc857, #c77d00); color: #2b1a00; }
    .hero-tile.green { background: linear-gradient(135deg, #24a148, #0b6b2b); }
    .hero-value { font-size: 22px; font-weight: 900; }
    .hero-label { margin-top: 4px; font-size: 12px; font-weight: 800; text-transform: uppercase; opacity: 0.9; }
    label { display: block; font-size: 12px; font-weight: 900; color: #0d47a1; text-transform: uppercase; margin: 10px 0 4px; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 2px solid #8fc2df; border-radius: 10px; padding: 10px; font-size: 15px; background: #f7fcff; }
    textarea { min-height: 74px; resize: vertical; }
    .filters { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; align-items: end; }
    .workspace { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(380px, 0.9fr); gap: 16px; align-items: start; }
    .map-shell { position: sticky; top: 12px; min-height: 680px; overflow: hidden; border-radius: 18px; border: 2px solid #8fc2df; background: #102033; box-shadow: 0 16px 34px rgba(16,32,51,0.22); }
    #verificationMap { height: 680px; width: 100%; }
    .map-tools { position: absolute; z-index: 500; left: 14px; top: 14px; display: flex; gap: 8px; flex-wrap: wrap; max-width: calc(100% - 28px); }
    .map-tools button { box-shadow: 0 8px 18px rgba(16,32,51,0.24); }
    .legend { position: absolute; z-index: 500; left: 14px; bottom: 14px; display: flex; gap: 8px; flex-wrap: wrap; background: rgba(16,32,51,0.84); color: #fff; border: 1px solid rgba(255,255,255,0.28); border-radius: 999px; padding: 8px 10px; font-size: 12px; font-weight: 900; }
    .legend span { display: inline-flex; align-items: center; gap: 5px; }
    .dot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
    .dot.bridge { background: #d62828; }
    .dot.no-truck { background: #7c3aed; }
    .dot.residential { background: #1565c0; }
    .side-panel { max-height: 760px; overflow: auto; }
    .record-list { display: grid; gap: 10px; }
    .record-card { border: 2px solid #d4e8f6; border-left: 8px solid #8fc2df; border-radius: 14px; background: #ffffff; padding: 12px; cursor: pointer; transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease; }
    .record-card:hover, .record-card.active { transform: translateY(-1px); border-color: #1565c0; box-shadow: 0 10px 24px rgba(21,101,192,0.15); }
    .record-card.low_bridge { border-left-color: #d62828; }
    .record-card.no_truck { border-left-color: #7c3aed; }
    .record-card.residential { border-left-color: #1565c0; }
    .record-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 900; }
    .record-id { font-size: 12px; color: #4d6478; word-break: break-word; }
    .record-detail { margin-top: 8px; color: #4d6478; font-size: 13px; line-height: 1.35; }
    .report-photos { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 9px; }
    .report-photos img { width: 92px; height: 72px; object-fit: cover; border-radius: 8px; border: 2px solid #8fc2df; }
    button { border: 0; border-radius: 10px; padding: 10px 12px; font-weight: 900; cursor: pointer; }
    .primary { background: #d62828; color: #fff; }
    .blue { background: #1565c0; color: #fff; }
    .gray { background: #e8f5ff; color: #24506f; }
    .danger { background: #ffe3e3; color: #a11b1b; }
    .gold { background: #fff0c2; color: #7a4f00; }
    .green { background: #dff4e7; color: #146c2e; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; overflow: hidden; border-radius: 12px; }
    th, td { border-bottom: 1px solid #d4e8f6; padding: 9px; text-align: left; vertical-align: top; }
    th { color: #ffffff; background: #0d47a1; text-transform: uppercase; font-size: 11px; }
    tr:nth-child(even) td { background: #f7fcff; }
    .pill { display: inline-block; border-radius: 999px; padding: 3px 8px; font-weight: 900; font-size: 11px; }
    .unverified { background: #fff3cd; color: #7a4f00; }
    .verified { background: #dff4e7; color: #146c2e; }
    .needs_review { background: #e8f5ff; color: #0d47a1; }
    .inactive, .incorrect { background: #ffe3e3; color: #a11b1b; }
    .meta { color: #4d6478; line-height: 1.35; }
    .message { min-height: 20px; margin: 10px 0; font-weight: 900; color: #1565c0; }
    .row-actions { display: flex; gap: 6px; flex-wrap: wrap; min-width: 260px; }
    .leaflet-popup-content { min-width: 260px; }
    .map-marker { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-size: 11px; font-weight: 900; border: 3px solid #fff; box-shadow: 0 8px 18px rgba(16,32,51,0.36); }
    .map-marker.low_bridge { background: #d62828; }
    .map-marker.no_truck { background: #7c3aed; }
    .map-marker.residential { background: #1565c0; }
    .picked-marker { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: #ff2d2d; font-size: 18px; font-weight: 900; border: 3px solid #fff; box-shadow: 0 8px 18px rgba(16,32,51,0.42); }
    .quick-add { margin-top: 16px; border-left-color: #1565c0; background: linear-gradient(145deg, rgba(255,255,255,0.96), rgba(232,245,255,0.96)); }
    .quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .copy-row { display: flex; gap: 8px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
    .coord-readout { font-family: Consolas, monospace; font-size: 13px; font-weight: 900; color: #102033; background: #ffffff; border: 2px solid #8fc2df; border-radius: 999px; padding: 8px 12px; }
    @media (max-width: 1100px) { .workspace { grid-template-columns: 1fr; } .map-shell { position: relative; min-height: 520px; } #verificationMap { height: 520px; } .side-panel { max-height: none; } }
    @media (max-width: 980px) { .filters, .hero-strip, .quick-grid { grid-template-columns: 1fr; } header { align-items: flex-start; flex-direction: column; } }
  </style>
</head>
<body>
  <header>
    <div>
      <p class="eyebrow">Supervisor Console</p>
      <h1>Static Hazard Verification</h1>
      <p class="subtitle">Verify imported records and driver-reported missing hazards before they affect routing.</p>
    </div>
    <div class="header-actions">
      <div class="role-badge">${adminBadge}</div>
      <form method="post" action="/api/routing/manual-hazards/admin/logout"><button class="logout" type="submit">Log Out</button></form>
    </div>
  </header>
  <nav class="admin-tabs">
    <a class="tab" href="/api/routing/manual-hazards/admin">Hazard Review</a>
    <a class="tab active" href="/api/routing/hazard-verification/admin">Static Hazard Verification</a>
    <a class="tab" href="/api/routing/route-sessions/admin">Route Replay</a>
    <a class="tab delivery" href="/api/delivery-notes/admin">Delivery Notes</a>
    <a class="tab" href="/api/route-manifests/admin">Route Manifests</a>
    <a class="tab" href="/api/drivers/admin">Driver Registry</a>
    <a class="tab" href="/api/admin">Supervisor Dashboard</a>
  </nav>
  <main>
    <div class="hero-strip">
      <div class="hero-tile gold"><div id="countUnverified" class="hero-value">0</div><div class="hero-label">Unverified shown</div></div>
      <div class="hero-tile green"><div id="countVerified" class="hero-value">0</div><div class="hero-label">Verified shown</div></div>
      <div class="hero-tile blue"><div id="countReview" class="hero-value">0</div><div class="hero-label">Needs review shown</div></div>
      <div class="hero-tile"><div id="countInactive" class="hero-value">0</div><div class="hero-label">Inactive / incorrect shown</div></div>
    </div>
    <section>
      <h2>Verification Filters</h2>
      <div class="filters">
        <div><label>Hazard type</label><select id="category" onchange="handleHazardTypeChange()"><option value="low_bridge">Low bridge</option><option value="no_truck">No truck</option><option value="residential">Residential</option></select></div>
        <div><label>Status</label><select id="status" onchange="loadHazards()"><option value="">Active only</option><option value="unverified">Unverified</option><option value="verified">Verified</option><option value="needs_review">Needs review</option><option value="inactive">Inactive</option><option value="incorrect">Incorrect</option></select></div>
        <div><label>State area</label><select id="stateFilter" onchange="handleStateFilterChange()"><option value="service">TX / OK / NM / AR</option><option value="TX">Texas</option><option value="OK">Oklahoma</option><option value="NM">New Mexico</option><option value="AR">Arkansas</option><option value="all">All states</option></select></div>
        <div><label>Data quality</label><select id="qualityFilter" onchange="loadHazards()"><option value="">All records</option><option value="missing_city">Missing city</option><option value="missing_address">Missing address</option><option value="needs_geocode">Needs geocode</option><option value="complete_location">Complete location</option></select></div>
        <div><label>Search area</label><select id="areaMode" onchange="loadHazards()"><option value="map">Current map view</option><option value="all">No map bounds</option><option value="manual">Manual bounds</option></select></div>
        <div><label>Limit</label><select id="limit" onchange="loadHazards()"><option value="500">500</option><option value="300">300</option><option value="150">150</option></select></div>
      </div>
      <div class="filters" style="margin-top:10px">
        <div><label>North</label><input id="north" placeholder="manual only" /></div>
        <div><label>South</label><input id="south" placeholder="manual only" /></div>
        <div><label>East</label><input id="east" placeholder="manual only" /></div>
        <div><label>West</label><input id="west" placeholder="manual only" /></div>
        <div><button class="gray" onclick="fillBoundsFromMap()">Use Map Bounds</button></div>
      </div>
      <div class="row-actions" style="margin-top:12px">
        <button class="gray" onclick="clearBounds()">Clear Bounds</button>
        <button class="gold" onclick="showNeedsReview()">Needs Review</button>
        <button class="gray" onclick="toggleInactive()">Toggle Inactive</button>
        <button class="blue" onclick="queueMissingLocations()">Queue Missing Locations</button>
        <button class="green" onclick="loadBackfillStats()">Backfill Stats</button>
      </div>
      <div id="message" class="message"></div>
    </section>
    <div class="workspace">
      <div class="map-shell">
        <div class="map-tools">
          <button class="blue" onclick="loadHazardsFromMap()">Load Current Map</button>
          <button class="gray" onclick="fitAllHazards()">Fit Results</button>
          <button class="gold" onclick="centerServiceArea()">Service Area</button>
        </div>
        <div id="verificationMap"></div>
        <div class="legend">
          <span><i class="dot bridge"></i>Low bridge</span>
          <span><i class="dot no-truck"></i>No truck</span>
          <span><i class="dot residential"></i>Residential</span>
        </div>
      </div>
      <section class="side-panel">
        <section class="quick-add">
          <h2 id="quickAddTitle">Add Missing Low Bridge</h2>
          <div id="quickAddHelp" class="small">Tap the map where the bridge is located. The coordinates below will populate automatically.</div>
          <div class="copy-row">
            <span id="pickedCoordReadout" class="coord-readout">No point selected</span>
            <button class="gray" onclick="copyPickedCoordinates()">Copy Coordinates</button>
          </div>
          <div class="quick-grid">
            <div><label>Latitude</label><input id="pickedLatitude" placeholder="Tap map" /></div>
            <div><label>Longitude</label><input id="pickedLongitude" placeholder="Tap map" /></div>
            <div><label>Supervisor name</label><input id="manualBridgeSupervisor" placeholder="Supervisor name" value="${adminUser}" /></div>
            <div><label id="manualHazardNameLabel">Bridge / road name</label><input id="manualBridgeName" placeholder="Example: Commerce St railroad bridge" /></div>
            <div id="clearanceField"><label>Clearance ft</label><input id="manualBridgeClearance" placeholder="Example: 12.6" /></div>
            <div><label>Physical address</label><input id="manualBridgeAddress" placeholder="Nearest address or cross street" /></div>
            <div><label id="manualHazardLandmarkLabel">Landmark description</label><input id="manualBridgeLandmark" placeholder="Driver-friendly landmark" /></div>
          </div>
          <div class="row-actions" style="margin-top:12px">
            <button id="quickAddButton" class="primary" onclick="createManualHazard()">Add Confirmed Low Bridge</button>
            <button class="gray" onclick="clearPickedPoint()">Clear Point</button>
          </div>
        </section>
        <h2>Hazard Verification Records</h2>
        <div id="hazards" class="record-list"></div>
      </section>
    </div>
  </main>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const api = '/api/routing/hazard-verification';
    let includeInactive = false;
    let map = null;
    let hazardLayer = null;
    let pickedPointMarker = null;
    let currentHazards = [];
    let layerById = {};
    let selectedId = null;
    const stateBounds = {
      service: [[25.8, -106.7], [36.7, -89.6]],
      TX: [[25.8, -106.7], [36.6, -93.5]],
      OK: [[33.6, -103.1], [37.1, -94.3]],
      NM: [[31.2, -109.1], [37.1, -103.0]],
      AR: [[33.0, -94.7], [36.6, -89.6]]
    };

    function value(id) { return document.getElementById(id).value.trim(); }
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, function (char) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
      });
    }
    function display(value, fallback) { return escapeHtml(value ?? fallback ?? ''); }
    function hazardPhotosHtml(hazard) {
      const photos = Array.isArray(hazard && hazard.photos) ? hazard.photos : [];
      if (!photos.length) return '';
      return '<div class="report-photos">' + photos.map(function (photo) {
        const url = escapeHtml(photo && photo.url);
        return url ? '<a href="' + url + '" target="_blank" rel="noopener"><img src="' + url + '" alt="Driver hazard report photo" /></a>' : '';
      }).join('') + '</div>';
    }
    function setMessage(text) { document.getElementById('message').textContent = text || ''; }
    function formatHazardLocation(hazard) {
      const coordinates = [hazard.latitude, hazard.longitude]
        .filter(function (item) { return item !== null && item !== undefined; })
        .join(', ');
      return [
        hazard.location_address ? ('Address: ' + hazard.location_address) : '',
        'City: ' + (hazard.location_city || 'Needs lookup'),
        'State: ' + (hazard.state_code || hazard.location_state || 'Needs lookup'),
        hazard.location_description ? ('Landmark: ' + hazard.location_description) : '',
        coordinates ? ('Coordinates: ' + coordinates) : ''
      ].filter(Boolean).map(escapeHtml).join('<br>');
    }
    function getHazardLabel(category) {
      if (category === 'low_bridge') return 'LB';
      if (category === 'no_truck') return 'NT';
      return 'R';
    }
    function getQuickAddConfig(category) {
      if (category === 'no_truck') {
        return {
          title: 'Add Missing No-Truck Restriction',
          help: 'Tap the restricted road or zone on the map. The coordinates below will populate automatically.',
          nameLabel: 'Road / zone name',
          namePlaceholder: 'Example: Commerce St no-truck segment',
          landmarkLabel: 'Restriction / landmark description',
          landmarkPlaceholder: 'Example: No through trucks near customer entrance',
          button: 'Add Confirmed No-Truck Restriction',
          restriction: 'No truck restriction',
          defaultName: 'Manual no-truck restriction'
        };
      }
      if (category === 'residential') {
        return {
          title: 'Add Missing Residential Restriction',
          help: 'Tap the residential street or neighborhood on the map. The coordinates below will populate automatically.',
          nameLabel: 'Street / neighborhood name',
          namePlaceholder: 'Example: Oak Hills residential restriction',
          landmarkLabel: 'Restriction / landmark description',
          landmarkPlaceholder: 'Example: Residential no-through truck area',
          button: 'Add Confirmed Residential Restriction',
          restriction: 'Residential truck restriction',
          defaultName: 'Manual residential restriction'
        };
      }
      return {
        title: 'Add Missing Low Bridge',
        help: 'Tap the map where the bridge is located. The coordinates below will populate automatically.',
        nameLabel: 'Bridge / road name',
        namePlaceholder: 'Example: Commerce St railroad bridge',
        landmarkLabel: 'Landmark description',
        landmarkPlaceholder: 'Driver-friendly landmark',
        button: 'Add Confirmed Low Bridge',
        restriction: 'Low clearance bridge',
        defaultName: 'Manual low bridge'
      };
    }
    function updateQuickAddPanel() {
      const category = value('category') || 'low_bridge';
      const config = getQuickAddConfig(category);
      document.getElementById('quickAddTitle').textContent = config.title;
      document.getElementById('quickAddHelp').textContent = config.help;
      document.getElementById('manualHazardNameLabel').textContent = config.nameLabel;
      document.getElementById('manualBridgeName').placeholder = config.namePlaceholder;
      document.getElementById('manualHazardLandmarkLabel').textContent = config.landmarkLabel;
      document.getElementById('manualBridgeLandmark').placeholder = config.landmarkPlaceholder;
      document.getElementById('quickAddButton').textContent = config.button;
      document.getElementById('clearanceField').style.display = category === 'low_bridge' ? '' : 'none';
    }
    function initMap() {
      if (typeof L === 'undefined') {
        setMessage('Map library did not load. Check internet access, then refresh this page.');
        return;
      }
      map = L.map('verificationMap', {
        center: [33.1, -97.5],
        zoom: 6,
        zoomControl: true
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      hazardLayer = L.featureGroup().addTo(map);
      map.on('moveend', function () {
        if (value('areaMode') === 'map') fillBoundsFromMap(false);
      });
      map.on('click', function (event) {
        setPickedPoint(event.latlng.lat, event.latlng.lng);
      });
      map.fitBounds(stateBounds.service, { padding: [24, 24] });
    }
    function pickedPointIcon() {
      return L.divIcon({
        className: '',
        html: '<div class="picked-marker">+</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16]
      });
    }
    function setPickedPoint(lat, lng) {
      const latitude = Number(lat);
      const longitude = Number(lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      const latText = latitude.toFixed(6);
      const lngText = longitude.toFixed(6);
      document.getElementById('pickedLatitude').value = latText;
      document.getElementById('pickedLongitude').value = lngText;
      document.getElementById('pickedCoordReadout').textContent = latText + ', ' + lngText;

      if (!pickedPointMarker) {
        pickedPointMarker = L.marker([latitude, longitude], { icon: pickedPointIcon(), zIndexOffset: 2000 }).addTo(map);
      } else {
        pickedPointMarker.setLatLng([latitude, longitude]);
      }
      pickedPointMarker.bindPopup(
        '<strong>Selected location</strong><br>' +
        latText + ', ' + lngText + '<br>' +
        '<button class="primary" onclick="createManualHazard()">Add Hazard Here</button>'
      ).openPopup();
      setMessage('Selected map point ' + latText + ', ' + lngText + '.');
    }
    function clearPickedPoint() {
      document.getElementById('pickedLatitude').value = '';
      document.getElementById('pickedLongitude').value = '';
      document.getElementById('pickedCoordReadout').textContent = 'No point selected';
      if (pickedPointMarker && map) {
        map.removeLayer(pickedPointMarker);
        pickedPointMarker = null;
      }
      setMessage('Selected coordinate point cleared.');
    }
    async function copyPickedCoordinates() {
      const lat = value('pickedLatitude');
      const lng = value('pickedLongitude');
      if (!lat || !lng) {
        setMessage('Tap the map first to select coordinates.');
        return;
      }
      const text = lat + ', ' + lng;
      try {
        await navigator.clipboard.writeText(text);
        setMessage('Copied coordinates: ' + text);
      } catch {
        window.prompt('Copy these coordinates:', text);
      }
    }
    function centerServiceArea() {
      if (!map) return;
      document.getElementById('stateFilter').value = 'service';
      document.getElementById('areaMode').value = 'all';
      clearBoundsFields();
      map.fitBounds(stateBounds.service, { padding: [24, 24] });
      loadHazards();
    }
    function handleStateFilterChange() {
      const stateFilter = value('stateFilter') || 'service';
      document.getElementById('areaMode').value = 'all';
      document.getElementById('limit').value = '500';
      clearBoundsFields();
      if (map && stateBounds[stateFilter]) {
        map.fitBounds(stateBounds[stateFilter], { padding: [24, 24] });
      }
      setMessage(stateFilter === 'all' ? 'Loading all states.' : 'Loading ' + document.getElementById('stateFilter').selectedOptions[0].text + '.');
      loadHazards();
    }
    function handleHazardTypeChange() {
      document.getElementById('areaMode').value = 'all';
      document.getElementById('limit').value = '500';
      clearBoundsFields();
      updateQuickAddPanel();
      const stateFilter = value('stateFilter') || 'service';
      if (map && stateBounds[stateFilter]) {
        map.fitBounds(stateBounds[stateFilter], { padding: [24, 24] });
      }
      setMessage('Loading ' + document.getElementById('category').selectedOptions[0].text + ' records.');
      loadHazards();
    }
    function fillBoundsFromMap(shouldSwitch) {
      if (!map) return;
      const bounds = map.getBounds();
      document.getElementById('north').value = bounds.getNorth().toFixed(6);
      document.getElementById('south').value = bounds.getSouth().toFixed(6);
      document.getElementById('east').value = bounds.getEast().toFixed(6);
      document.getElementById('west').value = bounds.getWest().toFixed(6);
      if (shouldSwitch !== false) document.getElementById('areaMode').value = 'manual';
    }
    function buildQuery() {
      const params = new URLSearchParams();
      params.set('category', value('category') || 'low_bridge');
      params.set('limit', value('limit') || '150');
      if (value('status')) params.set('status', value('status'));
      if (value('qualityFilter')) params.set('quality', value('qualityFilter'));
      if (includeInactive) params.set('includeInactive', 'true');
      const stateFilter = value('stateFilter') || 'service';
      if (stateFilter === 'service') params.set('serviceAreaOnly', 'true');
      if (stateFilter !== 'service' && stateFilter !== 'all') params.set('state', stateFilter);
      const areaMode = value('areaMode');
      if (areaMode === 'map' && map) fillBoundsFromMap(false);
      if (areaMode !== 'all') {
        ['north', 'south', 'east', 'west'].forEach(function (id) {
          if (value(id)) params.set(id, value(id));
        });
      }
      return params.toString();
    }
    function clearBounds() {
      clearBoundsFields();
      document.getElementById('areaMode').value = 'all';
      loadHazards();
    }
    function clearBoundsFields() {
      ['north', 'south', 'east', 'west'].forEach(function (id) { document.getElementById(id).value = ''; });
    }
    function loadHazardsFromMap() {
      document.getElementById('areaMode').value = 'map';
      loadHazards();
    }
    function showNeedsReview() {
      document.getElementById('status').value = 'needs_review';
      includeInactive = true;
      loadHazards();
    }
    function toggleInactive() {
      includeInactive = !includeInactive;
      setMessage(includeInactive ? 'Inactive and incorrect records are included.' : 'Only active records are shown.');
      loadHazards();
    }
    function updateCounts(hazards) {
      const counts = { unverified: 0, verified: 0, needs_review: 0, inactive: 0, incorrect: 0 };
      hazards.forEach(function (hazard) { counts[hazard.verification_status || 'unverified'] = (counts[hazard.verification_status || 'unverified'] || 0) + 1; });
      document.getElementById('countUnverified').textContent = counts.unverified || 0;
      document.getElementById('countVerified').textContent = counts.verified || 0;
      document.getElementById('countReview').textContent = counts.needs_review || 0;
      document.getElementById('countInactive').textContent = (counts.inactive || 0) + (counts.incorrect || 0);
    }
    function toLatLng(point) {
      const lat = Number(point && (point.lat ?? point.latitude));
      const lng = Number(point && (point.lng ?? point.longitude));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [lat, lng];
    }
    function getHazardPoint(hazard) {
      const direct = toLatLng({ lat: hazard.latitude, lng: hazard.longitude });
      if (direct) return direct;
      if (Array.isArray(hazard.geometry) && hazard.geometry.length) return toLatLng(hazard.geometry[0]);
      if (Array.isArray(hazard.polygon) && hazard.polygon.length) return toLatLng(hazard.polygon[0]);
      return null;
    }
    function markerIcon(hazard) {
      const category = hazard.category || 'low_bridge';
      return L.divIcon({
        className: '',
        html: '<div class="map-marker ' + category + '">' + getHazardLabel(category) + '</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18]
      });
    }
    function styleForHazard(hazard) {
      if (hazard.category === 'low_bridge') return { color: '#d62828', fillColor: '#d62828', weight: 4, fillOpacity: 0.2 };
      if (hazard.category === 'no_truck') return { color: '#7c3aed', fillColor: '#7c3aed', weight: 4, fillOpacity: 0.18 };
      return { color: '#1565c0', fillColor: '#1565c0', weight: 4, fillOpacity: 0.14 };
    }
    function popupHtml(hazard) {
      const status = hazard.verification_status || 'unverified';
      const details = [
        '<strong>' + display(hazard.id) + '</strong>',
        hazard.name ? display(hazard.name) : '',
        '<span class="pill ' + status + '">' + display(status) + '</span>',
        formatHazardLocation(hazard),
        hazard.clearance_ft ? 'Clearance: ' + display(hazard.clearance_ft) + ' ft' : '',
        hazard.restriction ? display(hazard.restriction) : '',
        hazard.verification_notes ? 'Notes: ' + display(hazard.verification_notes) : ''
      ].filter(Boolean).join('<br>');
      const category = escapeHtml(hazard.category);
      const id = escapeHtml(hazard.id);
      return '<div>' + details + hazardPhotosHtml(hazard) + '<div class="row-actions" style="margin-top:10px; min-width:0">' +
        '<button class="green" onclick="setStatus(&quot;' + category + '&quot;,&quot;' + id + '&quot;,&quot;verified&quot;)">Verified</button>' +
        '<button class="gold" onclick="setStatus(&quot;' + category + '&quot;,&quot;' + id + '&quot;,&quot;needs_review&quot;)">Review</button>' +
        '<button class="danger" onclick="setStatus(&quot;' + category + '&quot;,&quot;' + id + '&quot;,&quot;incorrect&quot;)">Incorrect</button>' +
        '<button class="gray" onclick="setStatus(&quot;' + category + '&quot;,&quot;' + id + '&quot;,&quot;inactive&quot;)">Inactive</button>' +
        '<button class="blue" onclick="editLocation(&quot;' + category + '&quot;,&quot;' + id + '&quot;)">Location Note</button>' +
        '</div></div>';
    }
    function buildHazardLayer(hazard) {
      let layer = null;
      const style = styleForHazard(hazard);
      const polygon = Array.isArray(hazard.polygon) ? hazard.polygon.map(toLatLng).filter(Boolean) : [];
      const geometry = Array.isArray(hazard.geometry) ? hazard.geometry.map(toLatLng).filter(Boolean) : [];
      if (polygon.length >= 3) {
        layer = L.polygon(polygon, style);
      } else if (geometry.length >= 2) {
        layer = L.polyline(geometry, style);
      } else {
        const point = getHazardPoint(hazard);
        if (!point) return null;
        layer = L.marker(point, { icon: markerIcon(hazard) });
      }
      layer.bindPopup(popupHtml(hazard));
      layer.on('click', function () { selectHazard(hazard.id, false); });
      return layer;
    }
    function renderMap(hazards) {
      if (!map || !hazardLayer) return;
      hazardLayer.clearLayers();
      layerById = {};
      hazards.forEach(function (hazard) {
        const layer = buildHazardLayer(hazard);
        if (!layer) return;
        layerById[hazard.id] = layer;
        hazardLayer.addLayer(layer);
      });
      fitAllHazards();
    }
    function fitAllHazards() {
      if (!map || !hazardLayer || hazardLayer.getLayers().length === 0) return;
      map.fitBounds(hazardLayer.getBounds(), { padding: [36, 36], maxZoom: 16 });
    }
    function selectHazard(id, shouldZoom) {
      selectedId = id;
      document.querySelectorAll('.record-card').forEach(function (card) {
        card.classList.toggle('active', card.dataset.id === id);
      });
      const layer = layerById[id];
      if (!layer || !map) return;
      if (shouldZoom) {
        if (layer.getBounds) {
          map.fitBounds(layer.getBounds(), { padding: [48, 48], maxZoom: 17 });
        } else if (layer.getLatLng) {
          map.setView(layer.getLatLng(), Math.max(map.getZoom(), 16));
        }
      }
      if (layer.openPopup) layer.openPopup();
    }
    function renderList(hazards) {
      const rows = hazards.map(function (h) {
        const status = h.verification_status || 'unverified';
        const location = formatHazardLocation(h);
        const details = [
          h.clearance_ft ? ('Clearance: ' + h.clearance_ft + ' ft') : '',
          h.restriction || '',
          h.type ? ('Source type: ' + h.type) : '',
          h.verification_notes ? ('Notes: ' + h.verification_notes) : '',
          h.active === false ? 'Inactive for routing' : 'Active for routing'
        ].filter(Boolean).map(escapeHtml).join('<br>');
        return '<div class="record-card ' + display(h.category) + '" data-id="' + display(h.id) + '" onclick="selectHazard(&quot;' + escapeHtml(h.id) + '&quot;, true)">' +
          '<div class="record-title"><span>' + display(h.category) + '</span><span class="pill ' + status + '">' + display(status) + '</span></div>' +
          '<div class="record-id">' + display(h.id) + '</div>' +
          '<div class="record-detail"><strong>' + display(h.name || 'Imported hazard') + '</strong><br>' + location + '<br>' + (details || 'No extra details') + hazardPhotosHtml(h) + '</div>' +
          '<div class="row-actions" style="margin-top:10px; min-width:0" onclick="event.stopPropagation()">' +
          '<button class="green" onclick="setStatus(&quot;' + escapeHtml(h.category) + '&quot;,&quot;' + escapeHtml(h.id) + '&quot;,&quot;verified&quot;)">Verified</button>' +
          '<button class="gold" onclick="setStatus(&quot;' + escapeHtml(h.category) + '&quot;,&quot;' + escapeHtml(h.id) + '&quot;,&quot;needs_review&quot;)">Needs Review</button>' +
          '<button class="danger" onclick="setStatus(&quot;' + escapeHtml(h.category) + '&quot;,&quot;' + escapeHtml(h.id) + '&quot;,&quot;incorrect&quot;)">Incorrect</button>' +
          '<button class="gray" onclick="setStatus(&quot;' + escapeHtml(h.category) + '&quot;,&quot;' + escapeHtml(h.id) + '&quot;,&quot;inactive&quot;)">Inactive</button>' +
          '<button class="blue" onclick="editLocation(&quot;' + escapeHtml(h.category) + '&quot;,&quot;' + escapeHtml(h.id) + '&quot;)">Location Note</button>' +
          '</div></div>';
      }).join('');
      document.getElementById('hazards').innerHTML = rows || '<div class="record-card">No imported hazards match these filters.</div>';
    }
    async function loadHazards() {
      const res = await fetch(api + '?' + buildQuery());
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Unable to load hazard verification records.');
        return;
      }
      const hazards = data.hazards || [];
      currentHazards = hazards;
      updateCounts(hazards);
      renderMap(hazards);
      renderList(hazards);
      setMessage('Loaded ' + hazards.length + ' ' + document.getElementById('category').selectedOptions[0].text + ' record(s).');
    }
    function selectedStateForBackfill() {
      const stateFilter = value('stateFilter') || 'service';
      return stateFilter !== 'service' && stateFilter !== 'all' ? stateFilter : '';
    }
    async function queueMissingLocations() {
      setMessage('Queueing missing city/address records for backfill...');
      const res = await fetch('/api/routing/hazard-location-backfill/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: value('category') || 'low_bridge',
          limit: Number(value('limit')) || 500,
          serviceAreaOnly: (value('stateFilter') || 'service') === 'service',
          state: selectedStateForBackfill()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Unable to queue location backfill records.');
        return;
      }
      setMessage('Queued ' + data.queuedCount + ' missing location record(s). Run npm.cmd run db:process:locations on the backend to fill addresses.');
    }
    async function loadBackfillStats() {
      const params = new URLSearchParams();
      params.set('category', value('category') || 'low_bridge');
      params.set('limit', '10');
      const res = await fetch('/api/routing/hazard-location-backfill?' + params.toString());
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Unable to load backfill queue stats.');
        return;
      }
      const stats = (data.stats || []).map(function (row) {
        return row.hazard_category + ' ' + row.status + ': ' + row.count;
      }).join(' | ');
      setMessage(stats || 'No backfill queue records yet.');
    }
    async function setStatus(category, id, status) {
      const notes = window.prompt('Verification notes for ' + status + ':', status === 'verified' ? 'Verified by supervisor review.' : '');
      if (notes === null) return;
      const res = await fetch(api + '/' + encodeURIComponent(category) + '/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verification_status: status, verification_notes: notes })
      });
      const data = await res.json();
      setMessage(res.ok ? ('Updated ' + id + ' to ' + status + '.') : data.error);
      loadHazards();
    }
    function findCurrentHazard(id) {
      return currentHazards.find(function (hazard) { return hazard.id === id; }) || {};
    }
    async function editLocation(category, id) {
      const hazard = findCurrentHazard(id);
      const address = window.prompt('Physical address near this hazard:', hazard.location_address || hazard.nearby_address || '');
      if (address === null) return;
      const city = window.prompt('City:', hazard.location_city || '');
      if (city === null) return;
      const stateCode = window.prompt('State abbreviation, for example TX:', hazard.state_code || '');
      if (stateCode === null) return;
      const landmark = window.prompt('Landmark or driver-friendly description:', hazard.location_description || '');
      if (landmark === null) return;
      const res = await fetch(api + '/' + encodeURIComponent(category) + '/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_address: address, location_city: city, state_code: stateCode, location_description: landmark })
      });
      const data = await res.json();
      setMessage(res.ok ? ('Updated location note for ' + id + '.') : data.error);
      loadHazards();
    }
    async function createManualHazard() {
      const category = value('category') || 'low_bridge';
      const config = getQuickAddConfig(category);
      const latitude = Number(value('pickedLatitude'));
      const longitude = Number(value('pickedLongitude'));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setMessage('Tap the map first so latitude and longitude are populated.');
        return;
      }

      const clearanceText = value('manualBridgeClearance');
      const clearance = clearanceText ? Number(clearanceText) : null;
      if (category === 'low_bridge' && clearanceText && !Number.isFinite(clearance)) {
        setMessage('Clearance must be a number, for example 12.6.');
        return;
      }

      const payload = {
        category,
        name: value('manualBridgeName') || config.defaultName,
        latitude,
        longitude,
        clearance_ft: category === 'low_bridge' && Number.isFinite(clearance) ? clearance : null,
        nearby_address: value('manualBridgeAddress'),
        notes: value('manualBridgeLandmark') || 'Added from static hazard verification map.',
        restriction: config.restriction,
        status: 'confirmed',
        enabled: true,
        report_source: 'manual_admin',
        reported_by: value('manualBridgeSupervisor') || 'supervisor',
        confidence: 'medium',
        reviewed_by: value('manualBridgeSupervisor') || 'supervisor',
        review_notes: 'Confirmed manual hazard added from map coordinate picker.'
      };

      const res = await fetch('/api/routing/manual-hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Unable to add manual hazard.');
        return;
      }
      setMessage('Added confirmed manual ' + category.replace(/_/g, ' ') + ': ' + data.hazard.id + '. It is now active for routing.');
      document.getElementById('manualBridgeName').value = '';
      document.getElementById('manualBridgeClearance').value = '';
      document.getElementById('manualBridgeAddress').value = '';
      document.getElementById('manualBridgeLandmark').value = '';
      loadHazards();
    }
    updateQuickAddPanel();
    initMap();
    loadHazards();
  </script>
</body>
</html>`;
}

function renderRouteSessionsAdminPage(session = {}) {
  const adminBadge = renderAdminBadgeText(session);
  const canDeleteRouteSessions = session?.role === 'admin';
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Truck-Safe Route Replay</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: linear-gradient(145deg, #102033 0%, #16476f 42%, #fff2f4 100%); color: #102033; }
    header { background: linear-gradient(135deg, #7c0b12 0%, #d62828 48%, #0d47a1 100%); color: #fff; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; box-shadow: 0 14px 34px rgba(12,38,64,0.28); }
    main { max-width: 1440px; margin: 0 auto; padding: 20px; }
    section { background: rgba(255,255,255,0.94); border: 2px solid #8fc2df; border-left: 8px solid #1565c0; border-radius: 16px; padding: 16px; margin-bottom: 16px; box-shadow: 0 12px 30px rgba(12,38,64,0.18); }
    .admin-tabs { max-width: 1280px; margin: 16px auto 0; padding: 0 20px; display: flex; gap: 10px; flex-wrap: wrap; }
    .tab { min-height: 44px; border-radius: 999px; padding: 0 18px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; font-weight: 900; text-transform: uppercase; font-size: 12px; color: #102033; background: rgba(255,255,255,0.82); border: 2px solid #8fc2df; }
    .tab.active { color: #fff; background: #c8131f; border-color: #ffffff; box-shadow: 0 8px 18px rgba(200,19,31,0.24); }
    .tab.delivery { background: #1565c0; color: #fff; border-color: #aee4ff; }
    .role-badge, .logout { border-radius: 999px; padding: 9px 12px; color: #fff; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.36); font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .logout { cursor: pointer; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; overflow: hidden; border-radius: 12px; }
    th, td { border-bottom: 1px solid #d4e8f6; padding: 10px; text-align: left; vertical-align: top; }
    th { color: #ffffff; background: #0d47a1; text-transform: uppercase; font-size: 11px; }
    tr:nth-child(even) td { background: #f7fcff; }
    .pill { display: inline-block; border-radius: 999px; padding: 4px 9px; font-weight: 900; font-size: 11px; background: #e8f5ff; color: #0d47a1; }
    .critical { background: #ffe3e3; color: #a11b1b; }
    .message { min-height: 20px; margin: 10px 0; font-weight: 900; color: #1565c0; }
    button { border: 0; border-radius: 10px; padding: 10px 12px; font-weight: 900; cursor: pointer; background: #1565c0; color: #fff; }
    button.danger { background: #d62828; color: #fff; }
    button.gray { background: #e8f5ff; color: #24506f; }
    input, select { width: 100%; box-sizing: border-box; border: 2px solid #8fc2df; border-radius: 10px; padding: 10px; font-size: 14px; background: #f7fcff; }
    label { display: block; font-size: 11px; font-weight: 900; color: #0d47a1; text-transform: uppercase; margin: 0 0 4px; }
    .filters { display: grid; grid-template-columns: minmax(160px, 1.5fr) repeat(4, minmax(120px, 0.8fr)); gap: 10px; align-items: end; margin: 12px 0; }
    .button-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .workspace { display: grid; grid-template-columns: minmax(420px, 0.9fr) minmax(0, 1.4fr); gap: 16px; align-items: start; }
    .map-shell { min-height: 680px; overflow: hidden; border-radius: 18px; border: 2px solid #8fc2df; background: #102033; box-shadow: 0 16px 34px rgba(16,32,51,0.22); position: sticky; top: 12px; }
    #replayMap { height: 680px; width: 100%; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
    .stat { border-radius: 14px; padding: 12px; color: #fff; background: linear-gradient(135deg, #1565c0, #0d47a1); }
    .stat.red { background: linear-gradient(135deg, #d62828, #7c0b12); }
    .stat.gold { background: linear-gradient(135deg, #ffc857, #c77d00); color: #2b1a00; }
    .stat.green { background: linear-gradient(135deg, #24a148, #0b6b2b); }
    .stat-value { font-size: 22px; font-weight: 900; }
    .stat-label { margin-top: 4px; font-size: 11px; font-weight: 900; text-transform: uppercase; opacity: 0.88; }
    .detail-card { display: grid; gap: 10px; }
    .detail-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .info-panel { border-radius: 14px; background: linear-gradient(145deg, #f7fcff, #ffffff); border: 2px solid #d4e8f6; padding: 12px; }
    .info-title { margin: 0 0 8px; color: #0d47a1; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .info-line { color: #102033; font-size: 14px; line-height: 1.42; margin: 4px 0; }
    textarea { width: 100%; box-sizing: border-box; border: 2px solid #8fc2df; border-radius: 10px; padding: 10px; font-size: 14px; background: #f7fcff; min-height: 86px; resize: vertical; }
    .route-options { display: grid; gap: 8px; }
    .route-option { border-radius: 12px; border: 2px solid #d4e8f6; background: #ffffff; padding: 10px; display: grid; grid-template-columns: 80px 1fr; gap: 8px; align-items: center; }
    .route-option.chosen { border-color: #24a148; background: #f0fff5; }
    .route-score { border-radius: 999px; padding: 7px 9px; background: #e8f5ff; color: #0d47a1; font-weight: 900; text-align: center; }
    .route-option.chosen .route-score { background: #24a148; color: #fff; }
    .event-list { max-height: 220px; overflow: auto; display: grid; gap: 8px; }
    .event { border-left: 6px solid #1565c0; border-radius: 10px; background: #f7fcff; padding: 9px; font-size: 13px; }
    .event.critical, .event.high, .event.warning { border-left-color: #d62828; background: #fff4f4; }
    .event.medium { border-left-color: #c77d00; background: #fff8df; }
    .event-tools { display: grid; grid-template-columns: repeat(2, minmax(140px, 1fr)) auto; gap: 10px; align-items: end; }
    .timeline-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 10px; }
    .timeline-box { border-radius: 14px; padding: 11px; background: linear-gradient(145deg, #e8f5ff, #ffffff); border: 2px solid #d4e8f6; }
    .timeline-value { font-size: 18px; font-weight: 900; color: #0d47a1; }
    .timeline-label { margin-top: 3px; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #24506f; }
    .event-chip-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    .event-chip { border-radius: 999px; padding: 5px 9px; background: #e8f5ff; color: #0d47a1; font-size: 11px; font-weight: 900; }
    .event-chip.hot { background: #ffe3e3; color: #a11b1b; }
    pre { white-space: pre-wrap; background: #102033; color: #e8f5ff; border-radius: 12px; padding: 12px; max-height: 260px; overflow: auto; }
    .route-marker { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; color: #fff; border: 3px solid #fff; box-shadow: 0 8px 18px rgba(16,32,51,0.32); font-size: 10px; font-weight: 900; }
    .route-marker.origin { background: #24a148; }
    .route-marker.destination { background: #d62828; }
    .route-marker.event { background: #1565c0; }
    .route-marker.event-selected { background: #ffc857; color: #2b1a00; transform: scale(1.25); }
    .route-marker.hazard-low_bridge { background: #d62828; }
    .route-marker.hazard-no_truck { background: #7c3aed; }
    .route-marker.hazard-residential { background: #1565c0; }
    @media (max-width: 1100px) { .workspace { grid-template-columns: 1fr; } .map-shell { position: relative; min-height: 520px; } #replayMap { height: 520px; } .stat-grid, .detail-grid, .timeline-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 760px) { .detail-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <div>
      <p style="margin:0 0 4px;color:#aee4ff;font-size:12px;font-weight:900;text-transform:uppercase">Supervisor Console</p>
      <h1 style="margin:0">Route Replay</h1>
      <p style="margin:4px 0 0;color:#ffe8ec;font-weight:700">Review route requests, selected route, and hazard decisions.</p>
    </div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <div class="role-badge">${adminBadge}</div>
      <form method="post" action="/api/routing/manual-hazards/admin/logout"><button class="logout" type="submit">Log Out</button></form>
    </div>
  </header>
  <nav class="admin-tabs">
    <a class="tab" href="/api/routing/manual-hazards/admin">Hazard Review</a>
    <a class="tab" href="/api/routing/hazard-verification/admin">Static Hazard Verification</a>
    <a class="tab active" href="/api/routing/route-sessions/admin">Route Replay</a>
    <a class="tab delivery" href="/api/delivery-notes/admin">Delivery Notes</a>
    <a class="tab" href="/api/route-manifests/admin">Route Manifests</a>
    <a class="tab" href="/api/drivers/admin">Driver Registry</a>
    <a class="tab" href="/api/admin">Supervisor Dashboard</a>
  </nav>
  <main>
    <section>
      <h2>Safety Analytics</h2>
      <div class="filters">
        <div><label>Destination Search</label><input id="sessionSearch" placeholder="Customer, street, city" onkeydown="if(event.key==='Enter') loadDashboard()" /></div>
        <div><label>Time Window</label><select id="sessionDays" onchange="loadDashboard()"><option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option><option value="90">Last 90 days</option><option value="">All time</option></select></div>
        <div><label>Hazards</label><select id="hazardOnly" onchange="loadDashboard()"><option value="">All routes</option><option value="true">Hazard routes only</option></select></div>
        <div><label>Review</label><select id="reviewStatusFilter" onchange="loadDashboard()"><option value="">All reviews</option><option value="unreviewed">Unreviewed</option><option value="reviewed">Reviewed</option><option value="needs_follow_up">Needs follow-up</option><option value="training_needed">Training needed</option><option value="dismissed">Dismissed</option></select></div>
        <div><label>Archive</label><select id="archiveFilter" onchange="loadDashboard()"><option value="active">Active only</option><option value="archived">Archived only</option><option value="all">Active + archived</option></select></div>
        <div class="button-row"><button onclick="loadDashboard()">Apply</button><button onclick="exportSessionsCsv()">Export CSV</button><button class="gray" onclick="archiveVisibleSessions()">Archive Visible</button>${canDeleteRouteSessions ? '<button class="danger" onclick="deleteVisibleSessions()">Delete Visible</button>' : ''}</div>
      </div>
      <div class="stat-grid">
        <div class="stat"><div id="analyticsRoutes" class="stat-value">0</div><div class="stat-label">Routes</div></div>
        <div class="stat red"><div id="analyticsHazards" class="stat-value">0</div><div class="stat-label">Hazards scored</div></div>
        <div class="stat gold"><div id="analyticsWarnings" class="stat-value">0</div><div class="stat-label">Warnings/events</div></div>
        <div class="stat green"><div id="analyticsRouteOptions" class="stat-value">0</div><div class="stat-label">Avg route options</div></div>
      </div>
      <div id="analyticsBreakdown" class="message"></div>
    </section>
    <div class="workspace">
      <section>
        <h2>Recent Route Sessions</h2>
        <div id="message" class="message"></div>
        <div class="button-row"><button onclick="loadSessions()">Refresh</button><button class="gray" onclick="clearSelectedSession()">Clear Selection</button></div>
        <table style="margin-top:12px">
          <thead><tr><th>Time</th><th>Destination</th><th>Chosen</th><th>Hazards</th><th>Actions</th></tr></thead>
          <tbody id="sessions"></tbody>
        </table>
      </section>
      <div class="map-shell"><div id="replayMap"></div></div>
    </div>
    <section>
      <h2>Selected Session</h2>
      <div class="stat-grid">
        <div class="stat"><div id="statRoute" class="stat-value">--</div><div class="stat-label">Chosen route</div></div>
        <div class="stat red"><div id="statLowBridge" class="stat-value">0</div><div class="stat-label">Low bridges</div></div>
        <div class="stat gold"><div id="statNoTruck" class="stat-value">0</div><div class="stat-label">No-truck</div></div>
        <div class="stat green"><div id="statEvents" class="stat-value">0</div><div class="stat-label">Driver events</div></div>
      </div>
      <div class="detail-card">
        <div id="sessionSummary" class="message">Select a route session.</div>
        <div class="detail-grid">
          <div class="info-panel">
            <h3 class="info-title">Route Decision</h3>
            <div id="routeDecisionDetails" class="info-line">No route selected.</div>
          </div>
          <div class="info-panel">
            <h3 class="info-title">Truck Profile</h3>
            <div id="truckProfileDetails" class="info-line">No route selected.</div>
          </div>
          <div class="info-panel">
            <h3 class="info-title">Safety Result</h3>
            <div id="safetyResultDetails" class="info-line">No route selected.</div>
          </div>
        </div>
        <div class="info-panel">
          <h3 class="info-title">Supervisor Review</h3>
          <div class="filters" style="grid-template-columns: minmax(160px, 0.7fr) minmax(260px, 1.5fr) auto">
            <div><label>Review Status</label><select id="reviewStatus"><option value="unreviewed">Unreviewed</option><option value="reviewed">Reviewed</option><option value="needs_follow_up">Needs Follow-up</option><option value="training_needed">Training Needed</option><option value="dismissed">Dismissed</option></select></div>
            <div><label>Supervisor Notes</label><textarea id="supervisorNotes" placeholder="What did the supervisor determine?"></textarea></div>
            <div class="button-row"><button onclick="saveSessionReview()">Save Review</button></div>
          </div>
          <div id="reviewMeta" class="message">Select a route session to review.</div>
        </div>
        <h3>Route Options</h3>
        <div id="routeOptionList" class="route-options"><div class="event">No route selected.</div></div>
        <h3>Driver Events</h3>
        <div id="timelineSummary" class="timeline-summary"></div>
        <div class="event-tools">
          <div><label>Event Type</label><select id="eventTypeFilter" onchange="applyEventFilters()"><option value="">All event types</option></select></div>
          <div><label>Severity</label><select id="eventSeverityFilter" onchange="applyEventFilters()"><option value="">All severities</option></select></div>
          <div class="button-row">
            <button class="gray" onclick="selectPreviousEvent()">Previous Event</button>
            <button class="gray" onclick="selectNextEvent()">Next Event</button>
            <button onclick="jumpToFirstSafetyEvent()">First Safety Event</button>
            <button class="gray" onclick="exportSelectedSessionJson()">Export JSON</button>
            <button class="gray" onclick="printSelectedSessionReport()">Print Report</button>
          </div>
        </div>
        <div id="eventList" class="event-list"><div class="event">No route selected.</div></div>
        <details>
          <summary><strong>Raw Session Payload</strong> - technical debugging record</summary>
          <pre id="detail">Select a route session.</pre>
        </details>
      </div>
    </section>
  </main>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    let replayMap = null;
    let replayLayer = null;
    let sessionsCache = [];
    let selectedSessionId = null;
    let selectedSession = null;
    let selectedSessionEvents = [];
    let selectedEventIndex = -1;
    let selectedEventMarker = null;
    const canDeleteRouteSessions = ${canDeleteRouteSessions ? 'true' : 'false'};

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, function (char) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
      });
    }
    function initReplayMap() {
      if (typeof L === 'undefined') {
        document.getElementById('message').textContent = 'Map library did not load. Check internet access, then refresh.';
        return;
      }
      replayMap = L.map('replayMap', {
        center: [31.7, -98.8],
        zoom: 6,
        zoomControl: true
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(replayMap);
      replayLayer = L.featureGroup().addTo(replayMap);
    }
    function decodePolyline(encoded) {
      if (!encoded) return [];
      let index = 0;
      let lat = 0;
      let lng = 0;
      const coordinates = [];
      while (index < encoded.length) {
        let b;
        let shift = 0;
        let result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);
        shift = 0;
        result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);
        coordinates.push([lat / 1e5, lng / 1e5]);
      }
      return coordinates;
    }
    function markerIcon(className, label) {
      return L.divIcon({
        className: '',
        html: '<div class="route-marker ' + className + '">' + label + '</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -14]
      });
    }
    function summarizeHazards(summary) {
      if (!summary) return 'None';
      return [
        'Low bridges: ' + (summary.lowBridgeCount || 0),
        'No-truck: ' + (summary.noTruckZoneCount || 0),
        'Residential: ' + (summary.residentialZoneCount || 0)
      ].join('<br>');
    }
    function formatMiles(meters) {
      const parsed = Number(meters);
      return Number.isFinite(parsed) ? (parsed / 1609.344).toFixed(1) + ' mi' : '--';
    }
    function formatMinutes(seconds) {
      const parsed = Number(seconds);
      return Number.isFinite(parsed) ? Math.round(parsed / 60) + ' min' : '--';
    }
    function formatLocalDateTime(value) {
      if (!value) return '--';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString();
    }
    function severityRank(value) {
      const severity = String(value || 'info').toLowerCase();
      if (severity === 'critical') return 5;
      if (severity === 'high' || severity === 'warning') return 4;
      if (severity === 'medium') return 3;
      if (severity === 'low') return 2;
      return 1;
    }
    function isSafetyEvent(event) {
      const type = String(event && event.eventType || '').toLowerCase();
      return severityRank(event && event.severity) >= 3 ||
        type.includes('warning') ||
        type.includes('hazard') ||
        type.includes('speed') ||
        type.includes('bridge') ||
        type.includes('truck') ||
        type.includes('residential') ||
        type.includes('off_route') ||
        type.includes('reroute');
    }
    function compactPayload(payload) {
      const safePayload = payload && typeof payload === 'object' ? payload : {};
      const important = {};
      ['message', 'warning', 'distanceMeters', 'distance_m', 'speedMph', 'speed_mph', 'hazardType', 'hazard_type', 'routeIndex', 'route_index'].forEach(function (key) {
        if (safePayload[key] !== undefined && safePayload[key] !== null && safePayload[key] !== '') {
          important[key] = safePayload[key];
        }
      });
      const source = Object.keys(important).length ? important : safePayload;
      const text = JSON.stringify(source || {});
      return text.length > 180 ? text.slice(0, 177) + '...' : text;
    }
    function eventTypeLabel(value) {
      return String(value || 'driver_event').replace(/_/g, ' ');
    }
    function renderTruckProfile(profile) {
      const truck = profile || {};
      return [
        'Height: ' + escapeHtml(truck.height_ft ?? '--') + ' ft',
        'Length: ' + escapeHtml(truck.length_ft ?? '--') + ' ft',
        'Weight: ' + escapeHtml(truck.weight_lb ?? '--') + ' lb',
        'Hazmat: ' + (truck.hazmat ? 'Yes' : 'No')
      ].join('<br>');
    }
    function renderSafetyResult(summary) {
      const hazardSummary = summary || {};
      const total = Number(hazardSummary.total || 0);
      const label = total > 0 ? 'Hazards found on selected route' : 'No hazards found on selected route';
      return [
        '<strong>' + label + '</strong>',
        'Low bridges: ' + escapeHtml(hazardSummary.lowBridgeCount || 0),
        'No-truck: ' + escapeHtml(hazardSummary.noTruckZoneCount || 0),
        'Residential: ' + escapeHtml(hazardSummary.residentialZoneCount || 0)
      ].join('<br>');
    }
    function renderRouteOptions(session) {
      const trace = getGpsTrail(session.events || []);
      return '<div class="event"><strong>Replay source: driver device GPS</strong><br>' +
        escapeHtml(trace.length) + ' GPS trail points recorded. Google route geometry is not retained.</div>';
    }
    function buildDashboardQuery(limit) {
      const params = new URLSearchParams();
      params.set('limit', String(limit || 75));
      const search = document.getElementById('sessionSearch').value.trim();
      const days = document.getElementById('sessionDays').value.trim();
      const hazardOnly = document.getElementById('hazardOnly').value.trim();
      const reviewStatus = document.getElementById('reviewStatusFilter')?.value?.trim?.() || '';
      const archiveFilter = document.getElementById('archiveFilter')?.value?.trim?.() || 'active';
      if (search) params.set('search', search);
      if (days) params.set('days', days);
      if (hazardOnly) params.set('hazardOnly', hazardOnly);
      if (reviewStatus) params.set('reviewStatus', reviewStatus);
      if (archiveFilter === 'all') params.set('includeArchived', 'true');
      if (archiveFilter === 'archived') params.set('archivedOnly', 'true');
      return params;
    }
    function renderAnalytics(data) {
      const summary = data.summary || {};
      const severityTotal = (data.eventSeverityCounts || []).reduce(function (total, row) {
        return total + Number(row.count || 0);
      }, 0);
      document.getElementById('analyticsRoutes').textContent = String(summary.route_count || 0);
      document.getElementById('analyticsHazards').textContent = String(summary.total_hazards || 0);
      document.getElementById('analyticsWarnings').textContent = String(severityTotal);
      document.getElementById('analyticsRouteOptions').textContent = String(summary.average_route_options || '0.00');
      const severityText = (data.eventSeverityCounts || []).map(function (row) {
        return row.severity + ': ' + row.count;
      }).join(' | ');
      const typeText = (data.eventTypeCounts || []).slice(0, 6).map(function (row) {
        return row.event_type + ': ' + row.count;
      }).join(' | ');
      document.getElementById('analyticsBreakdown').textContent =
        [severityText, typeText].filter(Boolean).join('    ');
    }
    function normalizeHazardCoordinate(hazard) {
      const lat = Number(hazard && (hazard.latitude ?? hazard.lat));
      const lng = Number(hazard && (hazard.longitude ?? hazard.lng));
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
    }
    function addHazardMarkers(hazards, bucket, label) {
      (hazards || []).forEach(function (hazard) {
        const coordinate = normalizeHazardCoordinate(hazard);
        if (!coordinate) return;
        L.marker(coordinate, {
          icon: markerIcon('hazard-' + bucket, label)
        })
          .bindPopup(
            '<strong>' + escapeHtml(hazard.category || bucket) + '</strong><br>' +
            escapeHtml(hazard.name || hazard.id || 'Hazard') + '<br>' +
            (hazard.clearance_ft ? ('Clearance: ' + escapeHtml(hazard.clearance_ft) + ' ft<br>') : '') +
            escapeHtml(hazard.warning_strength || hazard.severity || '')
          )
          .addTo(replayLayer);
      });
    }
    function getGpsTrail(events) {
      return (events || []).filter(function (event) {
        const lat = Number(event.latitude);
        const lng = Number(event.longitude);
        return String(event.eventType || '').toLowerCase() === 'gps_trace' &&
          Number.isFinite(lat) &&
          Number.isFinite(lng);
      });
    }
    function trailDistanceMeters(events) {
      const points = getGpsTrail(events);
      const toRadians = function (degrees) { return degrees * Math.PI / 180; };
      let total = 0;
      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        const lat1 = toRadians(Number(previous.latitude));
        const lat2 = toRadians(Number(current.latitude));
        const dLat = lat2 - lat1;
        const dLng = toRadians(Number(current.longitude) - Number(previous.longitude));
        const haversine = Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        total += 6371000 * 2 * Math.asin(Math.sqrt(haversine));
      }
      return total;
    }
    function trailDurationSeconds(events) {
      const points = getGpsTrail(events);
      if (points.length < 2) return null;
      const first = Date.parse(points[0].payload?.clientRecordedAt || points[0].createdAt);
      const last = Date.parse(points[points.length - 1].payload?.clientRecordedAt || points[points.length - 1].createdAt);
      return Number.isFinite(first) && Number.isFinite(last)
        ? Math.max(0, Math.round((last - first) / 1000))
        : null;
    }
    function renderSessionMap(session) {
      if (!replayMap || !replayLayer) return;
      replayLayer.clearLayers();
      const trail = getGpsTrail(session.events || []);
      const coordinates = trail.map(function (event) {
        return [Number(event.latitude), Number(event.longitude)];
      });
      if (coordinates.length) {
        L.polyline(coordinates, { color: '#05c7ff', weight: 8, opacity: 0.92 }).addTo(replayLayer);
        L.polyline(coordinates, { color: '#003cff', weight: 3, opacity: 0.95 }).addTo(replayLayer);
        L.marker(coordinates[0], { icon: markerIcon('origin', 'S') }).bindPopup('Recorded start').addTo(replayLayer);
        L.marker(coordinates[coordinates.length - 1], { icon: markerIcon('destination', 'E') }).bindPopup('Recorded end').addTo(replayLayer);
      }
      const hazards = session.chosenRouteHazards || {};
      addHazardMarkers(hazards.lowBridges, 'low_bridge', 'LB');
      addHazardMarkers(hazards.noTruckZones, 'no_truck', 'NT');
      addHazardMarkers(hazards.residentialZones, 'residential', 'R');
      (session.events || []).forEach(function (event) {
        if (String(event.eventType || '').toLowerCase() === 'gps_trace') return;
        const lat = Number(event.latitude);
        const lng = Number(event.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        L.marker([lat, lng], { icon: markerIcon('event', '!') })
          .bindPopup('<strong>' + escapeHtml(event.eventType) + '</strong><br>' + escapeHtml(event.severity || 'info') + '<br>' + escapeHtml(event.createdAt || ''))
          .addTo(replayLayer);
      });
      if (selectedEventMarker) {
        selectedEventMarker.addTo(replayLayer);
      }
      if (replayLayer.getLayers().length) {
        replayMap.fitBounds(replayLayer.getBounds(), { padding: [36, 36], maxZoom: 17 });
      }
    }
    function populateEventFilters() {
      const typeSelect = document.getElementById('eventTypeFilter');
      const severitySelect = document.getElementById('eventSeverityFilter');
      if (!typeSelect || !severitySelect) return;
      const previousType = typeSelect.value;
      const previousSeverity = severitySelect.value;
      const types = Array.from(new Set(selectedSessionEvents.map(function (event) {
        return String(event.eventType || 'driver_event');
      }))).sort();
      const severities = Array.from(new Set(selectedSessionEvents.map(function (event) {
        return String(event.severity || 'info');
      }))).sort(function (a, b) {
        return severityRank(b) - severityRank(a);
      });
      typeSelect.innerHTML = '<option value="">All event types</option>' + types.map(function (type) {
        return '<option value="' + escapeHtml(type) + '">' + escapeHtml(eventTypeLabel(type)) + '</option>';
      }).join('');
      severitySelect.innerHTML = '<option value="">All severities</option>' + severities.map(function (severity) {
        return '<option value="' + escapeHtml(severity) + '">' + escapeHtml(severity) + '</option>';
      }).join('');
      typeSelect.value = types.includes(previousType) ? previousType : '';
      severitySelect.value = severities.includes(previousSeverity) ? previousSeverity : '';
    }
    function getVisibleEventIndexes() {
      const typeFilter = document.getElementById('eventTypeFilter')?.value || '';
      const severityFilter = document.getElementById('eventSeverityFilter')?.value || '';
      return selectedSessionEvents
        .map(function (event, index) { return { event, index }; })
        .filter(function (entry) {
          if (typeFilter && String(entry.event.eventType || '') !== typeFilter) return false;
          if (severityFilter && String(entry.event.severity || 'info') !== severityFilter) return false;
          return true;
        })
        .map(function (entry) { return entry.index; });
    }
    function renderTimelineSummary(session) {
      const container = document.getElementById('timelineSummary');
      if (!container) return;
      const events = session && Array.isArray(session.events) ? session.events : [];
      if (!events.length) {
        container.innerHTML = '<div class="timeline-box"><div class="timeline-value">0</div><div class="timeline-label">Events recorded</div></div>';
        return;
      }
      const safetyEvents = events.filter(isSafetyEvent);
      const severeEvents = events.filter(function (event) {
        return severityRank(event.severity) >= 4;
      });
      const firstEvent = events[0];
      const lastEvent = events[events.length - 1];
      const firstSafety = safetyEvents[0];
      const typeCounts = events.reduce(function (counts, event) {
        const key = String(event.eventType || 'driver_event');
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {});
      const topTypes = Object.keys(typeCounts).sort(function (a, b) {
        return typeCounts[b] - typeCounts[a];
      }).slice(0, 4);
      container.innerHTML =
        '<div class="timeline-box"><div class="timeline-value">' + escapeHtml(events.length) + '</div><div class="timeline-label">Events recorded</div></div>' +
        '<div class="timeline-box"><div class="timeline-value">' + escapeHtml(safetyEvents.length) + '</div><div class="timeline-label">Safety events</div></div>' +
        '<div class="timeline-box"><div class="timeline-value">' + escapeHtml(severeEvents.length) + '</div><div class="timeline-label">High / critical</div></div>' +
        '<div class="timeline-box"><div class="timeline-value">' + escapeHtml(firstSafety ? eventTypeLabel(firstSafety.eventType) : 'None') + '</div><div class="timeline-label">First safety event</div></div>' +
        '<div class="timeline-box" style="grid-column:1/-1">' +
          '<div class="timeline-label">Timeline window</div>' +
          '<div class="info-line">' + escapeHtml(formatLocalDateTime(firstEvent.createdAt)) + ' to ' + escapeHtml(formatLocalDateTime(lastEvent.createdAt)) + '</div>' +
          '<div class="event-chip-row">' + topTypes.map(function (type) {
            const hot = type.toLowerCase().includes('warning') || type.toLowerCase().includes('hazard') || type.toLowerCase().includes('speed');
            return '<span class="event-chip ' + (hot ? 'hot' : '') + '">' + escapeHtml(eventTypeLabel(type)) + ': ' + escapeHtml(typeCounts[type]) + '</span>';
          }).join('') + '</div>' +
        '</div>';
    }
    function renderEventTimeline() {
      const visibleIndexes = getVisibleEventIndexes();
      document.getElementById('eventList').innerHTML = visibleIndexes.map(function (eventIndex) {
        const event = selectedSessionEvents[eventIndex];
        const active = eventIndex === selectedEventIndex ? ' style="outline:3px solid #ffc857"' : '';
        return '<div class="event ' + escapeHtml(event.severity || '') + '"' + active + ' onclick="selectEvent(' + eventIndex + ')">' +
          '<strong>' + escapeHtml(eventIndex + 1) + '. ' + escapeHtml(eventTypeLabel(event.eventType)) + '</strong> ' +
          '<span class="pill">' + escapeHtml(event.severity || 'info') + '</span><br>' +
          escapeHtml(formatLocalDateTime(event.createdAt)) + '<br>' +
          escapeHtml(compactPayload(event.payload || {})) +
          '</div>';
      }).join('') || (selectedSessionEvents.length ? '<div class="event">No events match the current filter.</div>' : '<div class="event">No driver events logged for this route yet.</div>');
    }
    function applyEventFilters() {
      renderEventTimeline();
    }
    function selectEvent(index) {
      if (!selectedSessionEvents.length) return;
      selectedEventIndex = Math.max(0, Math.min(index, selectedSessionEvents.length - 1));
      const event = selectedSessionEvents[selectedEventIndex];
      renderEventTimeline();
      if (selectedEventMarker && replayMap) {
        replayMap.removeLayer(selectedEventMarker);
        selectedEventMarker = null;
      }
      const lat = Number(event.latitude);
      const lng = Number(event.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !replayMap) return;
      selectedEventMarker = L.marker([lat, lng], { icon: markerIcon('event-selected', '!'), zIndexOffset: 3000 })
        .bindPopup('<strong>Selected event</strong><br>' + escapeHtml(event.eventType) + '<br>' + escapeHtml(event.createdAt || ''))
        .addTo(replayMap);
      selectedEventMarker.openPopup();
      replayMap.setView([lat, lng], Math.max(replayMap.getZoom(), 16), { animate: true });
    }
    function selectNextEvent() {
      if (!selectedSessionEvents.length) return;
      const visibleIndexes = getVisibleEventIndexes();
      if (!visibleIndexes.length) return;
      const position = visibleIndexes.indexOf(selectedEventIndex);
      const nextPosition = position < 0 ? 0 : Math.min(position + 1, visibleIndexes.length - 1);
      selectEvent(visibleIndexes[nextPosition]);
    }
    function selectPreviousEvent() {
      if (!selectedSessionEvents.length) return;
      const visibleIndexes = getVisibleEventIndexes();
      if (!visibleIndexes.length) return;
      const position = visibleIndexes.indexOf(selectedEventIndex);
      const previousPosition = position <= 0 ? 0 : position - 1;
      selectEvent(visibleIndexes[previousPosition]);
    }
    function jumpToFirstSafetyEvent() {
      const index = selectedSessionEvents.findIndex(isSafetyEvent);
      if (index >= 0) {
        selectEvent(index);
        return;
      }
      document.getElementById('message').textContent = 'No safety events were recorded for this route session.';
    }
    function exportSelectedSessionJson() {
      if (!selectedSession) {
        document.getElementById('message').textContent = 'Select a route session before exporting JSON.';
        return;
      }
      const blob = new Blob([JSON.stringify(selectedSession, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'truck-safe-route-session-' + selectedSession.id + '.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
    function printSelectedSessionReport() {
      if (!selectedSession) {
        document.getElementById('message').textContent = 'Select a route session before printing a report.';
        return;
      }
      const summary = selectedSession.hazardSummary || {};
      const events = selectedSession.events || [];
      const actualDistanceMeters = trailDistanceMeters(events);
      const actualDurationSeconds = trailDurationSeconds(events);
      const report = window.open('', '_blank');
      if (!report) {
        document.getElementById('message').textContent = 'Popup blocked. Allow popups to print the selected route report.';
        return;
      }
      report.document.write('<!doctype html><html><head><title>Truck-Safe Route Report</title><style>body{font-family:Arial,sans-serif;margin:28px;color:#102033}h1{color:#0d47a1}.box{border:1px solid #c8dceb;border-radius:12px;padding:12px;margin:12px 0}.event{border-left:5px solid #1565c0;padding:8px 10px;margin:8px 0;background:#f7fcff}.hot{border-left-color:#d62828;background:#fff4f4}</style></head><body>');
      report.document.write('<h1>Truck-Safe Route Replay Report</h1>');
      report.document.write('<div class="box"><strong>Session:</strong> ' + escapeHtml(selectedSession.id) + '<br><strong>Created:</strong> ' + escapeHtml(formatLocalDateTime(selectedSession.createdAt)) + '<br><strong>Origin:</strong> ' + escapeHtml(selectedSession.originLabel || '') + '<br><strong>Destination:</strong> ' + escapeHtml(selectedSession.destinationLabel || '') + '</div>');
      report.document.write('<div class="box"><strong>Replay source:</strong> Driver device GPS<br><strong>Actual recorded distance:</strong> ' + escapeHtml(formatMiles(actualDistanceMeters)) + '<br><strong>Actual recorded duration:</strong> ' + escapeHtml(formatMinutes(actualDurationSeconds)) + '<br><strong>Operational events:</strong> ' + escapeHtml(events.length) + '</div>');
      report.document.write('<div class="box"><strong>Review status:</strong> ' + escapeHtml(selectedSession.reviewStatus || 'unreviewed') + '<br><strong>Reviewed by:</strong> ' + escapeHtml(selectedSession.reviewedBy || '') + '<br><strong>Supervisor notes:</strong><br>' + escapeHtml(selectedSession.supervisorNotes || '') + '</div>');
      report.document.write('<h2>Driver Event Timeline</h2>');
      events.forEach(function (event, index) {
        report.document.write('<div class="event ' + (isSafetyEvent(event) ? 'hot' : '') + '"><strong>' + escapeHtml(index + 1) + '. ' + escapeHtml(eventTypeLabel(event.eventType)) + '</strong> (' + escapeHtml(event.severity || 'info') + ')<br>' + escapeHtml(formatLocalDateTime(event.createdAt)) + '<br>' + escapeHtml(compactPayload(event.payload || {})) + '</div>');
      });
      if (!events.length) report.document.write('<p>No driver events were logged for this route.</p>');
      report.document.write('</body></html>');
      report.document.close();
      report.focus();
      report.print();
    }
    function renderSessionDetail(session) {
      const summary = session.hazardSummary || {};
      const events = session.events || [];
      const actualDistanceMeters = trailDistanceMeters(events);
      const actualDurationSeconds = trailDurationSeconds(events);
      document.getElementById('statRoute').textContent = String(session.chosenRouteIndex ?? '--');
      document.getElementById('statLowBridge').textContent = String(summary.lowBridgeCount || 0);
      document.getElementById('statNoTruck').textContent = String(summary.noTruckZoneCount || 0);
      document.getElementById('statEvents').textContent = String((session.events || []).length);
      document.getElementById('sessionSummary').textContent =
        (session.destinationLabel || 'Unknown destination') + ' | ' +
        (session.createdAt || '') + ' | ' +
        'Route count: ' + (session.routeCount || 0);
      document.getElementById('routeDecisionDetails').innerHTML = [
        '<strong>' + escapeHtml(session.originLabel || 'Unknown origin') + '</strong>',
        'to',
        '<strong>' + escapeHtml(session.destinationLabel || 'Unknown destination') + '</strong>',
        'Replay source: Driver device GPS',
        'Actual recorded distance: ' + formatMiles(actualDistanceMeters),
        'Actual recorded duration: ' + formatMinutes(actualDurationSeconds)
      ].join('<br>');
      document.getElementById('truckProfileDetails').innerHTML = renderTruckProfile(session.usedTruckProfile);
      document.getElementById('safetyResultDetails').innerHTML = renderSafetyResult(summary);
      document.getElementById('routeOptionList').innerHTML = renderRouteOptions(session);
      selectedSessionId = session.id;
      selectedSession = session;
      document.getElementById('reviewStatus').value = session.reviewStatus || 'unreviewed';
      document.getElementById('supervisorNotes').value = session.supervisorNotes || '';
      document.getElementById('reviewMeta').textContent = session.reviewedAt
        ? 'Last reviewed by ' + (session.reviewedBy || 'supervisor') + ' at ' + session.reviewedAt + '.'
        : 'This route session has not been reviewed yet.';
      if (selectedEventMarker && replayMap) {
        replayMap.removeLayer(selectedEventMarker);
        selectedEventMarker = null;
      }
      selectedSessionEvents = session.events || [];
      selectedEventIndex = -1;
      populateEventFilters();
      renderTimelineSummary(session);
      renderEventTimeline();
      document.getElementById('detail').textContent = JSON.stringify(session, null, 2);
      renderSessionMap(session);
    }
    function clearSelectedSession() {
      if (replayLayer) replayLayer.clearLayers();
      document.getElementById('statRoute').textContent = '--';
      document.getElementById('statLowBridge').textContent = '0';
      document.getElementById('statNoTruck').textContent = '0';
      document.getElementById('statEvents').textContent = '0';
      document.getElementById('sessionSummary').textContent = 'No route session selected.';
      document.getElementById('eventList').innerHTML = '<div class="event">No route selected.</div>';
      document.getElementById('routeDecisionDetails').innerHTML = 'No route selected.';
      document.getElementById('truckProfileDetails').innerHTML = 'No route selected.';
      document.getElementById('safetyResultDetails').innerHTML = 'No route selected.';
      document.getElementById('routeOptionList').innerHTML = '<div class="event">No route selected.</div>';
      selectedSessionId = null;
      selectedSession = null;
      selectedSessionEvents = [];
      selectedEventIndex = -1;
      if (selectedEventMarker && replayMap) {
        replayMap.removeLayer(selectedEventMarker);
        selectedEventMarker = null;
      }
      document.getElementById('reviewStatus').value = 'unreviewed';
      document.getElementById('supervisorNotes').value = '';
      document.getElementById('reviewMeta').textContent = 'Select a route session to review.';
      document.getElementById('detail').textContent = 'Select a route session.';
      document.getElementById('timelineSummary').innerHTML = '';
      document.getElementById('eventTypeFilter').innerHTML = '<option value="">All event types</option>';
      document.getElementById('eventSeverityFilter').innerHTML = '<option value="">All severities</option>';
    }
    async function loadSessions() {
      const res = await fetch('/api/routing/route-sessions?' + buildDashboardQuery(75).toString());
      const data = await res.json();
      if (!res.ok) {
        document.getElementById('message').textContent = data.error || 'Unable to load sessions.';
        return;
      }
      sessionsCache = data.sessions || [];
      document.getElementById('sessions').innerHTML = (data.sessions || []).map(function (session) {
        return '<tr>' +
          '<td>' + escapeHtml(session.createdAt) + '<br><span class="pill">' + escapeHtml(session.id) + '</span></td>' +
          '<td>' + escapeHtml(session.destinationLabel || 'Unknown destination') + '</td>' +
          '<td>Route ' + escapeHtml(session.chosenRouteIndex) + ' of ' + escapeHtml(session.routeCount) + '</td>' +
          '<td>' + summarizeHazards(session.hazardSummary) + '</td>' +
          '<td><div class="button-row">' +
          '<span class="pill">' + escapeHtml(session.reviewStatus || 'unreviewed') + '</span>' +
          (session.archivedAt ? '<span class="pill">archived</span>' : '') +
          '<button onclick="loadSession(&quot;' + escapeHtml(session.id) + '&quot;)">View</button>' +
          (!session.archivedAt ? '<button class="gray" onclick="archiveSession(&quot;' + escapeHtml(session.id) + '&quot;)">Archive</button>' : '') +
          (canDeleteRouteSessions ? '<button class="danger" onclick="deleteSession(&quot;' + escapeHtml(session.id) + '&quot;)">Delete</button>' : '') +
          '</div></td>' +
          '</tr>';
      }).join('') || '<tr><td colspan="5">No route sessions recorded yet.</td></tr>';
      document.getElementById('message').textContent = 'Loaded ' + (data.sessions || []).length + ' route sessions.';
      if (sessionsCache[0]) loadSession(sessionsCache[0].id);
    }
    async function loadAnalytics() {
      const res = await fetch('/api/routing/route-sessions/stats?' + buildDashboardQuery(75).toString());
      const data = await res.json();
      if (!res.ok) {
        document.getElementById('analyticsBreakdown').textContent = data.error || 'Unable to load analytics.';
        return;
      }
      renderAnalytics(data.analytics || {});
    }
    function loadDashboard() {
      loadAnalytics();
      loadSessions();
    }
    function exportSessionsCsv() {
      window.location.href = '/api/routing/route-sessions/export.csv?' + buildDashboardQuery(1000).toString();
    }
    async function loadSession(id) {
      document.getElementById('message').textContent = 'Loading route session ' + id + '...';
      const res = await fetch('/api/routing/route-sessions/' + encodeURIComponent(id));
      const data = await res.json();
      if (!res.ok) {
        document.getElementById('message').textContent = data.error || 'Unable to load session.';
        return;
      }
      renderSessionDetail(data.session);
      document.getElementById('message').textContent = 'Viewing route session ' + id + '.';
    }
    async function saveSessionReview() {
      if (!selectedSessionId) {
        document.getElementById('reviewMeta').textContent = 'Select a route session before saving a review.';
        return;
      }
      const res = await fetch('/api/routing/route-sessions/' + encodeURIComponent(selectedSessionId) + '/review', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewStatus: document.getElementById('reviewStatus').value,
          supervisorNotes: document.getElementById('supervisorNotes').value
        })
      });
      const data = await res.json();
      if (!res.ok) {
        document.getElementById('reviewMeta').textContent = data.error || 'Unable to save review.';
        return;
      }
      renderSessionDetail(data.session);
      document.getElementById('message').textContent = 'Saved supervisor review for route session ' + selectedSessionId + '.';
      loadAnalytics();
      loadSessions();
    }
    async function deleteSession(id) {
      if (!canDeleteRouteSessions) {
        document.getElementById('message').textContent = 'Only admins can permanently delete route sessions. Use Archive instead.';
        return;
      }
      if (!window.confirm('Delete this route session and its driver events? This cannot be undone.')) return;
      const res = await fetch('/api/routing/route-sessions/' + encodeURIComponent(id), { method: 'DELETE' });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        document.getElementById('message').textContent = data.error || 'Unable to delete route session.';
        return;
      }
      document.getElementById('message').textContent = 'Deleted route session ' + id + '.';
      clearSelectedSession();
      loadDashboard();
    }
    async function deleteVisibleSessions() {
      if (!canDeleteRouteSessions) {
        document.getElementById('message').textContent = 'Only admins can permanently delete route sessions. Use Archive Visible instead.';
        return;
      }
      if (!sessionsCache.length) {
        document.getElementById('message').textContent = 'There are no visible sessions to delete.';
        return;
      }
      const confirmed = window.confirm(
        'Delete the ' + sessionsCache.length + ' visible route session(s) matching the current filters? This cannot be undone.'
      );
      if (!confirmed) return;
      const res = await fetch('/api/routing/route-sessions?' + buildDashboardQuery(1000).toString(), { method: 'DELETE' });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        document.getElementById('message').textContent = data.error || 'Unable to delete visible route sessions.';
        return;
      }
      document.getElementById('message').textContent = 'Deleted ' + (data.deletedCount || 0) + ' route session(s).';
      clearSelectedSession();
      loadDashboard();
    }
    async function archiveSession(id) {
      const reason = window.prompt('Archive reason:', 'Archived after supervisor review.');
      if (reason === null) return;
      const res = await fetch('/api/routing/route-sessions/' + encodeURIComponent(id) + '/archive', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiveReason: reason })
      });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        document.getElementById('message').textContent = data.error || 'Unable to archive route session.';
        return;
      }
      document.getElementById('message').textContent = 'Archived route session ' + id + '.';
      clearSelectedSession();
      loadDashboard();
    }
    async function archiveVisibleSessions() {
      if (!sessionsCache.length) {
        document.getElementById('message').textContent = 'There are no visible sessions to archive.';
        return;
      }
      const reason = window.prompt('Archive reason for visible sessions:', 'Bulk archived after supervisor review.');
      if (reason === null) return;
      const confirmed = window.confirm('Archive the ' + sessionsCache.length + ' visible active route session(s)?');
      if (!confirmed) return;
      const res = await fetch('/api/routing/route-sessions/archive?' + buildDashboardQuery(1000).toString(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiveReason: reason })
      });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        document.getElementById('message').textContent = data.error || 'Unable to archive visible route sessions.';
        return;
      }
      document.getElementById('message').textContent = 'Archived ' + (data.archivedCount || 0) + ' route session(s).';
      clearSelectedSession();
      loadDashboard();
    }
    initReplayMap();
    loadDashboard();
  </script>
</body>
</html>`;
}

// Haversine distance in meters
function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function distancePointToSegmentMeters(point, a, b) {
  const latScale = 111320;
  const lngScale = 111320 * Math.cos((point.lat * Math.PI) / 180);
  const px = point.lng * lngScale;
  const py = point.lat * latScale;
  const ax = a.lng * lngScale;
  const ay = a.lat * latScale;
  const bx = b.lng * lngScale;
  const by = b.lat * latScale;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return haversineMeters(point, a);
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const closest = {
    lng: (ax + t * dx) / lngScale,
    lat: (ay + t * dy) / latScale
  };

  return haversineMeters(point, closest);
}

function orientation(a, b, c) {
  const value =
    (b.lng - a.lng) * (c.lat - b.lat) -
    (b.lat - a.lat) * (c.lng - b.lng);

  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return (
    b.lng <= Math.max(a.lng, c.lng) &&
    b.lng >= Math.min(a.lng, c.lng) &&
    b.lat <= Math.max(a.lat, c.lat) &&
    b.lat >= Math.min(a.lat, c.lat)
  );
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;

  return false;
}

function distanceSegmentToSegmentMeters(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;

  return Math.min(
    distancePointToSegmentMeters(a, c, d),
    distancePointToSegmentMeters(b, c, d),
    distancePointToSegmentMeters(c, a, b),
    distancePointToSegmentMeters(d, a, b)
  );
}

function nearestDistanceToGeometryMeters(point, geometry) {
  if (!Array.isArray(geometry) || geometry.length < 2) return Infinity;

  let nearest = Infinity;
  for (let index = 0; index < geometry.length - 1; index += 1) {
    const a = geometry[index];
    const b = geometry[index + 1];
    if (
      !Number.isFinite(Number(a?.lat)) ||
      !Number.isFinite(Number(a?.lng)) ||
      !Number.isFinite(Number(b?.lat)) ||
      !Number.isFinite(Number(b?.lng))
    ) {
      continue;
    }

    const distance = distancePointToSegmentMeters(
      point,
      { lat: Number(a.lat), lng: Number(a.lng) },
      { lat: Number(b.lat), lng: Number(b.lng) }
    );
    if (distance < nearest) nearest = distance;
  }

  return nearest;
}

function nearestDistanceBetweenGeometriesMeters(routePoints, geometry) {
  if (!Array.isArray(routePoints) || routePoints.length < 2) return Infinity;
  if (!Array.isArray(geometry) || geometry.length < 2) return Infinity;

  let nearest = Infinity;

  for (let routeIndex = 0; routeIndex < routePoints.length - 1; routeIndex += 1) {
    const routeA = normalizeLatLng(routePoints[routeIndex]);
    const routeB = normalizeLatLng(routePoints[routeIndex + 1]);
    if (!routeA || !routeB) continue;

    for (let geometryIndex = 0; geometryIndex < geometry.length - 1; geometryIndex += 1) {
      const geometryA = normalizeLatLng(geometry[geometryIndex]);
      const geometryB = normalizeLatLng(geometry[geometryIndex + 1]);
      if (!geometryA || !geometryB) continue;

      const distance = distanceSegmentToSegmentMeters(routeA, routeB, geometryA, geometryB);
      if (distance < nearest) nearest = distance;
      if (nearest === 0) return 0;
    }
  }

  return nearest;
}

function nearestDistancePointToRouteMeters(point, routePoints) {
  if (!point || !Array.isArray(routePoints) || !routePoints.length) return Infinity;

  if (routePoints.length === 1) {
    const onlyPoint = normalizeLatLng(routePoints[0]);
    return onlyPoint ? haversineMeters(point, onlyPoint) : Infinity;
  }

  let nearest = Infinity;

  for (let index = 0; index < routePoints.length - 1; index += 1) {
    const a = normalizeLatLng(routePoints[index]);
    const b = normalizeLatLng(routePoints[index + 1]);
    if (!a || !b) continue;

    const distance = distancePointToSegmentMeters(point, a, b);
    if (distance < nearest) nearest = distance;
    if (nearest === 0) return 0;
  }

  return nearest;
}

function closestPointOnSegment(point, a, b) {
  const latScale = 111320;
  const lngScale = 111320 * Math.cos((point.lat * Math.PI) / 180);
  const px = point.lng * lngScale;
  const py = point.lat * latScale;
  const ax = a.lng * lngScale;
  const ay = a.lat * latScale;
  const bx = b.lng * lngScale;
  const by = b.lat * latScale;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return a;

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return {
    lng: (ax + t * dx) / lngScale,
    lat: (ay + t * dy) / latScale
  };
}

function nearestPointOnGeometry(point, geometry) {
  if (!Array.isArray(geometry) || geometry.length < 2) return null;

  let nearest = null;
  let nearestDistance = Infinity;

  for (let index = 0; index < geometry.length - 1; index += 1) {
    const a = normalizeLatLng(geometry[index]);
    const b = normalizeLatLng(geometry[index + 1]);
    if (!a || !b) continue;

    const candidate = closestPointOnSegment(point, a, b);
    const distance = haversineMeters(point, candidate);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = candidate;
    }
  }

  return nearest;
}

function nearestPointOnGeometryToRoute(routePoints, geometry) {
  if (!Array.isArray(routePoints) || routePoints.length < 2) return null;
  if (!Array.isArray(geometry) || geometry.length < 2) return null;

  let nearest = null;
  let nearestDistance = Infinity;

  for (let routeIndex = 0; routeIndex < routePoints.length - 1; routeIndex += 1) {
    const routeA = normalizeLatLng(routePoints[routeIndex]);
    const routeB = normalizeLatLng(routePoints[routeIndex + 1]);
    if (!routeA || !routeB) continue;

    for (let geometryIndex = 0; geometryIndex < geometry.length - 1; geometryIndex += 1) {
      const geometryA = normalizeLatLng(geometry[geometryIndex]);
      const geometryB = normalizeLatLng(geometry[geometryIndex + 1]);
      if (!geometryA || !geometryB) continue;

      const distance = distanceSegmentToSegmentMeters(routeA, routeB, geometryA, geometryB);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = closestPointOnSegment(routeA, geometryA, geometryB);
      }

      if (nearestDistance === 0) return nearest;
    }
  }

  return nearest;
}

// Ray-casting point-in-polygon
function pointInPolygon(point, polygon) {
  let x = point.lat, y = point.lng;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function routeIntersectsPolygon(routePoints, polygon) {
  if (!Array.isArray(routePoints) || routePoints.length < 2) return null;
  if (!Array.isArray(polygon) || polygon.length < 3) return null;

  for (const point of routePoints) {
    const normalizedPoint = normalizeLatLng(point);
    if (normalizedPoint && pointInPolygon(normalizedPoint, polygon)) {
      return normalizedPoint;
    }
  }

  for (let routeIndex = 0; routeIndex < routePoints.length - 1; routeIndex += 1) {
    const routeA = normalizeLatLng(routePoints[routeIndex]);
    const routeB = normalizeLatLng(routePoints[routeIndex + 1]);
    if (!routeA || !routeB) continue;

    for (let polygonIndex = 0; polygonIndex < polygon.length; polygonIndex += 1) {
      const polygonA = normalizeLatLng(polygon[polygonIndex]);
      const polygonB = normalizeLatLng(polygon[(polygonIndex + 1) % polygon.length]);
      if (!polygonA || !polygonB) continue;

      if (segmentsIntersect(routeA, routeB, polygonA, polygonB)) {
        return {
          lat: (routeA.lat + routeB.lat) / 2,
          lng: (routeA.lng + routeB.lng) / 2
        };
      }
    }
  }

  return null;
}

// Decode Google encoded polyline
function decodePolyline(str) {
  let index = 0, lat = 0, lng = 0, out = [];
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1); lat += dlat;
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1); lng += dlng;
    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeTruckProfile(truck) {
  return {
    height_ft: positiveNumber(truck?.height_ft, 13.6),
    weight_lb: positiveNumber(truck?.weight_lb, 80000),
    length_ft: positiveNumber(truck?.length_ft, 53),
    hazmat: Boolean(truck?.hazmat)
  };
}

function cleanInstruction(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLatLng(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function normalizeRouteSteps(legs) {
  const steps = [];

  for (const leg of legs || []) {
    for (const step of leg.steps || []) {
      const start = normalizeLatLng(step.start_location);
      const end = normalizeLatLng(step.end_location);
      if (!start || !end) continue;

      steps.push({
        index: steps.length,
        instruction: cleanInstruction(step.html_instructions),
        maneuver: step.maneuver || null,
        distance_m: step.distance?.value ?? null,
        duration_s: step.duration?.value ?? null,
        start_location: start,
        end_location: end,
        encoded: step.polyline?.points || null
      });
    }
  }

  return steps;
}

function summarizeHazards(hazards) {
  const lowBridgeCount = hazards.lowBridges?.length || 0;
  const noTruckZoneCount = hazards.noTruckZones?.length || 0;
  const residentialZoneCount = hazards.residentialZones?.length || 0;
  const total =
    lowBridgeCount +
    noTruckZoneCount +
    residentialZoneCount;

  let severity = 'clear';
  if (lowBridgeCount > 0) {
    severity = 'critical';
  } else if (noTruckZoneCount > 0) {
    severity = 'high';
  } else if (residentialZoneCount > 0) {
    severity = 'medium';
  }

  return {
    total,
    lowBridgeCount,
    noTruckZoneCount,
    residentialZoneCount,
    severity
  };
}

function parseBoundsFromQuery(query) {
  const north = Number(query.north);
  const south = Number(query.south);
  const east = Number(query.east);
  const west = Number(query.west);

  if (
    !Number.isFinite(north) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(west)
  ) {
    return null;
  }

  return {
    north: Math.max(north, south),
    south: Math.min(north, south),
    east,
    west
  };
}

function pointInsideBounds(point, bounds) {
  if (!point || !bounds) return false;

  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  const insideLatitude = lat >= bounds.south && lat <= bounds.north;
  const insideLongitude = bounds.west <= bounds.east
    ? lng >= bounds.west && lng <= bounds.east
    : lng >= bounds.west || lng <= bounds.east;

  return insideLatitude && insideLongitude;
}

function getAveragePoint(points) {
  if (!Array.isArray(points) || !points.length) return null;

  let latSum = 0;
  let lngSum = 0;
  let count = 0;

  for (const point of points) {
    const normalized = normalizeLatLng(point);
    if (!normalized) continue;
    latSum += normalized.lat;
    lngSum += normalized.lng;
    count += 1;
  }

  if (!count) return null;
  return {
    lat: latSum / count,
    lng: lngSum / count
  };
}

function getMiddlePoint(points) {
  if (!Array.isArray(points) || !points.length) return null;

  const middleIndex = Math.floor(points.length / 2);
  return normalizeLatLng(points[middleIndex]) || getAveragePoint(points);
}

function getZoneMarkerPoint(zone) {
  const directPoint = normalizeLatLng({
    lat: zone?.latitude ?? zone?.lat,
    lng: zone?.longitude ?? zone?.lng
  });
  if (directPoint) return directPoint;

  if (Array.isArray(zone?.geometry) && zone.geometry.length) {
    return getMiddlePoint(zone.geometry);
  }

  if (Array.isArray(zone?.polygon) && zone.polygon.length) {
    return getAveragePoint(zone.polygon);
  }

  return null;
}

function getVisiblePointFromList(points, bounds) {
  if (!Array.isArray(points) || !points.length) return null;

  const visiblePoints = points
    .map(normalizeLatLng)
    .filter((point) => pointInsideBounds(point, bounds));

  if (!visiblePoints.length) return null;
  return visiblePoints[Math.floor(visiblePoints.length / 2)];
}

function pointClampedToBounds(point, bounds) {
  if (!point || !bounds) return null;

  return {
    lat: Math.min(bounds.north, Math.max(bounds.south, point.lat)),
    lng: bounds.west <= bounds.east
      ? Math.min(bounds.east, Math.max(bounds.west, point.lng))
      : point.lng
  };
}

function segmentIntersectsBounds(a, b, bounds) {
  if (pointInsideBounds(a, bounds) || pointInsideBounds(b, bounds)) return true;

  const nw = { lat: bounds.north, lng: bounds.west };
  const ne = { lat: bounds.north, lng: bounds.east };
  const se = { lat: bounds.south, lng: bounds.east };
  const sw = { lat: bounds.south, lng: bounds.west };

  return (
    segmentsIntersect(a, b, nw, ne) ||
    segmentsIntersect(a, b, ne, se) ||
    segmentsIntersect(a, b, se, sw) ||
    segmentsIntersect(a, b, sw, nw)
  );
}

function getSegmentPointInBounds(points, bounds) {
  if (!Array.isArray(points) || points.length < 2) return null;

  for (let index = 0; index < points.length - 1; index += 1) {
    const a = normalizeLatLng(points[index]);
    const b = normalizeLatLng(points[index + 1]);
    if (!a || !b) continue;

    if (segmentIntersectsBounds(a, b, bounds)) {
      return pointClampedToBounds({
        lat: (a.lat + b.lat) / 2,
        lng: (a.lng + b.lng) / 2
      }, bounds);
    }
  }

  return null;
}

function getZoneMarkerPointInBounds(zone, bounds) {
  const directPoint = normalizeLatLng({
    lat: zone?.latitude ?? zone?.lat,
    lng: zone?.longitude ?? zone?.lng
  });
  if (pointInsideBounds(directPoint, bounds)) return directPoint;

  const visibleGeometryPoint = getVisiblePointFromList(zone?.geometry, bounds);
  if (visibleGeometryPoint) return visibleGeometryPoint;

  const visiblePolygonPoint = getVisiblePointFromList(zone?.polygon, bounds);
  if (visiblePolygonPoint) return visiblePolygonPoint;

  const geometrySegmentPoint = getSegmentPointInBounds(zone?.geometry, bounds);
  if (geometrySegmentPoint) return geometrySegmentPoint;

  const polygonSegmentPoint = getSegmentPointInBounds(zone?.polygon, bounds);
  if (polygonSegmentPoint) return polygonSegmentPoint;

  return getZoneMarkerPoint(zone);
}

function buildVisibleHazard(record, category, point) {
  const confidence = getHazardConfidence(record);
  const sourceMetadata = getHazardSourceMetadata(record, category);
  const verificationStatus = normalizeHazardVerificationStatus(record);
  return {
    id: record.id || record.structure_id || `${category}:${point.lat},${point.lng}`,
    category,
    name: record.name || record.road || record.description || null,
    ...buildHazardLocationMetadata(record),
    latitude: point.lat,
    longitude: point.lng,
    clearance_ft: record.clearance_ft ?? null,
    manual: sourceMetadata.manual,
    source: sourceMetadata.source,
    source_label: sourceMetadata.label,
    source_metadata: sourceMetadata,
    confidence,
    trust_level: confidence,
    verification_status: verificationStatus,
    verified_by: record.verified_by || null,
    verified_at: record.verified_at || null,
    warning_strength: buildWarningStrength(record, category, confidence),
    notes: record.notes || null,
    restriction: record.restriction || null,
    type: record.type || category,
    severity:
      category === 'low_bridge'
        ? 'critical'
        : category === 'no_truck'
          ? 'high'
          : 'medium'
  };
}

function buildHazardLocationMetadata(record = {}) {
  return {
    state: record.state || record.location_state || null,
    state_code: record.state_code || record.stateCode || null,
    location_city: record.location_city || record.city || null,
    location_state: record.location_state || record.state || null,
    location_address: record.location_address || record.address || record.nearby_address || null,
    location_description: record.location_description || record.description || null
  };
}

function normalizeHazardVerificationStatus(record = {}) {
  const normalized = cleanManualText(record.verification_status || record.status || 'unverified', 40)
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (['verified', 'confirmed'].includes(normalized)) return 'verified';
  if (['needs_review', 'needs_follow_up', 'pending'].includes(normalized)) return 'needs_review';
  if (['inactive', 'incorrect', 'rejected'].includes(normalized)) return normalized;
  return 'unverified';
}

function normalizeHazardConfidence(value) {
  const normalized = cleanManualText(value, 40).toLowerCase().replace(/[\s-]+/g, '_');
  if (['verified', 'high', 'medium', 'low'].includes(normalized)) return normalized;
  if (['caution', 'standard', 'unverified'].includes(normalized)) return 'low';
  return null;
}

function getHazardConfidence(record = {}) {
  const explicit = normalizeHazardConfidence(record.confidence);
  if (explicit) return explicit;

  const verificationStatus = normalizeHazardVerificationStatus(record);
  if (verificationStatus === 'verified') return 'verified';
  if (record.source === 'manual_override' || record.manual === true) return 'high';
  if (record.report_source === 'driver_report') return 'medium';
  if (verificationStatus === 'needs_review') return 'medium';
  if (record.raw?.city_metadata_source === 'census_tiger_place' || record.city_metadata_source === 'census_tiger_place') return 'medium';
  return 'low';
}

function getHazardSourceMetadata(record = {}, category = 'hazard') {
  const raw = record.raw || {};
  const reportSource = normalizeManualSource(record.report_source || record.source_type, '');
  const manual = record.source === 'manual_override' || record.manual === true || reportSource === 'manual_admin';
  const driverReported = reportSource === 'driver_report';
  const cityMetadataSource = record.city_metadata_source || raw.city_metadata_source || null;
  const importedSource = record.source || raw.source || null;
  let source = 'imported_static_dataset';
  let label = 'Imported static hazard dataset';

  if (driverReported) {
    source = 'driver_report';
    label = 'Driver report';
  } else if (manual) {
    source = 'manual_supervisor_override';
    label = 'Supervisor manual override';
  } else if (cityMetadataSource === 'census_tiger_place') {
    source = 'census_tiger_place_enriched_static_dataset';
    label = 'Imported hazard enriched with Census TIGER/Line city metadata';
  } else if (importedSource === 'manual_override') {
    source = 'manual_supervisor_override';
    label = 'Supervisor manual override';
  } else if (category === 'no_truck' || category === 'residential') {
    source = 'openstreetmap_import';
    label = 'OpenStreetMap imported restriction';
  } else if (category === 'low_bridge') {
    source = 'low_clearance_bridge_import';
    label = 'Imported low-clearance bridge dataset';
  }

  return {
    source,
    label,
    manual,
    driver_reported: driverReported,
    imported_source: importedSource,
    report_source: reportSource || null,
    city_metadata_source: cityMetadataSource,
    city_metadata_year: record.city_metadata_year || raw.city_metadata_year || null,
    census_place_geoid: record.census_place_geoid || raw.census_place_geoid || null,
    verification_status: normalizeHazardVerificationStatus(record),
    verified_by: record.verified_by || null,
    verified_at: record.verified_at || null
  };
}

function buildWarningStrength(record, category, confidence) {
  const trusted = confidence === 'verified' || confidence === 'high';
  if (category === 'low_bridge') {
    return trusted ? 'critical_verified' : 'critical_caution';
  }
  if (category === 'no_truck') {
    return trusted ? 'strong_verified' : 'strong_caution';
  }
  return trusted ? 'moderate_verified' : 'moderate_caution';
}

function summarizeHazardSourceConfidence(hazards) {
  const normalized = normalizeHazardsForVerification(hazards);
  const summary = {
    confidence: { verified: 0, high: 0, medium: 0, low: 0 },
    sources: {},
    verification: {}
  };

  for (const hazard of [
    ...normalized.lowBridges,
    ...normalized.noTruckZones,
    ...normalized.residentialZones
  ]) {
    const confidence = normalizeHazardConfidence(hazard.confidence || hazard.trust_level) || 'low';
    const verificationStatus = normalizeHazardVerificationStatus(hazard);
    const source = hazard.source || hazard.source_metadata?.source || 'unknown';
    summary.confidence[confidence] = (summary.confidence[confidence] || 0) + 1;
    summary.sources[source] = (summary.sources[source] || 0) + 1;
    summary.verification[verificationStatus] = (summary.verification[verificationStatus] || 0) + 1;
  }

  return summary;
}

function decorateScoredHazard(record, category) {
  const confidence = getHazardConfidence(record);
  const sourceMetadata = getHazardSourceMetadata(record, category);
  return {
    ...buildHazardLocationMetadata(record),
    confidence,
    trust_level: confidence,
    verification_status: normalizeHazardVerificationStatus(record),
    verified_by: record.verified_by || null,
    verified_at: record.verified_at || null,
    warning_strength: buildWarningStrength(record, category, confidence),
    source: sourceMetadata.source,
    source_label: sourceMetadata.label,
    source_metadata: sourceMetadata,
    manual: sourceMetadata.manual,
    notes: record.notes || null
  };
}

function collectVisibleHazards(records, category, bounds, limit, pointForRecord) {
  const output = [];

  for (const record of records) {
    const point = pointForRecord(record);
    if (!pointInsideBounds(point, bounds)) continue;

    output.push(buildVisibleHazard(record, category, point));
    if (output.length >= limit) break;
  }

  return output;
}

function buildDirectionsLocation({ placeId, address, coordinate }) {
  if (address) return address;
  if (placeId) return `place_id:${placeId}`;
  if (coordinate) return `${coordinate.lat},${coordinate.lng}`;
  return null;
}

function getPointHazardRouteDistanceMeters(hazard, points) {
  const point = normalizeLatLng({
    lat: hazard.latitude ?? hazard.lat,
    lng: hazard.longitude ?? hazard.lng
  });

  if (!point) return Infinity;
  return nearestDistancePointToRouteMeters(point, points);
}

// Count hazards for a polyline (array of {lat,lng})
function scoreRoute(points, opts) {
  const {
    truckHeightFt = 13.6,            // Standard beverage trailers can be near 13'6"
    safetyMarginFt = 0.3,            // ~3.6 inches margin
    minCutoffFt = 13.0,              // never allow below 13 even if truck shorter
    bridgeBufferMeters = 120,        // more generous buffer to catch near-path bridges
    restrictedRoadBufferMeters = 45,
    hazardDatasets = null
  } = opts || {};
  const manualHazards = hazardDatasets ? null : splitManualHazards();
  const bridgeRecords = hazardDatasets?.bridges || [...bridges, ...manualHazards.lowBridges];
  const noTruckRecords = hazardDatasets?.noTruckZones || [...noTruckZones, ...manualHazards.noTruckZones];
  const residentialRecords = hazardDatasets?.residentialZones || [...residentialZones, ...manualHazards.residentialZones];

  // Required clearance is max(truckHeight + margin, regulatory cutoff)
  const requiredClearance = Math.max(minCutoffFt, truckHeightFt + safetyMarginFt);

  const hazards = {
    lowBridges: [],
    noTruckZones: [],
    residentialZones: []
  };

 // 1) Bridges: dataset already contains ONLY low-clearance bridges.
// Flag if a low-clearance point is within buffer of the route polyline.
for (const b of bridgeRecords) {
  const bp = { lat: Number(b.latitude), lng: Number(b.longitude) };
  if (!Number.isFinite(bp.lat) || !Number.isFinite(bp.lng)) continue;

  const clr = Number(b.clearance_ft);
  const clearance_ft = Number.isFinite(clr) ? clr : null;
  const nearestRouteDistanceMeters = nearestDistancePointToRouteMeters(bp, points);

  if (nearestRouteDistanceMeters <= bridgeBufferMeters) {
    const clearanceGapFt = clearance_ft === null
      ? null
      : Number((clearance_ft - requiredClearance).toFixed(1));

    hazards.lowBridges.push({
      id: b.id || b.structure_id || `${b.latitude},${b.longitude}`,
      name: b.name || 'Low-clearance bridge',
      latitude: bp.lat,
      longitude: bp.lng,
      clearance_ft,
      required_clearance_ft: Number(requiredClearance.toFixed(1)),
      clearance_gap_ft: clearanceGapFt,
      distance_from_route_m: Math.round(nearestRouteDistanceMeters),
      severity: clearanceGapFt === null || clearanceGapFt < 0 ? 'critical' : 'warning',
      ...decorateScoredHazard(b, 'low_bridge')
    });
  }
}

  // 2) Zones – if any route point lies inside polygon
  const checkZones = (zones, bucket) => {
    for (const z of zones) {
      const poly = z.polygon || [];
      const geometry = z.geometry || [];
      const severity = bucket === 'noTruckZones' ? 'high' : 'medium';

      if (Array.isArray(poly) && poly.length >= 3) {
        const markerPoint = routeIntersectsPolygon(points, poly);
        if (markerPoint) {
          hazards[bucket].push({
            id: z.id,
            name: z.name,
            latitude: markerPoint.lat,
            longitude: markerPoint.lng,
            type: z.type || 'polygon',
            restriction: z.restriction || null,
            distance_from_route_m: 0,
            severity,
            ...decorateScoredHazard(z, bucket === 'noTruckZones' ? 'no_truck' : 'residential')
          });
        }
        continue;
      }

      if (Array.isArray(geometry) && geometry.length >= 2) {
        const nearestRouteDistanceMeters = nearestDistanceBetweenGeometriesMeters(points, geometry);

        if (nearestRouteDistanceMeters <= restrictedRoadBufferMeters) {
          const markerPoint = nearestPointOnGeometryToRoute(points, geometry);

          hazards[bucket].push({
            id: z.id,
            name: z.name,
            latitude: markerPoint?.lat ?? geometry[0]?.lat ?? null,
            longitude: markerPoint?.lng ?? geometry[0]?.lng ?? null,
            type: z.type || 'restricted_road',
            restriction: z.restriction || null,
            distance_from_route_m: Math.round(nearestRouteDistanceMeters),
            severity,
            ...decorateScoredHazard(z, bucket === 'noTruckZones' ? 'no_truck' : 'residential')
          });
        }
        continue;
      }

      const pointDistanceMeters = getPointHazardRouteDistanceMeters(z, points);
      if (pointDistanceMeters <= restrictedRoadBufferMeters) {
        const markerPoint = normalizeLatLng({
          lat: z.latitude ?? z.lat,
          lng: z.longitude ?? z.lng
        });

        hazards[bucket].push({
          id: z.id,
          name: z.name,
          latitude: markerPoint?.lat ?? null,
          longitude: markerPoint?.lng ?? null,
          type: z.type || 'manual_point',
          restriction: z.restriction || null,
          distance_from_route_m: Math.round(pointDistanceMeters),
          severity,
          ...decorateScoredHazard(z, bucket === 'noTruckZones' ? 'no_truck' : 'residential')
        });
      }
    }
  };
  checkZones(noTruckRecords, 'noTruckZones');
  checkZones(residentialRecords, 'residentialZones');

  const score =
    hazards.lowBridges.length * 10 + // most critical
    hazards.noTruckZones.length * 5 +
    hazards.residentialZones.length * 3;

  return { hazards, score };
}

function buildRouteVerification(route) {
  const hazards = normalizeHazardsForVerification(route?.hazards);
  const samples = {
    lowBridges: hazards.lowBridges.slice(0, 8),
    noTruckZones: hazards.noTruckZones.slice(0, 8),
    residentialZones: hazards.residentialZones.slice(0, 8)
  };

  return {
    index: route?.index,
    summary: route?.summary || '',
    distance_m: route?.distance_m ?? null,
    duration_s: route?.duration_s ?? null,
    point_count: route?.encoded ? decodePolyline(route.encoded).length : 0,
    hazardSummary: route?.hazardSummary || summarizeHazards(hazards),
    hazardSourceSummary: summarizeHazardSourceConfidence(hazards),
    hazardSamples: samples,
    verification: {
      checks: [
        'low bridges measured against full route polyline segments',
        'no-truck road geometry measured against full route polyline segments',
        'residential polygons checked against route points and segment intersections',
        'manual override hazards included with imported datasets'
      ],
      manualHazardsIncluded: true
    }
  };
}

function normalizeHazardsForVerification(hazards) {
  return {
    lowBridges: Array.isArray(hazards?.lowBridges) ? hazards.lowBridges : [],
    noTruckZones: Array.isArray(hazards?.noTruckZones) ? hazards.noTruckZones : [],
    residentialZones: Array.isArray(hazards?.residentialZones) ? hazards.residentialZones : []
  };
}

function buildSafeRouteResponse(evaluated, truckProfile, tuning) {
  const safe = evaluated.find((route) => route.score === 0);
  const best = safe || evaluated.reduce((a, b) => (a.score <= b.score ? a : b));

  return {
    chosenRouteIndex: best.index,
    chosenRouteHazards: best.hazards,
    chosenRouteHazardSummary: best.hazardSummary,
    chosenRouteHazardSourceSummary: summarizeHazardSourceConfidence(best.hazards),
    routes: evaluated,
    usedTruckProfile: truckProfile,
    usedTuning: {
      bridgeBufferMeters: Number(tuning?.bridgeBufferMeters) || 120,
      restrictedRoadBufferMeters: Number(tuning?.restrictedRoadBufferMeters) || 45
    },
    verification: {
      chosenRoute: buildRouteVerification(best),
      routes: evaluated.map(buildRouteVerification),
      manualHazardCount: readManualHazards().length
    }
  };
}

function buildRerouteRecommendation(hazards) {
  const normalized = normalizeHazardsForVerification(hazards);
  const criticalBridge = normalized.lowBridges.find((hazard) => Number(hazard.distance_from_truck_m) <= 500);
  const noTruck = normalized.noTruckZones.find((hazard) => Number(hazard.distance_from_truck_m) <= 120);
  const residential = normalized.residentialZones.find((hazard) => Number(hazard.distance_from_truck_m) <= 120);

  if (criticalBridge) {
    return {
      recommended: true,
      reason: 'low_bridge_proximity',
      severity: 'critical',
      message: 'Low-clearance bridge nearby. Recalculate the truck-safe route before proceeding.'
    };
  }
  if (noTruck) {
    return {
      recommended: true,
      reason: 'no_truck_proximity',
      severity: 'high',
      message: 'No-truck restriction nearby. Recalculate route if this is not the planned route.'
    };
  }
  if (residential) {
    return {
      recommended: true,
      reason: 'residential_restriction_proximity',
      severity: 'medium',
      message: 'Residential truck restriction nearby. Confirm route or recalculate.'
    };
  }
  return {
    recommended: false,
    reason: null,
    severity: null,
    message: null
  };
}

function formatCoordinateLabel(coordinate) {
  const point = normalizeLatLng(coordinate);
  if (!point) return null;
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

function buildRouteEndpoint({ address, placeId, coordinate }) {
  const normalizedCoordinate = normalizeLatLng(coordinate) || normalizeLatLng({
    lat: coordinate?.latitude,
    lng: coordinate?.longitude
  });
  return {
    address: address || null,
    placeId: placeId || null,
    coordinate: normalizedCoordinate
  };
}

function buildRouteEndpointLabel({ address, placeId, coordinate }) {
  return address || placeId || formatCoordinateLabel(coordinate) || 'Unknown';
}

function summarizeRouteOptionForSession(route) {
  return {
    index: route.index,
    summary: route.summary || '',
    distance_m: route.distance_m ?? null,
    duration_s: route.duration_s ?? null,
    score: route.score ?? null,
    hazardSummary: route.hazardSummary || summarizeHazards(route.hazards),
    hazardDataSource: route.hazardDataSource || null,
    stepCount: Array.isArray(route.steps) ? route.steps.length : 0,
    encoded: route.encoded || null
  };
}

function normalizeSessionEventType(value) {
  const normalized = cleanManualText(value, 80).toLowerCase().replace(/[\s-]+/g, '_');
  return normalized || 'driver_event';
}

function normalizeSessionEventSeverity(value) {
  const normalized = cleanManualText(value, 40).toLowerCase().replace(/[\s-]+/g, '_');
  if (['info', 'low', 'medium', 'high', 'warning', 'critical'].includes(normalized)) return normalized;
  return 'info';
}

function parseBooleanQuery(value) {
  return ['true', '1', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function buildRouteSessionQueryOptions(query = {}) {
  return {
    limit: Math.min(Math.max(Number(query.limit) || 75, 1), 1000),
    search: cleanManualText(query.search, 160),
    days: Number(query.days) || null,
    since: cleanManualText(query.since, 80) || null,
    until: cleanManualText(query.until, 80) || null,
    hazardOnly: parseBooleanQuery(query.hazardOnly),
    reviewStatus: cleanManualText(query.reviewStatus || query.review_status, 40) || null,
    includeArchived: parseBooleanQuery(query.includeArchived),
    archivedOnly: parseBooleanQuery(query.archivedOnly)
  };
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildRouteSessionsCsv(sessions = []) {
  const rows = [
    [
      'route_session_id',
      'created_at',
      'origin',
      'destination',
      'chosen_route_index',
      'route_count',
      'low_bridge_count',
      'no_truck_zone_count',
      'residential_zone_count',
      'total_hazards',
      'truck_height_ft',
      'truck_length_ft',
      'truck_weight_lb',
      'hazmat',
      'review_status',
      'reviewed_by',
      'reviewed_at',
      'supervisor_notes',
      'archived_at',
      'archived_by',
      'archive_reason'
    ]
  ];

  for (const session of sessions) {
    const summary = session.hazardSummary || {};
    const truck = session.usedTruckProfile || {};
    rows.push([
      session.id,
      session.createdAt,
      session.originLabel,
      session.destinationLabel,
      session.chosenRouteIndex,
      session.routeCount,
      summary.lowBridgeCount || 0,
      summary.noTruckZoneCount || 0,
      summary.residentialZoneCount || 0,
      summary.total || 0,
      truck.height_ft ?? '',
      truck.length_ft ?? '',
      truck.weight_lb ?? '',
      truck.hazmat === true ? 'true' : 'false',
      session.reviewStatus || 'unreviewed',
      session.reviewedBy || '',
      session.reviewedAt || '',
      session.supervisorNotes || '',
      session.archivedAt || '',
      session.archivedBy || '',
      session.archiveReason || ''
    ]);
  }

  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

function buildRouteSessionPayload({
  routeSessionId,
  body,
  responseBody,
  evaluated,
  truckProfile,
  tuning,
  origin,
  destination,
  originAddress,
  destinationAddress,
  originPlaceId,
  destinationPlaceId,
  driver
}) {
  const originEndpoint = buildRouteEndpoint({
    address: originAddress,
    placeId: originPlaceId,
    coordinate: origin
  });
  const destinationEndpoint = buildRouteEndpoint({
    address: destinationAddress,
    placeId: destinationPlaceId,
    coordinate: destination
  });

  return {
    id: routeSessionId,
    originLabel: buildRouteEndpointLabel(originEndpoint),
    destinationLabel: buildRouteEndpointLabel(destinationEndpoint),
    origin: originEndpoint,
    destination: destinationEndpoint,
    chosenRouteIndex: null,
    routeCount: null,
    hazardSummary: {},
    chosenRouteHazards: {},
    usedTruckProfile: truckProfile,
    usedTuning: responseBody.usedTuning || {
      bridgeBufferMeters: Number(tuning?.bridgeBufferMeters) || 120,
      restrictedRoadBufferMeters: Number(tuning?.restrictedRoadBufferMeters) || 45
    },
    routeOptions: [],
    request: {
      driver: driver || null,
      truck: body?.truck || null,
      tuning: body?.tuning || null,
      replaySource: 'driver_device_gps'
    }
  };
}

async function saveRouteSessionIfAvailable(sessionPayload) {
  if (!repositories.isDatabaseEnabled()) return false;

  try {
    await repositories.saveRouteSession(sessionPayload);
    return true;
  } catch (error) {
    console.error('route-session save error:', error.message);
    return false;
  }
}

// ---------- Debug helpers ----------

// Quick “nearest low bridge” to a point (for validation)
router.get('/nearest-bridge', (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Number(req.query.radiusm || 500);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat,lng required' });
  }
  const here = { lat, lng };
  const within = [];
  for (const b of bridges) {
    const bp = { lat: Number(b.latitude), lng: Number(b.longitude) };
    const d = haversineMeters(here, bp);
    if (d <= radius) within.push({ id: b.id, clearance_ft: b.clearance_ft, lat: bp.lat, lng: bp.lng, dist_m: Math.round(d) });
  }
  within.sort((a, b) => a.dist_m - b.dist_m);
  res.json({ count: within.length, bridges: within.slice(0, 10) });
});

router.get('/ping', (req, res) => res.json({ ok: true, where: 'routes/routing.js' }));

router.get('/manual-hazards/admin/login', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  if (!getAdminPassword() || !getAdminSecret()) {
    return res.status(503).send(renderAdminLoginPage({ setupRequired: true }));
  }
  return res.send(renderAdminLoginPage());
});

router.post('/manual-hazards/admin/login', express.urlencoded({ extended: false }), async (req, res) => {
  if (!getAdminSecret()) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(503).send(renderAdminLoginPage({ setupRequired: true }));
  }

  const username = cleanManualText(req.body?.username || 'supervisor', 80) || 'supervisor';
  const password = String(req.body?.password || '');
  const result = await adminAuth.authenticateAdminUser(username, password);
  if (!result.ok) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(result.setupRequired ? 503 : 401).send(renderAdminLoginPage({
      setupRequired: result.setupRequired,
      error: result.reason || 'Incorrect supervisor username or password.'
    }));
  }

  setAdminSessionCookie(req, res, result.username, result.role, result.sessionVersion);
  return res.redirect('/api/admin');
});

router.post('/manual-hazards/admin/logout', (req, res) => {
  clearAdminSessionCookie(res);
  return res.redirect('/api/routing/manual-hazards/admin/login');
});

router.get('/manual-hazards/admin', requireAdminAuth, (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.send(renderManualHazardAdminPage(req.adminSession));
});

router.get('/hazard-verification/admin', requireAdminAuth, (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.send(renderHazardVerificationAdminPage(req.adminSession));
});

router.get('/route-sessions/admin', requireAdminAuth, (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.send(renderRouteSessionsAdminPage(req.adminSession));
});

router.get('/manual-hazards/admin-users/admin', requireAdminRole, (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.send(renderAdminUsersPage(req.adminSession));
});

function publicAdminUser(user) {
  return {
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
    driverCount: user.driverCount,
    teamCount: user.teamCount
  };
}

router.get('/manual-hazards/admin-users', requireAdminRole, async (req, res) => {
  try {
    if (!repositories.isDatabaseEnabled()) {
      return res.status(503).json({ error: 'Admin user management requires PostgreSQL. DATABASE_URL is not configured.' });
    }

    const users = await repositories.listAdminUsers();
    return res.json({ users: users.map(publicAdminUser) });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to list admin users' });
  }
});

router.post('/manual-hazards/admin-users', requireAdminRole, async (req, res) => {
  try {
    if (!repositories.isDatabaseEnabled()) {
      return res.status(503).json({ error: 'Admin user management requires PostgreSQL. DATABASE_URL is not configured.' });
    }

    const username = adminAuth.normalizeUsername(req.body?.username);
    const role = cleanManualText(req.body?.role || 'supervisor', 40).toLowerCase() === 'admin'
      ? 'admin'
      : 'supervisor';
    const displayName = cleanManualText(req.body?.displayName || req.body?.display_name || username, 120);
    const password = String(req.body?.password || '');
    const existing = username ? await repositories.getAdminUser(username) : null;

    if (!username) {
      return res.status(400).json({ error: 'username is required' });
    }
    if (!existing && password.length < 12) {
      return res.status(400).json({ error: 'new admin users require a password of at least 12 characters' });
    }
    if (existing?.active && existing.role === 'admin' && role !== 'admin') {
      const users = await repositories.listAdminUsers();
      const activeAdminCount = users.filter((user) => user.active && user.role === 'admin').length;
      if (activeAdminCount <= 1) {
        return res.status(409).json({ error: 'Create another active administrator before changing the final administrator role.' });
      }
    }

    const user = await repositories.upsertAdminUser({
      username,
      passwordHash: password ? adminAuth.hashPassword(password) : existing.passwordHash,
      role,
      displayName,
      active: req.body?.active !== false
    });

    return res.status(existing ? 200 : 201).json({ user: publicAdminUser(user) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Unable to save admin user' });
  }
});

router.put('/manual-hazards/admin-users/:username/active', requireAdminRole, async (req, res) => {
  try {
    if (!repositories.isDatabaseEnabled()) {
      return res.status(503).json({ error: 'Admin user management requires PostgreSQL. DATABASE_URL is not configured.' });
    }

    const username = adminAuth.normalizeUsername(req.params.username);
    const requestedActive = req.body?.active === true;
    if (username === adminAuth.normalizeUsername(req.adminSession?.username) && !requestedActive) {
      return res.status(400).json({ error: 'You cannot deactivate your own active admin session.' });
    }
    if (!requestedActive) {
      const existing = await repositories.getAdminUser(username);
      if (existing?.active && existing.role === 'admin') {
        const users = await repositories.listAdminUsers();
        const activeAdminCount = users.filter((user) => user.active && user.role === 'admin').length;
        if (activeAdminCount <= 1) {
          return res.status(409).json({ error: 'Create another active administrator before deactivating the final administrator.' });
        }
      }
      const assignedDrivers = await repositories.listDrivers({ supervisorUsername: username, limit: 1 });
      if (assignedDrivers.length) {
        return res.status(409).json({
          error: 'Transfer or remove this supervisor assigned drivers before deactivating the account.'
        });
      }
    }

    const user = await repositories.setAdminUserActive(username, requestedActive);
    if (!user) return res.status(404).json({ error: `admin user not found: ${username}` });
    return res.json({ user: publicAdminUser(user) });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to update admin user' });
  }
});

router.get('/route-sessions', requireAdminAuth, async (req, res) => {
  if (!repositories.isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Route replay requires PostgreSQL. DATABASE_URL is not configured.' });
  }

  try {
    const sessions = await repositories.listRouteSessions(buildRouteSessionQueryOptions(req.query));
    return res.json({ count: sessions.length, sessions });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Unable to list route sessions'
    });
  }
});

router.get('/route-sessions/stats', requireAdminAuth, async (req, res) => {
  if (!repositories.isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Route analytics requires PostgreSQL. DATABASE_URL is not configured.' });
  }

  try {
    const analytics = await repositories.getRouteSessionAnalytics(buildRouteSessionQueryOptions(req.query));
    return res.json({ analytics });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Unable to load route session analytics'
    });
  }
});

router.get('/route-sessions/export.csv', requireAdminAuth, async (req, res) => {
  if (!repositories.isDatabaseEnabled()) {
    return res.status(503).send('Route replay export requires PostgreSQL. DATABASE_URL is not configured.');
  }

  try {
    const sessions = await repositories.listRouteSessions({
      ...buildRouteSessionQueryOptions(req.query),
      limit: 1000
    });
    const exportedAt = new Date().toISOString();
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="truck-safe-route-sessions-${exportedAt.slice(0, 10)}.csv"`);
    return res.send(buildRouteSessionsCsv(sessions));
  } catch (error) {
    return res.status(500).send(error.message || 'Unable to export route sessions');
  }
});

router.put('/route-sessions/archive', requireAdminAuth, async (req, res) => {
  if (!repositories.isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Route replay archive requires PostgreSQL. DATABASE_URL is not configured.' });
  }

  try {
    const archivedCount = await repositories.archiveRouteSessions(buildRouteSessionQueryOptions(req.query), {
      archiveReason: req.body?.archiveReason || req.body?.archive_reason || req.body?.reason,
      archivedBy: req.adminSession?.username || 'supervisor'
    });
    return res.json({ archivedCount });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Unable to archive route sessions'
    });
  }
});

router.delete('/route-sessions', requireAdminRole, async (req, res) => {
  if (!repositories.isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Route replay deletion requires PostgreSQL. DATABASE_URL is not configured.' });
  }

  try {
    const options = buildRouteSessionQueryOptions(req.query);
    const deletedCount = await repositories.deleteRouteSessions(options);
    return res.json({ deletedCount });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Unable to delete route sessions'
    });
  }
});

router.get('/route-sessions/:id', requireAdminAuth, async (req, res) => {
  if (!repositories.isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Route replay requires PostgreSQL. DATABASE_URL is not configured.' });
  }

  try {
    const sessionId = cleanManualText(req.params.id, 120);
    const session = await repositories.getRouteSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: `route session not found: ${req.params.id}` });
    }
    session.events = await repositories.listRouteSessionEvents(sessionId, { limit: 2500 });
    return res.json({ session });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Unable to load route session'
    });
  }
});

router.put('/route-sessions/:id/review', requireAdminAuth, async (req, res) => {
  if (!repositories.isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Route session review requires PostgreSQL. DATABASE_URL is not configured.' });
  }

  try {
    const sessionId = cleanManualText(req.params.id, 120);
    const updated = await repositories.updateRouteSessionReview(sessionId, {
      reviewStatus: req.body?.reviewStatus || req.body?.review_status || req.body?.status,
      supervisorNotes: req.body?.supervisorNotes || req.body?.supervisor_notes || req.body?.notes,
      reviewedBy: req.adminSession?.username || req.body?.reviewedBy || req.body?.reviewed_by || 'supervisor'
    });
    if (!updated) {
      return res.status(404).json({ error: `route session not found: ${sessionId}` });
    }
    updated.events = await repositories.listRouteSessionEvents(sessionId, { limit: 2500 });
    return res.json({ session: updated });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to save route session review'
    });
  }
});

router.put('/route-sessions/:id/archive', requireAdminAuth, async (req, res) => {
  if (!repositories.isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Route replay archive requires PostgreSQL. DATABASE_URL is not configured.' });
  }

  try {
    const sessionId = cleanManualText(req.params.id, 120);
    const archived = await repositories.archiveRouteSession(sessionId, {
      archiveReason: req.body?.archiveReason || req.body?.archive_reason || req.body?.reason,
      archivedBy: req.adminSession?.username || 'supervisor'
    });
    if (!archived) {
      return res.status(404).json({ error: `route session not found: ${sessionId}` });
    }
    archived.events = await repositories.listRouteSessionEvents(sessionId, { limit: 2500 });
    return res.json({ session: archived });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Unable to archive route session'
    });
  }
});

router.delete('/route-sessions/:id', requireAdminRole, async (req, res) => {
  if (!repositories.isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Route replay deletion requires PostgreSQL. DATABASE_URL is not configured.' });
  }

  try {
    const deleted = await repositories.deleteRouteSession(cleanManualText(req.params.id, 120));
    if (!deleted) {
      return res.status(404).json({ error: `route session not found: ${req.params.id}` });
    }
    return res.json({ deleted });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Unable to delete route session'
    });
  }
});

router.post('/route-sessions/:id/events', driverAuth.requireDriverAuth, async (req, res) => {
  if (!repositories.isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Route session events require PostgreSQL. DATABASE_URL is not configured.' });
  }

  try {
    const sessionId = cleanManualText(req.params.id, 120);
    const session = await repositories.getRouteSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: `route session not found: ${sessionId}` });
    }

    const eventType = normalizeSessionEventType(req.body?.eventType || req.body?.event_type);
    const severity = normalizeSessionEventSeverity(req.body?.severity);
    const payload = req.body?.payload && typeof req.body.payload === 'object'
      ? req.body.payload
      : {};
    const event = await repositories.addRouteSessionEvent({
      routeSessionId: sessionId,
      eventType,
      severity,
      latitude: numberOrNull(req.body?.latitude ?? req.body?.lat),
      longitude: numberOrNull(req.body?.longitude ?? req.body?.lng),
      payload: {
        ...payload,
        driver: req.driverAuth || driverAuth.getDriverIdentity(req),
        clientRecordedAt: cleanNullableText(req.body?.clientRecordedAt || req.body?.client_recorded_at, 80)
      }
    });
    return res.status(201).json({ event });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Unable to save route session event'
    });
  }
});

router.get('/manual-hazards', async (req, res) => {
  const includeAll = String(req.query.includeAll || '').toLowerCase() === 'true';
  if (includeAll && !getAdminSession(req)) {
    return res.status(401).json({ error: 'Supervisor admin login required.' });
  }
  const status = cleanManualText(req.query.status, 30).toLowerCase();
  const category = normalizeManualCategory(req.query.category);
  const source = normalizeManualSource(req.query.source, '');
  let records = includeAll
    ? await readAllManualHazardsAsync({
      status: status && ['pending', 'confirmed', 'rejected'].includes(status) ? status : null,
      category,
      source
    })
    : await readManualHazardsAsync();
  records = [...records].sort((a, b) => {
    const bTime = Date.parse(b.updated_at || b.reported_at || b.created_at || 0);
    const aTime = Date.parse(a.updated_at || a.reported_at || a.created_at || 0);
    return bTime - aTime;
  });
  return res.json({
    count: records.length,
    hazards: records
  });
});

router.get('/manual-hazards/export', requireAdminAuth, async (req, res) => {
  const source = normalizeManualSource(req.query.source, '');
  let records = await readAllManualHazardsAsync({ source });

  const exportedAt = new Date().toISOString();
  const label = source === 'driver_report' ? 'driver-reports' : 'manual-hazards';
  res.set('Content-Type', 'application/json; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="truck-safe-${label}-${exportedAt.slice(0, 10)}.json"`);
  return res.json({
    exportedAt,
    source: source || 'all',
    count: records.length,
    records
  });
});

router.post('/manual-hazards', requireAdminAuth, async (req, res) => {
  try {
    const existingRecords = await readAllManualHazardsAsync();
    const hazard = normalizeManualHazardInput(req.body || {});

    if (existingRecords.some((record) => record.id === hazard.id)) {
      return res.status(409).json({ error: `manual hazard id already exists: ${hazard.id}` });
    }

    await saveManualHazardRecord(hazard);
    return res.status(201).json({ hazard });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to create manual hazard'
    });
  }
});

router.post('/manual-hazards/report', driverAuth.requireDriverAuth, async (req, res) => {
  try {
    const driver = req.driverAuth || driverAuth.getDriverIdentity(req);
    const hazard = normalizeDriverHazardReport({
      ...(req.body || {}),
      reported_by: driver.driverId,
      driver_id: driver.driverId,
      driver_name: driver.driverName
    });
    const photos = await saveHazardReportPhotos(req.body?.photos, hazard.id, req);
    hazard.photos = photos;
    await saveManualHazardRecord(hazard);
    const verificationRecord = await saveDriverReportForStaticVerification(hazard, photos);
    return res.status(201).json({
      hazard,
      verificationRecord,
      message: 'Hazard report saved as pending. It will not affect routing until confirmed.'
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to submit hazard report'
    });
  }
});

router.put('/manual-hazards/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = cleanManualText(req.params.id, 80);
    const existingRecords = await readAllManualHazardsAsync();
    const existing = existingRecords.find((record) => record.id === id);

    if (!existing) {
      return res.status(404).json({ error: `manual hazard not found: ${id}` });
    }

    const updated = normalizeManualHazardInput({ ...req.body, id }, existing);
    await saveManualHazardRecord(updated);
    return res.json({ hazard: updated });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to update manual hazard'
    });
  }
});

router.delete('/manual-hazards/:id', requireAdminAuth, async (req, res) => {
  const id = cleanManualText(req.params.id, 80);
  const deleted = await deleteManualHazardRecord(id);

  if (!deleted) {
    return res.status(404).json({ error: `manual hazard not found: ${id}` });
  }

  const count = (await readAllManualHazardsAsync()).length;
  return res.json({ deleted: id, count });
});

router.get('/hazard-verification', requireAdminAuth, async (req, res) => {
  if (!repositories.isDatabaseEnabled()) {
    return res.status(503).json({
      error: 'Hazard verification requires PostgreSQL. DATABASE_URL is not configured.'
    });
  }

  try {
    const category = normalizeManualCategory(req.query.category || 'low_bridge');
    if (!category) {
      return res.status(400).json({ error: 'category must be low_bridge, no_truck, or residential' });
    }

    const status = cleanManualText(req.query.status, 40).toLowerCase().replace(/[\s-]+/g, '_');
    const includeInactive =
      String(req.query.includeInactive || '').toLowerCase() === 'true'
      || status === 'needs_review';
    const serviceAreaOnly = String(req.query.serviceAreaOnly || '').toLowerCase() === 'true';
    const state = cleanManualText(req.query.state || req.query.stateCode, 40).toUpperCase();
    const quality = cleanManualText(req.query.quality || req.query.dataQuality, 40).toLowerCase().replace(/[\s-]+/g, '_');
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const bounds = parseBoundsFromQuery(req.query);
    const records = await repositories.listStaticHazardsForVerification({
      category,
      status: status || null,
      bounds,
      includeInactive,
      serviceAreaOnly,
      state,
      quality,
      limit
    });

    return res.json({
      count: records.length,
      hazards: records,
      filters: {
        category,
        status: status || null,
        includeInactive,
        serviceAreaOnly,
        state: state || null,
        quality: quality || null,
        bounds,
        limit
      }
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to list hazards for verification'
    });
  }
});

router.put('/hazard-verification/:category/:id', requireAdminAuth, async (req, res) => {
  if (!repositories.isDatabaseEnabled()) {
    return res.status(503).json({
      error: 'Hazard verification requires PostgreSQL. DATABASE_URL is not configured.'
    });
  }

  try {
    const category = normalizeManualCategory(req.params.category);
    if (!category) {
      return res.status(400).json({ error: 'category must be low_bridge, no_truck, or residential' });
    }

    const updated = await repositories.updateStaticHazardVerification(category, req.params.id, {
      verification_status: req.body?.verification_status ?? req.body?.status,
      verification_notes: req.body?.verification_notes ?? req.body?.notes,
      verified_by: req.body?.verified_by ?? req.body?.verifiedBy ?? req.adminSession?.username,
      location_address: req.body?.location_address ?? req.body?.address,
      location_description: req.body?.location_description ?? req.body?.landmark ?? req.body?.description,
      location_city: req.body?.location_city ?? req.body?.city,
      location_state: req.body?.location_state ?? req.body?.state,
      state_code: req.body?.state_code ?? req.body?.stateCode,
      active: Object.prototype.hasOwnProperty.call(req.body || {}, 'active') ? req.body.active : undefined
    });

    if (!updated) {
      return res.status(404).json({ error: `static hazard not found: ${req.params.id}` });
    }

    const manualHazardId = updated.manual_hazard_id || updated.manualHazardId;
    if (manualHazardId) {
      const existingRecords = await readAllManualHazardsAsync();
      const existing = existingRecords.find((record) => record.id === manualHazardId);
      if (existing) {
        const verificationStatus = updated.verification_status;
        const manualStatus = verificationStatus === 'verified'
          ? 'confirmed'
          : ['incorrect', 'inactive'].includes(verificationStatus)
            ? 'rejected'
            : 'pending';
        await saveManualHazardRecord(normalizeManualHazardInput({
          ...existing,
          status: manualStatus,
          enabled: manualStatus === 'confirmed',
          reviewed_by: req.adminSession?.username,
          review_notes: req.body?.verification_notes ?? req.body?.notes
        }, existing));
      }
    }

    return res.json({ hazard: updated });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to update hazard verification'
    });
  }
});

router.get('/hazard-location-backfill', requireAdminAuth, async (req, res) => {
  if (!repositories.isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Location backfill queue requires PostgreSQL.' });
  }

  const status = cleanManualText(req.query.status, 30).toLowerCase();
  const category = normalizeManualCategory(req.query.category);
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const [queue, stats] = await Promise.all([
    repositories.listStaticHazardLocationBackfillQueue({ status, category, limit }),
    repositories.getStaticHazardLocationBackfillStats()
  ]);
  return res.json({ queue, stats });
});

router.post('/hazard-location-backfill/enqueue', requireAdminAuth, async (req, res) => {
  if (!repositories.isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Location backfill queue requires PostgreSQL.' });
  }

  try {
    const category = normalizeManualCategory(req.body?.category || req.query.category || 'low_bridge');
    if (!category) {
      return res.status(400).json({ error: 'category must be low_bridge, no_truck, or residential' });
    }
    const limit = Math.min(Math.max(Number(req.body?.limit ?? req.query.limit) || 250, 1), 2000);
    const serviceAreaOnly = String(req.body?.serviceAreaOnly ?? req.query.serviceAreaOnly ?? 'true').toLowerCase() !== 'false';
    const state = cleanManualText(req.body?.state || req.query.state, 10).toUpperCase();
    const queued = await repositories.enqueueStaticHazardLocationBackfill({
      category,
      limit,
      serviceAreaOnly,
      state
    });
    const stats = await repositories.getStaticHazardLocationBackfillStats();
    return res.status(201).json({ queuedCount: queued.length, queued, stats });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to enqueue location backfill records'
    });
  }
});

router.get('/hazards-in-bounds', async (req, res) => {
  const bounds = parseBoundsFromQuery(req.query);
  if (!bounds) {
    return res.status(400).json({
      error: 'north, south, east, and west query parameters are required'
    });
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 140, 25), 300);
  const bridgeLimit = Math.min(Math.max(Number(req.query.bridgeLimit) || limit, 25), 300);
  const noTruckLimit = Math.min(Math.max(Number(req.query.noTruckLimit) || limit, 25), 300);
  const residentialLimit = Math.min(Math.max(Number(req.query.residentialLimit) || limit, 25), 300);
  const hazardDatasets = await getHazardDatasetsForBounds(bounds, {
    bridgeLimit,
    noTruckLimit,
    residentialLimit
  });
  const bridgeRecords = hazardDatasets.bridges;
  const noTruckRecords = hazardDatasets.noTruckZones;
  const residentialRecords = hazardDatasets.residentialZones;

  const lowBridges = collectVisibleHazards(
    bridgeRecords,
    'low_bridge',
    bounds,
    bridgeLimit,
    (bridge) => normalizeLatLng({ lat: bridge.latitude, lng: bridge.longitude })
  );
  const noTruckVisible = collectVisibleHazards(
    noTruckRecords,
    'no_truck',
    bounds,
    noTruckLimit,
    (zone) => getZoneMarkerPointInBounds(zone, bounds)
  );
  const residentialVisible = collectVisibleHazards(
    residentialRecords,
    'residential',
    bounds,
    residentialLimit,
    (zone) => getZoneMarkerPointInBounds(zone, bounds)
  );

  return res.json({
    hazards: {
      lowBridges,
      noTruckZones: noTruckVisible,
      residentialZones: residentialVisible
    },
    counts: {
      lowBridgeCount: lowBridges.length,
      noTruckZoneCount: noTruckVisible.length,
      residentialZoneCount: residentialVisible.length,
      total: lowBridges.length + noTruckVisible.length + residentialVisible.length
    },
    bounds,
    limits: {
      bridgeLimit,
      noTruckLimit,
      residentialLimit
    },
    source: {
      hazards: hazardDatasets.source
    }
  });
});

router.get('/hazards-near', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusMeters = Math.min(Math.max(Number(req.query.radiusm) || 1000, 100), 2500);
  const restrictedRoadRadiusMeters = Math.min(
    Math.max(Number(req.query.roadRadiusm) || 90, 35),
    Math.min(radiusMeters, 250)
  );
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 5), 60);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng query parameters are required' });
  }

  const here = { lat, lng };
  const queryBounds = expandBoundsByMeters({
    north: lat,
    south: lat,
    east: lng,
    west: lng
  }, radiusMeters);
  const hazardDatasets = await getHazardDatasetsForBounds(queryBounds, {
    bridgeLimit: limit * 12,
    noTruckLimit: limit * 18,
    residentialLimit: limit * 24
  });
  const bridgeRecords = hazardDatasets.bridges;
  const noTruckRecords = hazardDatasets.noTruckZones;
  const residentialRecords = hazardDatasets.residentialZones;

  const lowBridges = [];
  for (const bridge of bridgeRecords) {
    const point = normalizeLatLng({ lat: bridge.latitude, lng: bridge.longitude });
    if (!point) continue;

    const distance = haversineMeters(here, point);
    if (distance > radiusMeters) continue;

    lowBridges.push({
      ...buildVisibleHazard(bridge, 'low_bridge', point),
      distance_from_truck_m: Math.round(distance)
    });
  }
  lowBridges.sort((a, b) => a.distance_from_truck_m - b.distance_from_truck_m);

  const collectNearbyZones = (zones, category) => {
    const output = [];

    for (const zone of zones) {
      const polygon = zone.polygon || [];
      const geometry = zone.geometry || [];
      let distance = Infinity;
      let markerPoint = null;

      if (Array.isArray(polygon) && polygon.length >= 3 && pointInPolygon(here, polygon)) {
        distance = 0;
        markerPoint = here;
      } else if (Array.isArray(geometry) && geometry.length >= 2) {
        distance = nearestDistanceToGeometryMeters(here, geometry);
        markerPoint = nearestPointOnGeometry(here, geometry);
      } else {
        markerPoint = getZoneMarkerPoint(zone);
        distance = markerPoint ? haversineMeters(here, markerPoint) : Infinity;
      }

      if (!markerPoint || distance > restrictedRoadRadiusMeters) continue;

      output.push({
        ...buildVisibleHazard(zone, category, markerPoint),
        distance_from_truck_m: Math.round(distance)
      });

      if (output.length >= limit) break;
    }

    output.sort((a, b) => a.distance_from_truck_m - b.distance_from_truck_m);
    return output;
  };

  const noTruckNearby = collectNearbyZones(noTruckRecords, 'no_truck');
  const residentialNearby = collectNearbyZones(residentialRecords, 'residential');
  const nearbyHazards = {
    lowBridges: lowBridges.slice(0, limit),
    noTruckZones: noTruckNearby,
    residentialZones: residentialNearby
  };

  return res.json({
    hazards: nearbyHazards,
    counts: {
      lowBridgeCount: Math.min(lowBridges.length, limit),
      noTruckZoneCount: noTruckNearby.length,
      residentialZoneCount: residentialNearby.length,
      total: Math.min(lowBridges.length, limit) + noTruckNearby.length + residentialNearby.length
    },
    scan: {
      lat,
      lng,
      radiusMeters,
      restrictedRoadRadiusMeters,
      source: hazardDatasets.source
    },
    rerouteRecommendation: buildRerouteRecommendation(nearbyHazards)
  });
});

// ---------- Main route ----------

router.post('/safe-route', driverAuth.requireDriverAuth, async (req, res) => {
  try {
    const {
      origin,
      destination,
      originAddress,
      destinationAddress,
      originPlaceId,
      destinationPlaceId,
      truck,
      tuning
    } = req.body || {};

    if (!(origin || originAddress || originPlaceId) || !(destination || destinationAddress || destinationPlaceId)) {
      return res.status(400).json({ error: 'origin/originAddress/originPlaceId AND destination/destinationAddress/destinationPlaceId are required' });
    }
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not set on server' });
    }

    const truckProfile = normalizeTruckProfile(truck);

    // Build Directions params (prefer addresses if given)
    const originLocation = buildDirectionsLocation({
      placeId: originPlaceId,
      address: originAddress,
      coordinate: origin
    });
    const destinationLocation = buildDirectionsLocation({
      placeId: destinationPlaceId,
      address: destinationAddress,
      coordinate: destination
    });

    const params = {
      origin: originLocation,
      destination: destinationLocation,
      mode: 'driving',
      alternatives: true,
      departure_time: 'now',
      key: process.env.GOOGLE_MAPS_API_KEY
    };

    const response = await client.directions({ params, timeout: 15000 });
    const routes = response.data.routes || [];
    if (!routes.length) {
      return res.status(502).json({ error: 'No routes returned from Google Directions' });
    }

    // Evaluate hazards per route using overview polyline
    const evaluated = await Promise.all(routes.map(async (r, idx) => {
      const enc = r.overview_polyline?.points;
      const pts = enc ? decodePolyline(enc) : [];
      const bridgeBufferMeters = Number(tuning?.bridgeBufferMeters) || 120;
      const restrictedRoadBufferMeters = Number(tuning?.restrictedRoadBufferMeters) || 45;
      const hazardDatasets = await getHazardDatasetsForRoute(pts, {
        bridgeBufferMeters,
        restrictedRoadBufferMeters
      });
      const { hazards, score } = scoreRoute(pts, {
        truckHeightFt: truckProfile.height_ft,
        bridgeBufferMeters,
        restrictedRoadBufferMeters,
        hazardDatasets
      });

      // Flatten some fields for frontend
      const leg = r.legs?.[0];
      return {
        index: idx,
        encoded: enc || null,
        summary: r.summary || '',
        distance_m: leg?.distance?.value ?? null,
        duration_s: leg?.duration_in_traffic?.value ?? leg?.duration?.value ?? null,
        steps: normalizeRouteSteps(r.legs),
        hazards,
        hazardSummary: summarizeHazards(hazards),
        score,
        hazardDataSource: hazardDatasets.source
      };
    }));

    const routeSessionId = crypto.randomUUID();
    const responseBody = buildSafeRouteResponse(evaluated, truckProfile, tuning);
    responseBody.routeSessionId = routeSessionId;
    responseBody.rerouteRecommendation = buildRerouteRecommendation(responseBody.chosenRouteHazards);
    responseBody.routeSessionLogged = 'queued';

    const routeSessionPayload = buildRouteSessionPayload({
      routeSessionId,
      body: req.body,
      responseBody,
      evaluated,
      truckProfile,
      tuning,
      origin,
      destination,
      originAddress,
      destinationAddress,
      originPlaceId,
      destinationPlaceId,
      driver: req.driverAuth || driverAuth.getDriverIdentity(req)
    });

    res.json(responseBody);

    saveRouteSessionIfAvailable(routeSessionPayload).catch((error) => {
      console.error('route-session async save error:', error.message);
    });
    return;

  } catch (err) {
    console.error('safe-route error:', err?.response?.data || err.message);
    return res.status(500).json({
      error: 'Error fetching directions',
      detail: err?.response?.data || err.message
    });
  }
});

module.exports = router;
