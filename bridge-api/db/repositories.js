const postgres = require('./postgres');

function isDatabaseEnabled() {
  return postgres.isDatabaseConfigured();
}

function isPostgisEnabled() {
  return postgres.isPostgisEnabled();
}

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function deliveryNoteFromRow(row) {
  return {
    id: row.id,
    placeId: row.place_id || null,
    destination: row.destination || '',
    address: row.address || null,
    accountName: row.account_name || null,
    customerName: row.customer_name || null,
    instructions: row.instructions || '',
    driverName: row.driver_name || 'driver_app',
    routeContext: row.route_context || null,
    photos: asArray(row.photos),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function adminUserFromRow(row) {
  return {
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role || 'supervisor',
    displayName: row.display_name || null,
    active: row.active !== false,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    lastLoginAt: toIsoString(row.last_login_at)
  };
}

function manualHazardFromRow(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    clearance_ft: row.clearance_ft,
    restriction: row.restriction,
    notes: row.notes,
    reported_by: row.reported_by,
    source: row.source,
    report_source: row.report_source,
    status: row.status,
    enabled: row.enabled,
    driver_id: row.driver_id,
    driver_name: row.driver_name,
    route_destination: row.route_destination,
    reported_at: toIsoString(row.reported_at),
    reported_speed_mph: row.reported_speed_mph,
    reported_heading: row.reported_heading,
    route_deviation_m: row.route_deviation_m,
    was_on_route: row.was_on_route,
    nearby_address: row.nearby_address,
    reviewed_by: row.reviewed_by,
    reviewed_at: toIsoString(row.reviewed_at),
    review_notes: row.review_notes,
    rejection_reason: row.rejection_reason,
    confidence: row.confidence,
    geometry: asArray(row.geometry),
    polygon: asArray(row.polygon),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at)
  };
}

function recentDestinationFromRow(row) {
  return {
    placeId: row.place_id || '',
    description: row.description || '',
    mainText: row.main_text || '',
    secondaryText: row.secondary_text || '',
    photoUrl: row.photo_url || '',
    placePhotoUrl: row.place_photo_url || '',
    streetViewUrl: row.street_view_url || '',
    photoSource: row.photo_source || '',
    phoneNumber: row.phone_number || '',
    internationalPhoneNumber: row.international_phone_number || '',
    name: row.name || '',
    savedAt: toIsoString(row.saved_at)
  };
}

function backfillQueueFromRow(row) {
  return {
    id: row.id,
    hazardCategory: row.hazard_category,
    hazardId: row.hazard_id,
    status: row.status,
    priority: row.priority,
    attempts: row.attempts,
    lastError: row.last_error || null,
    queuedAt: toIsoString(row.queued_at),
    processingStartedAt: toIsoString(row.processing_started_at),
    processedAt: toIsoString(row.processed_at),
    result: row.result || {}
  };
}

function routeSessionFromRow(row) {
  return {
    id: row.id,
    originLabel: row.origin_label || null,
    destinationLabel: row.destination_label || null,
    origin: row.origin || {},
    destination: row.destination || {},
    chosenRouteIndex: row.chosen_route_index,
    routeCount: row.route_count,
    hazardSummary: row.hazard_summary || {},
    chosenRouteHazards: row.chosen_route_hazards || {},
    usedTruckProfile: row.used_truck_profile || {},
    usedTuning: row.used_tuning || {},
    routeOptions: asArray(row.route_options),
    request: row.request || {},
    reviewStatus: row.review_status || 'unreviewed',
    supervisorNotes: row.supervisor_notes || null,
    reviewedBy: row.reviewed_by || null,
    reviewedAt: toIsoString(row.reviewed_at),
    archivedAt: toIsoString(row.archived_at),
    archivedBy: row.archived_by || null,
    archiveReason: row.archive_reason || null,
    createdAt: toIsoString(row.created_at)
  };
}

function routeSessionEventFromRow(row) {
  return {
    id: row.id,
    routeSessionId: row.route_session_id || null,
    eventType: row.event_type,
    severity: row.severity || null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    payload: row.payload || {},
    createdAt: toIsoString(row.created_at)
  };
}

function routeManifestFromRow(row, stops = []) {
  return {
    id: row.id,
    routeDate: row.route_date instanceof Date
      ? row.route_date.toISOString().slice(0, 10)
      : row.route_date ? String(row.route_date).slice(0, 10) : null,
    routeNumber: row.route_number,
    routeName: row.route_name || null,
    startLocation: row.start_location || null,
    plannedStartAt: toIsoString(row.planned_start_at),
    plannedEndAt: toIsoString(row.planned_end_at),
    plannedDurationMinutes: row.planned_duration_minutes ?? null,
    totalStops: Number(row.total_stops) || 0,
    totalPallets: Number(row.total_pallets) || 0,
    totalCases: Number(row.total_cases) || 0,
    assignedDriverId: row.assigned_driver_id || null,
    assignedDriverName: row.assigned_driver_name || null,
    assignedAt: toIsoString(row.assigned_at),
    assignedBy: row.assigned_by || null,
    status: row.status || 'unassigned',
    sourceFileName: row.source_file_name || null,
    importedBy: row.imported_by || null,
    importedAt: toIsoString(row.imported_at),
    publishedAt: toIsoString(row.published_at),
    startedAt: toIsoString(row.started_at),
    completedAt: toIsoString(row.completed_at),
    raw: row.raw || {},
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    stops
  };
}

function routeStopFromRow(row) {
  return {
    id: row.id,
    manifestId: row.manifest_id,
    stopSequence: Number(row.stop_sequence) || 0,
    accountNumber: row.account_number || null,
    accountName: row.account_name || null,
    destinationAddress: row.destination_address || '',
    city: row.city || null,
    stateCode: row.state_code || null,
    postalCode: row.postal_code || null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    plannedArrivalAt: toIsoString(row.planned_arrival_at),
    plannedDepartureAt: toIsoString(row.planned_departure_at),
    plannedServiceMinutes: row.planned_service_minutes ?? null,
    driveMinutesToNext: row.drive_minutes_to_next ?? null,
    palletCount: Number(row.pallet_count) || 0,
    caseCount: Number(row.case_count) || 0,
    itemSummary: asArray(row.item_summary),
    status: row.status || 'pending',
    actualArrivalAt: toIsoString(row.actual_arrival_at),
    actualServiceStartedAt: toIsoString(row.actual_service_started_at),
    actualCompletedAt: toIsoString(row.actual_completed_at),
    actualDepartureAt: toIsoString(row.actual_departure_at),
    driverNotes: row.driver_notes || null,
    raw: row.raw || {},
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function staticBridgeFromRow(row) {
  const inferredStateCode = inferServiceAreaStateCode(row.latitude, row.longitude);
  const stateCode = row.state_code || row.raw?.state_code || row.raw?.stateCode || inferredStateCode;
  return {
    ...(row.raw || {}),
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    clearance_ft: row.clearance_ft,
    location_address: row.location_address || row.raw?.location_address || row.raw?.address || row.raw?.nearby_address || null,
    location_description: row.location_description || row.raw?.location_description || row.raw?.description || null,
    location_city: row.location_city || row.raw?.location_city || row.raw?.city || null,
    location_state: row.location_state || row.raw?.location_state || row.raw?.state || STATE_NAMES[stateCode] || null,
    state_code: stateCode || null,
    verification_status: row.verification_status || 'unverified',
    verification_notes: row.verification_notes || null,
    verified_by: row.verified_by || null,
    verified_at: toIsoString(row.verified_at),
    active: row.active !== false
  };
}

function staticZoneFromRow(row) {
  const inferredStateCode = inferServiceAreaStateCode(row.latitude, row.longitude);
  const stateCode = row.state_code || row.raw?.state_code || row.raw?.stateCode || inferredStateCode;
  return {
    ...(row.raw || {}),
    id: row.id,
    type: row.raw?.type || row.zone_type,
    name: row.name || row.raw?.name || null,
    latitude: row.latitude,
    longitude: row.longitude,
    restriction: row.restriction || row.raw?.restriction || null,
    geometry: asArray(row.geometry),
    polygon: asArray(row.polygon),
    location_address: row.location_address || row.raw?.location_address || row.raw?.address || row.raw?.nearby_address || null,
    location_description: row.location_description || row.raw?.location_description || row.raw?.description || null,
    location_city: row.location_city || row.raw?.location_city || row.raw?.city || null,
    location_state: row.location_state || row.raw?.location_state || row.raw?.state || STATE_NAMES[stateCode] || null,
    state_code: stateCode || null,
    verification_status: row.verification_status || 'unverified',
    verification_notes: row.verification_notes || null,
    verified_by: row.verified_by || null,
    verified_at: toIsoString(row.verified_at),
    active: row.active !== false
  };
}

const ACTIVE_STATIC_HAZARD_SQL = "active = true AND verification_status NOT IN ('inactive', 'incorrect')";
const VERIFICATION_STATUSES = new Set(['unverified', 'verified', 'needs_review', 'inactive', 'incorrect']);
const SERVICE_AREA_STATE_CODES = ['TX', 'OK', 'NM', 'AR'];
const SERVICE_AREA_BOUNDS = [
  { code: 'TX', south: 25.8, north: 36.6, west: -106.7, east: -93.5 },
  { code: 'OK', south: 33.6, north: 37.1, west: -103.1, east: -94.3 },
  { code: 'NM', south: 31.2, north: 37.1, west: -109.1, east: -103.0 },
  { code: 'AR', south: 33.0, north: 36.6, west: -94.7, east: -89.6 }
];
const STATE_NAMES = {
  AR: 'Arkansas',
  NM: 'New Mexico',
  OK: 'Oklahoma',
  TX: 'Texas'
};

function inferServiceAreaStateCode(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  if (lat >= 33.0 && lat <= 36.6 && lng >= -94.7 && lng <= -89.6) return 'AR';
  if (lat >= 31.2 && lat <= 37.1 && lng >= -109.1 && lng <= -103.0) return 'NM';
  if (
    (lat >= 33.6 && lat <= 37.1 && lng >= -100.0 && lng <= -94.3) ||
    (lat >= 36.45 && lat <= 37.1 && lng >= -103.1 && lng <= -100.0)
  ) return 'OK';
  if (
    (lat >= 25.8 && lat <= 32.0 && lng >= -106.7 && lng <= -93.5) ||
    (lat > 32.0 && lat <= 33.0 && lng >= -103.1 && lng <= -93.5) ||
    (lat > 33.0 && lat <= 33.7 && lng >= -103.1 && lng <= -94.05) ||
    (lat > 33.7 && lat <= 36.6 && lng >= -103.1 && lng <= -100.0)
  ) return 'TX';
  return null;
}

function normalizeVerificationStatus(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return VERIFICATION_STATUSES.has(normalized) ? normalized : null;
}

function normalizeStaticHazardCategory(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['low_bridge', 'low_clearance', 'bridge'].includes(normalized)) {
    return { category: 'low_bridge', table: 'low_clearance_bridges', zoneType: null };
  }
  if (['no_truck', 'no_truck_zone', 'truck_restricted', 'restricted_road'].includes(normalized)) {
    return { category: 'no_truck', table: 'truck_restricted_zones', zoneType: 'no_truck' };
  }
  if (['residential', 'residential_zone', 'residential_restriction'].includes(normalized)) {
    return { category: 'residential', table: 'truck_restricted_zones', zoneType: 'residential' };
  }
  return null;
}

function normalizeLimit(value, fallback = 100, max = 500) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function normalizeStateCodes(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  return raw
    .map((item) => String(item || '').trim().toUpperCase())
    .filter((item) => /^[A-Z]{2}$/.test(item));
}

function normalizeQualityFilter(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['missing_city', 'missing_address', 'missing_location', 'needs_geocode', 'complete_location'].includes(normalized)) {
    return normalized;
  }
  return null;
}

