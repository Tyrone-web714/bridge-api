const crypto = require('crypto');
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

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const iso = toIsoString(value);
  return iso ? iso.slice(0, 10) : null;
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

function driverFromRow(row) {
  return {
    driverId: row.driver_id,
    driverName: row.driver_name,
    employeeNumber: row.employee_number || null,
    phoneNumber: row.phone_number || null,
    routeGroup: row.route_group || null,
    territory: row.territory || null,
    supervisorUsername: row.supervisor_username || null,
    supervisorName: row.supervisor_name || null,
    teamName: row.team_name || null,
    active: row.active !== false,
    notes: row.notes || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
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
    nonDeliveryReason: row.non_delivery_reason || null,
    nonDeliveryNotes: row.non_delivery_notes || null,
    nonDeliveryReportedAt: toIsoString(row.non_delivery_reported_at),
    redeliveryStatus: row.redelivery_status || 'none',
    redeliveryDate: toDateOnly(row.redelivery_date),
    redeliveryNotes: row.redelivery_notes || null,
    redeliveryUpdatedBy: row.redelivery_updated_by || null,
    redeliveryUpdatedAt: toIsoString(row.redelivery_updated_at),
    raw: row.raw || {},
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function productFromRow(row) {
  return {
    sku: row.sku,
    productName: row.product_name,
    brand: row.brand || null,
    packageSize: row.package_size || null,
    category: row.category || null,
    unitPrice: row.unit_price == null ? null : normalizeMoney(row.unit_price),
    active: row.active !== false,
    raw: row.raw || {},
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function accountOrderItemFromRow(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    sku: row.sku || null,
    productName: row.product_name,
    brand: row.brand || null,
    packageSize: row.package_size || null,
    category: row.category || null,
    quantity: normalizeQuantity(row.quantity),
    unitPrice: normalizeMoney(row.unit_price),
    grossAmount: normalizeMoney(row.gross_amount),
    deductionQuantity: normalizeQuantity(row.deduction_quantity),
    deductionAmount: normalizeMoney(row.deduction_amount),
    netAmount: normalizeMoney(row.net_amount),
    raw: row.raw || {},
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function deliveryDeductionFromRow(row) {
  return {
    id: row.id,
    orderId: row.order_id || null,
    orderItemId: row.order_item_id || null,
    accountNumber: row.account_number,
    routeStopId: row.route_stop_id || null,
    sku: row.sku || null,
    productName: row.product_name || null,
    reason: row.reason,
    quantity: normalizeQuantity(row.quantity),
    amount: normalizeMoney(row.amount),
    notes: row.notes || null,
    createdBy: row.created_by || null,
    createdAt: toIsoString(row.created_at),
    raw: row.raw || {}
  };
}

function accountOrderFromRow(row, items = [], deductions = []) {
  return {
    id: row.id,
    accountNumber: row.account_number,
    accountName: row.account_name || null,
    orderDate: toDateOnly(row.order_date),
    deliveryDate: toDateOnly(row.delivery_date),
    invoiceNumber: row.invoice_number || null,
    routeManifestId: row.route_manifest_id || null,
    routeStopId: row.route_stop_id || null,
    subtotalAmount: normalizeMoney(row.subtotal_amount),
    deductionAmount: normalizeMoney(row.deduction_amount),
    netAmount: normalizeMoney(row.net_amount),
    status: row.status || 'open',
    raw: row.raw || {},
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    items,
    deductions
  };
}

function accountAiInsightFromRow(row) {
  return {
    id: row.id,
    accountNumber: row.account_number,
    insightType: row.insight_type,
    title: row.title,
    summary: row.summary,
    confidence: row.confidence || 'medium',
    sourcePeriodStart: toDateOnly(row.source_period_start),
    sourcePeriodEnd: toDateOnly(row.source_period_end),
    generatedBy: row.generated_by || 'rules_engine_v1',
    status: row.status || 'active',
    raw: row.raw || {},
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function aiInteractionLogFromRow(row) {
  return {
    id: row.id,
    endpoint: row.endpoint,
    requesterType: row.requester_type || null,
    requesterId: row.requester_id || null,
    accountNumber: row.account_number || null,
    routeManifestId: row.route_manifest_id || null,
    routeStopId: row.route_stop_id || null,
    model: row.model || null,
    status: row.status,
    inputSummary: row.input_summary || {},
    outputSummary: row.output_summary || {},
    errorMessage: row.error_message || null,
    latencyMs: row.latency_ms ?? null,
    createdAt: toIsoString(row.created_at)
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

function generateRepositoryId(prefix) {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')}`;
}

function stableRepositoryId(prefix, parts) {
  return `${prefix}_${crypto.createHash('sha1').update(parts.map((part) => String(part ?? '')).join('|')).digest('hex').slice(0, 24)}`;
}

function normalizeMoney(value, fallback = 0) {
  const parsed = Number(String(value ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : fallback;
}

function normalizeQuantity(value, fallback = 0) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : fallback;
}

function cleanRepositoryText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
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

async function getDriver(driverId) {
  const cleanedDriverId = String(driverId || '').trim();
  if (!cleanedDriverId) return null;

  const result = await postgres.query('SELECT * FROM drivers WHERE driver_id = $1', [cleanedDriverId]);
  return result.rows[0] ? driverFromRow(result.rows[0]) : null;
}

async function listDrivers(options = {}) {
  const values = [];
  const where = [];
  const search = String(options.search || '').trim();
  const active = options.active;

  if (active === true || active === 'true') {
    where.push('active = true');
  } else if (active === false || active === 'false') {
    where.push('active = false');
  }

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    where.push(`(
      LOWER(driver_id) LIKE $${values.length}
      OR LOWER(driver_name) LIKE $${values.length}
      OR LOWER(COALESCE(employee_number, '')) LIKE $${values.length}
      OR LOWER(COALESCE(route_group, '')) LIKE $${values.length}
      OR LOWER(COALESCE(territory, '')) LIKE $${values.length}
      OR LOWER(COALESCE(supervisor_username, '')) LIKE $${values.length}
      OR LOWER(COALESCE(supervisor_name, '')) LIKE $${values.length}
      OR LOWER(COALESCE(team_name, '')) LIKE $${values.length}
    )`);
  }
  if (options.supervisorUsername) {
    values.push(String(options.supervisorUsername).trim().toLowerCase());
    where.push(`LOWER(COALESCE(supervisor_username, '')) = $${values.length}`);
  }
  if (options.teamName) {
    values.push(String(options.teamName).trim().toLowerCase());
    where.push(`LOWER(COALESCE(team_name, '')) = $${values.length}`);
  }

  const limit = Math.min(Math.max(Number.parseInt(options.limit, 10) || 250, 1), 1000);
  values.push(limit);

  const result = await postgres.query(`
    SELECT *
    FROM drivers
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY active DESC, supervisor_username NULLS LAST, team_name NULLS LAST, route_group NULLS LAST, driver_name ASC, driver_id ASC
    LIMIT $${values.length}
  `, values);

  return result.rows.map(driverFromRow);
}

async function upsertDriver(input = {}, actor = 'supervisor') {
  const driverId = String(input.driverId || input.driver_id || '').trim();
  const driverName = String(input.driverName || input.driver_name || '').trim();
  const active = input.active === undefined ? true : input.active === true || input.active === 'true';

  if (!driverId) {
    const error = new Error('driverId is required');
    error.status = 400;
    throw error;
  }
  if (!driverName) {
    const error = new Error('driverName is required');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    INSERT INTO drivers (
      driver_id, driver_name, employee_number, phone_number, route_group,
      territory, supervisor_username, supervisor_name, team_name,
      active, notes, created_by, updated_by, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, NOW(), NOW())
    ON CONFLICT (driver_id) DO UPDATE SET
      driver_name = EXCLUDED.driver_name,
      employee_number = EXCLUDED.employee_number,
      phone_number = EXCLUDED.phone_number,
      route_group = EXCLUDED.route_group,
      territory = EXCLUDED.territory,
      supervisor_username = EXCLUDED.supervisor_username,
      supervisor_name = EXCLUDED.supervisor_name,
      team_name = EXCLUDED.team_name,
      active = EXCLUDED.active,
      notes = EXCLUDED.notes,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING *
  `, [
    driverId,
    driverName,
    String(input.employeeNumber || input.employee_number || '').trim() || null,
    String(input.phoneNumber || input.phone_number || '').trim() || null,
    String(input.routeGroup || input.route_group || '').trim() || null,
    String(input.territory || '').trim() || null,
    String(input.supervisorUsername || input.supervisor_username || '').trim().toLowerCase() || null,
    String(input.supervisorName || input.supervisor_name || '').trim() || null,
    String(input.teamName || input.team_name || '').trim() || null,
    active,
    String(input.notes || '').trim() || null,
    String(actor || 'supervisor').trim() || 'supervisor'
  ]);

  return driverFromRow(result.rows[0]);
}

async function setDriverActive(driverId, active, actor = 'supervisor') {
  const cleanedDriverId = String(driverId || '').trim();
  if (!cleanedDriverId) return null;

  const result = await postgres.query(`
    UPDATE drivers
    SET active = $2, updated_by = $3, updated_at = NOW()
    WHERE driver_id = $1
    RETURNING *
  `, [cleanedDriverId, active === true, String(actor || 'supervisor').trim() || 'supervisor']);

  return result.rows[0] ? driverFromRow(result.rows[0]) : null;
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

async function getDailyRouteManifestWithAccountIntelligence(id, options = {}) {
  const route = await getDailyRouteManifest(id, options);
  if (!route || !Array.isArray(route.stops) || !route.stops.length) {
    return route;
  }

  const stopIds = route.stops.map((stop) => stop.id).filter(Boolean);
  const accountNumbers = [...new Set(route.stops.map((stop) => stop.accountNumber).filter(Boolean))];

  const orderRows = stopIds.length
    ? (await postgres.query(`
      SELECT *
      FROM account_orders
      WHERE route_stop_id = ANY($1::text[])
      ORDER BY COALESCE(delivery_date, order_date) DESC, created_at DESC
    `, [stopIds])).rows
    : [];
  const orderIds = orderRows.map((row) => row.id).filter(Boolean);

  const itemRows = orderIds.length
    ? (await postgres.query(`
      SELECT *
      FROM account_order_items
      WHERE order_id = ANY($1::text[])
      ORDER BY product_name ASC
    `, [orderIds])).rows
    : [];
  const deductionRows = orderIds.length
    ? (await postgres.query(`
      SELECT *
      FROM delivery_deductions
      WHERE order_id = ANY($1::text[])
      ORDER BY created_at DESC
    `, [orderIds])).rows
    : [];
  const insightRows = accountNumbers.length
    ? (await postgres.query(`
      SELECT DISTINCT ON (account_number, insight_type) *
      FROM account_ai_insights
      WHERE account_number = ANY($1::text[])
        AND status = 'active'
      ORDER BY account_number, insight_type, created_at DESC
    `, [accountNumbers])).rows
    : [];

  const itemsByOrderId = new Map();
  for (const row of itemRows) {
    const mapped = accountOrderItemFromRow(row);
    if (!itemsByOrderId.has(mapped.orderId)) itemsByOrderId.set(mapped.orderId, []);
    itemsByOrderId.get(mapped.orderId).push(mapped);
  }

  const deductionsByOrderId = new Map();
  for (const row of deductionRows) {
    const mapped = deliveryDeductionFromRow(row);
    if (!deductionsByOrderId.has(mapped.orderId)) deductionsByOrderId.set(mapped.orderId, []);
    deductionsByOrderId.get(mapped.orderId).push(mapped);
  }

  const ordersByStopId = new Map();
  for (const row of orderRows) {
    const mapped = accountOrderFromRow(
      row,
      itemsByOrderId.get(row.id) || [],
      deductionsByOrderId.get(row.id) || []
    );
    if (!ordersByStopId.has(mapped.routeStopId)) ordersByStopId.set(mapped.routeStopId, []);
    ordersByStopId.get(mapped.routeStopId).push(mapped);
  }

  const insightsByAccountNumber = new Map();
  for (const row of insightRows) {
    const mapped = accountAiInsightFromRow(row);
    if (!insightsByAccountNumber.has(mapped.accountNumber)) insightsByAccountNumber.set(mapped.accountNumber, []);
    insightsByAccountNumber.get(mapped.accountNumber).push(mapped);
  }

  return {
    ...route,
    stops: route.stops.map((stop) => {
      const accountOrders = ordersByStopId.get(stop.id) || [];
      const orderItems = accountOrders.flatMap((order) => order.items || []);
      const accountProductTotals = {
        orderCount: accountOrders.length,
        itemCount: orderItems.length,
        totalQuantity: normalizeQuantity(orderItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)),
        subtotalAmount: normalizeMoney(accountOrders.reduce((sum, order) => sum + (Number(order.subtotalAmount) || 0), 0)),
        deductionAmount: normalizeMoney(accountOrders.reduce((sum, order) => sum + (Number(order.deductionAmount) || 0), 0)),
        netAmount: normalizeMoney(accountOrders.reduce((sum, order) => sum + (Number(order.netAmount) || 0), 0))
      };

      return {
        ...stop,
        accountOrders,
        accountInsights: insightsByAccountNumber.get(stop.accountNumber) || [],
        accountProductTotals
      };
    })
  };
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

async function swapDailyRouteAssignments(leftRouteId, rightRouteId, input = {}) {
  const leftId = String(leftRouteId || input.leftRouteId || input.left_route_id || '').trim();
  const rightId = String(rightRouteId || input.rightRouteId || input.right_route_id || '').trim();
  const assignedBy = String(input.assignedBy || input.assigned_by || 'supervisor').trim() || 'supervisor';

  if (!leftId || !rightId || leftId === rightId) {
    const error = new Error('Two different route ids are required to switch route assignments.');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    WITH selected AS (
      SELECT *
      FROM daily_route_manifests
      WHERE id IN ($1, $2)
    ),
    left_route AS (
      SELECT * FROM selected WHERE id = $1
    ),
    right_route AS (
      SELECT * FROM selected WHERE id = $2
    ),
    updated_left AS (
      UPDATE daily_route_manifests target
      SET
        assigned_driver_id = right_route.assigned_driver_id,
        assigned_driver_name = right_route.assigned_driver_name,
        assigned_by = $3,
        assigned_at = CASE WHEN right_route.assigned_driver_id IS NULL THEN NULL ELSE NOW() END,
        status = CASE
          WHEN target.status = 'completed' THEN target.status
          WHEN right_route.assigned_driver_id IS NULL THEN 'unassigned'
          ELSE 'assigned'
        END,
        updated_at = NOW()
      FROM right_route
      WHERE target.id = $1
      RETURNING target.*
    ),
    updated_right AS (
      UPDATE daily_route_manifests target
      SET
        assigned_driver_id = left_route.assigned_driver_id,
        assigned_driver_name = left_route.assigned_driver_name,
        assigned_by = $3,
        assigned_at = CASE WHEN left_route.assigned_driver_id IS NULL THEN NULL ELSE NOW() END,
        status = CASE
          WHEN target.status = 'completed' THEN target.status
          WHEN left_route.assigned_driver_id IS NULL THEN 'unassigned'
          ELSE 'assigned'
        END,
        updated_at = NOW()
      FROM left_route
      WHERE target.id = $2
      RETURNING target.*
    )
    SELECT * FROM updated_left
    UNION ALL
    SELECT * FROM updated_right
  `, [leftId, rightId, assignedBy]);

  if (result.rows.length !== 2) {
    const error = new Error('Both route manifests must exist before assignments can be switched.');
    error.status = 404;
    throw error;
  }

  return result.rows.map(routeManifestFromRow);
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
  const requestedStatus = String(input.status || '').trim().toLowerCase();
  const status = requestedStatus === 'service_started' ? 'servicing' : requestedStatus;
  const driverNotes = input.driverNotes == null ? null : String(input.driverNotes).trim().slice(0, 2000);
  const nonDeliveryReason = String(input.nonDeliveryReason || input.non_delivery_reason || '').trim().toLowerCase();
  const nonDeliveryNotes = input.nonDeliveryNotes == null && input.non_delivery_notes == null
    ? null
    : String(input.nonDeliveryNotes ?? input.non_delivery_notes).trim().slice(0, 2000);
  const allowedStatuses = new Set(['pending', 'en_route', 'arrived', 'servicing', 'service_started', 'completed', 'departed', 'skipped', 'undelivered']);
  const allowedNonDeliveryReasons = new Set(['customer_refused', 'missed_time_window', 'business_closed', 'no_payment']);

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
  if (status === 'undelivered' && !allowedNonDeliveryReasons.has(nonDeliveryReason)) {
    const error = new Error('A valid non-delivery reason is required.');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    UPDATE daily_route_stops AS stop
    SET
      status = $3,
      actual_arrival_at = CASE
        WHEN $3 IN ('arrived', 'servicing', 'completed', 'departed', 'undelivered') THEN COALESCE(stop.actual_arrival_at, NOW())
        ELSE stop.actual_arrival_at
      END,
      actual_service_started_at = CASE
        WHEN $3 IN ('servicing', 'completed', 'departed') THEN COALESCE(stop.actual_service_started_at, NOW())
        ELSE stop.actual_service_started_at
      END,
      actual_completed_at = CASE
        WHEN $3 IN ('completed', 'departed', 'undelivered') THEN COALESCE(stop.actual_completed_at, NOW())
        ELSE stop.actual_completed_at
      END,
      actual_departure_at = CASE
        WHEN $3 = 'departed' THEN COALESCE(stop.actual_departure_at, NOW())
        ELSE stop.actual_departure_at
      END,
      driver_notes = COALESCE(NULLIF($4, ''), stop.driver_notes),
      non_delivery_reason = CASE WHEN $3 = 'undelivered' THEN $5 ELSE stop.non_delivery_reason END,
      non_delivery_notes = CASE WHEN $3 = 'undelivered' THEN COALESCE(NULLIF($6, ''), stop.non_delivery_notes) ELSE stop.non_delivery_notes END,
      non_delivery_reported_at = CASE WHEN $3 = 'undelivered' THEN COALESCE(stop.non_delivery_reported_at, NOW()) ELSE stop.non_delivery_reported_at END,
      redelivery_status = CASE WHEN $3 = 'undelivered' THEN 'pending' ELSE stop.redelivery_status END,
      updated_at = NOW()
    FROM daily_route_manifests AS manifest
    WHERE stop.manifest_id = manifest.id
      AND stop.id = $1
      AND manifest.assigned_driver_id = $2
    RETURNING stop.*
  `, [cleanedStopId, cleanedDriverId, status, driverNotes, nonDeliveryReason, nonDeliveryNotes]);

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
            AND status NOT IN ('completed', 'departed', 'skipped', 'undelivered')
        ) THEN CASE
          WHEN EXISTS (
            SELECT 1
            FROM daily_route_stops
            WHERE manifest_id = $1
              AND status = 'undelivered'
          ) THEN 'completed_with_exceptions'
          ELSE 'completed'
        END
        WHEN $2 <> 'pending' AND status IN ('assigned', 'unassigned', 'active') THEN 'in_progress'
        ELSE status
      END,
      started_at = CASE
        WHEN $2 <> 'pending' THEN COALESCE(started_at, NOW())
        ELSE started_at
      END,
      completed_at = CASE
        WHEN NOT EXISTS (
          SELECT 1
          FROM daily_route_stops
          WHERE manifest_id = $1
            AND status NOT IN ('completed', 'departed', 'skipped', 'undelivered')
        ) THEN COALESCE(completed_at, NOW())
        ELSE completed_at
      END,
      updated_at = NOW()
    WHERE id = $1
  `, [updatedStop.manifestId, status]);

  return updatedStop;
}

async function getAssignedDailyRouteForDriver(driverId, routeDate) {
  const result = await postgres.query(`
    SELECT *
    FROM daily_route_manifests
    WHERE assigned_driver_id = $1
      AND route_date = $2
      AND status NOT IN ('completed', 'completed_with_exceptions', 'cancelled')
    ORDER BY assigned_at DESC NULLS LAST, route_number ASC
    LIMIT 1
  `, [driverId, routeDate]);
  const manifest = result.rows[0] ? routeManifestFromRow(result.rows[0]) : null;
  if (!manifest) return null;
  return getDailyRouteManifestWithAccountIntelligence(manifest.id);
}

async function listUndeliveredRouteStops(options = {}) {
  const limit = normalizeLimit(options.limit, 100, 500);
  const values = [];
  const where = ["stop.status = 'undelivered'"];

  if (options.routeDate) {
    values.push(String(options.routeDate).trim());
    where.push(`manifest.route_date = $${values.length}`);
  }
  if (options.redeliveryStatus) {
    values.push(String(options.redeliveryStatus).trim().toLowerCase());
    where.push(`stop.redelivery_status = $${values.length}`);
  }

  values.push(limit);
  const result = await postgres.query(`
    SELECT
      stop.*,
      manifest.route_date,
      manifest.route_number,
      manifest.route_name,
      manifest.assigned_driver_id,
      manifest.assigned_driver_name
    FROM daily_route_stops AS stop
    JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
    WHERE ${where.join(' AND ')}
    ORDER BY manifest.route_date DESC, manifest.route_number ASC, stop.stop_sequence ASC
    LIMIT $${values.length}
  `, values);

  return result.rows.map((row) => ({
    ...routeStopFromRow(row),
    routeDate: toDateOnly(row.route_date),
    routeNumber: row.route_number || null,
    routeName: row.route_name || null,
    assignedDriverId: row.assigned_driver_id || null,
    assignedDriverName: row.assigned_driver_name || null
  }));
}

async function updateUndeliveredStopDisposition(stopId, input = {}) {
  const cleanedStopId = String(stopId || '').trim();
  const redeliveryStatus = String(input.redeliveryStatus || input.redelivery_status || '').trim().toLowerCase();
  const redeliveryDate = String(input.redeliveryDate || input.redelivery_date || '').trim();
  const redeliveryNotes = input.redeliveryNotes == null && input.redelivery_notes == null
    ? null
    : String(input.redeliveryNotes ?? input.redelivery_notes).trim().slice(0, 2000);
  const updatedBy = String(input.updatedBy || input.updated_by || 'supervisor').trim().slice(0, 120);
  const allowedStatuses = new Set(['pending', 'redelivery_scheduled', 'cancelled']);

  if (!cleanedStopId) {
    const error = new Error('stopId is required.');
    error.status = 400;
    throw error;
  }
  if (!allowedStatuses.has(redeliveryStatus)) {
    const error = new Error('A valid redelivery status is required.');
    error.status = 400;
    throw error;
  }
  if (redeliveryStatus === 'redelivery_scheduled' && !/^\d{4}-\d{2}-\d{2}$/.test(redeliveryDate)) {
    const error = new Error('A redelivery date in YYYY-MM-DD format is required.');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    UPDATE daily_route_stops
    SET
      redelivery_status = $2,
      redelivery_date = CASE WHEN $2 = 'redelivery_scheduled' THEN $3::date ELSE NULL END,
      redelivery_notes = COALESCE(NULLIF($4, ''), redelivery_notes),
      redelivery_updated_by = $5,
      redelivery_updated_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
      AND status = 'undelivered'
    RETURNING *
  `, [cleanedStopId, redeliveryStatus, redeliveryDate || null, redeliveryNotes, updatedBy || 'supervisor']);

  return result.rows[0] ? routeStopFromRow(result.rows[0]) : null;
}

async function upsertProduct(input = {}) {
  const sku = cleanRepositoryText(input.sku || input.SKU, 120);
  const productName = cleanRepositoryText(input.productName || input.product_name || input.name, 240);
  if (!sku || !productName) {
    const error = new Error('sku and productName are required.');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    INSERT INTO products (
      sku, product_name, brand, package_size, category, unit_price, active, raw, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
    ON CONFLICT (sku) DO UPDATE SET
      product_name = EXCLUDED.product_name,
      brand = EXCLUDED.brand,
      package_size = EXCLUDED.package_size,
      category = EXCLUDED.category,
      unit_price = EXCLUDED.unit_price,
      active = EXCLUDED.active,
      raw = EXCLUDED.raw,
      updated_at = NOW()
    RETURNING *
  `, [
    sku,
    productName,
    cleanRepositoryText(input.brand, 120) || null,
    cleanRepositoryText(input.packageSize || input.package_size, 120) || null,
    cleanRepositoryText(input.category, 120) || null,
    input.unitPrice == null && input.unit_price == null ? null : normalizeMoney(input.unitPrice ?? input.unit_price),
    input.active !== false,
    JSON.stringify(input.raw || {})
  ]);
  return productFromRow(result.rows[0]);
}

async function listProducts(options = {}) {
  const limit = normalizeLimit(options.limit, 100, 500);
  const values = [];
  const where = [];

  if (options.search) {
    values.push(`%${cleanRepositoryText(options.search, 120)}%`);
    where.push(`(sku ILIKE $${values.length} OR product_name ILIKE $${values.length} OR brand ILIKE $${values.length})`);
  }
  if (options.category) {
    values.push(cleanRepositoryText(options.category, 120));
    where.push(`category = $${values.length}`);
  }
  if (options.active !== undefined) {
    values.push(options.active !== false && String(options.active).toLowerCase() !== 'false');
    where.push(`active = $${values.length}`);
  }

  values.push(limit);
  const result = await postgres.query(`
    SELECT *
    FROM products
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY product_name ASC
    LIMIT $${values.length}
  `, values);
  return result.rows.map(productFromRow);
}

async function createAccountOrder(input = {}) {
  const accountNumber = cleanRepositoryText(input.accountNumber || input.account_number, 120);
  if (!accountNumber) {
    const error = new Error('accountNumber is required.');
    error.status = 400;
    throw error;
  }

  const items = asArray(input.items).map((item) => {
    const quantity = normalizeQuantity(item.quantity ?? item.cases ?? item.units);
    const unitPrice = normalizeMoney(item.unitPrice ?? item.unit_price);
    const grossAmount = normalizeMoney(item.grossAmount ?? item.gross_amount, quantity * unitPrice);
    const deductionQuantity = normalizeQuantity(item.deductionQuantity ?? item.deduction_quantity);
    const deductionAmount = normalizeMoney(item.deductionAmount ?? item.deduction_amount);
    return {
      id: cleanRepositoryText(item.id, 160) || generateRepositoryId('order_item'),
      sku: cleanRepositoryText(item.sku || item.SKU, 120) || null,
      productName: cleanRepositoryText(item.productName || item.product_name || item.name, 240),
      brand: cleanRepositoryText(item.brand, 120) || null,
      packageSize: cleanRepositoryText(item.packageSize || item.package_size, 120) || null,
      category: cleanRepositoryText(item.category, 120) || null,
      quantity,
      unitPrice,
      grossAmount,
      deductionQuantity,
      deductionAmount,
      netAmount: Math.max(0, normalizeMoney(item.netAmount ?? item.net_amount, grossAmount - deductionAmount)),
      raw: item.raw || item
    };
  }).filter((item) => item.productName);

  const invoiceNumber = cleanRepositoryText(input.invoiceNumber || input.invoice_number, 160) || null;
  const subtotalAmount = normalizeMoney(input.subtotalAmount ?? input.subtotal_amount, items.reduce((sum, item) => sum + item.grossAmount, 0));
  const deductionAmount = normalizeMoney(input.deductionAmount ?? input.deduction_amount, items.reduce((sum, item) => sum + item.deductionAmount, 0));
  const netAmount = normalizeMoney(input.netAmount ?? input.net_amount, Math.max(0, subtotalAmount - deductionAmount));
  const orderId = cleanRepositoryText(input.id, 160) || (invoiceNumber
    ? stableRepositoryId('order', [accountNumber, invoiceNumber])
    : generateRepositoryId('order'));

  const result = await postgres.query(`
    INSERT INTO account_orders (
      id, account_number, account_name, order_date, delivery_date, invoice_number,
      route_manifest_id, route_stop_id, subtotal_amount, deduction_amount, net_amount,
      status, raw, updated_at
    )
    VALUES (
      $1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5::date, $6,
      $7, $8, $9, $10, $11, $12, $13::jsonb, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      account_number = EXCLUDED.account_number,
      account_name = EXCLUDED.account_name,
      order_date = EXCLUDED.order_date,
      delivery_date = EXCLUDED.delivery_date,
      invoice_number = EXCLUDED.invoice_number,
      route_manifest_id = EXCLUDED.route_manifest_id,
      route_stop_id = EXCLUDED.route_stop_id,
      subtotal_amount = EXCLUDED.subtotal_amount,
      deduction_amount = EXCLUDED.deduction_amount,
      net_amount = EXCLUDED.net_amount,
      status = EXCLUDED.status,
      raw = EXCLUDED.raw,
      updated_at = NOW()
    RETURNING *
  `, [
    orderId,
    accountNumber,
    cleanRepositoryText(input.accountName || input.account_name, 240) || null,
    toDateOnly(input.orderDate || input.order_date) || null,
    toDateOnly(input.deliveryDate || input.delivery_date) || null,
    invoiceNumber,
    cleanRepositoryText(input.routeManifestId || input.route_manifest_id, 160) || null,
    cleanRepositoryText(input.routeStopId || input.route_stop_id, 160) || null,
    subtotalAmount,
    deductionAmount,
    netAmount,
    cleanRepositoryText(input.status, 80) || 'open',
    JSON.stringify(input.raw || {})
  ]);

  await postgres.query('DELETE FROM account_order_items WHERE order_id = $1', [orderId]);
  for (const item of items) {
    if (item.sku) {
      await upsertProduct({
        sku: item.sku,
        productName: item.productName,
        brand: item.brand,
        packageSize: item.packageSize,
        category: item.category,
        unitPrice: item.unitPrice,
        raw: item.raw
      });
    }
    await postgres.query(`
      INSERT INTO account_order_items (
        id, order_id, sku, product_name, brand, package_size, category,
        quantity, unit_price, gross_amount, deduction_quantity, deduction_amount,
        net_amount, raw, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14::jsonb, NOW()
      )
    `, [
      item.id,
      orderId,
      item.sku,
      item.productName,
      item.brand,
      item.packageSize,
      item.category,
      item.quantity,
      item.unitPrice,
      item.grossAmount,
      item.deductionQuantity,
      item.deductionAmount,
      item.netAmount,
      JSON.stringify(item.raw || {})
    ]);
  }

  return getAccountOrder(result.rows[0].id);
}

async function getAccountOrder(id) {
  const orderResult = await postgres.query('SELECT * FROM account_orders WHERE id = $1', [id]);
  const row = orderResult.rows[0];
  if (!row) return null;

  const itemResult = await postgres.query(`
    SELECT *
    FROM account_order_items
    WHERE order_id = $1
    ORDER BY product_name ASC
  `, [id]);
  const deductionResult = await postgres.query(`
    SELECT *
    FROM delivery_deductions
    WHERE order_id = $1
    ORDER BY created_at DESC
  `, [id]);

  return accountOrderFromRow(
    row,
    itemResult.rows.map(accountOrderItemFromRow),
    deductionResult.rows.map(deliveryDeductionFromRow)
  );
}

async function listAccountOrders(options = {}) {
  const limit = normalizeLimit(options.limit, 100, 500);
  const values = [];
  const where = [];

  if (options.accountNumber) {
    values.push(cleanRepositoryText(options.accountNumber, 120));
    where.push(`account_number = $${values.length}`);
  }
  if (options.routeStopId) {
    values.push(cleanRepositoryText(options.routeStopId, 160));
    where.push(`route_stop_id = $${values.length}`);
  }
  if (options.status) {
    values.push(cleanRepositoryText(options.status, 80));
    where.push(`status = $${values.length}`);
  }

  values.push(limit);
  const result = await postgres.query(`
    SELECT *
    FROM account_orders
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY COALESCE(delivery_date, order_date) DESC, created_at DESC
    LIMIT $${values.length}
  `, values);
  return result.rows.map((row) => accountOrderFromRow(row));
}

async function recordDeliveryDeduction(input = {}) {
  const accountNumber = cleanRepositoryText(input.accountNumber || input.account_number, 120);
  const reason = cleanRepositoryText(input.reason, 120).toLowerCase().replace(/\s+/g, '_');
  if (!accountNumber || !reason) {
    const error = new Error('accountNumber and reason are required.');
    error.status = 400;
    throw error;
  }

  const id = cleanRepositoryText(input.id, 160) || generateRepositoryId('deduction');
  const orderId = cleanRepositoryText(input.orderId || input.order_id, 160) || null;
  const orderItemId = cleanRepositoryText(input.orderItemId || input.order_item_id, 160) || null;
  const amount = normalizeMoney(input.amount);
  const quantity = normalizeQuantity(input.quantity);

  const result = await postgres.query(`
    INSERT INTO delivery_deductions (
      id, order_id, order_item_id, account_number, route_stop_id, sku, product_name,
      reason, quantity, amount, notes, created_by, raw
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
    RETURNING *
  `, [
    id,
    orderId,
    orderItemId,
    accountNumber,
    cleanRepositoryText(input.routeStopId || input.route_stop_id, 160) || null,
    cleanRepositoryText(input.sku || input.SKU, 120) || null,
    cleanRepositoryText(input.productName || input.product_name, 240) || null,
    reason,
    quantity,
    amount,
    cleanRepositoryText(input.notes, 2000) || null,
    cleanRepositoryText(input.createdBy || input.created_by, 120) || 'driver_app',
    JSON.stringify(input.raw || {})
  ]);

  if (orderItemId) {
    await postgres.query(`
      UPDATE account_order_items
      SET
        deduction_quantity = deduction_quantity + $2,
        deduction_amount = deduction_amount + $3,
        net_amount = GREATEST(0, net_amount - $3),
        updated_at = NOW()
      WHERE id = $1
    `, [orderItemId, quantity, amount]);
  }

  if (orderId) {
    await postgres.query(`
      UPDATE account_orders
      SET
        deduction_amount = COALESCE((SELECT SUM(amount) FROM delivery_deductions WHERE order_id = $1), 0),
        net_amount = GREATEST(0, subtotal_amount - COALESCE((SELECT SUM(amount) FROM delivery_deductions WHERE order_id = $1), 0)),
        updated_at = NOW()
      WHERE id = $1
    `, [orderId]);
  }

  return deliveryDeductionFromRow(result.rows[0]);
}

async function recordDeliveryDeductionForDriverStop(stopId, driverId, input = {}) {
  const cleanedStopId = cleanRepositoryText(stopId, 160);
  const cleanedDriverId = cleanRepositoryText(driverId, 120);
  if (!cleanedStopId || !cleanedDriverId) {
    const error = new Error('stopId and driverId are required.');
    error.status = 400;
    throw error;
  }

  const stopResult = await postgres.query(`
    SELECT stop.*
    FROM daily_route_stops AS stop
    JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
    WHERE stop.id = $1
      AND manifest.assigned_driver_id = $2
    LIMIT 1
  `, [cleanedStopId, cleanedDriverId]);
  const stop = stopResult.rows[0] ? routeStopFromRow(stopResult.rows[0]) : null;
  if (!stop) return null;

  let orderId = cleanRepositoryText(input.orderId || input.order_id, 160) || null;
  let orderItemId = cleanRepositoryText(input.orderItemId || input.order_item_id, 160) || null;
  let sku = cleanRepositoryText(input.sku || input.SKU, 120) || null;
  let productName = cleanRepositoryText(input.productName || input.product_name, 240) || null;

  if (orderItemId) {
    const itemResult = await postgres.query(`
      SELECT item.*, ord.id AS verified_order_id
      FROM account_order_items AS item
      JOIN account_orders AS ord ON ord.id = item.order_id
      WHERE item.id = $1
        AND ord.route_stop_id = $2
      LIMIT 1
    `, [orderItemId, cleanedStopId]);
    const itemRow = itemResult.rows[0];
    if (!itemRow) {
      const error = new Error('Order item does not belong to this assigned stop.');
      error.status = 400;
      throw error;
    }
    orderId = itemRow.verified_order_id;
    sku = sku || itemRow.sku || null;
    productName = productName || itemRow.product_name || null;
  } else if (orderId) {
    const orderResult = await postgres.query(`
      SELECT id
      FROM account_orders
      WHERE id = $1
        AND route_stop_id = $2
      LIMIT 1
    `, [orderId, cleanedStopId]);
    if (!orderResult.rows[0]) {
      const error = new Error('Order does not belong to this assigned stop.');
      error.status = 400;
      throw error;
    }
  } else {
    const orderResult = await postgres.query(`
      SELECT id
      FROM account_orders
      WHERE route_stop_id = $1
      ORDER BY COALESCE(delivery_date, order_date) DESC, created_at DESC
      LIMIT 1
    `, [cleanedStopId]);
    orderId = orderResult.rows[0]?.id || null;
  }

  return recordDeliveryDeduction({
    ...input,
    accountNumber: stop.accountNumber,
    routeStopId: stop.id,
    orderId,
    orderItemId,
    sku,
    productName,
    createdBy: cleanedDriverId,
    raw: {
      ...(input.raw || {}),
      source: 'driver_stop_deduction',
      driverId: cleanedDriverId,
      stopId: stop.id,
      manifestId: stop.manifestId
    }
  });
}

async function getAccountProductSummary(accountNumber, options = {}) {
  const cleanedAccountNumber = cleanRepositoryText(accountNumber, 120);
  if (!cleanedAccountNumber) {
    const error = new Error('accountNumber is required.');
    error.status = 400;
    throw error;
  }

  const periodDays = normalizeLimit(options.periodDays, 180, 1095);
  const totalsResult = await postgres.query(`
    SELECT
      account_number,
      MAX(account_name) AS account_name,
      COUNT(*)::int AS order_count,
      COALESCE(SUM(subtotal_amount), 0) AS subtotal_amount,
      COALESCE(SUM(deduction_amount), 0) AS deduction_amount,
      COALESCE(SUM(net_amount), 0) AS net_amount,
      MIN(COALESCE(delivery_date, order_date)) AS first_order_date,
      MAX(COALESCE(delivery_date, order_date)) AS last_order_date
    FROM account_orders
    WHERE account_number = $1
      AND COALESCE(delivery_date, order_date, CURRENT_DATE) >= CURRENT_DATE - ($2::int * INTERVAL '1 day')
    GROUP BY account_number
  `, [cleanedAccountNumber, periodDays]);

  const topProductsResult = await postgres.query(`
    SELECT
      item.sku,
      item.product_name,
      MAX(item.brand) AS brand,
      MAX(item.category) AS category,
      COALESCE(SUM(item.quantity), 0) AS quantity,
      COALESCE(SUM(item.gross_amount), 0) AS gross_amount,
      COALESCE(SUM(item.deduction_amount), 0) AS deduction_amount,
      COALESCE(SUM(item.net_amount), 0) AS net_amount
    FROM account_order_items AS item
    JOIN account_orders AS ord ON ord.id = item.order_id
    WHERE ord.account_number = $1
      AND COALESCE(ord.delivery_date, ord.order_date, CURRENT_DATE) >= CURRENT_DATE - ($2::int * INTERVAL '1 day')
    GROUP BY item.sku, item.product_name
    ORDER BY net_amount DESC, quantity DESC
    LIMIT 10
  `, [cleanedAccountNumber, periodDays]);

  const deductionReasonsResult = await postgres.query(`
    SELECT
      reason,
      COUNT(*)::int AS count,
      COALESCE(SUM(quantity), 0) AS quantity,
      COALESCE(SUM(amount), 0) AS amount
    FROM delivery_deductions
    WHERE account_number = $1
      AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
    GROUP BY reason
    ORDER BY amount DESC, count DESC
    LIMIT 10
  `, [cleanedAccountNumber, periodDays]);

  const recentOrders = await listAccountOrders({ accountNumber: cleanedAccountNumber, limit: 10 });
  const totals = totalsResult.rows[0] || {
    account_number: cleanedAccountNumber,
    account_name: null,
    order_count: 0,
    subtotal_amount: 0,
    deduction_amount: 0,
    net_amount: 0,
    first_order_date: null,
    last_order_date: null
  };

  return {
    accountNumber: cleanedAccountNumber,
    accountName: totals.account_name || null,
    periodDays,
    orderCount: Number(totals.order_count) || 0,
    subtotalAmount: normalizeMoney(totals.subtotal_amount),
    deductionAmount: normalizeMoney(totals.deduction_amount),
    netAmount: normalizeMoney(totals.net_amount),
    firstOrderDate: toDateOnly(totals.first_order_date),
    lastOrderDate: toDateOnly(totals.last_order_date),
    topProducts: topProductsResult.rows.map((row) => ({
      sku: row.sku || null,
      productName: row.product_name,
      brand: row.brand || null,
      category: row.category || null,
      quantity: normalizeQuantity(row.quantity),
      grossAmount: normalizeMoney(row.gross_amount),
      deductionAmount: normalizeMoney(row.deduction_amount),
      netAmount: normalizeMoney(row.net_amount)
    })),
    deductionReasons: deductionReasonsResult.rows.map((row) => ({
      reason: row.reason,
      count: Number(row.count) || 0,
      quantity: normalizeQuantity(row.quantity),
      amount: normalizeMoney(row.amount)
    })),
    recentOrders
  };
}

async function generateAccountInsight(accountNumber, options = {}) {
  const summary = await getAccountProductSummary(accountNumber, options);
  const topProduct = summary.topProducts[0] || null;
  const deductionRate = summary.subtotalAmount > 0 ? summary.deductionAmount / summary.subtotalAmount : 0;
  const title = summary.orderCount
    ? `${summary.accountName || summary.accountNumber} account purchase summary`
    : `${summary.accountNumber} has no recorded order history`;
  const parts = [];

  if (summary.orderCount) {
    parts.push(`Recorded ${summary.orderCount} order${summary.orderCount === 1 ? '' : 's'} over the last ${summary.periodDays} days.`);
    parts.push(`Net account spend is $${summary.netAmount.toFixed(2)} after $${summary.deductionAmount.toFixed(2)} in deductions.`);
  } else {
    parts.push('No product-level purchase history has been recorded for this account yet.');
  }
  if (topProduct) {
    parts.push(`Highest-value product is ${topProduct.productName} with $${topProduct.netAmount.toFixed(2)} in net spend.`);
  }
  if (deductionRate >= 0.05) {
    parts.push(`Deduction rate is ${(deductionRate * 100).toFixed(1)}%, which should be reviewed before the next delivery.`);
  }

  const insight = {
    id: generateRepositoryId('insight'),
    accountNumber: summary.accountNumber,
    insightType: 'account_product_summary',
    title,
    summary: parts.join(' '),
    confidence: summary.orderCount >= 5 ? 'high' : summary.orderCount > 0 ? 'medium' : 'low',
    sourcePeriodStart: null,
    sourcePeriodEnd: summary.lastOrderDate || null,
    generatedBy: cleanRepositoryText(options.generatedBy || options.generated_by, 120) || 'rules_engine_v1',
    raw: { summary }
  };

  const result = await postgres.query(`
    INSERT INTO account_ai_insights (
      id, account_number, insight_type, title, summary, confidence,
      source_period_start, source_period_end, generated_by, status, raw, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, 'active', $10::jsonb, NOW())
    RETURNING *
  `, [
    insight.id,
    insight.accountNumber,
    insight.insightType,
    insight.title,
    insight.summary,
    insight.confidence,
    insight.sourcePeriodStart,
    insight.sourcePeriodEnd,
    insight.generatedBy,
    JSON.stringify(insight.raw)
  ]);

  return accountAiInsightFromRow(result.rows[0]);
}

async function listAccountInsights(options = {}) {
  const limit = normalizeLimit(options.limit, 50, 200);
  const values = [];
  const where = [];

  if (options.accountNumber) {
    values.push(cleanRepositoryText(options.accountNumber, 120));
    where.push(`account_number = $${values.length}`);
  }
  if (options.insightType) {
    values.push(cleanRepositoryText(options.insightType, 120));
    where.push(`insight_type = $${values.length}`);
  }
  if (options.status) {
    values.push(cleanRepositoryText(options.status, 80));
    where.push(`status = $${values.length}`);
  } else {
    where.push("status = 'active'");
  }

  values.push(limit);
  const result = await postgres.query(`
    SELECT *
    FROM account_ai_insights
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
    LIMIT $${values.length}
  `, values);
  return result.rows.map(accountAiInsightFromRow);
}

async function saveAiInteractionLog(input = {}) {
  const result = await postgres.query(`
    INSERT INTO ai_interaction_logs (
      id, endpoint, requester_type, requester_id, account_number,
      route_manifest_id, route_stop_id, model, status, input_summary,
      output_summary, error_message, latency_ms
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10::jsonb,
      $11::jsonb, $12, $13
    )
    RETURNING *
  `, [
    cleanRepositoryText(input.id, 160) || generateRepositoryId('ai_log'),
    cleanRepositoryText(input.endpoint, 160),
    cleanRepositoryText(input.requesterType || input.requester_type, 80) || null,
    cleanRepositoryText(input.requesterId || input.requester_id, 160) || null,
    cleanRepositoryText(input.accountNumber || input.account_number, 120) || null,
    cleanRepositoryText(input.routeManifestId || input.route_manifest_id, 160) || null,
    cleanRepositoryText(input.routeStopId || input.route_stop_id, 160) || null,
    cleanRepositoryText(input.model, 120) || null,
    cleanRepositoryText(input.status, 80) || 'unknown',
    JSON.stringify(input.inputSummary || input.input_summary || {}),
    JSON.stringify(input.outputSummary || input.output_summary || {}),
    cleanRepositoryText(input.errorMessage || input.error_message, 1000) || null,
    Number.isFinite(Number(input.latencyMs ?? input.latency_ms)) ? Math.max(0, Math.round(Number(input.latencyMs ?? input.latency_ms))) : null
  ]);
  return aiInteractionLogFromRow(result.rows[0]);
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
  getAccountOrder,
  getAccountProductSummary,
  getDailyRouteManifest,
  getDailyRouteManifestWithAccountIntelligence,
  getDriver,
  getStaticHazardLocationBackfillStats,
  getRouteSessionAnalytics,
  isDatabaseEnabled,
  isPostgisEnabled,
  generateAccountInsight,
  listAccountInsights,
  listAccountOrders,
  listAdminUsers,
  listDailyRouteManifests,
  listDrivers,
  listProducts,
  listUndeliveredRouteStops,
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
  saveAiInteractionLog,
  saveRecentDestination,
  saveRouteSession,
  recordDeliveryDeduction,
  recordDeliveryDeductionForDriverStop,
  recordAdminUserLogin,
  setAdminUserActive,
  setDriverActive,
  swapDailyRouteAssignments,
  updateRouteSessionReview,
  updateStaticHazardVerification,
  updateDailyRouteStopStatusForDriver,
  updateUndeliveredStopDisposition,
  upsertProduct,
  upsertAdminUser,
  createAccountOrder,
  upsertDailyRouteManifest,
  upsertDriver,
  upsertDeliveryNote,
  upsertManualHazard,
  upsertStaticBridge,
  upsertStaticZone,
  replaceDailyRouteStops
};