function normalizeRouteSessionReviewStatus(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['unreviewed', 'reviewed', 'needs_follow_up', 'training_needed', 'dismissed'].includes(normalized)) {
    return normalized;
  }
  return null;
}

function buildServiceAreaWhere() {
  const fallbackBounds = SERVICE_AREA_BOUNDS
    .map((bounds) => `(state_code IS NULL AND ${buildFallbackStateCoordinateWhere(bounds.code)})`)
    .join(' OR ');
  return `(
    state_code = ANY($STATE_PARAM_PLACEHOLDER::text[])
    OR (${fallbackBounds})
  )`;
}

function buildStateAreaWhere(stateCodes) {
  const selectedBounds = stateCodes
    .map((code) => `(state_code IS NULL AND ${buildFallbackStateCoordinateWhere(code)})`)
    .join(' OR ');

  return `(
    state_code = ANY($STATE_PARAM_PLACEHOLDER::text[])
    ${selectedBounds ? `OR (${selectedBounds})` : ''}
  )`;
}

function buildFallbackStateCoordinateWhere(code) {
  if (code === 'AR') return '(latitude BETWEEN 33.0 AND 36.6 AND longitude BETWEEN -94.7 AND -89.6)';
  if (code === 'NM') return '(latitude BETWEEN 31.2 AND 37.1 AND longitude BETWEEN -109.1 AND -103.0)';
  if (code === 'OK') {
    return `(
      (latitude BETWEEN 33.6 AND 37.1 AND longitude BETWEEN -100.0 AND -94.3)
      OR (latitude BETWEEN 36.45 AND 37.1 AND longitude BETWEEN -103.1 AND -100.0)
    )`;
  }
  if (code === 'TX') {
    return `(
      (latitude BETWEEN 25.8 AND 32.0 AND longitude BETWEEN -106.7 AND -93.5)
      OR (latitude > 32.0 AND latitude <= 33.0 AND longitude BETWEEN -103.1 AND -93.5)
      OR (latitude > 33.0 AND latitude <= 33.7 AND longitude BETWEEN -103.1 AND -94.05)
      OR (latitude > 33.7 AND latitude <= 36.6 AND longitude BETWEEN -103.1 AND -100.0)
    )`;
  }
  return 'FALSE';
}

function buildBoundsWhere(bounds, values) {
  if (!bounds) return 'TRUE';

  values.push(bounds.south, bounds.north);
  const southParam = values.length - 1;
  const northParam = values.length;
  const latitudeWhere = `latitude BETWEEN $${southParam} AND $${northParam}`;

  if (bounds.west <= bounds.east) {
    values.push(bounds.west, bounds.east);
    const westParam = values.length - 1;
    const eastParam = values.length;
    return `${latitudeWhere} AND longitude BETWEEN $${westParam} AND $${eastParam}`;
  }

  values.push(bounds.west, bounds.east);
  const westParam = values.length - 1;
  const eastParam = values.length;
  return `${latitudeWhere} AND (longitude >= $${westParam} OR longitude <= $${eastParam})`;
}

function buildGeoJsonPoint(point) {
  const lat = Number(point?.lat ?? point?.latitude);
  const lng = Number(point?.lng ?? point?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    type: 'Point',
    coordinates: [lng, lat]
  };
}

function buildGeoJsonLineString(points) {
  const coordinates = asArray(points)
    .map((point) => {
      const lat = Number(point?.lat ?? point?.latitude);
      const lng = Number(point?.lng ?? point?.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null;
    })
    .filter(Boolean);

  if (coordinates.length < 2) return null;
  return {
    type: 'LineString',
    coordinates
  };
}

function getExpandedRouteBounds(points, bufferMeters = 500) {
  const coordinates = asArray(points)
    .map((point) => {
      const lat = Number(point?.lat ?? point?.latitude);
      const lng = Number(point?.lng ?? point?.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    })
    .filter(Boolean);

  if (!coordinates.length) return null;

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  for (const point of coordinates) {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lng);
    west = Math.min(west, point.lng);
  }

  const latitudePadding = Math.max(250, Number(bufferMeters) || 500) / 111320;
  const centerLatitude = (north + south) / 2;
  const longitudeMetersPerDegree = Math.max(
    25000,
    111320 * Math.cos((centerLatitude * Math.PI) / 180)
  );
  const longitudePadding = Math.max(250, Number(bufferMeters) || 500) / longitudeMetersPerDegree;

  return {
    north: Math.min(90, north + latitudePadding),
    south: Math.max(-90, south - latitudePadding),
    east: Math.min(180, east + longitudePadding),
    west: Math.max(-180, west - longitudePadding)
  };
}

function buildGeoJsonPolygon(points) {
  const coordinates = asArray(points)
    .map((point) => {
      const lat = Number(point?.lat ?? point?.latitude);
      const lng = Number(point?.lng ?? point?.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null;
    })
    .filter(Boolean);

  if (coordinates.length < 3) return null;

  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coordinates.push(first);
  }

  return {
    type: 'Polygon',
    coordinates: [coordinates]
  };
}

async function listDeliveryNotes() {
  const result = await postgres.query(`
    SELECT *
    FROM delivery_notes
    ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST
  `);
  return result.rows.map(deliveryNoteFromRow);
}

async function getAdminUser(username) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  if (!normalizedUsername) return null;

  const result = await postgres.query('SELECT * FROM admin_users WHERE username = $1', [normalizedUsername]);
  return result.rows[0] ? adminUserFromRow(result.rows[0]) : null;
}

async function listAdminUsers() {
  const result = await postgres.query(`
    SELECT *
    FROM admin_users
    ORDER BY role, username
  `);
  return result.rows.map(adminUserFromRow);
}

async function upsertAdminUser(user) {
  const normalizedUsername = String(user.username || '').trim().toLowerCase();
  if (!normalizedUsername) {
    const error = new Error('username is required');
    error.status = 400;
    throw error;
  }
  if (!user.passwordHash) {
    const error = new Error('passwordHash is required');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    INSERT INTO admin_users (
      username, password_hash, role, display_name, active, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    ON CONFLICT (username) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role,
      display_name = EXCLUDED.display_name,
      active = EXCLUDED.active,
      updated_at = NOW()
    RETURNING *
  `, [
    normalizedUsername,
    user.passwordHash,
    user.role || 'supervisor',
    user.displayName || null,
    user.active !== false
  ]);

  return adminUserFromRow(result.rows[0]);
}

async function setAdminUserActive(username, active) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  if (!normalizedUsername) return null;

  const result = await postgres.query(`
    UPDATE admin_users
    SET active = $2, updated_at = NOW()
    WHERE username = $1
    RETURNING *
  `, [normalizedUsername, active === true]);

  return result.rows[0] ? adminUserFromRow(result.rows[0]) : null;
}

async function recordAdminUserLogin(username) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  if (!normalizedUsername) return null;

  const result = await postgres.query(`
    UPDATE admin_users
    SET last_login_at = NOW()
    WHERE username = $1
    RETURNING *
  `, [normalizedUsername]);

  return result.rows[0] ? adminUserFromRow(result.rows[0]) : null;
}

async function upsertDeliveryNote(note) {
  await postgres.query(`
    INSERT INTO delivery_notes (
      id, place_id, destination, address, account_name, customer_name,
      instructions, driver_name, route_context, photos, created_at, updated_at, raw
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      place_id = EXCLUDED.place_id,
      destination = EXCLUDED.destination,
      address = EXCLUDED.address,
      account_name = EXCLUDED.account_name,
      customer_name = EXCLUDED.customer_name,
      instructions = EXCLUDED.instructions,
      driver_name = EXCLUDED.driver_name,
      route_context = EXCLUDED.route_context,
      photos = EXCLUDED.photos,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      raw = EXCLUDED.raw
  `, [
    note.id,
    note.placeId || null,
    note.destination || null,
    note.address || null,
    note.accountName || null,
    note.customerName || null,
    note.instructions || '',
    note.driverName || 'driver_app',
    note.routeContext || null,
    JSON.stringify(asArray(note.photos)),
    note.createdAt || new Date().toISOString(),
    note.updatedAt || new Date().toISOString(),
    JSON.stringify(note)
  ]);

  return note;
}

async function deleteDeliveryNote(id) {
  const result = await postgres.query('DELETE FROM delivery_notes WHERE id = $1 RETURNING *', [id]);
  return result.rows[0] ? deliveryNoteFromRow(result.rows[0]) : null;
}

async function listManualHazards(options = {}) {
  const values = [];
  const where = [];

  if (!options.includeAll) {
    where.push('enabled = true');
    where.push("status = 'confirmed'");
  }
  if (options.status) {
    values.push(options.status);
    where.push(`status = $${values.length}`);
  }
  if (options.category) {
    values.push(options.category);
    where.push(`category = $${values.length}`);
  }
  if (options.source) {
    values.push(options.source);
    where.push(`report_source = $${values.length}`);
  }

  const result = await postgres.query(`
    SELECT *
    FROM manual_hazards
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY COALESCE(updated_at, reported_at, created_at) DESC NULLS LAST
  `, values);

  return result.rows.map(manualHazardFromRow);
}

async function upsertManualHazard(hazard) {
  await postgres.query(`
    INSERT INTO manual_hazards (
      id, category, name, latitude, longitude, clearance_ft, restriction, notes,
      reported_by, source, report_source, status, enabled, driver_id, driver_name,
      route_destination, reported_at, reported_speed_mph, reported_heading,
      route_deviation_m, was_on_route, nearby_address, reviewed_by, reviewed_at,
      review_notes, rejection_reason, confidence, geometry, polygon, created_at,
      updated_at, raw
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15,
      $16, $17, $18, $19,
      $20, $21, $22, $23, $24,
      $25, $26, $27, $28::jsonb, $29::jsonb, $30,
      $31, $32::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      category = EXCLUDED.category,
      name = EXCLUDED.name,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      clearance_ft = EXCLUDED.clearance_ft,
      restriction = EXCLUDED.restriction,
      notes = EXCLUDED.notes,
      reported_by = EXCLUDED.reported_by,
      source = EXCLUDED.source,
      report_source = EXCLUDED.report_source,
      status = EXCLUDED.status,
      enabled = EXCLUDED.enabled,
      driver_id = EXCLUDED.driver_id,
      driver_name = EXCLUDED.driver_name,
      route_destination = EXCLUDED.route_destination,
      reported_at = EXCLUDED.reported_at,
      reported_speed_mph = EXCLUDED.reported_speed_mph,
      reported_heading = EXCLUDED.reported_heading,
      route_deviation_m = EXCLUDED.route_deviation_m,
      was_on_route = EXCLUDED.was_on_route,
      nearby_address = EXCLUDED.nearby_address,
      reviewed_by = EXCLUDED.reviewed_by,
      reviewed_at = EXCLUDED.reviewed_at,
      review_notes = EXCLUDED.review_notes,
      rejection_reason = EXCLUDED.rejection_reason,
      confidence = EXCLUDED.confidence,
      geometry = EXCLUDED.geometry,
      polygon = EXCLUDED.polygon,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      raw = EXCLUDED.raw
  `, [
    hazard.id,
    hazard.category,
    hazard.name || null,
    hazard.latitude ?? null,
    hazard.longitude ?? null,
    hazard.clearance_ft ?? null,
    hazard.restriction || null,
    hazard.notes || null,
    hazard.reported_by || null,
    hazard.source || null,
    hazard.report_source || null,
    hazard.status || null,
    hazard.enabled === true,
    hazard.driver_id || null,
    hazard.driver_name || null,
    hazard.route_destination || null,
    hazard.reported_at || null,
    hazard.reported_speed_mph ?? null,
    hazard.reported_heading ?? null,
    hazard.route_deviation_m ?? null,
    hazard.was_on_route ?? null,
    hazard.nearby_address || null,
    hazard.reviewed_by || null,
    hazard.reviewed_at || null,
    hazard.review_notes || null,
    hazard.rejection_reason || null,
    hazard.confidence || null,
    JSON.stringify(asArray(hazard.geometry)),
    JSON.stringify(asArray(hazard.polygon)),
    hazard.created_at || new Date().toISOString(),
    hazard.updated_at || new Date().toISOString(),
    JSON.stringify(hazard)
  ]);

  return hazard;
}

async function deleteManualHazard(id) {
  const result = await postgres.query('DELETE FROM manual_hazards WHERE id = $1 RETURNING *', [id]);
  return result.rows[0] ? manualHazardFromRow(result.rows[0]) : null;
}

async function listStaticBridgesInBounds(bounds, limit = 5000) {
  if (await postgres.isPostgisEnabled()) {
    return listStaticBridgesInBoundsPostgis(bounds, limit);
  }

  const values = [];
  const boundsWhere = buildBoundsWhere(bounds, values);
  values.push(limit);
  const limitParam = values.length;

  const result = await postgres.query(`
    SELECT *
    FROM low_clearance_bridges
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND ${ACTIVE_STATIC_HAZARD_SQL}
      AND ${boundsWhere}
    ORDER BY id
    LIMIT $${limitParam}
  `, values);

  return result.rows.map(staticBridgeFromRow);
}

async function listStaticZonesInBounds(zoneType, bounds, limit = 12000) {
  if (await postgres.isPostgisEnabled()) {
    return listStaticZonesInBoundsPostgis(zoneType, bounds, limit);
  }

  const values = [zoneType];
  const boundsWhere = buildBoundsWhere(bounds, values);
  values.push(limit);
  const limitParam = values.length;

  const result = await postgres.query(`
    SELECT *
    FROM truck_restricted_zones
    WHERE zone_type = $1
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND ${ACTIVE_STATIC_HAZARD_SQL}
      AND ${boundsWhere}
    ORDER BY id
    LIMIT $${limitParam}
  `, values);

  return result.rows.map(staticZoneFromRow);
}

async function listStaticBridgesInBoundsPostgis(bounds, limit = 5000) {
  if (!bounds || bounds.west > bounds.east) {
    return listStaticBridgesInBoundsFallback(bounds, limit);
  }

  const result = await postgres.query(`
    WITH envelope AS (
      SELECT ST_MakeEnvelope($1, $2, $3, $4, 4326) AS geom
    )
    SELECT b.*
    FROM low_clearance_bridges b, envelope
    WHERE b.geom IS NOT NULL
      AND b.active = true
      AND b.verification_status NOT IN ('inactive', 'incorrect')
      AND b.geom && envelope.geom
      AND ST_Intersects(b.geom, envelope.geom)
    ORDER BY b.id
    LIMIT $5
  `, [bounds.west, bounds.south, bounds.east, bounds.north, limit]);

  return result.rows.map(staticBridgeFromRow);
}

async function listStaticBridgesInBoundsFallback(bounds, limit) {
  const values = [];
  const boundsWhere = buildBoundsWhere(bounds, values);
  values.push(limit);
  const limitParam = values.length;

  const result = await postgres.query(`
    SELECT *
    FROM low_clearance_bridges
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND ${ACTIVE_STATIC_HAZARD_SQL}
      AND ${boundsWhere}
    ORDER BY id
    LIMIT $${limitParam}
  `, values);

  return result.rows.map(staticBridgeFromRow);
}

async function listStaticZonesInBoundsPostgis(zoneType, bounds, limit = 12000) {
  if (!bounds || bounds.west > bounds.east) {
    return listStaticZonesInBoundsFallback(zoneType, bounds, limit);
  }

  const result = await postgres.query(`
    WITH envelope AS (
      SELECT ST_MakeEnvelope($2, $3, $4, $5, 4326) AS geom
    )
    SELECT z.*
    FROM truck_restricted_zones z, envelope
    WHERE z.zone_type = $1
      AND z.active = true
      AND z.verification_status NOT IN ('inactive', 'incorrect')
      AND (
        (z.route_geom IS NOT NULL AND z.route_geom && envelope.geom AND ST_Intersects(z.route_geom, envelope.geom))
        OR
        (z.marker_geom IS NOT NULL AND z.marker_geom && envelope.geom AND ST_Intersects(z.marker_geom, envelope.geom))
      )
    ORDER BY z.id
    LIMIT $6
  `, [zoneType, bounds.west, bounds.south, bounds.east, bounds.north, limit]);

  return result.rows.map(staticZoneFromRow);
}

async function listStaticZonesInBoundsFallback(zoneType, bounds, limit) {
  const values = [zoneType];
  const boundsWhere = buildBoundsWhere(bounds, values);
  values.push(limit);
  const limitParam = values.length;

  const result = await postgres.query(`
    SELECT *
    FROM truck_restricted_zones
    WHERE zone_type = $1
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND ${ACTIVE_STATIC_HAZARD_SQL}
      AND ${boundsWhere}
    ORDER BY id
    LIMIT $${limitParam}
  `, values);

  return result.rows.map(staticZoneFromRow);
}

async function listStaticBridgesNearRoute(routePoints, bufferMeters, limit = 12000) {
  if (!(await postgres.isPostgisEnabled())) return null;

  const routeGeoJson = buildGeoJsonLineString(routePoints);
  if (!routeGeoJson) return [];
  const bounds = getExpandedRouteBounds(routePoints, bufferMeters);
  if (!bounds) return [];

  const result = await postgres.query(`
    WITH route AS (
      SELECT ST_SetSRID(ST_GeomFromGeoJSON($1::text), 4326) AS geom
    ),
    envelope AS (
      SELECT ST_MakeEnvelope($3, $4, $5, $6, 4326) AS geom
    )
    SELECT b.*
    FROM low_clearance_bridges b, route, envelope
    WHERE b.geom IS NOT NULL
      AND b.active = true
      AND b.verification_status NOT IN ('inactive', 'incorrect')
      AND b.geom && envelope.geom
      AND ST_DWithin(b.geom::geography, route.geom::geography, $2)
    ORDER BY ST_Distance(b.geom::geography, route.geom::geography)
    LIMIT $7
  `, [
    JSON.stringify(routeGeoJson),
    bufferMeters,
    bounds.west,
    bounds.south,
    bounds.east,
    bounds.north,
    limit
  ]);

  return result.rows.map(staticBridgeFromRow);
}

async function listStaticZonesNearRoute(zoneType, routePoints, bufferMeters, limit = 24000) {
  if (!(await postgres.isPostgisEnabled())) return null;

  const routeGeoJson = buildGeoJsonLineString(routePoints);
  if (!routeGeoJson) return [];
  const bounds = getExpandedRouteBounds(routePoints, bufferMeters);
  if (!bounds) return [];

  const result = await postgres.query(`
    WITH route AS (
      SELECT ST_SetSRID(ST_GeomFromGeoJSON($2::text), 4326) AS geom
    ),
    envelope AS (
      SELECT ST_MakeEnvelope($4, $5, $6, $7, 4326) AS geom
    )
    SELECT z.*
    FROM truck_restricted_zones z, route, envelope
    WHERE z.zone_type = $1
      AND z.route_geom IS NOT NULL
      AND z.active = true
      AND z.verification_status NOT IN ('inactive', 'incorrect')
      AND z.route_geom && envelope.geom
      AND ST_DWithin(z.route_geom::geography, route.geom::geography, $3)
    ORDER BY ST_Distance(z.route_geom::geography, route.geom::geography)
    LIMIT $8
  `, [
    zoneType,
    JSON.stringify(routeGeoJson),
    bufferMeters,
    bounds.west,
    bounds.south,
    bounds.east,
    bounds.north,
    limit
  ]);

  return result.rows.map(staticZoneFromRow);
}

async function listRecentDestinations() {
  const result = await postgres.query(`
    SELECT *
    FROM recent_destinations
    ORDER BY saved_at DESC NULLS LAST
    LIMIT 12
  `);
  return result.rows.map(recentDestinationFromRow);
}

async function saveRecentDestination(destination, maxRecords = 12) {
  const key = destination.placeId || String(destination.description || '').toLowerCase();

  await postgres.query(`
    INSERT INTO recent_destinations (
      record_key, place_id, description, main_text, secondary_text, photo_url,
      place_photo_url, street_view_url, photo_source, phone_number,
      international_phone_number, name, saved_at, raw
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
    ON CONFLICT (record_key) DO UPDATE SET
      place_id = EXCLUDED.place_id,
      description = EXCLUDED.description,
      main_text = EXCLUDED.main_text,
      secondary_text = EXCLUDED.secondary_text,
      photo_url = EXCLUDED.photo_url,
      place_photo_url = EXCLUDED.place_photo_url,
      street_view_url = EXCLUDED.street_view_url,
      photo_source = EXCLUDED.photo_source,
      phone_number = EXCLUDED.phone_number,
      international_phone_number = EXCLUDED.international_phone_number,
      name = EXCLUDED.name,
      saved_at = EXCLUDED.saved_at,
      raw = EXCLUDED.raw
  `, [
    key,
    destination.placeId || null,
    destination.description,
    destination.mainText || null,
    destination.secondaryText || null,
    destination.photoUrl || null,
    destination.placePhotoUrl || null,
    destination.streetViewUrl || null,
    destination.photoSource || null,
    destination.phoneNumber || null,
    destination.internationalPhoneNumber || null,
    destination.name || null,
    destination.savedAt || new Date().toISOString(),
    JSON.stringify(destination)
  ]);

  await postgres.query(`
    DELETE FROM recent_destinations
    WHERE record_key IN (
      SELECT record_key
      FROM recent_destinations
      ORDER BY saved_at DESC NULLS LAST
      OFFSET $1
    )
  `, [maxRecords]);

  return listRecentDestinations();
}

async function upsertStaticBridge(record) {
  const id = String(record.id || `bridge-${record.latitude}-${record.longitude}`);
  const latitude = Number.isFinite(Number(record.latitude)) ? Number(record.latitude) : null;
  const longitude = Number.isFinite(Number(record.longitude)) ? Number(record.longitude) : null;
  const clearanceFt = Number.isFinite(Number(record.clearance_ft)) ? Number(record.clearance_ft) : null;

  if (await postgres.isPostgisEnabled()) {
    await postgres.query(`
      INSERT INTO low_clearance_bridges (id, latitude, longitude, clearance_ft, raw, geom)
      VALUES (
        $1, $2, $3, $4, $5::jsonb,
        CASE WHEN $2::double precision IS NULL OR $3::double precision IS NULL
          THEN NULL
          ELSE ST_SetSRID(ST_MakePoint($3, $2), 4326)
        END
      )
      ON CONFLICT (id) DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        clearance_ft = EXCLUDED.clearance_ft,
        raw = EXCLUDED.raw,
        geom = EXCLUDED.geom
    `, [id, latitude, longitude, clearanceFt, JSON.stringify(record)]);
    return;
  }

  await postgres.query(`
    INSERT INTO low_clearance_bridges (id, latitude, longitude, clearance_ft, raw)
    VALUES ($1, $2, $3, $4, $5::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      clearance_ft = EXCLUDED.clearance_ft,
      raw = EXCLUDED.raw
  `, [id, latitude, longitude, clearanceFt, JSON.stringify(record)]);
}

async function upsertStaticZone(record, zoneType) {
  const marker = Array.isArray(record.geometry) ? record.geometry[0] : Array.isArray(record.polygon) ? record.polygon[0] : null;
  const id = String(record.id || `${zoneType}-${record.name || Date.now()}-${Math.random()}`);
  const latitude = Number.isFinite(Number(record.latitude ?? marker?.lat)) ? Number(record.latitude ?? marker?.lat) : null;
  const longitude = Number.isFinite(Number(record.longitude ?? marker?.lng)) ? Number(record.longitude ?? marker?.lng) : null;
  const geometry = asArray(record.geometry);
  const polygon = asArray(record.polygon);

  if (await postgres.isPostgisEnabled()) {
    const markerGeoJson = buildGeoJsonPoint({ lat: latitude, lng: longitude });
    const routeGeoJson = buildGeoJsonPolygon(polygon) || buildGeoJsonLineString(geometry) || markerGeoJson;

    await postgres.query(`
      INSERT INTO truck_restricted_zones (
        id, zone_type, name, latitude, longitude, restriction, geometry, polygon, raw, marker_geom, route_geom
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb,
        CASE WHEN $10::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($10::text), 4326) END,
        CASE WHEN $11::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($11::text), 4326) END
      )
      ON CONFLICT (id) DO UPDATE SET
        zone_type = EXCLUDED.zone_type,
        name = EXCLUDED.name,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        restriction = EXCLUDED.restriction,
        geometry = EXCLUDED.geometry,
        polygon = EXCLUDED.polygon,
        raw = EXCLUDED.raw,
        marker_geom = EXCLUDED.marker_geom,
        route_geom = EXCLUDED.route_geom
    `, [
      id,
      zoneType,
      record.name || null,
      latitude,
      longitude,
      record.restriction || null,
      JSON.stringify(geometry),
      JSON.stringify(polygon),
      JSON.stringify(record),
      markerGeoJson ? JSON.stringify(markerGeoJson) : null,
      routeGeoJson ? JSON.stringify(routeGeoJson) : null
    ]);
    return;
  }

  await postgres.query(`
    INSERT INTO truck_restricted_zones (
      id, zone_type, name, latitude, longitude, restriction, geometry, polygon, raw
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      zone_type = EXCLUDED.zone_type,
      name = EXCLUDED.name,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      restriction = EXCLUDED.restriction,
      geometry = EXCLUDED.geometry,
      polygon = EXCLUDED.polygon,
      raw = EXCLUDED.raw
  `, [
    id,
    zoneType,
    record.name || null,
    latitude,
    longitude,
    record.restriction || null,
    JSON.stringify(geometry),
    JSON.stringify(polygon),
    JSON.stringify(record)
  ]);
}

async function listStaticHazardsForVerification(options = {}) {
  const normalizedCategory = normalizeStaticHazardCategory(options.category || 'low_bridge');
  if (!normalizedCategory) {
    const error = new Error('category must be low_bridge, no_truck, or residential');
    error.status = 400;
    throw error;
  }

  const values = [];
  const where = [];
  const limit = normalizeLimit(options.limit, 100, 500);
  const status = normalizeVerificationStatus(options.status);
  const quality = normalizeQualityFilter(options.quality || options.dataQuality);

  if (normalizedCategory.zoneType) {
    values.push(normalizedCategory.zoneType);
    where.push(`zone_type = $${values.length}`);
  }
  if (status) {
    values.push(status);
    where.push(`verification_status = $${values.length}`);
  }
  if (!options.includeInactive) {
    where.push(ACTIVE_STATIC_HAZARD_SQL);
  }
  if (quality === 'missing_city') {
    where.push("(location_city IS NULL OR btrim(location_city) = '')");
  } else if (quality === 'missing_address') {
    where.push("(location_address IS NULL OR btrim(location_address) = '')");
  } else if (quality === 'missing_location' || quality === 'needs_geocode') {
    where.push(`(
      location_city IS NULL OR btrim(location_city) = ''
      OR location_address IS NULL OR btrim(location_address) = ''
      OR state_code IS NULL OR btrim(state_code) = ''
    )`);
  } else if (quality === 'complete_location') {
    where.push(`(
      location_city IS NOT NULL AND btrim(location_city) <> ''
      AND location_address IS NOT NULL AND btrim(location_address) <> ''
      AND state_code IS NOT NULL AND btrim(state_code) <> ''
    )`);
  }
  const stateCodes = normalizeStateCodes(options.stateCodes || options.stateCode || options.state);
  if (options.serviceAreaOnly) {
    values.push(SERVICE_AREA_STATE_CODES);
    where.push(buildServiceAreaWhere().replace('$STATE_PARAM_PLACEHOLDER', `$${values.length}`));
  } else if (stateCodes.length) {
    values.push(stateCodes);
    where.push(buildStateAreaWhere(stateCodes).replace('$STATE_PARAM_PLACEHOLDER', `$${values.length}`));
  }

  const boundsWhere = buildBoundsWhere(options.bounds, values);
  where.push(boundsWhere);
  values.push(limit);
  const limitParam = values.length;

  const result = await postgres.query(`
    SELECT *
    FROM ${normalizedCategory.table}
    WHERE ${where.join(' AND ')}
    ORDER BY
      CASE verification_status
        WHEN 'needs_review' THEN 0
        WHEN 'unverified' THEN 1
        WHEN 'verified' THEN 2
        ELSE 3
      END,
      id
    LIMIT $${limitParam}
  `, values);

  const mapper = normalizedCategory.category === 'low_bridge'
    ? staticBridgeFromRow
    : staticZoneFromRow;

  return result.rows.map((row) => ({
    ...mapper(row),
    category: normalizedCategory.category
  }));
}

async function updateStaticHazardVerification(category, id, input = {}) {
  const normalizedCategory = normalizeStaticHazardCategory(category);
  if (!normalizedCategory) {
    const error = new Error('category must be low_bridge, no_truck, or residential');
    error.status = 400;
    throw error;
  }

  const hazardId = String(id || '').trim();
  if (!hazardId) {
    const error = new Error('hazard id is required');
    error.status = 400;
    throw error;
  }

  const statusWasProvided = Object.prototype.hasOwnProperty.call(input, 'verification_status')
    || Object.prototype.hasOwnProperty.call(input, 'status');
  const normalizedStatus = statusWasProvided
    ? normalizeVerificationStatus(input.verification_status ?? input.status)
    : null;

  if (statusWasProvided && !normalizedStatus) {
    const error = new Error('verification_status must be unverified, verified, needs_review, inactive, or incorrect');
    error.status = 400;
    throw error;
  }

  const notesWasProvided = Object.prototype.hasOwnProperty.call(input, 'verification_notes')
    || Object.prototype.hasOwnProperty.call(input, 'notes');
  const verifiedByWasProvided = Object.prototype.hasOwnProperty.call(input, 'verified_by')
    || Object.prototype.hasOwnProperty.call(input, 'verifiedBy');
  const activeWasProvided = Object.prototype.hasOwnProperty.call(input, 'active');
  const normalizedActive = activeWasProvided
    ? Boolean(input.active)
    : normalizedStatus
      ? !['inactive', 'incorrect'].includes(normalizedStatus)
      : null;
  const verificationNotes = notesWasProvided
    ? String(input.verification_notes ?? input.notes ?? '').trim().slice(0, 1000) || null
    : null;
  const verifiedBy = verifiedByWasProvided
    ? String(input.verified_by ?? input.verifiedBy ?? '').trim().slice(0, 120) || null
    : null;
  const locationAddressWasProvided = Object.prototype.hasOwnProperty.call(input, 'location_address')
    || Object.prototype.hasOwnProperty.call(input, 'address');
  const locationDescriptionWasProvided = Object.prototype.hasOwnProperty.call(input, 'location_description')
    || Object.prototype.hasOwnProperty.call(input, 'landmark')
    || Object.prototype.hasOwnProperty.call(input, 'description');
  const locationCityWasProvided = Object.prototype.hasOwnProperty.call(input, 'location_city')
    || Object.prototype.hasOwnProperty.call(input, 'city');
  const locationStateWasProvided = Object.prototype.hasOwnProperty.call(input, 'location_state')
    || Object.prototype.hasOwnProperty.call(input, 'state');
  const stateCodeWasProvided = Object.prototype.hasOwnProperty.call(input, 'state_code')
    || Object.prototype.hasOwnProperty.call(input, 'stateCode');
  const locationAddress = locationAddressWasProvided
    ? String(input.location_address ?? input.address ?? '').trim().slice(0, 240) || null
    : null;
  const locationDescription = locationDescriptionWasProvided
    ? String(input.location_description ?? input.landmark ?? input.description ?? '').trim().slice(0, 500) || null
    : null;
  const locationCity = locationCityWasProvided
    ? String(input.location_city ?? input.city ?? '').trim().slice(0, 120) || null
    : null;
  const locationState = locationStateWasProvided
    ? String(input.location_state ?? input.state ?? '').trim().slice(0, 120) || null
    : null;
  const stateCode = stateCodeWasProvided
    ? String(input.state_code ?? input.stateCode ?? '').trim().toUpperCase().slice(0, 2) || null
    : null;

  const values = [
    hazardId,
    normalizedStatus,
    verificationNotes,
    verifiedBy,
    normalizedActive,
    locationAddress,
    locationDescription,
    locationCity,
    locationState,
    stateCode
  ];

  let zoneTypeWhere = '';
  if (normalizedCategory.zoneType) {
    values.push(normalizedCategory.zoneType);
    zoneTypeWhere = `AND zone_type = $${values.length}`;
  }

  const result = await postgres.query(`
    UPDATE ${normalizedCategory.table}
    SET
      verification_status = COALESCE($2, verification_status),
      verification_notes = CASE WHEN $3::text IS NULL THEN verification_notes ELSE $3 END,
      verified_by = CASE WHEN $4::text IS NULL THEN verified_by ELSE $4 END,
      active = COALESCE($5, active),
      location_address = CASE WHEN $6::text IS NULL THEN location_address ELSE $6 END,
      location_description = CASE WHEN $7::text IS NULL THEN location_description ELSE $7 END,
      location_city = CASE WHEN $8::text IS NULL THEN location_city ELSE $8 END,
      location_state = CASE WHEN $9::text IS NULL THEN location_state ELSE $9 END,
      state_code = CASE WHEN $10::text IS NULL THEN state_code ELSE $10 END,
      verified_at = NOW()
    WHERE id = $1
      ${zoneTypeWhere}
    RETURNING *
  `, values);

  if (!result.rows[0]) return null;
  const mapper = normalizedCategory.category === 'low_bridge'
    ? staticBridgeFromRow
    : staticZoneFromRow;
  return {
    ...mapper(result.rows[0]),
    category: normalizedCategory.category
  };
}

async function enqueueStaticHazardLocationBackfill(options = {}) {
  const normalizedCategory = normalizeStaticHazardCategory(options.category || 'low_bridge');
  if (!normalizedCategory) {
    const error = new Error('category must be low_bridge, no_truck, or residential');
    error.status = 400;
    throw error;
  }

  const values = [];
  const where = [
    'latitude IS NOT NULL',
    'longitude IS NOT NULL',
    `(
      location_city IS NULL OR btrim(location_city) = ''
      OR location_address IS NULL OR btrim(location_address) = ''
      OR state_code IS NULL OR btrim(state_code) = ''
    )`
  ];
  if (normalizedCategory.zoneType) {
    values.push(normalizedCategory.zoneType);
    where.push(`zone_type = $${values.length}`);
  }
  if (options.serviceAreaOnly) {
    values.push(SERVICE_AREA_STATE_CODES);
    where.push(buildServiceAreaWhere().replace('$STATE_PARAM_PLACEHOLDER', `$${values.length}`));
  } else {
    const stateCodes = normalizeStateCodes(options.stateCodes || options.stateCode || options.state);
    if (stateCodes.length) {
      values.push(stateCodes);
      where.push(buildStateAreaWhere(stateCodes).replace('$STATE_PARAM_PLACEHOLDER', `$${values.length}`));
    }
  }

  const limit = normalizeLimit(options.limit, 100, 2000);
  const priority = Number.isFinite(Number(options.priority)) ? Number(options.priority) : 100;
  values.push(normalizedCategory.category, priority, limit);
  const categoryParam = values.length - 2;
  const priorityParam = values.length - 1;
  const limitParam = values.length;

  const result = await postgres.query(`
    WITH candidates AS (
      SELECT id
      FROM ${normalizedCategory.table}
      WHERE ${where.join(' AND ')}
      ORDER BY id
      LIMIT $${limitParam}
    ),
    inserted AS (
      INSERT INTO static_hazard_location_backfill_queue (
        hazard_category, hazard_id, priority, status, queued_at
      )
      SELECT $${categoryParam}, id, $${priorityParam}, 'queued', NOW()
      FROM candidates
      ON CONFLICT (hazard_category, hazard_id) DO UPDATE SET
        status = CASE
          WHEN static_hazard_location_backfill_queue.status IN ('done', 'processing') THEN static_hazard_location_backfill_queue.status
          ELSE 'queued'
        END,
        priority = LEAST(static_hazard_location_backfill_queue.priority, EXCLUDED.priority),
        queued_at = CASE
          WHEN static_hazard_location_backfill_queue.status = 'done' THEN static_hazard_location_backfill_queue.queued_at
          ELSE NOW()
        END
      RETURNING *
    )
    SELECT * FROM inserted
    ORDER BY priority, queued_at
  `, values);

  return result.rows.map(backfillQueueFromRow);
}

async function listStaticHazardLocationBackfillQueue(options = {}) {
  const values = [];
  const where = [];
  const status = String(options.status || '').trim().toLowerCase();
  if (status) {
    values.push(status);
    where.push(`status = $${values.length}`);
  }
  const category = normalizeStaticHazardCategory(options.category);
  if (category) {
    values.push(category.category);
    where.push(`hazard_category = $${values.length}`);
  }
  const limit = normalizeLimit(options.limit, 100, 500);
  values.push(limit);
  const limitParam = values.length;
  const result = await postgres.query(`
    SELECT *
    FROM static_hazard_location_backfill_queue
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY
      CASE status WHEN 'failed' THEN 0 WHEN 'queued' THEN 1 WHEN 'processing' THEN 2 ELSE 3 END,
      priority,
      queued_at
    LIMIT $${limitParam}
  `, values);
  return result.rows.map(backfillQueueFromRow);
}

async function getStaticHazardLocationBackfillStats() {
  const result = await postgres.query(`
    SELECT hazard_category, status, count(*)::int AS count
    FROM static_hazard_location_backfill_queue
    GROUP BY hazard_category, status
    ORDER BY hazard_category, status
  `);
  return result.rows;
}

async function saveRouteSession(session) {
  await postgres.query(`
    INSERT INTO route_sessions (
      id, origin_label, destination_label, origin, destination, chosen_route_index,
      route_count, hazard_summary, chosen_route_hazards, used_truck_profile,
      used_tuning, route_options, request, created_at
    )
    VALUES (
      $1, $2, $3, $4::jsonb, $5::jsonb, $6,
      $7, $8::jsonb, $9::jsonb, $10::jsonb,
      $11::jsonb, $12::jsonb, $13::jsonb, $14
    )
    ON CONFLICT (id) DO UPDATE SET
      origin_label = EXCLUDED.origin_label,
      destination_label = EXCLUDED.destination_label,
      origin = EXCLUDED.origin,
      destination = EXCLUDED.destination,
      chosen_route_index = EXCLUDED.chosen_route_index,
      route_count = EXCLUDED.route_count,
      hazard_summary = EXCLUDED.hazard_summary,
      chosen_route_hazards = EXCLUDED.chosen_route_hazards,
      used_truck_profile = EXCLUDED.used_truck_profile,
      used_tuning = EXCLUDED.used_tuning,
      route_options = EXCLUDED.route_options,
      request = EXCLUDED.request
  `, [
    session.id,
    session.originLabel || null,
    session.destinationLabel || null,
    JSON.stringify(session.origin || {}),
    JSON.stringify(session.destination || {}),
    session.chosenRouteIndex ?? null,
    session.routeCount ?? null,
    JSON.stringify(session.hazardSummary || {}),
    JSON.stringify(session.chosenRouteHazards || {}),
    JSON.stringify(session.usedTruckProfile || {}),
    JSON.stringify(session.usedTuning || {}),
    JSON.stringify(asArray(session.routeOptions)),
    JSON.stringify(session.request || {}),
    session.createdAt || new Date().toISOString()
  ]);
  return session;
}

function buildRouteSessionFilters(options = {}, values = []) {
  const where = [];
  const search = String(options.search || '').trim();
  if (search) {
    values.push(`%${search}%`);
    where.push(`(destination_label ILIKE $${values.length} OR origin_label ILIKE $${values.length})`);
  }

  const since = options.since ? new Date(options.since) : null;
  const until = options.until ? new Date(options.until) : null;
  const days = Number(options.days);
  if (since && !Number.isNaN(since.getTime())) {
    values.push(since.toISOString());
    where.push(`created_at >= $${values.length}`);
  } else if (Number.isFinite(days) && days > 0) {
    const sinceDate = new Date(Date.now() - Math.trunc(days) * 24 * 60 * 60 * 1000);
    values.push(sinceDate.toISOString());
    where.push(`created_at >= $${values.length}`);
  }
  if (until && !Number.isNaN(until.getTime())) {
    values.push(until.toISOString());
    where.push(`created_at <= $${values.length}`);
  }

  if (options.hazardOnly) {
    where.push(`(
      COALESCE((hazard_summary->>'total')::int, 0) > 0
      OR COALESCE((hazard_summary->>'lowBridgeCount')::int, 0) > 0
      OR COALESCE((hazard_summary->>'noTruckZoneCount')::int, 0) > 0
      OR COALESCE((hazard_summary->>'residentialZoneCount')::int, 0) > 0
    )`);
  }
  const reviewStatus = normalizeRouteSessionReviewStatus(options.reviewStatus || options.review_status);
  if (reviewStatus) {
    values.push(reviewStatus);
    where.push(`review_status = $${values.length}`);
  }
  if (options.archivedOnly) {
    where.push('archived_at IS NOT NULL');
  } else if (!options.includeArchived) {
    where.push('archived_at IS NULL');
  }

  return where.length ? `WHERE ${where.join(' AND ')}` : '';
}

async function listRouteSessions(options = {}) {
  const limit = normalizeLimit(options.limit, 50, 250);
  const values = [];
  const whereSql = buildRouteSessionFilters(options, values);
  values.push(limit);
  const limitParam = values.length;
  const result = await postgres.query(`
    SELECT *
    FROM route_sessions
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${limitParam}
  `, values);
  return result.rows.map(routeSessionFromRow);
}

async function getRouteSessionAnalytics(options = {}) {
  const values = [];
  const whereSql = buildRouteSessionFilters(options, values);
  const summaryResult = await postgres.query(`
    SELECT
      count(*)::int AS route_count,
      COALESCE(SUM(COALESCE((hazard_summary->>'total')::int, 0)), 0)::int AS total_hazards,
      COALESCE(SUM(COALESCE((hazard_summary->>'lowBridgeCount')::int, 0)), 0)::int AS low_bridge_count,
      COALESCE(SUM(COALESCE((hazard_summary->>'noTruckZoneCount')::int, 0)), 0)::int AS no_truck_zone_count,
      COALESCE(SUM(COALESCE((hazard_summary->>'residentialZoneCount')::int, 0)), 0)::int AS residential_zone_count,
      COALESCE(AVG(route_count), 0)::numeric(10,2) AS average_route_options
    FROM route_sessions
    ${whereSql}
  `, values);

  const eventValues = [];
  const eventWhereSql = buildRouteSessionFilters(options, eventValues);
  const eventSeverityResult = await postgres.query(`
    SELECT COALESCE(e.severity, 'info') AS severity, count(*)::int AS count
    FROM route_session_events e
    JOIN route_sessions s ON s.id = e.route_session_id
    ${eventWhereSql.replace(/\bcreated_at\b/g, 's.created_at')}
    GROUP BY COALESCE(e.severity, 'info')
    ORDER BY count DESC, severity
  `, eventValues);

  const eventTypeResult = await postgres.query(`
    SELECT e.event_type AS event_type, count(*)::int AS count
    FROM route_session_events e
    JOIN route_sessions s ON s.id = e.route_session_id
    ${eventWhereSql.replace(/\bcreated_at\b/g, 's.created_at')}
    GROUP BY e.event_type
    ORDER BY count DESC, e.event_type
    LIMIT 20
  `, eventValues);

  return {
    summary: summaryResult.rows[0] || {},
    eventSeverityCounts: eventSeverityResult.rows,
    eventTypeCounts: eventTypeResult.rows
  };
}

async function getRouteSession(id) {
  const result = await postgres.query('SELECT * FROM route_sessions WHERE id = $1', [id]);
  return result.rows[0] ? routeSessionFromRow(result.rows[0]) : null;
}

async function updateRouteSessionReview(id, input = {}) {
  const status = normalizeRouteSessionReviewStatus(input.reviewStatus || input.review_status || input.status);
  if (!status) {
    const error = new Error('reviewStatus must be unreviewed, reviewed, needs_follow_up, training_needed, or dismissed');
    error.status = 400;
    throw error;
  }

  const notes = String(input.supervisorNotes ?? input.supervisor_notes ?? input.notes ?? '').trim().slice(0, 2000) || null;
  const reviewedBy = String(input.reviewedBy ?? input.reviewed_by ?? 'supervisor').trim().slice(0, 120) || 'supervisor';
  const result = await postgres.query(`
    UPDATE route_sessions
    SET
      review_status = $2,
      supervisor_notes = $3,
      reviewed_by = $4,
      reviewed_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, status, notes, reviewedBy]);
  return result.rows[0] ? routeSessionFromRow(result.rows[0]) : null;
}

async function deleteRouteSession(id) {
  const result = await postgres.query('DELETE FROM route_sessions WHERE id = $1 RETURNING *', [id]);
  return result.rows[0] ? routeSessionFromRow(result.rows[0]) : null;
}

async function deleteRouteSessions(options = {}) {
  const values = [];
  const whereSql = buildRouteSessionFilters(options, values);
  const result = await postgres.query(`
    WITH deleted AS (
      DELETE FROM route_sessions
      ${whereSql}
      RETURNING id
    )
    SELECT count(*)::int AS count FROM deleted
  `, values);
  return result.rows[0]?.count || 0;
}

async function archiveRouteSession(id, input = {}) {
  const reason = String(input.archiveReason ?? input.archive_reason ?? input.reason ?? 'Archived by supervisor').trim().slice(0, 500) || 'Archived by supervisor';
  const archivedBy = String(input.archivedBy ?? input.archived_by ?? 'supervisor').trim().slice(0, 120) || 'supervisor';
  const result = await postgres.query(`
    UPDATE route_sessions
    SET
      archived_at = NOW(),
      archived_by = $2,
      archive_reason = $3
    WHERE id = $1
    RETURNING *
  `, [id, archivedBy, reason]);
  return result.rows[0] ? routeSessionFromRow(result.rows[0]) : null;
}

async function archiveRouteSessions(options = {}, input = {}) {
  const values = [];
  const whereSql = buildRouteSessionFilters({ ...options, includeArchived: false, archivedOnly: false }, values);
  const archivedBy = String(input.archivedBy ?? input.archived_by ?? 'supervisor').trim().slice(0, 120) || 'supervisor';
  const reason = String(input.archiveReason ?? input.archive_reason ?? input.reason ?? 'Bulk archived by supervisor').trim().slice(0, 500) || 'Bulk archived by supervisor';
  values.push(archivedBy, reason);
  const archivedByParam = values.length - 1;
  const reasonParam = values.length;
  const result = await postgres.query(`
    WITH archived AS (
      UPDATE route_sessions
      SET
        archived_at = NOW(),
        archived_by = $${archivedByParam},
        archive_reason = $${reasonParam}
      ${whereSql}
      RETURNING id
    )
    SELECT count(*)::int AS count FROM archived
  `, values);
  return result.rows[0]?.count || 0;
}

async function listRouteSessionEvents(routeSessionId, options = {}) {
  const limit = normalizeLimit(options.limit, 250, 1000);
  const result = await postgres.query(`
    SELECT *
    FROM route_session_events
    WHERE route_session_id = $1
    ORDER BY created_at ASC, id ASC
    LIMIT $2
  `, [routeSessionId, limit]);
  return result.rows.map(routeSessionEventFromRow);
}

async function addRouteSessionEvent(event) {
  const result = await postgres.query(`
    INSERT INTO route_session_events (
      route_session_id, event_type, severity, latitude, longitude, payload, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
    RETURNING *
  `, [
    event.routeSessionId || null,
    event.eventType,
    event.severity || null,
    event.latitude ?? null,
    event.longitude ?? null,
    JSON.stringify(event.payload || {}),
    event.createdAt || new Date().toISOString()
  ]);
  return result.rows[0];
}

async function upsertDailyRouteManifest(manifest) {
  const result = await postgres.query(`
    INSERT INTO daily_route_manifests (
      id, route_date, route_number, route_name, start_location,
      planned_start_at, planned_end_at, planned_duration_minutes,
      total_stops, total_pallets, total_cases,
      assigned_driver_id, assigned_driver_name, assigned_at, assigned_by,
      status, source_file_name, imported_by, imported_at, published_at,
      raw, updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11,
      $12, $13, $14, $15,
      $16, $17, $18, COALESCE($19::timestamptz, NOW()), $20,
      $21::jsonb, NOW()
    )
    ON CONFLICT (route_date, route_number) DO UPDATE SET
      id = EXCLUDED.id,
      route_name = EXCLUDED.route_name,
      start_location = EXCLUDED.start_location,
      planned_start_at = EXCLUDED.planned_start_at,
      planned_end_at = EXCLUDED.planned_end_at,
      planned_duration_minutes = EXCLUDED.planned_duration_minutes,
      total_stops = EXCLUDED.total_stops,
      total_pallets = EXCLUDED.total_pallets,
      total_cases = EXCLUDED.total_cases,
      assigned_driver_id = EXCLUDED.assigned_driver_id,
      assigned_driver_name = EXCLUDED.assigned_driver_name,
      assigned_at = EXCLUDED.assigned_at,
      assigned_by = EXCLUDED.assigned_by,
      status = EXCLUDED.status,
      source_file_name = EXCLUDED.source_file_name,
      imported_by = EXCLUDED.imported_by,
      imported_at = EXCLUDED.imported_at,
      raw = EXCLUDED.raw,
      updated_at = NOW()
    RETURNING *
  `, [
    manifest.id,
    manifest.routeDate,
    manifest.routeNumber,
    manifest.routeName || null,
    manifest.startLocation || null,
    manifest.plannedStartAt || null,
    manifest.plannedEndAt || null,
    manifest.plannedDurationMinutes ?? null,
    manifest.totalStops ?? 0,
    manifest.totalPallets ?? 0,
    manifest.totalCases ?? 0,
    manifest.assignedDriverId || null,
    manifest.assignedDriverName || null,
    manifest.assignedAt || null,
    manifest.assignedBy || null,
    manifest.status || 'unassigned',
    manifest.sourceFileName || null,
    manifest.importedBy || null,
    manifest.importedAt || null,
    manifest.publishedAt || null,
    JSON.stringify(manifest.raw || {})
  ]);
  return routeManifestFromRow(result.rows[0]);
}

async function replaceDailyRouteStops(manifestId, stops = []) {
  await postgres.query('DELETE FROM daily_route_stops WHERE manifest_id = $1', [manifestId]);
  const savedStops = [];

  for (const stop of stops) {
    const result = await postgres.query(`
      INSERT INTO daily_route_stops (
        id, manifest_id, stop_sequence, account_number, account_name,
        destination_address, city, state_code, postal_code, latitude, longitude,
        planned_arrival_at, planned_departure_at, planned_service_minutes,
        drive_minutes_to_next, pallet_count, case_count, item_summary,
        status, raw, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17, $18::jsonb,
        $19, $20::jsonb, NOW()
      )
      RETURNING *
    `, [
      stop.id,
      manifestId,
      stop.stopSequence,
      stop.accountNumber || null,
      stop.accountName || null,
      stop.destinationAddress,
      stop.city || null,
      stop.stateCode || null,
      stop.postalCode || null,
      stop.latitude ?? null,
      stop.longitude ?? null,
      stop.plannedArrivalAt || null,
      stop.plannedDepartureAt || null,
      stop.plannedServiceMinutes ?? null,
      stop.driveMinutesToNext ?? null,
      stop.palletCount ?? 0,
      stop.caseCount ?? 0,
      JSON.stringify(asArray(stop.itemSummary)),
      stop.status || 'pending',
      JSON.stringify(stop.raw || {})
    ]);
    savedStops.push(routeStopFromRow(result.rows[0]));
  }

  return savedStops;
}

async function getDailyRouteManifest(id, options = {}) {
  const manifestResult = await postgres.query('SELECT * FROM daily_route_manifests WHERE id = $1', [id]);
  const manifestRow = manifestResult.rows[0];
  if (!manifestRow) return null;

  if (options.includeStops === false) {
    return routeManifestFromRow(manifestRow);
  }

  const stopsResult = await postgres.query(`
    SELECT *
    FROM daily_route_stops
    WHERE manifest_id = $1
    ORDER BY stop_sequence ASC
  `, [id]);
  return routeManifestFromRow(manifestRow, stopsResult.rows.map(routeStopFromRow));
}

async function listDailyRouteManifests(options = {}) {
  const limit = normalizeLimit(options.limit, 100, 500);
  const values = [];
  const where = [];

  if (options.routeDate) {
    values.push(options.routeDate);
    where.push(`route_date = $${values.length}`);
  }
  if (options.driverId) {
    values.push(String(options.driverId).trim());
    where.push(`assigned_driver_id = $${values.length}`);
  }
  if (options.status) {
    values.push(String(options.status).trim().toLowerCase());
    where.push(`status = $${values.length}`);
  }

  values.push(limit);
  const result = await postgres.query(`
    SELECT *
    FROM daily_route_manifests
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY route_date DESC, route_number ASC
    LIMIT $${values.length}
  `, values);
  return result.rows.map((row) => routeManifestFromRow(row));
}

async function assignDailyRouteManifest(id, input = {}) {
  const driverId = String(input.driverId || input.driver_id || '').trim();
  const driverName = String(input.driverName || input.driver_name || driverId).trim();
  const assignedBy = String(input.assignedBy || input.assigned_by || 'supervisor').trim();
  if (!driverId) {
    const error = new Error('driverId is required to assign a route');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    UPDATE daily_route_manifests
    SET
      assigned_driver_id = $2,
      assigned_driver_name = $3,
      assigned_by = $4,
      assigned_at = NOW(),
      status = CASE WHEN status = 'completed' THEN status ELSE 'assigned' END,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, driverId, driverName || driverId, assignedBy || 'supervisor']);
  return result.rows[0] ? routeManifestFromRow(result.rows[0]) : null;
}

async function deleteDailyRouteManifest(id) {
  const cleanedId = String(id || '').trim();
  if (!cleanedId) {
    const error = new Error('Route manifest id is required.');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    WITH selected AS (
      SELECT id, route_date, route_number, assigned_driver_id
      FROM daily_route_manifests
      WHERE id = $1
    ),
    stop_count AS (
      SELECT count(*)::int AS stops
      FROM daily_route_stops
      WHERE manifest_id = $1
    ),
    deleted AS (
      DELETE FROM daily_route_manifests
      WHERE id = $1
      RETURNING *
    )
    SELECT
      deleted.*,
      COALESCE((SELECT stops FROM stop_count), 0) AS deleted_stops
    FROM deleted
  `, [cleanedId]);

  const row = result.rows[0];
  if (!row) return null;
  return {
    route: routeManifestFromRow(row),
    deletedStops: Number(row.deleted_stops) || 0
  };
}

async function deleteDailyRouteManifestsByDate(routeDate) {
  const cleanedRouteDate = String(routeDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanedRouteDate)) {
    const error = new Error('A route date in YYYY-MM-DD format is required.');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    WITH selected AS (
      SELECT id
      FROM daily_route_manifests
      WHERE route_date = $1
    ),
    stop_count AS (
      SELECT count(*)::int AS stops
      FROM daily_route_stops
      WHERE manifest_id IN (SELECT id FROM selected)
    ),
    deleted AS (
      DELETE FROM daily_route_manifests
      WHERE id IN (SELECT id FROM selected)
      RETURNING id
    )
    SELECT
      (SELECT count(*)::int FROM deleted) AS routes,
      COALESCE((SELECT stops FROM stop_count), 0) AS stops
  `, [cleanedRouteDate]);

  return {
    routeDate: cleanedRouteDate,
    deletedRoutes: Number(result.rows[0]?.routes) || 0,
    deletedStops: Number(result.rows[0]?.stops) || 0
  };
}

async function updateDailyRouteStopStatusForDriver(stopId, driverId, input = {}) {
  const cleanedStopId = String(stopId || '').trim();
  const cleanedDriverId = String(driverId || '').trim();
  const status = String(input.status || '').trim().toLowerCase();
  const driverNotes = input.driverNotes == null ? null : String(input.driverNotes).trim().slice(0, 2000);
  const allowedStatuses = new Set(['pending', 'en_route', 'arrived', 'service_started', 'completed', 'departed', 'skipped']);

  if (!cleanedStopId || !cleanedDriverId) {
    const error = new Error('stopId and driverId are required.');
    error.status = 400;
    throw error;
  }
  if (!allowedStatuses.has(status)) {
    const error = new Error('Invalid stop status.');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    UPDATE daily_route_stops AS stop
    SET
      status = $3,
      actual_arrival_at = CASE
        WHEN $3 IN ('arrived', 'service_started', 'completed', 'departed') THEN COALESCE(stop.actual_arrival_at, NOW())
        ELSE stop.actual_arrival_at
      END,
      actual_service_started_at = CASE
        WHEN $3 IN ('service_started', 'completed', 'departed') THEN COALESCE(stop.actual_service_started_at, NOW())
        ELSE stop.actual_service_started_at
      END,
      actual_completed_at = CASE
        WHEN $3 IN ('completed', 'departed') THEN COALESCE(stop.actual_completed_at, NOW())
        ELSE stop.actual_completed_at
      END,
      actual_departure_at = CASE
        WHEN $3 = 'departed' THEN COALESCE(stop.actual_departure_at, NOW())
        ELSE stop.actual_departure_at
      END,
      driver_notes = COALESCE(NULLIF($4, ''), stop.driver_notes),
      updated_at = NOW()
    FROM daily_route_manifests AS manifest
    WHERE stop.manifest_id = manifest.id
      AND stop.id = $1
      AND manifest.assigned_driver_id = $2
    RETURNING stop.*
  `, [cleanedStopId, cleanedDriverId, status, driverNotes]);

  const updatedStop = result.rows[0] ? routeStopFromRow(result.rows[0]) : null;
  if (!updatedStop) return null;

  await postgres.query(`
    UPDATE daily_route_manifests
    SET
      status = CASE
        WHEN NOT EXISTS (
          SELECT 1
          FROM daily_route_stops
          WHERE manifest_id = $1
            AND status NOT IN ('completed', 'departed', 'skipped')
        ) THEN 'completed'
        WHEN status IN ('assigned', 'unassigned') THEN 'active'
        ELSE status
      END,
      started_at = COALESCE(started_at, NOW()),
      completed_at = CASE
        WHEN NOT EXISTS (
          SELECT 1
          FROM daily_route_stops
          WHERE manifest_id = $1
            AND status NOT IN ('completed', 'departed', 'skipped')
        ) THEN COALESCE(completed_at, NOW())
        ELSE completed_at
      END,
      updated_at = NOW()
    WHERE id = $1
  `, [updatedStop.manifestId]);

  return updatedStop;
}

async function getAssignedDailyRouteForDriver(driverId, routeDate) {
  const result = await postgres.query(`
    SELECT *
    FROM daily_route_manifests
    WHERE assigned_driver_id = $1
      AND route_date = $2
      AND status NOT IN ('completed', 'cancelled')
    ORDER BY assigned_at DESC NULLS LAST, route_number ASC
    LIMIT 1
  `, [driverId, routeDate]);
  const manifest = result.rows[0] ? routeManifestFromRow(result.rows[0]) : null;
  if (!manifest) return null;
  return getDailyRouteManifest(manifest.id);
}

module.exports = {
  getAdminUser,
  assignDailyRouteManifest,
  deleteDailyRouteManifest,
  deleteDailyRouteManifestsByDate,
  deleteDeliveryNote,
  deleteManualHazard,
  deleteRouteSession,
  deleteRouteSessions,
  archiveRouteSession,
  archiveRouteSessions,
  addRouteSessionEvent,
  enqueueStaticHazardLocationBackfill,
  getRouteSession,
  getAssignedDailyRouteForDriver,
  getDailyRouteManifest,
  getStaticHazardLocationBackfillStats,
  getRouteSessionAnalytics,
  isDatabaseEnabled,
  isPostgisEnabled,
  listAdminUsers,
  listDailyRouteManifests,
  listRouteSessionEvents,
  listRouteSessions,
  listStaticHazardLocationBackfillQueue,
  listStaticHazardsForVerification,
  listDeliveryNotes,
  listManualHazards,
  listRecentDestinations,
  listStaticBridgesInBounds,
  listStaticBridgesNearRoute,
  listStaticZonesInBounds,
  listStaticZonesNearRoute,
  saveRecentDestination,
  saveRouteSession,
  recordAdminUserLogin,
  setAdminUserActive,
  updateRouteSessionReview,
  updateStaticHazardVerification,
  updateDailyRouteStopStatusForDriver,
  upsertAdminUser,
  upsertDailyRouteManifest,
  upsertDeliveryNote,
  upsertManualHazard,
  upsertStaticBridge,
  upsertStaticZone,
  replaceDailyRouteStops
};
