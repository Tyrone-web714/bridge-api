const crypto = require('crypto');
const postgres = require('./postgres');
const branding = require('../services/branding');
const censusServiceAreaPlaces = require('../data/census_service_area_places.json');

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

function assignedDriverIdMatchesSql(columnSql, parameterSql) {
  return `LOWER(TRIM(${columnSql})) = LOWER(TRIM(${parameterSql}))`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function deliveryNoteFromRow(row) {
  return {
    id: row.id,
    accountNumber: row.account_number || null,
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
    pinConfigured: Boolean(row.pin_hash),
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
    mainText: row.description || '',
    secondaryText: '',
    name: '',
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
    barcodes: asArray(row.barcodes).map((value) => String(value || '').trim()).filter(Boolean),
    raw: row.raw || {},
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function customerAccountFromRow(row) {
  if (!row) return null;
  return {
    accountNumber: row.account_number,
    accountName: row.account_name,
    address: row.address || null,
    city: row.city || null,
    stateCode: row.state_code || null,
    postalCode: row.postal_code || null,
    phone: row.phone || null,
    territory: row.territory || null,
    routeGroup: row.route_group || null,
    distributionCenter: row.distribution_center || null,
    active: row.active !== false,
    raw: row.raw || {},
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function dataImportBatchFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    importType: row.import_type,
    sourceFileName: row.source_file_name || null,
    status: row.status,
    rowCount: Number(row.row_count) || 0,
    importedCount: Number(row.imported_count) || 0,
    warningCount: Number(row.warning_count) || 0,
    summary: row.summary || {},
    importedBy: row.imported_by || null,
    createdAt: toIsoString(row.created_at),
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

function deliverySettlementItemFromRow(row) {
  return {
    id: row.id,
    settlementId: row.settlement_id,
    orderItemId: row.order_item_id || null,
    sku: row.sku || null,
    productName: row.product_name,
    brand: row.brand || null,
    packageSize: row.package_size || null,
    category: row.category || null,
    plannedQuantity: normalizeQuantity(row.planned_quantity),
    deliveredQuantity: normalizeQuantity(row.delivered_quantity),
    rejectedQuantity: normalizeQuantity(row.rejected_quantity),
    damagedQuantity: normalizeQuantity(row.damaged_quantity),
    missingQuantity: normalizeQuantity(row.missing_quantity),
    returnedQuantity: normalizeQuantity(row.returned_quantity),
    addedQuantity: normalizeQuantity(row.added_quantity),
    unitPrice: normalizeMoney(row.unit_price),
    finalAmount: normalizeMoney(row.final_amount),
    adjustmentReason: row.adjustment_reason || null,
    notes: row.notes || null,
    raw: row.raw || {},
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function deliverySettlementFromRow(row, items = []) {
  if (!row) return null;
  return {
    id: row.id,
    routeStopId: row.route_stop_id,
    orderId: row.order_id || null,
    driverId: row.driver_id,
    status: row.status || 'draft',
    completionStatus: row.completion_status || null,
    nonDeliveryReason: row.non_delivery_reason || null,
    plannedQuantity: normalizeQuantity(row.planned_quantity),
    deliveredQuantity: normalizeQuantity(row.delivered_quantity),
    rejectedQuantity: normalizeQuantity(row.rejected_quantity),
    damagedQuantity: normalizeQuantity(row.damaged_quantity),
    missingQuantity: normalizeQuantity(row.missing_quantity),
    returnedQuantity: normalizeQuantity(row.returned_quantity),
    addedQuantity: normalizeQuantity(row.added_quantity),
    plannedAmount: normalizeMoney(row.planned_amount),
    finalAmount: normalizeMoney(row.final_amount),
    taxAmount: normalizeMoney(row.tax_amount),
    totalAmount: normalizeMoney(row.total_amount),
    paymentMethod: row.payment_method || null,
    amountPaid: normalizeMoney(row.amount_paid),
    unpaidBalance: normalizeMoney(row.unpaid_balance),
    customerSignature: row.customer_signature || null,
    driverSignature: row.driver_signature || null,
    supervisorReviewRequired: row.supervisor_review_required === true,
    notes: row.notes || null,
    completedAt: toIsoString(row.completed_at),
    raw: row.raw || {},
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    items
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
    reviewedBy: row.reviewed_by || null,
    reviewedAt: toIsoString(row.reviewed_at),
    reviewNotes: row.review_notes || null,
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
    providerRequestId: row.provider_request_id || null,
    inputTokens: row.input_tokens ?? null,
    outputTokens: row.output_tokens ?? null,
    totalTokens: row.total_tokens ?? null,
    estimatedCostUsd: row.estimated_cost_usd === null || row.estimated_cost_usd === undefined
      ? null
      : Number(row.estimated_cost_usd),
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
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  const parsed = Number(String(value ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : fallback;
}

function normalizeQuantity(value, fallback = 0) {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : fallback;
}

function cleanRepositoryText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeOperationalCode(value, maxLength = 80) {
  return cleanRepositoryText(value, maxLength)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeTextList(value, maxItems = 500, itemLength = 160) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values
    .map((item) => cleanRepositoryText(item, itemLength))
    .filter(Boolean))]
    .slice(0, maxItems);
}

function readInputField(source, names = []) {
  if (!source || typeof source !== 'object') return undefined;
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(source, name)) return source[name];
  }
  const normalized = new Map(
    Object.keys(source).map((key) => [String(key).replace(/[\s_-]+/g, '').toLowerCase(), source[key]])
  );
  for (const name of names) {
    const key = String(name).replace(/[\s_-]+/g, '').toLowerCase();
    if (normalized.has(key)) return normalized.get(key);
  }
  return undefined;
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

async function getDriverAuthRecord(driverId) {
  const cleanedDriverId = String(driverId || '').trim();
  if (!cleanedDriverId) return null;

  const result = await postgres.query(`
    SELECT driver_id, driver_name, active, pin_hash
    FROM drivers
    WHERE driver_id = $1
  `, [cleanedDriverId]);
  return result.rows[0] || null;
}

async function setDriverPinHash(driverId, pinHash, actor = 'supervisor') {
  const cleanedDriverId = String(driverId || '').trim();
  if (!cleanedDriverId || !pinHash) return null;

  const result = await postgres.query(`
    UPDATE drivers
    SET pin_hash = $2, updated_by = $3, updated_at = NOW()
    WHERE driver_id = $1
    RETURNING *
  `, [cleanedDriverId, pinHash, String(actor || 'supervisor').trim() || 'supervisor']);
  await postgres.query(`
    UPDATE driver_sessions
    SET revoked_at = NOW()
    WHERE driver_id = $1 AND revoked_at IS NULL
  `, [cleanedDriverId]);
  return result.rows[0] ? driverFromRow(result.rows[0]) : null;
}

async function createDriverSession(session) {
  await postgres.query(`
    UPDATE driver_sessions
    SET revoked_at = NOW()
    WHERE driver_id = $1 AND device_id = $2 AND revoked_at IS NULL
  `, [session.driverId, session.deviceId]);

  const result = await postgres.query(`
    INSERT INTO driver_sessions (
      id, driver_id, device_id, token_hash, created_at, expires_at, last_used_at
    )
    VALUES ($1, $2, $3, $4, NOW(), $5, NOW())
    RETURNING *
  `, [
    session.id,
    session.driverId,
    session.deviceId,
    session.tokenHash,
    session.expiresAt
  ]);
  return result.rows[0] || null;
}

async function getActiveDriverSession(tokenHash) {
  const result = await postgres.query(`
    SELECT
      session.id,
      session.driver_id,
      session.device_id,
      session.expires_at,
      driver.driver_name,
      driver.active
    FROM driver_sessions session
    JOIN drivers driver ON driver.driver_id = session.driver_id
    WHERE session.token_hash = $1
      AND session.revoked_at IS NULL
      AND session.expires_at > NOW()
      AND driver.active = true
    LIMIT 1
  `, [String(tokenHash || '')]);
  const session = result.rows[0] || null;
  if (session) {
    await postgres.query(
      'UPDATE driver_sessions SET last_used_at = NOW() WHERE id = $1',
      [session.id]
    );
  }
  return session;
}

async function revokeDriverSession(tokenHash) {
  const result = await postgres.query(`
    UPDATE driver_sessions
    SET revoked_at = NOW()
    WHERE token_hash = $1 AND revoked_at IS NULL
    RETURNING id
  `, [String(tokenHash || '')]);
  return Boolean(result.rows[0]);
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
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, NOW(), NOW())
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

  if (active !== true) {
    await postgres.query(`
      UPDATE driver_sessions
      SET revoked_at = NOW()
      WHERE driver_id = $1 AND revoked_at IS NULL
    `, [cleanedDriverId]);
  }

  return result.rows[0] ? driverFromRow(result.rows[0]) : null;
}

async function deleteDriver(driverId) {
  const cleanedDriverId = String(driverId || '').trim();
  if (!cleanedDriverId) return null;

  const result = await postgres.query(`
    DELETE FROM drivers
    WHERE driver_id = $1
    RETURNING *
  `, [cleanedDriverId]);

  return result.rows[0] ? driverFromRow(result.rows[0]) : null;
}

async function upsertDeliveryNote(note) {
  await postgres.query(`
    INSERT INTO delivery_notes (
      id, account_number, place_id, destination, address, account_name, customer_name,
      instructions, driver_name, route_context, photos, created_at, updated_at, raw
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      account_number = EXCLUDED.account_number,
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
    note.accountNumber || null,
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
  const persistedRecord = {
    placeId: destination.placeId || null,
    description: destination.description,
    savedAt: destination.savedAt || new Date().toISOString()
  };

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
      main_text = NULL,
      secondary_text = NULL,
      photo_url = NULL,
      place_photo_url = NULL,
      street_view_url = NULL,
      photo_source = NULL,
      phone_number = NULL,
      international_phone_number = NULL,
      name = NULL,
      saved_at = EXCLUDED.saved_at,
      raw = EXCLUDED.raw
  `, [
    key,
    destination.placeId || null,
    destination.description,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    destination.savedAt || new Date().toISOString(),
    JSON.stringify(persistedRecord)
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
    null,
    null,
    JSON.stringify({}),
    JSON.stringify({}),
    JSON.stringify(session.usedTruckProfile || {}),
    JSON.stringify(session.usedTuning || {}),
    JSON.stringify([]),
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
  const limit = normalizeLimit(options.limit, 2500, 5000);
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

function deliveryDocumentFromRow(row) {
  return {
    id: row.id,
    routeStopId: row.route_stop_id,
    orderId: row.order_id || null,
    settlementId: row.settlement_id || null,
    accountNumber: row.account_number || null,
    documentType: row.document_type,
    documentNumber: row.document_number,
    driverId: row.driver_id,
    driverName: row.driver_name || null,
    payload: row.payload || {},
    createdAt: toIsoString(row.created_at),
    expiresAt: toIsoString(row.expires_at)
  };
}

async function purgeExpiredDeliveryDocuments() {
  await postgres.query('DELETE FROM delivery_documents WHERE expires_at <= NOW()');
}

async function saveDeliveryDocument(input = {}) {
  await purgeExpiredDeliveryDocuments();
  const routeStopId = cleanRepositoryText(input.routeStopId, 160);
  const documentType = cleanRepositoryText(input.documentType, 40).toLowerCase();
  const driverId = cleanRepositoryText(input.driverId, 120);
  if (!routeStopId || !driverId || !['delivery_order', 'receipt'].includes(documentType)) {
    const error = new Error('routeStopId, driverId, and a valid documentType are required.');
    error.status = 400;
    throw error;
  }

  const documentNumber = cleanRepositoryText(input.documentNumber, 160)
    || `${documentType === 'receipt' ? 'RCPT' : 'ORDER'}-${Date.now()}`;
  const id = cleanRepositoryText(input.id, 160)
    || stableRepositoryId('delivery_document', [routeStopId, documentType, documentNumber]);
  const result = await postgres.query(`
    INSERT INTO delivery_documents (
      id, route_stop_id, order_id, settlement_id, account_number,
      document_type, document_number, driver_id, driver_name, payload,
      created_at, expires_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10::jsonb,
      NOW(), NOW() + INTERVAL '14 days'
    )
    ON CONFLICT (document_number) DO UPDATE SET
      settlement_id = EXCLUDED.settlement_id,
      driver_id = EXCLUDED.driver_id,
      driver_name = EXCLUDED.driver_name,
      payload = EXCLUDED.payload,
      expires_at = NOW() + INTERVAL '14 days'
    RETURNING *
  `, [
    id,
    routeStopId,
    input.orderId || null,
    input.settlementId || null,
    input.accountNumber || null,
    documentType,
    documentNumber,
    driverId,
    input.driverName || null,
    JSON.stringify(input.payload || {})
  ]);
  return deliveryDocumentFromRow(result.rows[0]);
}

async function listDeliveryDocumentsForDriverStop(stopId, driverId) {
  await purgeExpiredDeliveryDocuments();
  const result = await postgres.query(`
    SELECT document.*
    FROM delivery_documents AS document
    JOIN daily_route_stops AS stop ON stop.id = document.route_stop_id
    JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
    WHERE document.route_stop_id = $1
      AND ${assignedDriverIdMatchesSql('manifest.assigned_driver_id', '$2')}
      AND document.expires_at > NOW()
      AND (
        document.document_type <> 'receipt'
        OR document.created_at > NOW() - INTERVAL '24 hours'
      )
    ORDER BY document.created_at DESC
  `, [cleanRepositoryText(stopId, 160), cleanRepositoryText(driverId, 120)]);
  return result.rows.map(deliveryDocumentFromRow);
}

async function listDeliveryDocumentsForAdmin(options = {}) {
  await purgeExpiredDeliveryDocuments();
  const values = [];
  const where = ['document.expires_at > NOW()'];
  const routeDate = toDateOnly(options.routeDate);
  const accountNumber = cleanRepositoryText(options.accountNumber, 120);
  if (routeDate) {
    values.push(routeDate);
    where.push(`manifest.route_date = $${values.length}`);
  }
  if (accountNumber) {
    values.push(accountNumber);
    where.push(`document.account_number = $${values.length}`);
  }
  values.push(Math.min(Math.max(Number(options.limit) || 200, 1), 1000));
  const result = await postgres.query(`
    SELECT
      document.*,
      stop.account_name,
      stop.destination_address,
      manifest.route_date,
      manifest.route_number
    FROM delivery_documents AS document
    JOIN daily_route_stops AS stop ON stop.id = document.route_stop_id
    JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
    WHERE ${where.join(' AND ')}
    ORDER BY document.created_at DESC
    LIMIT $${values.length}
  `, values);
  return result.rows.map((row) => ({
    ...deliveryDocumentFromRow(row),
    accountName: row.account_name || null,
    destinationAddress: row.destination_address || null,
    routeDate: toDateOnly(row.route_date),
    routeNumber: row.route_number || null
  }));
}

function routeCloseoutDocumentFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    manifestId: row.manifest_id,
    documentType: 'route_closeout',
    documentNumber: row.document_number,
    driverId: row.driver_id,
    driverName: row.driver_name || null,
    payload: row.payload || {},
    routeDate: toDateOnly(row.route_date || row.payload?.routeDate),
    routeNumber: row.route_number || row.payload?.routeNumber || null,
    createdAt: toIsoString(row.created_at),
    expiresAt: toIsoString(row.expires_at)
  };
}

async function purgeExpiredRouteCloseoutDocuments() {
  await postgres.query('DELETE FROM route_closeout_documents WHERE expires_at <= NOW()');
}

async function saveRouteCloseoutDocument(input = {}) {
  await purgeExpiredRouteCloseoutDocuments();
  const manifestId = cleanRepositoryText(input.manifestId, 160);
  const driverId = cleanRepositoryText(input.driverId, 120);
  if (!manifestId || !driverId) {
    const error = new Error('manifestId and driverId are required for a route closeout document.');
    error.status = 400;
    throw error;
  }

  const documentNumber = cleanRepositoryText(input.documentNumber, 160)
    || `TURNIN-${Date.now()}`;
  const id = cleanRepositoryText(input.id, 160)
    || stableRepositoryId('route_closeout_document', [manifestId]);
  const result = await postgres.query(`
    INSERT INTO route_closeout_documents (
      id, manifest_id, document_number, driver_id, driver_name, payload,
      created_at, expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW() + INTERVAL '14 days')
    ON CONFLICT (manifest_id) DO UPDATE SET
      document_number = EXCLUDED.document_number,
      driver_id = EXCLUDED.driver_id,
      driver_name = EXCLUDED.driver_name,
      payload = EXCLUDED.payload,
      expires_at = NOW() + INTERVAL '14 days'
    RETURNING *
  `, [
    id,
    manifestId,
    documentNumber,
    driverId,
    input.driverName || null,
    JSON.stringify(input.payload || {})
  ]);
  return routeCloseoutDocumentFromRow(result.rows[0]);
}

async function getRouteCloseoutDocumentForDriver(manifestId, driverId) {
  await purgeExpiredRouteCloseoutDocuments();
  const result = await postgres.query(`
    SELECT document.*, manifest.route_date, manifest.route_number
    FROM route_closeout_documents AS document
    JOIN daily_route_manifests AS manifest ON manifest.id = document.manifest_id
    WHERE document.manifest_id = $1
      AND ${assignedDriverIdMatchesSql('manifest.assigned_driver_id', '$2')}
      AND document.expires_at > NOW()
      AND document.created_at > NOW() - INTERVAL '24 hours'
    LIMIT 1
  `, [
    cleanRepositoryText(manifestId, 160),
    cleanRepositoryText(driverId, 120)
  ]);
  return routeCloseoutDocumentFromRow(result.rows[0]);
}

async function listRouteCloseoutDocumentsForAdmin(options = {}) {
  await purgeExpiredRouteCloseoutDocuments();
  const values = [];
  const where = ['document.expires_at > NOW()'];
  const routeDate = toDateOnly(options.routeDate);
  if (routeDate) {
    values.push(routeDate);
    where.push(`manifest.route_date = $${values.length}`);
  }
  values.push(Math.min(Math.max(Number(options.limit) || 200, 1), 1000));
  const result = await postgres.query(`
    SELECT document.*, manifest.route_date, manifest.route_number
    FROM route_closeout_documents AS document
    JOIN daily_route_manifests AS manifest ON manifest.id = document.manifest_id
    WHERE ${where.join(' AND ')}
    ORDER BY document.created_at DESC
    LIMIT $${values.length}
  `, values);
  return result.rows.map(routeCloseoutDocumentFromRow);
}

function routeInventoryCloseoutFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    manifestId: row.manifest_id,
    documentType: 'final_inventory_closeout',
    documentNumber: row.document_number,
    driverId: row.driver_id,
    driverName: row.driver_name || null,
    status: row.status,
    supervisorStatus: row.supervisor_status,
    loadedQuantity: normalizeQuantity(row.loaded_quantity),
    deliveredQuantity: normalizeQuantity(row.delivered_quantity),
    sellableQuantity: normalizeQuantity(row.sellable_quantity),
    returnedQuantity: normalizeQuantity(row.returned_quantity),
    damagedQuantity: normalizeQuantity(row.damaged_quantity),
    missingQuantity: normalizeQuantity(row.missing_quantity),
    addedQuantity: normalizeQuantity(row.added_quantity),
    rejectedQuantity: normalizeQuantity(row.rejected_quantity),
    unaccountedQuantity: normalizeQuantity(row.unaccounted_quantity),
    items: asArray(row.items),
    notes: row.notes || null,
    payload: row.payload || {},
    printConfirmationToken: row.print_confirmation_token || null,
    printRequestedAt: toIsoString(row.print_requested_at),
    printedAt: toIsoString(row.printed_at),
    actualDurationMinutes: row.actual_duration_minutes == null ? null : Number(row.actual_duration_minutes),
    reviewedBy: row.reviewed_by || null,
    reviewedAt: toIsoString(row.reviewed_at),
    reviewNotes: row.review_notes || null,
    archivedBy: row.archived_by || null,
    archivedAt: toIsoString(row.archived_at),
    routeDate: toDateOnly(row.route_date || row.payload?.routeDate),
    routeNumber: row.route_number || row.payload?.routeNumber || null,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

async function getRouteReturnInventorySummary(manifestId, driverId) {
  const cleanedManifestId = cleanRepositoryText(manifestId, 160);
  const cleanedDriverId = cleanRepositoryText(driverId, 120);
  const result = await postgres.query(`
    SELECT
      confirmation.inventory AS departure_inventory,
      confirmation.printed_at AS departure_printed_at,
      COALESCE((
        SELECT SUM(settlement.delivered_quantity + settlement.added_quantity)
        FROM delivery_settlements AS settlement
        JOIN daily_route_stops AS stop ON stop.id = settlement.route_stop_id
        WHERE stop.manifest_id = $1
      ), 0) AS delivered_quantity,
      COALESCE((
        SELECT SUM(addition.quantity)
        FROM route_truck_inventory_additions AS addition
        WHERE addition.manifest_id = $1
          AND ${assignedDriverIdMatchesSql('addition.driver_id', '$2')}
          AND confirmation.printed_at IS NOT NULL
          AND addition.created_at > confirmation.printed_at
      ), 0) AS added_after_departure_quantity
    FROM daily_route_manifests AS manifest
    LEFT JOIN route_departure_inventory_confirmations AS confirmation
      ON confirmation.manifest_id = manifest.id
      AND ${assignedDriverIdMatchesSql('confirmation.driver_id', '$2')}
    WHERE manifest.id = $1
      AND ${assignedDriverIdMatchesSql('manifest.assigned_driver_id', '$2')}
    LIMIT 1
  `, [cleanedManifestId, cleanedDriverId]);
  const row = result.rows[0] || {};
  const departureInventory = asArray(row.departure_inventory);
  const departureQuantity = normalizeQuantity(departureInventory.reduce((total, item) => (
    total + normalizeQuantity(
      item.expectedOnTruckQuantity,
      normalizeQuantity(item.plannedQuantity) + normalizeQuantity(item.addedQuantity)
    )
  ), 0));
  const deliveredQuantity = normalizeQuantity(row.delivered_quantity);
  const addedAfterDepartureQuantity = normalizeQuantity(row.added_after_departure_quantity);
  return {
    departureInventory,
    departurePrintedAt: toIsoString(row.departure_printed_at),
    departureQuantity,
    deliveredQuantity,
    addedAfterDepartureQuantity,
    expectedReturnQuantity: normalizeQuantity(
      departureQuantity + addedAfterDepartureQuantity - deliveredQuantity
    )
  };
}

async function prepareRouteInventoryCloseoutForDriver(manifestId, driverId, input = {}) {
  const cleanedManifestId = cleanRepositoryText(manifestId, 160);
  const cleanedDriverId = cleanRepositoryText(driverId, 120);
  if (!cleanedManifestId || !cleanedDriverId) {
    const error = new Error('manifestId and driverId are required to prepare final inventory closeout.');
    error.status = 400;
    throw error;
  }

  const routeResult = await postgres.query(`
    SELECT manifest.*
    FROM daily_route_manifests AS manifest
    JOIN drivers AS driver
      ON ${assignedDriverIdMatchesSql('driver.driver_id', 'manifest.assigned_driver_id')}
      AND driver.active = true
    WHERE manifest.id = $1
      AND ${assignedDriverIdMatchesSql('manifest.assigned_driver_id', '$2')}
      AND manifest.status IN ('completed', 'completed_with_exceptions')
      AND NOT EXISTS (
        SELECT 1
        FROM daily_route_stops AS stop
        WHERE stop.manifest_id = manifest.id
          AND stop.status NOT IN ('completed', 'departed', 'skipped', 'undelivered')
      )
    LIMIT 1
  `, [cleanedManifestId, cleanedDriverId]);
  const routeRow = routeResult.rows[0];
  if (!routeRow) return null;

  const existingResult = await postgres.query(
    'SELECT * FROM route_inventory_closeouts WHERE manifest_id = $1 LIMIT 1',
    [cleanedManifestId]
  );
  if (existingResult.rows[0]?.printed_at) {
    const error = new Error('Final inventory closeout has already been printed and completed.');
    error.status = 409;
    throw error;
  }

  const returnSummary = await getRouteReturnInventorySummary(cleanedManifestId, cleanedDriverId);
  if (!returnSummary.departurePrintedAt) {
    const error = new Error('A confirmed and printed departure inventory is required before the return inspection.');
    error.status = 409;
    throw error;
  }
  const loadedQuantity = returnSummary.departureQuantity;
  const deliveredQuantity = returnSummary.deliveredQuantity;
  const addedQuantity = returnSummary.addedAfterDepartureQuantity;
  const sellableQuantity = normalizeQuantity(input.sellableQuantity || input.sellable_quantity);
  const returnedQuantity = normalizeQuantity(input.returnedQuantity || input.returned_quantity);
  const damagedQuantity = normalizeQuantity(input.damagedQuantity || input.damaged_quantity);
  const missingQuantity = normalizeQuantity(input.missingQuantity || input.missing_quantity);
  const rejectedQuantity = normalizeQuantity(input.rejectedQuantity || input.rejected_quantity);
  const accountedQuantity = deliveredQuantity + sellableQuantity + returnedQuantity
    + damagedQuantity + missingQuantity + rejectedQuantity;
  const availableQuantity = loadedQuantity + addedQuantity;
  const discrepancyQuantity = Math.round((availableQuantity - accountedQuantity) * 100) / 100;
  const unaccountedQuantity = Math.abs(discrepancyQuantity);
  const discrepancyStatus = Math.abs(discrepancyQuantity) < 0.001
    ? 'balanced'
    : (discrepancyQuantity > 0 ? 'shortage' : 'overage');
  const notes = cleanRepositoryText(input.notes, 2000) || null;
  const items = asArray(input.items).map((item) => ({
    sku: cleanRepositoryText(item.sku, 120) || null,
    productName: cleanRepositoryText(item.productName || item.product_name, 240) || null,
    sellableQuantity: normalizeQuantity(item.sellableQuantity || item.sellable_quantity),
    returnedQuantity: normalizeQuantity(item.returnedQuantity || item.returned_quantity),
    damagedQuantity: normalizeQuantity(item.damagedQuantity || item.damaged_quantity),
    missingQuantity: normalizeQuantity(item.missingQuantity || item.missing_quantity),
    addedQuantity: normalizeQuantity(item.addedQuantity || item.added_quantity),
    rejectedQuantity: normalizeQuantity(item.rejectedQuantity || item.rejected_quantity),
    notes: cleanRepositoryText(item.notes, 500) || null
  }));
  const printRequestedAt = new Date().toISOString();
  const printConfirmationToken = crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(24).toString('hex');
  const documentNumber = `INV-CLOSEOUT-${toDateOnly(routeRow.route_date)}-${routeRow.route_number}`;
  const payload = {
    brand: branding.organizationName,
    documentType: 'final_inventory_closeout',
    driver: {
      id: cleanedDriverId,
      name: routeRow.assigned_driver_name || cleanedDriverId
    },
    warehouseEmployee: {
      id: cleanRepositoryText(input.warehouseEmployee?.employeeId, 120),
      name: cleanRepositoryText(input.warehouseEmployee?.employeeName, 200)
    },
    routeManifestId: cleanedManifestId,
    routeNumber: routeRow.route_number,
    routeDate: toDateOnly(routeRow.route_date),
    routeName: routeRow.route_name || null,
    plannedStartAt: toIsoString(routeRow.planned_start_at),
    plannedEndAt: toIsoString(routeRow.planned_end_at),
    printRequestedAt,
    inventory: {
      loadedQuantity,
      departureQuantity: loadedQuantity,
      deliveredQuantity,
      sellableQuantity,
      returnedQuantity,
      damagedQuantity,
      missingQuantity,
      addedQuantity,
      addedAfterDepartureQuantity: addedQuantity,
      rejectedQuantity,
      unaccountedQuantity,
      discrepancyQuantity,
      discrepancyStatus
    },
    items,
    notes
  };

  const result = await postgres.query(`
    INSERT INTO route_inventory_closeouts (
      id, manifest_id, document_number, driver_id, driver_name,
      status, supervisor_status, loaded_quantity, delivered_quantity,
      sellable_quantity, returned_quantity, damaged_quantity, missing_quantity,
      added_quantity, rejected_quantity, unaccounted_quantity, items, notes,
      payload, print_confirmation_token, print_requested_at, updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      'prepared', 'pending_review', $6, $7,
      $8, $9, $10, $11,
      $12, $13, $14, $15::jsonb, $16,
      $17::jsonb, $18, $19, NOW()
    )
    ON CONFLICT (manifest_id) DO UPDATE SET
      driver_id = EXCLUDED.driver_id,
      driver_name = EXCLUDED.driver_name,
      status = 'prepared',
      loaded_quantity = EXCLUDED.loaded_quantity,
      delivered_quantity = EXCLUDED.delivered_quantity,
      sellable_quantity = EXCLUDED.sellable_quantity,
      returned_quantity = EXCLUDED.returned_quantity,
      damaged_quantity = EXCLUDED.damaged_quantity,
      missing_quantity = EXCLUDED.missing_quantity,
      added_quantity = EXCLUDED.added_quantity,
      rejected_quantity = EXCLUDED.rejected_quantity,
      unaccounted_quantity = EXCLUDED.unaccounted_quantity,
      items = EXCLUDED.items,
      notes = EXCLUDED.notes,
      payload = EXCLUDED.payload,
      print_confirmation_token = EXCLUDED.print_confirmation_token,
      print_requested_at = EXCLUDED.print_requested_at,
      updated_at = NOW()
    RETURNING *
  `, [
    stableRepositoryId('route_inventory_closeout', [cleanedManifestId]),
    cleanedManifestId,
    documentNumber,
    cleanedDriverId,
    routeRow.assigned_driver_name || cleanedDriverId,
    loadedQuantity,
    deliveredQuantity,
    sellableQuantity,
    returnedQuantity,
    damagedQuantity,
    missingQuantity,
    addedQuantity,
    rejectedQuantity,
    unaccountedQuantity,
    JSON.stringify(items),
    notes,
    JSON.stringify(payload),
    printConfirmationToken,
    printRequestedAt
  ]);
  return routeInventoryCloseoutFromRow({
    ...result.rows[0],
    route_date: routeRow.route_date,
    route_number: routeRow.route_number
  });
}

async function confirmRouteInventoryCloseoutPrintForDriver(manifestId, driverId, confirmationToken) {
  const cleanedManifestId = cleanRepositoryText(manifestId, 160);
  const cleanedDriverId = cleanRepositoryText(driverId, 120);
  const cleanedToken = cleanRepositoryText(confirmationToken, 160);
  if (!cleanedManifestId || !cleanedDriverId || !cleanedToken) {
    const error = new Error('manifestId, driverId, and print confirmation token are required.');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    UPDATE route_inventory_closeouts AS closeout
    SET
      status = 'printed',
      printed_at = COALESCE(closeout.printed_at, closeout.print_requested_at, NOW()),
      actual_duration_minutes = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (
        COALESCE(closeout.printed_at, closeout.print_requested_at, NOW()) - manifest.planned_start_at
      )) / 60.0))::int,
      payload = closeout.payload || jsonb_build_object(
        'printedAt', COALESCE(closeout.printed_at, closeout.print_requested_at, NOW())
      ),
      print_confirmation_token = NULL,
      updated_at = NOW()
    FROM daily_route_manifests AS manifest
    JOIN drivers AS driver
      ON ${assignedDriverIdMatchesSql('driver.driver_id', 'manifest.assigned_driver_id')}
      AND driver.active = true
    WHERE closeout.manifest_id = manifest.id
      AND closeout.manifest_id = $1
      AND ${assignedDriverIdMatchesSql('manifest.assigned_driver_id', '$2')}
      AND closeout.print_confirmation_token = $3
      AND closeout.status = 'prepared'
    RETURNING closeout.*, manifest.route_date, manifest.route_number
  `, [cleanedManifestId, cleanedDriverId, cleanedToken]);
  return routeInventoryCloseoutFromRow(result.rows[0]);
}

async function confirmRouteInventoryCloseoutPrintForWarehouse(
  manifestId,
  driverId,
  warehouseEmployeeId,
  confirmationToken
) {
  const cleanedManifestId = cleanRepositoryText(manifestId, 160);
  const cleanedDriverId = cleanRepositoryText(driverId, 120);
  const cleanedEmployeeId = cleanRepositoryText(warehouseEmployeeId, 120);
  const cleanedToken = cleanRepositoryText(confirmationToken, 160);
  if (!cleanedManifestId || !cleanedDriverId || !cleanedEmployeeId || !cleanedToken) {
    const error = new Error('Manifest, driver, warehouse employee, and print confirmation token are required.');
    error.status = 400;
    throw error;
  }
  const result = await postgres.query(`
    UPDATE route_inventory_closeouts AS closeout
    SET
      status = 'printed',
      printed_at = COALESCE(closeout.printed_at, closeout.print_requested_at, NOW()),
      actual_duration_minutes = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (
        COALESCE(closeout.printed_at, closeout.print_requested_at, NOW()) - manifest.planned_start_at
      )) / 60.0))::int,
      payload = closeout.payload || jsonb_build_object(
        'printedAt', COALESCE(closeout.printed_at, closeout.print_requested_at, NOW())
      ),
      print_confirmation_token = NULL,
      updated_at = NOW()
    FROM daily_route_manifests AS manifest
    WHERE closeout.manifest_id = manifest.id
      AND closeout.manifest_id = $1
      AND ${assignedDriverIdMatchesSql('manifest.assigned_driver_id', '$2')}
      AND closeout.payload #>> '{warehouseEmployee,id}' = $3
      AND closeout.print_confirmation_token = $4
      AND closeout.status = 'prepared'
    RETURNING closeout.*, manifest.route_date, manifest.route_number
  `, [cleanedManifestId, cleanedDriverId, cleanedEmployeeId, cleanedToken]);
  return routeInventoryCloseoutFromRow(result.rows[0]);
}

async function listRouteInventoryCloseoutsForAdmin(options = {}) {
  const values = [];
  const where = [];
  const routeDate = toDateOnly(options.routeDate);
  if (routeDate) {
    values.push(routeDate);
    where.push(`manifest.route_date = $${values.length}`);
  }
  values.push(Math.min(Math.max(Number(options.limit) || 200, 1), 1000));
  const result = await postgres.query(`
    SELECT closeout.*, manifest.route_date, manifest.route_number
    FROM route_inventory_closeouts AS closeout
    JOIN daily_route_manifests AS manifest ON manifest.id = closeout.manifest_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY closeout.created_at DESC
    LIMIT $${values.length}
  `, values);
  return result.rows.map(routeInventoryCloseoutFromRow);
}

async function reviewRouteInventoryCloseout(manifestId, input = {}, actor = 'supervisor') {
  const cleanedManifestId = cleanRepositoryText(manifestId, 160);
  const supervisorStatus = cleanRepositoryText(input.status || input.supervisorStatus, 40).toLowerCase();
  if (!['approved', 'archived'].includes(supervisorStatus)) {
    const error = new Error('Final inventory closeout status must be approved or archived.');
    error.status = 400;
    throw error;
  }
  const result = await postgres.query(`
    UPDATE route_inventory_closeouts
    SET
      supervisor_status = $2,
      reviewed_by = CASE WHEN $2 = 'approved' THEN $3 ELSE reviewed_by END,
      reviewed_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE reviewed_at END,
      review_notes = COALESCE(NULLIF($4, ''), review_notes),
      archived_by = CASE WHEN $2 = 'archived' THEN $3 ELSE archived_by END,
      archived_at = CASE WHEN $2 = 'archived' THEN NOW() ELSE archived_at END,
      updated_at = NOW()
    WHERE manifest_id = $1
      AND status = 'printed'
    RETURNING *
  `, [
    cleanedManifestId,
    supervisorStatus,
    cleanRepositoryText(actor, 120) || 'supervisor',
    cleanRepositoryText(input.notes || input.reviewNotes, 2000)
  ]);
  return routeInventoryCloseoutFromRow(result.rows[0]);
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
  const settlementRows = stopIds.length
    ? (await postgres.query(`
      SELECT *
      FROM delivery_settlements
      WHERE route_stop_id = ANY($1::text[])
      ORDER BY created_at ASC
    `, [stopIds])).rows
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

  const settlementsByStopId = new Map(
    settlementRows.map((row) => [row.route_stop_id, deliverySettlementFromRow(row)])
  );
  const inventoryReconciliation = settlementRows.reduce((summary, row) => ({
    plannedQuantity: summary.plannedQuantity + normalizeQuantity(row.planned_quantity),
    deliveredQuantity: summary.deliveredQuantity + normalizeQuantity(row.delivered_quantity),
    rejectedQuantity: summary.rejectedQuantity + normalizeQuantity(row.rejected_quantity),
    damagedQuantity: summary.damagedQuantity + normalizeQuantity(row.damaged_quantity),
    missingQuantity: summary.missingQuantity + normalizeQuantity(row.missing_quantity),
    returnedQuantity: summary.returnedQuantity + normalizeQuantity(row.returned_quantity),
    addedQuantity: summary.addedQuantity + normalizeQuantity(row.added_quantity),
    plannedAmount: summary.plannedAmount + normalizeMoney(row.planned_amount),
    finalAmount: summary.finalAmount + normalizeMoney(row.final_amount),
    taxAmount: summary.taxAmount + normalizeMoney(row.tax_amount),
    totalAmount: summary.totalAmount + normalizeMoney(row.total_amount),
    amountPaid: summary.amountPaid + normalizeMoney(row.amount_paid),
    unpaidBalance: summary.unpaidBalance + normalizeMoney(row.unpaid_balance),
    cashAmount: summary.cashAmount + (row.payment_method === 'cash' ? normalizeMoney(row.amount_paid) : 0),
    checkAmount: summary.checkAmount + (row.payment_method === 'check' ? normalizeMoney(row.amount_paid) : 0),
    cardAmount: summary.cardAmount + (row.payment_method === 'card' ? normalizeMoney(row.amount_paid) : 0),
    creditAccountAmount: summary.creditAccountAmount + (row.payment_method === 'credit_account' ? normalizeMoney(row.total_amount) : 0),
    partialPaymentAmount: summary.partialPaymentAmount + (row.payment_method === 'partial_payment' ? normalizeMoney(row.amount_paid) : 0),
    completedSettlements: summary.completedSettlements + (row.status === 'completed' ? 1 : 0),
    supervisorReviewRequired: summary.supervisorReviewRequired || row.supervisor_review_required === true
  }), {
    plannedQuantity: 0,
    deliveredQuantity: 0,
    rejectedQuantity: 0,
    damagedQuantity: 0,
    missingQuantity: 0,
    returnedQuantity: 0,
    addedQuantity: 0,
    plannedAmount: 0,
    finalAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    amountPaid: 0,
    unpaidBalance: 0,
    cashAmount: 0,
    checkAmount: 0,
    cardAmount: 0,
    creditAccountAmount: 0,
    partialPaymentAmount: 0,
    completedSettlements: 0,
    supervisorReviewRequired: false
  });

  return {
    ...route,
    inventoryReconciliation: {
      ...inventoryReconciliation,
      totalStops: route.stops.length,
      unaccountedQuantity: normalizeQuantity(Math.max(
        0,
        inventoryReconciliation.plannedQuantity
          - inventoryReconciliation.deliveredQuantity
          - inventoryReconciliation.rejectedQuantity
          - inventoryReconciliation.damagedQuantity
          - inventoryReconciliation.missingQuantity
          - inventoryReconciliation.returnedQuantity
      ))
    },
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
        deliverySettlement: settlementsByStopId.get(stop.id) || null,
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
    where.push(`daily_route_manifests.route_date = $${values.length}`);
  }
  if (options.driverId) {
    values.push(String(options.driverId).trim());
    where.push(assignedDriverIdMatchesSql('daily_route_manifests.assigned_driver_id', `$${values.length}`));
  }
  if (options.status) {
    values.push(String(options.status).trim().toLowerCase());
    where.push(`daily_route_manifests.status = $${values.length}`);
  }

  values.push(limit);
  const result = await postgres.query(`
    SELECT *
    FROM daily_route_manifests
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY daily_route_manifests.route_date DESC, daily_route_manifests.route_number ASC
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

async function unassignDailyRouteManifest(id, input = {}) {
  const cleanedId = String(id || '').trim();
  const assignedBy = String(input.assignedBy || input.assigned_by || 'supervisor').trim() || 'supervisor';
  if (!cleanedId) {
    const error = new Error('Route manifest id is required.');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    UPDATE daily_route_manifests
    SET
      assigned_driver_id = NULL,
      assigned_driver_name = NULL,
      assigned_by = $2,
      assigned_at = NULL,
      status = CASE
        WHEN status IN ('completed', 'completed_with_exceptions', 'cancelled') THEN status
        ELSE 'unassigned'
      END,
      updated_at = NOW()
    WHERE id = $1
      AND status NOT IN ('completed', 'completed_with_exceptions', 'cancelled')
    RETURNING *
  `, [cleanedId, assignedBy]);

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
  const requestedEventAt = new Date(input.clientUpdatedAt || input.client_updated_at || '');
  const nowMs = Date.now();
  const eventAt = Number.isFinite(requestedEventAt.getTime())
    && requestedEventAt.getTime() >= nowMs - (7 * 24 * 60 * 60 * 1000)
    && requestedEventAt.getTime() <= nowMs + (5 * 60 * 1000)
    ? requestedEventAt.toISOString()
    : null;
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
  if (status !== 'pending') {
    const departureResult = await postgres.query(`
      SELECT confirmation.printed_at
      FROM daily_route_stops AS stop
      JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
      LEFT JOIN route_departure_inventory_confirmations AS confirmation ON confirmation.manifest_id = manifest.id
      WHERE stop.id = $1 AND ${assignedDriverIdMatchesSql('manifest.assigned_driver_id', '$2')}
      LIMIT 1
    `, [cleanedStopId, cleanedDriverId]);
    if (!departureResult.rows[0]?.printed_at) {
      const error = new Error('Warehouse inventory confirmation and successful pre-departure print are required before route execution.');
      error.status = 409;
      throw error;
    }
  }
  if (['completed', 'departed', 'undelivered'].includes(status)) {
    const settlementResult = await postgres.query(`
      SELECT status, completion_status
      FROM delivery_settlements
      WHERE route_stop_id = $1
        AND driver_id = $2
      LIMIT 1
    `, [cleanedStopId, cleanedDriverId]);
    const settlement = settlementResult.rows[0];
    const expectedCompletionStatus = status === 'undelivered' ? 'undelivered' : 'completed';
    if (!settlement || settlement.status !== 'completed' || settlement.completion_status !== expectedCompletionStatus) {
      const error = new Error('Complete the item-level delivery settlement before closing this stop.');
      error.status = 409;
      throw error;
    }
  }

  const result = await postgres.query(`
    UPDATE daily_route_stops AS stop
    SET
      status = $3,
      actual_arrival_at = CASE
        WHEN $3 IN ('arrived', 'servicing', 'completed', 'departed', 'undelivered') THEN COALESCE(stop.actual_arrival_at, $7::timestamptz, NOW())
        ELSE stop.actual_arrival_at
      END,
      actual_service_started_at = CASE
        WHEN $3 IN ('servicing', 'completed', 'departed') THEN COALESCE(stop.actual_service_started_at, $7::timestamptz, NOW())
        ELSE stop.actual_service_started_at
      END,
      actual_completed_at = CASE
        WHEN $3 IN ('completed', 'departed', 'undelivered') THEN COALESCE(stop.actual_completed_at, $7::timestamptz, NOW())
        ELSE stop.actual_completed_at
      END,
      actual_departure_at = CASE
        WHEN $3 = 'departed' THEN COALESCE(stop.actual_departure_at, $7::timestamptz, NOW())
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
      AND ${assignedDriverIdMatchesSql('manifest.assigned_driver_id', '$2')}
    RETURNING stop.*
  `, [cleanedStopId, cleanedDriverId, status, driverNotes, nonDeliveryReason, nonDeliveryNotes, eventAt]);

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
    SELECT manifest.*
    FROM daily_route_manifests AS manifest
    JOIN drivers AS driver
      ON ${assignedDriverIdMatchesSql('driver.driver_id', 'manifest.assigned_driver_id')}
      AND driver.active = true
    LEFT JOIN route_inventory_closeouts AS inventory_closeout
      ON inventory_closeout.manifest_id = manifest.id
    WHERE ${assignedDriverIdMatchesSql('manifest.assigned_driver_id', '$1')}
      AND manifest.route_date = $2
      AND manifest.status <> 'cancelled'
      AND (
        manifest.status NOT IN ('completed', 'completed_with_exceptions')
        OR inventory_closeout.printed_at IS NULL
      )
    ORDER BY manifest.assigned_at DESC NULLS LAST, manifest.route_number ASC
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

async function upsertCustomerAccount(input = {}) {
  const accountNumber = cleanRepositoryText(
    readInputField(input, ['accountNumber', 'account_number', 'customerNumber', 'customer_number']),
    120
  );
  const accountName = cleanRepositoryText(
    readInputField(input, ['accountName', 'account_name', 'customerName', 'customer_name', 'name']),
    240
  );
  if (!accountNumber || !accountName) {
    const error = new Error('accountNumber and accountName are required.');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    INSERT INTO customer_accounts (
      account_number, account_name, address, city, state_code, postal_code,
      phone, territory, route_group, distribution_center, active, raw, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, NOW())
    ON CONFLICT (account_number) DO UPDATE SET
      account_name = EXCLUDED.account_name,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state_code = EXCLUDED.state_code,
      postal_code = EXCLUDED.postal_code,
      phone = EXCLUDED.phone,
      territory = EXCLUDED.territory,
      route_group = EXCLUDED.route_group,
      distribution_center = EXCLUDED.distribution_center,
      active = EXCLUDED.active,
      raw = EXCLUDED.raw,
      updated_at = NOW()
    RETURNING *
  `, [
    accountNumber,
    accountName,
    cleanRepositoryText(readInputField(input, ['address', 'streetAddress', 'street_address']), 500) || null,
    cleanRepositoryText(readInputField(input, ['city']), 120) || null,
    cleanRepositoryText(readInputField(input, ['stateCode', 'state_code', 'state']), 2).toUpperCase() || null,
    cleanRepositoryText(readInputField(input, ['postalCode', 'postal_code', 'zip', 'zipcode']), 20) || null,
    cleanRepositoryText(readInputField(input, ['phone', 'phoneNumber', 'phone_number']), 40) || null,
    cleanRepositoryText(readInputField(input, ['territory']), 160) || null,
    cleanRepositoryText(readInputField(input, ['routeGroup', 'route_group']), 160) || null,
    cleanRepositoryText(readInputField(input, ['distributionCenter', 'distribution_center', 'warehouse']), 160) || null,
    input.active !== false && String(input.active).toLowerCase() !== 'false',
    JSON.stringify(input.raw || {}),
  ]);
  return customerAccountFromRow(result.rows[0]);
}

async function listCustomerAccounts(options = {}) {
  const limit = normalizeLimit(options.limit, 100, 1000);
  const values = [];
  const where = [];

  if (options.search) {
    values.push(`%${cleanRepositoryText(options.search, 160)}%`);
    where.push(`(
      account_number ILIKE $${values.length}
      OR account_name ILIKE $${values.length}
      OR address ILIKE $${values.length}
      OR city ILIKE $${values.length}
    )`);
  }
  if (options.stateCode || options.state) {
    values.push(cleanRepositoryText(options.stateCode || options.state, 2).toUpperCase());
    where.push(`state_code = $${values.length}`);
  }
  if (options.active !== undefined) {
    values.push(options.active !== false && String(options.active).toLowerCase() !== 'false');
    where.push(`active = $${values.length}`);
  }

  values.push(limit);
  const result = await postgres.query(`
    SELECT *
    FROM customer_accounts
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY account_name ASC
    LIMIT $${values.length}
  `, values);
  return result.rows.map(customerAccountFromRow);
}

async function saveDataImportBatch(input = {}) {
  const id = cleanRepositoryText(input.id, 160) || generateRepositoryId('data_import');
  const result = await postgres.query(`
    INSERT INTO data_import_batches (
      id, import_type, source_file_name, status, row_count, imported_count,
      warning_count, summary, imported_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
    RETURNING *
  `, [
    id,
    cleanRepositoryText(input.importType, 80),
    cleanRepositoryText(input.sourceFileName, 240) || null,
    cleanRepositoryText(input.status, 40) || 'completed',
    Number(input.rowCount) || 0,
    Number(input.importedCount) || 0,
    Number(input.warningCount) || 0,
    JSON.stringify(input.summary || {}),
    cleanRepositoryText(input.importedBy, 120) || null,
  ]);
  return dataImportBatchFromRow(result.rows[0]);
}

async function listDataImportBatches(options = {}) {
  const limit = normalizeLimit(options.limit, 50, 250);
  const values = [];
  const where = [];
  if (options.importType) {
    values.push(cleanRepositoryText(options.importType, 80));
    where.push(`import_type = $${values.length}`);
  }
  values.push(limit);
  const result = await postgres.query(`
    SELECT *
    FROM data_import_batches
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
    LIMIT $${values.length}
  `, values);
  return result.rows.map(dataImportBatchFromRow);
}

async function upsertProduct(input = {}) {
  const sku = cleanRepositoryText(input.sku || input.SKU, 120);
  const productName = cleanRepositoryText(input.productName || input.product_name || input.name, 240);
  if (!sku || !productName) {
    const error = new Error('sku and productName are required.');
    error.status = 400;
    throw error;
  }

  const barcodes = [...new Set(asArray(input.barcodes || input.barcodeValues)
    .flatMap((value) => String(value || '').split(/[|;]+/))
    .map((value) => cleanRepositoryText(value, 160))
    .filter(Boolean))];
  const result = await postgres.withTransaction(async (client) => {
    const productResult = await client.query(`
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
    if (input.barcodes !== undefined || input.barcodeValues !== undefined) {
      await client.query('DELETE FROM product_barcodes WHERE sku = $1', [sku]);
      for (const barcode of barcodes) {
        await client.query(`
          INSERT INTO product_barcodes (barcode, sku, package_size, configuration, active, raw, updated_at)
          VALUES ($1, $2, $3, $4, true, $5::jsonb, NOW())
          ON CONFLICT (barcode) DO UPDATE SET
            sku = EXCLUDED.sku,
            package_size = EXCLUDED.package_size,
            configuration = EXCLUDED.configuration,
            active = true,
            raw = EXCLUDED.raw,
            updated_at = NOW()
        `, [
          barcode,
          sku,
          cleanRepositoryText(input.packageSize || input.package_size, 120) || null,
          cleanRepositoryText(input.configuration, 160) || null,
          JSON.stringify({ source: 'product_catalog', sku })
        ]);
      }
    }
    productResult.rows[0].barcodes = barcodes;
    return productResult;
  });
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
    SELECT products.*,
      ARRAY(SELECT barcode FROM product_barcodes WHERE product_barcodes.sku = products.sku AND product_barcodes.active ORDER BY barcode) AS barcodes
    FROM products
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY product_name ASC
    LIMIT $${values.length}
  `, values);
  return result.rows.map(productFromRow);
}

async function lookupProductByBarcodeOrSku(value, queryable = postgres) {
  const identity = cleanRepositoryText(value, 160);
  if (!identity) return null;
  const barcodeResult = await queryable.query(`
    SELECT product.*, barcode.barcode AS matched_barcode,
      ARRAY(SELECT barcode_value.barcode FROM product_barcodes AS barcode_value WHERE barcode_value.sku = product.sku AND barcode_value.active ORDER BY barcode_value.barcode) AS barcodes
    FROM product_barcodes AS barcode
    JOIN products AS product ON product.sku = barcode.sku
    WHERE barcode.barcode = $1 AND barcode.active AND product.active
    LIMIT 1
  `, [identity]);
  if (barcodeResult.rows[0]) {
    return { ...productFromRow(barcodeResult.rows[0]), matchedBarcode: identity, lookupType: 'barcode' };
  }
  const skuResult = await queryable.query(`
    SELECT product.*,
      ARRAY(SELECT barcode FROM product_barcodes WHERE product_barcodes.sku = product.sku AND product_barcodes.active ORDER BY barcode) AS barcodes
    FROM products AS product
    WHERE product.sku = $1 AND product.active
    LIMIT 1
  `, [identity]);
  return skuResult.rows[0]
    ? { ...productFromRow(skuResult.rows[0]), matchedBarcode: identity, lookupType: 'sku_fallback' }
    : null;
}

async function addRouteTruckInventoryForDriver(manifestId, driverId, input = {}) {
  const cleanedManifestId = cleanRepositoryText(manifestId, 160);
  const cleanedDriverId = cleanRepositoryText(driverId, 120);
  const scannedBarcode = cleanRepositoryText(input.barcode || input.scannedBarcode, 160);
  const quantity = normalizeQuantity(input.quantity);
  const reason = cleanRepositoryText(input.reason, 240);
  const clientOperationId = cleanRepositoryText(input.clientOperationId || input.client_operation_id, 200);
  if (!cleanedManifestId || !cleanedDriverId || !scannedBarcode || quantity <= 0 || !reason || !clientOperationId) {
    const error = new Error('manifestId, driverId, scanned barcode, quantity, reason, and clientOperationId are required.');
    error.status = 400;
    throw error;
  }
  return postgres.withTransaction(async (client) => {
    const existing = await client.query('SELECT * FROM route_truck_inventory_additions WHERE client_operation_id = $1', [clientOperationId]);
    if (existing.rows[0]) return existing.rows[0];
    const routeResult = await client.query(`
      SELECT manifest.id
      FROM daily_route_manifests AS manifest
      JOIN drivers AS driver ON ${assignedDriverIdMatchesSql('driver.driver_id', 'manifest.assigned_driver_id')} AND driver.active
      WHERE manifest.id = $1 AND ${assignedDriverIdMatchesSql('manifest.assigned_driver_id', '$2')}
      FOR UPDATE OF manifest
    `, [cleanedManifestId, cleanedDriverId]);
    if (!routeResult.rows[0]) return null;
    const product = await lookupProductByBarcodeOrSku(scannedBarcode, client);
    if (!product) {
      const error = new Error('Scanned barcode was not found in the active product catalog.');
      error.status = 404;
      throw error;
    }
    const id = stableRepositoryId('truck_inventory_addition', [cleanedManifestId, clientOperationId]);
    const inserted = await client.query(`
      INSERT INTO route_truck_inventory_additions
        (id, manifest_id, driver_id, sku, scanned_barcode, quantity, reason, client_operation_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [id, cleanedManifestId, cleanedDriverId, product.sku, scannedBarcode, quantity, reason, clientOperationId]);
    return { ...inserted.rows[0], product };
  });
}

async function getRouteTruckInventoryForDriver(manifestId, driverId) {
  const cleanedManifestId = cleanRepositoryText(manifestId, 160);
  const cleanedDriverId = cleanRepositoryText(driverId, 120);
  const result = await postgres.query(`
    WITH planned AS (
      SELECT item.sku, SUM(item.quantity) AS quantity
      FROM account_order_items AS item
      JOIN account_orders AS ord ON ord.id = item.order_id
      LEFT JOIN daily_route_stops AS stop ON stop.id = ord.route_stop_id
      WHERE COALESCE(ord.route_manifest_id, stop.manifest_id) = $1
        AND item.sku IS NOT NULL
        AND COALESCE(item.raw->>'settlementAdditional', 'false') <> 'true'
      GROUP BY item.sku
    ), additions AS (
      SELECT sku, SUM(quantity) AS quantity FROM route_truck_inventory_additions
      WHERE manifest_id = $1 AND ${assignedDriverIdMatchesSql('driver_id', '$2')} GROUP BY sku
    ), allocations AS (
      SELECT sku, SUM(quantity) AS quantity FROM route_truck_inventory_allocations
      WHERE manifest_id = $1 AND ${assignedDriverIdMatchesSql('driver_id', '$2')} GROUP BY sku
    ), settled AS (
      SELECT item.sku,
        SUM(item.delivered_quantity + item.added_quantity) AS sold_quantity,
        SUM(item.returned_quantity) AS returned_quantity,
        SUM(item.damaged_quantity) AS damaged_quantity,
        SUM(item.missing_quantity) AS missing_quantity,
        SUM(item.rejected_quantity) AS rejected_quantity
      FROM delivery_settlement_items AS item
      JOIN delivery_settlements AS settlement ON settlement.id = item.settlement_id
      JOIN daily_route_stops AS stop ON stop.id = settlement.route_stop_id
      WHERE stop.manifest_id = $1 AND item.sku IS NOT NULL
      GROUP BY item.sku
    ), sku_set AS (
      SELECT sku FROM planned UNION SELECT sku FROM additions UNION SELECT sku FROM settled
    )
    SELECT product.*,
      ARRAY(SELECT barcode FROM product_barcodes WHERE product_barcodes.sku = product.sku AND product_barcodes.active ORDER BY barcode) AS barcodes,
      COALESCE(planned.quantity, 0) AS planned_quantity,
      COALESCE(additions.quantity, 0) AS added_quantity,
      COALESCE(allocations.quantity, 0) AS allocated_quantity,
      COALESCE(settled.sold_quantity, 0) AS sold_quantity,
      COALESCE(settled.returned_quantity, 0) AS returned_quantity,
      COALESCE(settled.damaged_quantity, 0) AS damaged_quantity,
      COALESCE(settled.missing_quantity, 0) AS missing_quantity,
      COALESCE(settled.rejected_quantity, 0) AS rejected_quantity
    FROM sku_set
    JOIN products AS product ON product.sku = sku_set.sku
    LEFT JOIN planned ON planned.sku = sku_set.sku
    LEFT JOIN additions ON additions.sku = sku_set.sku
    LEFT JOIN allocations ON allocations.sku = sku_set.sku
    LEFT JOIN settled ON settled.sku = sku_set.sku
    ORDER BY product.product_name
  `, [cleanedManifestId, cleanedDriverId]);
  return result.rows.map((row) => ({
    ...productFromRow(row),
    plannedQuantity: normalizeQuantity(row.planned_quantity),
    addedQuantity: normalizeQuantity(row.added_quantity),
    allocatedQuantity: normalizeQuantity(row.allocated_quantity),
    availableQuantity: normalizeQuantity(normalizeQuantity(row.added_quantity) - normalizeQuantity(row.allocated_quantity)),
    soldQuantity: normalizeQuantity(row.sold_quantity),
    returnedQuantity: normalizeQuantity(row.returned_quantity),
    damagedQuantity: normalizeQuantity(row.damaged_quantity),
    missingQuantity: normalizeQuantity(row.missing_quantity),
    rejectedQuantity: normalizeQuantity(row.rejected_quantity),
    expectedOnTruckQuantity: normalizeQuantity(
      normalizeQuantity(row.planned_quantity)
      + normalizeQuantity(row.added_quantity)
      - normalizeQuantity(row.sold_quantity)
      - normalizeQuantity(row.missing_quantity)
    )
  }));
}

async function upsertWarehouseEmployee(input = {}) {
  const employeeId = cleanRepositoryText(input.employeeId || input.employee_id, 120);
  const employeeName = cleanRepositoryText(input.employeeName || input.employee_name, 200);
  const pinHash = cleanRepositoryText(input.pinHash || input.pin_hash, 500);
  if (!employeeId || !employeeName || !pinHash) {
    const error = new Error('employeeId, employeeName, and pinHash are required.');
    error.status = 400;
    throw error;
  }
  const result = await postgres.query(`
    INSERT INTO warehouse_employees (employee_id, employee_name, pin_hash, active, created_by, updated_by, updated_at)
    VALUES ($1, $2, $3, $4, $5, $5, NOW())
    ON CONFLICT (employee_id) DO UPDATE SET
      employee_name = EXCLUDED.employee_name,
      pin_hash = EXCLUDED.pin_hash,
      active = EXCLUDED.active,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING employee_id, employee_name, active, created_at, updated_at
  `, [employeeId, employeeName, pinHash, input.active !== false, cleanRepositoryText(input.updatedBy || input.createdBy, 120) || 'supervisor']);
  return result.rows[0];
}

async function listWarehouseEmployees() {
  const result = await postgres.query(`
    SELECT employee_id, employee_name, active, created_at, updated_at
    FROM warehouse_employees ORDER BY employee_name, employee_id
  `);
  return result.rows;
}

async function getWarehouseEmployeeWithPin(employeeId) {
  const result = await postgres.query('SELECT * FROM warehouse_employees WHERE employee_id = $1 LIMIT 1', [cleanRepositoryText(employeeId, 120)]);
  return result.rows[0] || null;
}

async function prepareDepartureInventoryConfirmation(manifestId, driverId, warehouseEmployee) {
  const cleanedManifestId = cleanRepositoryText(manifestId, 160);
  const cleanedDriverId = cleanRepositoryText(driverId, 120);
  const routeResult = await postgres.query(`
    SELECT manifest.* FROM daily_route_manifests AS manifest
    JOIN drivers AS driver ON ${assignedDriverIdMatchesSql('driver.driver_id', 'manifest.assigned_driver_id')} AND driver.active
    WHERE manifest.id = $1 AND ${assignedDriverIdMatchesSql('manifest.assigned_driver_id', '$2')}
      AND manifest.status IN ('assigned', 'active')
    LIMIT 1
  `, [cleanedManifestId, cleanedDriverId]);
  const route = routeResult.rows[0];
  if (!route) return null;
  const inventory = await getRouteTruckInventoryForDriver(cleanedManifestId, cleanedDriverId);
  if (!inventory.length) {
    const error = new Error('This route has no product inventory to confirm.');
    error.status = 409;
    throw error;
  }
  const token = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(24).toString('hex');
  const result = await postgres.query(`
    INSERT INTO route_departure_inventory_confirmations
      (manifest_id, driver_id, warehouse_employee_id, warehouse_employee_name, status, inventory,
       print_confirmation_token, confirmed_at, print_requested_at, printed_at, updated_at)
    VALUES ($1, $2, $3, $4, 'confirmed', $5::jsonb, $6, NOW(), NOW(), NULL, NOW())
    ON CONFLICT (manifest_id) DO UPDATE SET
      driver_id = EXCLUDED.driver_id,
      warehouse_employee_id = EXCLUDED.warehouse_employee_id,
      warehouse_employee_name = EXCLUDED.warehouse_employee_name,
      status = 'confirmed', inventory = EXCLUDED.inventory,
      print_confirmation_token = EXCLUDED.print_confirmation_token,
      confirmed_at = NOW(), print_requested_at = NOW(), printed_at = NULL, updated_at = NOW()
    RETURNING *
  `, [cleanedManifestId, cleanedDriverId, warehouseEmployee.employee_id, warehouseEmployee.employee_name, JSON.stringify(inventory), token]);
  return {
    ...result.rows[0],
    routeNumber: route.route_number,
    routeDate: toDateOnly(route.route_date),
    routeName: route.route_name,
    driverName: route.assigned_driver_name,
    inventory
  };
}

async function confirmDepartureInventoryPrint(manifestId, driverId, token) {
  const result = await postgres.query(`
    UPDATE route_departure_inventory_confirmations
    SET status = 'printed', printed_at = NOW(), print_confirmation_token = NULL, updated_at = NOW()
    WHERE manifest_id = $1 AND ${assignedDriverIdMatchesSql('driver_id', '$2')}
      AND print_confirmation_token = $3 AND printed_at IS NULL
    RETURNING *
  `, [cleanRepositoryText(manifestId, 160), cleanRepositoryText(driverId, 120), cleanRepositoryText(token, 160)]);
  return result.rows[0] || null;
}

async function confirmDepartureInventoryPrintForWarehouse(manifestId, driverId, warehouseEmployeeId, token) {
  const result = await postgres.query(`
    UPDATE route_departure_inventory_confirmations
    SET status = 'printed', printed_at = NOW(), print_confirmation_token = NULL, updated_at = NOW()
    WHERE manifest_id = $1
      AND ${assignedDriverIdMatchesSql('driver_id', '$2')}
      AND warehouse_employee_id = $3
      AND print_confirmation_token = $4
      AND printed_at IS NULL
    RETURNING *
  `, [
    cleanRepositoryText(manifestId, 160),
    cleanRepositoryText(driverId, 120),
    cleanRepositoryText(warehouseEmployeeId, 120),
    cleanRepositoryText(token, 160)
  ]);
  return result.rows[0] || null;
}

async function getDepartureInventoryConfirmation(manifestId, driverId) {
  const result = await postgres.query(`
    SELECT * FROM route_departure_inventory_confirmations
    WHERE manifest_id = $1 AND ${assignedDriverIdMatchesSql('driver_id', '$2')} LIMIT 1
  `, [cleanRepositoryText(manifestId, 160), cleanRepositoryText(driverId, 120)]);
  return result.rows[0] || null;
}

async function createAccountOrder(input = {}) {
  const accountNumber = cleanRepositoryText(readInputField(input, ['accountNumber', 'account_number']), 120);
  if (!accountNumber) {
    const error = new Error('accountNumber is required.');
    error.status = 400;
    throw error;
  }

  const items = asArray(input.items).map((item) => {
    const quantity = normalizeQuantity(readInputField(item, ['quantity', 'cases', 'units']));
    const unitPrice = normalizeMoney(readInputField(item, ['unitPrice', 'unit_price', 'price', 'casePrice', 'case_price']));
    const grossAmount = normalizeMoney(readInputField(item, ['grossAmount', 'gross_amount', 'lineTotal', 'line_total', 'extendedPrice', 'extended_price']), quantity * unitPrice);
    const deductionQuantity = normalizeQuantity(readInputField(item, ['deductionQuantity', 'deduction_quantity']));
    const deductionAmount = normalizeMoney(readInputField(item, ['deductionAmount', 'deduction_amount']));
    return {
      id: cleanRepositoryText(readInputField(item, ['id']), 160) || generateRepositoryId('order_item'),
      sku: cleanRepositoryText(readInputField(item, ['sku', 'SKU', 'productCode', 'product_code', 'itemCode', 'item_code']), 120) || null,
      productName: cleanRepositoryText(readInputField(item, ['productName', 'product_name', 'name', 'product', 'itemName', 'item_name']), 240),
      brand: cleanRepositoryText(readInputField(item, ['brand']), 120) || null,
      packageSize: cleanRepositoryText(readInputField(item, ['packageSize', 'package_size', 'packSize', 'pack_size']), 120) || null,
      category: cleanRepositoryText(readInputField(item, ['category', 'productCategory', 'product_category']), 120) || null,
      quantity,
      unitPrice,
      grossAmount,
      deductionQuantity,
      deductionAmount,
      netAmount: Math.max(0, normalizeMoney(readInputField(item, ['netAmount', 'net_amount']), grossAmount - deductionAmount)),
      raw: item.raw || item
    };
  }).filter((item) => item.productName);

  const invoiceNumber = cleanRepositoryText(readInputField(input, ['invoiceNumber', 'invoice_number', 'invoice', 'orderNumber', 'order_number']), 160) || null;
  const subtotalAmount = normalizeMoney(readInputField(input, ['subtotalAmount', 'subtotal_amount']), items.reduce((sum, item) => sum + item.grossAmount, 0));
  const deductionAmount = normalizeMoney(readInputField(input, ['deductionAmount', 'deduction_amount']), items.reduce((sum, item) => sum + item.deductionAmount, 0));
  const netAmount = normalizeMoney(readInputField(input, ['netAmount', 'net_amount']), Math.max(0, subtotalAmount - deductionAmount));
  const orderId = cleanRepositoryText(readInputField(input, ['id']), 160) || (invoiceNumber
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
    cleanRepositoryText(readInputField(input, ['accountName', 'account_name']), 240) || null,
    toDateOnly(readInputField(input, ['orderDate', 'order_date'])) || null,
    toDateOnly(readInputField(input, ['deliveryDate', 'delivery_date'])) || null,
    invoiceNumber,
    cleanRepositoryText(readInputField(input, ['routeManifestId', 'route_manifest_id']), 160) || null,
    cleanRepositoryText(readInputField(input, ['routeStopId', 'route_stop_id']), 160) || null,
    subtotalAmount,
    deductionAmount,
    netAmount,
    cleanRepositoryText(readInputField(input, ['status']), 80) || 'open',
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
      AND ${assignedDriverIdMatchesSql('manifest.assigned_driver_id', '$2')}
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

async function getDriverStopDeliverySettlement(stopId, driverId) {
  const cleanedStopId = cleanRepositoryText(stopId, 160);
  const cleanedDriverId = cleanRepositoryText(driverId, 120);
  if (!cleanedStopId || !cleanedDriverId) {
    const error = new Error('stopId and driverId are required.');
    error.status = 400;
    throw error;
  }

  const stopResult = await postgres.query(`
    SELECT
      stop.*,
      manifest.route_date,
      manifest.route_number,
      manifest.route_name,
      manifest.assigned_driver_id,
      manifest.assigned_driver_name
    FROM daily_route_stops AS stop
    JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
    WHERE stop.id = $1
      AND ${assignedDriverIdMatchesSql('manifest.assigned_driver_id', '$2')}
    LIMIT 1
  `, [cleanedStopId, cleanedDriverId]);
  const stopRow = stopResult.rows[0];
  if (!stopRow) return null;

  const orderResult = await postgres.query(`
    SELECT *
    FROM account_orders
    WHERE route_stop_id = $1
    ORDER BY COALESCE(delivery_date, order_date) DESC, created_at DESC
    LIMIT 1
  `, [cleanedStopId]);
  const orderRow = orderResult.rows[0] || null;

  const orderItemsResult = orderRow
    ? await postgres.query(`
        SELECT *
        FROM account_order_items
        WHERE order_id = $1
          AND COALESCE(raw->>'settlementAdditional', 'false') <> 'true'
        ORDER BY product_name ASC
      `, [orderRow.id])
    : { rows: [] };

  const settlementResult = await postgres.query(`
    SELECT *
    FROM delivery_settlements
    WHERE route_stop_id = $1
    LIMIT 1
  `, [cleanedStopId]);
  const settlementRow = settlementResult.rows[0] || null;
  const settlementItemsResult = settlementRow
    ? await postgres.query(`
        SELECT *
        FROM delivery_settlement_items
        WHERE settlement_id = $1
        ORDER BY CASE WHEN order_item_id IS NULL THEN 1 ELSE 0 END, product_name ASC
      `, [settlementRow.id])
    : { rows: [] };

  const stop = {
    ...routeStopFromRow(stopRow),
    routeDate: toDateOnly(stopRow.route_date),
    routeNumber: stopRow.route_number || null,
    routeName: stopRow.route_name || null,
    assignedDriverId: stopRow.assigned_driver_id,
    assignedDriverName: stopRow.assigned_driver_name || null
  };
  const orderItems = orderItemsResult.rows.map(accountOrderItemFromRow);
  const defaultItems = orderItems.length
    ? orderItems.map((item) => ({
        id: `draft_${item.id}`,
        settlementId: null,
        orderItemId: item.id,
        sku: item.sku,
        productName: item.productName,
        brand: item.brand,
        packageSize: item.packageSize,
        category: item.category,
        plannedQuantity: item.quantity,
        deliveredQuantity: item.quantity,
        rejectedQuantity: 0,
        damagedQuantity: 0,
        missingQuantity: 0,
        returnedQuantity: 0,
        addedQuantity: 0,
        unitPrice: item.unitPrice,
        finalAmount: normalizeMoney(item.quantity * item.unitPrice),
        adjustmentReason: null,
        notes: null,
        raw: {}
      }))
    : asArray(stop.itemSummary).map((item, index) => {
        const quantity = normalizeQuantity(readInputField(item, ['quantity', 'cases', 'units']));
        const unitPrice = normalizeMoney(readInputField(item, ['unitPrice', 'unit_price', 'price']));
        return {
          id: `draft_summary_${index}`,
          settlementId: null,
          orderItemId: null,
          sku: cleanRepositoryText(readInputField(item, ['sku', 'SKU']), 120) || null,
          productName: cleanRepositoryText(readInputField(item, ['productName', 'product_name', 'name']), 240) || `Item ${index + 1}`,
          brand: cleanRepositoryText(readInputField(item, ['brand']), 120) || null,
          packageSize: cleanRepositoryText(readInputField(item, ['packageSize', 'package_size']), 120) || null,
          category: cleanRepositoryText(readInputField(item, ['category']), 120) || null,
          plannedQuantity: quantity,
          deliveredQuantity: quantity,
          rejectedQuantity: 0,
          damagedQuantity: 0,
          missingQuantity: 0,
          returnedQuantity: 0,
          addedQuantity: 0,
          unitPrice,
          finalAmount: normalizeMoney(quantity * unitPrice),
          adjustmentReason: null,
          notes: null,
          raw: { source: 'route_item_summary' }
        };
      });

  const settlement = settlementRow
    ? deliverySettlementFromRow(
        settlementRow,
        settlementItemsResult.rows.map(deliverySettlementItemFromRow)
      )
    : {
        id: null,
        routeStopId: cleanedStopId,
        orderId: orderRow?.id || null,
        driverId: cleanedDriverId,
        status: 'draft',
        completionStatus: null,
        nonDeliveryReason: null,
        plannedQuantity: defaultItems.reduce((sum, item) => sum + item.plannedQuantity, 0),
        deliveredQuantity: defaultItems.reduce((sum, item) => sum + item.deliveredQuantity, 0),
        rejectedQuantity: 0,
        damagedQuantity: 0,
        missingQuantity: 0,
        returnedQuantity: 0,
        addedQuantity: 0,
        plannedAmount: normalizeMoney(defaultItems.reduce((sum, item) => sum + (item.plannedQuantity * item.unitPrice), 0)),
        finalAmount: normalizeMoney(defaultItems.reduce((sum, item) => sum + item.finalAmount, 0)),
        taxAmount: 0,
        totalAmount: normalizeMoney(defaultItems.reduce((sum, item) => sum + item.finalAmount, 0)),
        paymentMethod: null,
        amountPaid: 0,
        unpaidBalance: normalizeMoney(defaultItems.reduce((sum, item) => sum + item.finalAmount, 0)),
        customerSignature: null,
        driverSignature: null,
        supervisorReviewRequired: false,
        notes: null,
        completedAt: null,
        items: defaultItems
      };

  return {
    stop,
    order: orderRow ? accountOrderFromRow(orderRow, orderItems) : null,
    settlement
  };
}

async function saveDriverStopDeliverySettlement(stopId, driverId, input = {}) {
  const cleanedStopId = cleanRepositoryText(stopId, 160);
  const cleanedDriverId = cleanRepositoryText(driverId, 120);
  const requestedStatus = cleanRepositoryText(input.status, 40).toLowerCase() || 'draft';
  const completionStatus = cleanRepositoryText(input.completionStatus || input.completion_status, 40).toLowerCase()
    || (requestedStatus === 'completed' ? 'completed' : null);
  const nonDeliveryReason = cleanRepositoryText(input.nonDeliveryReason || input.non_delivery_reason, 120).toLowerCase() || null;
  const notes = cleanRepositoryText(input.notes, 2000) || null;
  const taxAmount = normalizeMoney(input.taxAmount || input.tax_amount);
  const paymentMethod = cleanRepositoryText(input.paymentMethod || input.payment_method, 40).toLowerCase() || null;
  const amountPaid = normalizeMoney(input.amountPaid || input.amount_paid);
  const customerSignature = cleanRepositoryText(input.customerSignature || input.customer_signature, 350000) || null;
  const driverSignature = cleanRepositoryText(input.driverSignature || input.driver_signature, 350000) || null;
  const allowedStatuses = new Set(['draft', 'completed']);
  const allowedCompletionStatuses = new Set(['completed', 'undelivered']);
  const allowedNonDeliveryReasons = new Set(['customer_refused', 'missed_time_window', 'business_closed', 'no_payment']);
  const allowedPaymentMethods = new Set(['cash', 'check', 'card', 'credit_account', 'partial_payment', 'unpaid']);

  if (!cleanedStopId || !cleanedDriverId) {
    const error = new Error('stopId and driverId are required.');
    error.status = 400;
    throw error;
  }
  if (!allowedStatuses.has(requestedStatus)) {
    const error = new Error('Settlement status must be draft or completed.');
    error.status = 400;
    throw error;
  }
  if (requestedStatus === 'completed' && !allowedCompletionStatuses.has(completionStatus)) {
    const error = new Error('A valid completion status is required.');
    error.status = 400;
    throw error;
  }
  if (completionStatus === 'undelivered' && !allowedNonDeliveryReasons.has(nonDeliveryReason)) {
    const error = new Error('A valid non-delivery reason is required.');
    error.status = 400;
    throw error;
  }
  if (paymentMethod && !allowedPaymentMethods.has(paymentMethod)) {
    const error = new Error('A valid payment method is required.');
    error.status = 400;
    throw error;
  }

  const saved = await postgres.withTransaction(async (client) => {
    const stopResult = await client.query(`
      SELECT stop.*, manifest.assigned_driver_id
      FROM daily_route_stops AS stop
      JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
      WHERE stop.id = $1
        AND ${assignedDriverIdMatchesSql('manifest.assigned_driver_id', '$2')}
      FOR UPDATE OF stop
    `, [cleanedStopId, cleanedDriverId]);
    const stopRow = stopResult.rows[0];
    if (!stopRow) return null;

    const orderResult = await client.query(`
      SELECT *
      FROM account_orders
      WHERE route_stop_id = $1
      ORDER BY COALESCE(delivery_date, order_date) DESC, created_at DESC
      LIMIT 1
      FOR UPDATE
    `, [cleanedStopId]);
    const orderRow = orderResult.rows[0] || null;
    const orderItemsResult = orderRow
      ? await client.query(`
          SELECT *
          FROM account_order_items
          WHERE order_id = $1
            AND COALESCE(raw->>'settlementAdditional', 'false') <> 'true'
          ORDER BY product_name ASC
          FOR UPDATE
        `, [orderRow.id])
      : { rows: [] };
    const plannedItems = orderItemsResult.rows;
    const plannedById = new Map(plannedItems.map((row) => [row.id, row]));
    const suppliedItems = asArray(input.items);
    const normalizedItems = suppliedItems.map((item, index) => {
      const orderItemId = cleanRepositoryText(item.orderItemId || item.order_item_id, 160) || null;
      const plannedRow = orderItemId ? plannedById.get(orderItemId) : null;
      if (orderItemId && !plannedRow) {
        const error = new Error('A settlement item does not belong to this stop.');
        error.status = 400;
        throw error;
      }

      const plannedQuantity = plannedRow
        ? normalizeQuantity(plannedRow.quantity)
        : normalizeQuantity(item.plannedQuantity || item.planned_quantity);
      const deliveredQuantity = normalizeQuantity(item.deliveredQuantity || item.delivered_quantity);
      const rejectedQuantity = normalizeQuantity(item.rejectedQuantity || item.rejected_quantity);
      const damagedQuantity = normalizeQuantity(item.damagedQuantity || item.damaged_quantity);
      const missingQuantity = normalizeQuantity(item.missingQuantity || item.missing_quantity);
      const returnedQuantity = normalizeQuantity(item.returnedQuantity || item.returned_quantity);
      const addedQuantity = normalizeQuantity(item.addedQuantity || item.added_quantity);
      const scannedBarcode = cleanRepositoryText(
        item.scannedBarcode || item.scanned_barcode || item.barcode || item.raw?.scannedBarcode,
        160
      ) || null;
      const accountedQuantity = deliveredQuantity + rejectedQuantity + damagedQuantity + missingQuantity + returnedQuantity;
      const adjustmentReason = cleanRepositoryText(item.adjustmentReason || item.adjustment_reason, 240) || null;
      const itemNotes = cleanRepositoryText(item.notes, 1000) || null;
      const unitPrice = plannedRow
        ? normalizeMoney(plannedRow.unit_price)
        : normalizeMoney(item.unitPrice || item.unit_price);
      const productName = plannedRow?.product_name
        || cleanRepositoryText(item.productName || item.product_name, 240);

      if (!productName) {
        const error = new Error(`Product name is required for settlement item ${index + 1}.`);
        error.status = 400;
        throw error;
      }
      if (plannedRow && Math.abs(accountedQuantity - plannedQuantity) > 0.001 && requestedStatus === 'completed') {
        const error = new Error(`${productName} has ${normalizeQuantity(plannedQuantity - accountedQuantity)} unaccounted unit(s).`);
        error.status = 400;
        throw error;
      }
      if (!plannedRow && plannedQuantity > 0) {
        const error = new Error('Additional products cannot change the warehouse-planned quantity.');
        error.status = 400;
        throw error;
      }
      if (!plannedRow && addedQuantity <= 0) {
        const error = new Error('An added product must have an added quantity greater than zero.');
        error.status = 400;
        throw error;
      }
      if ((rejectedQuantity + damagedQuantity + missingQuantity + returnedQuantity + addedQuantity) > 0 && !adjustmentReason) {
        const error = new Error(`An adjustment reason is required for ${productName}.`);
        error.status = 400;
        throw error;
      }

      return {
        id: stableRepositoryId('settlement_item', [
          cleanedStopId,
          orderItemId || cleanRepositoryText(item.sku, 120) || productName,
          index
        ]),
        orderItemId,
        sku: plannedRow?.sku || cleanRepositoryText(item.sku || item.SKU, 120) || null,
        productName,
        brand: plannedRow?.brand || cleanRepositoryText(item.brand, 120) || null,
        packageSize: plannedRow?.package_size || cleanRepositoryText(item.packageSize || item.package_size, 120) || null,
        category: plannedRow?.category || cleanRepositoryText(item.category, 120) || null,
        plannedQuantity,
        deliveredQuantity,
        rejectedQuantity,
        damagedQuantity,
        missingQuantity,
        returnedQuantity,
        addedQuantity,
        scannedBarcode,
        unitPrice,
        finalAmount: normalizeMoney((deliveredQuantity + addedQuantity) * unitPrice),
        adjustmentReason,
        notes: itemNotes,
        raw: {
          ...(item.raw || {}),
          ...(scannedBarcode ? { scannedBarcode } : {})
        }
      };
    });

    if (plannedItems.length) {
      const suppliedPlannedIds = new Set(normalizedItems.map((item) => item.orderItemId).filter(Boolean));
      const missingPlannedItem = plannedItems.find((item) => !suppliedPlannedIds.has(item.id));
      if (missingPlannedItem) {
        const error = new Error(`${missingPlannedItem.product_name} is missing from the delivery settlement.`);
        error.status = 400;
        throw error;
      }
    }

    const addedBySku = new Map();
    for (const item of normalizedItems.filter((entry) => entry.addedQuantity > 0)) {
      if (!item.sku || !item.scannedBarcode) {
        const error = new Error(`${item.productName} must be added by scanning its barcode.`);
        error.status = 400;
        throw error;
      }
      const catalogProduct = await lookupProductByBarcodeOrSku(item.scannedBarcode, client);
      if (!catalogProduct || catalogProduct.sku !== item.sku) {
        const error = new Error(`The scanned barcode does not match ${item.productName}.`);
        error.status = 400;
        throw error;
      }
      const current = addedBySku.get(item.sku) || { quantity: 0, barcode: item.scannedBarcode, productName: item.productName };
      current.quantity += item.addedQuantity;
      addedBySku.set(item.sku, current);
    }
    for (const [sku, requested] of addedBySku) {
      const additionRows = await client.query(`
        SELECT quantity FROM route_truck_inventory_additions
        WHERE manifest_id = $1 AND ${assignedDriverIdMatchesSql('driver_id', '$2')} AND sku = $3
        FOR UPDATE
      `, [stopRow.manifest_id, cleanedDriverId, sku]);
      const allocationRows = await client.query(`
        SELECT route_stop_id, quantity FROM route_truck_inventory_allocations
        WHERE manifest_id = $1 AND ${assignedDriverIdMatchesSql('driver_id', '$2')} AND sku = $3
        FOR UPDATE
      `, [stopRow.manifest_id, cleanedDriverId, sku]);
      const truckAdded = additionRows.rows.reduce((sum, row) => sum + normalizeQuantity(row.quantity), 0);
      const allocatedElsewhere = allocationRows.rows
        .filter((row) => row.route_stop_id !== cleanedStopId)
        .reduce((sum, row) => sum + normalizeQuantity(row.quantity), 0);
      if (requested.quantity > truckAdded - allocatedElsewhere + 0.001) {
        const error = new Error(`${requested.productName} exceeds available scanned truck inventory.`);
        error.status = 409;
        throw error;
      }
    }

    const totals = normalizedItems.reduce((summary, item) => ({
      plannedQuantity: summary.plannedQuantity + item.plannedQuantity,
      deliveredQuantity: summary.deliveredQuantity + item.deliveredQuantity,
      rejectedQuantity: summary.rejectedQuantity + item.rejectedQuantity,
      damagedQuantity: summary.damagedQuantity + item.damagedQuantity,
      missingQuantity: summary.missingQuantity + item.missingQuantity,
      returnedQuantity: summary.returnedQuantity + item.returnedQuantity,
      addedQuantity: summary.addedQuantity + item.addedQuantity,
      plannedAmount: summary.plannedAmount + (item.plannedQuantity * item.unitPrice),
      finalAmount: summary.finalAmount + item.finalAmount
    }), {
      plannedQuantity: 0,
      deliveredQuantity: 0,
      rejectedQuantity: 0,
      damagedQuantity: 0,
      missingQuantity: 0,
      returnedQuantity: 0,
      addedQuantity: 0,
      plannedAmount: 0,
      finalAmount: 0
    });
    const supervisorReviewRequired = normalizedItems.some((item) =>
      item.damagedQuantity > 0 || item.missingQuantity > 0 || item.addedQuantity > 0
    );
    const totalAmount = normalizeMoney(totals.finalAmount + taxAmount);
    if (requestedStatus === 'completed' && !paymentMethod) {
      const error = new Error('A payment method or unpaid balance status is required.');
      error.status = 400;
      throw error;
    }
    if (
      requestedStatus === 'completed'
      && ['cash', 'check', 'card'].includes(paymentMethod)
      && Math.abs(amountPaid - totalAmount) > 0.01
    ) {
      const error = new Error('Cash, check, and card payments must equal the final total. Use partial payment when a balance remains.');
      error.status = 400;
      throw error;
    }
    if (
      requestedStatus === 'completed'
      && paymentMethod === 'partial_payment'
      && (amountPaid <= 0 || amountPaid >= totalAmount)
    ) {
      const error = new Error('A partial payment must be greater than zero and less than the final total.');
      error.status = 400;
      throw error;
    }
    const effectiveAmountPaid = paymentMethod === 'credit_account'
      ? 0
      : Math.min(amountPaid, totalAmount);
    const unpaidBalance = paymentMethod === 'credit_account'
      ? 0
      : normalizeMoney(Math.max(0, totalAmount - effectiveAmountPaid));
    const settlementId = stableRepositoryId('settlement', [cleanedStopId]);

    const settlementResult = await client.query(`
      INSERT INTO delivery_settlements (
        id, route_stop_id, order_id, driver_id, status, completion_status,
        non_delivery_reason, planned_quantity, delivered_quantity, rejected_quantity,
        damaged_quantity, missing_quantity, returned_quantity, added_quantity,
        planned_amount, final_amount, tax_amount, total_amount, payment_method,
        amount_paid, unpaid_balance, customer_signature, driver_signature,
        supervisor_review_required, notes,
        completed_at, raw, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17, $18, $19,
        $20, $21, $22, $23,
        $24, $25,
        CASE WHEN $5 = 'completed' THEN NOW() ELSE NULL END,
        $26::jsonb, NOW()
      )
      ON CONFLICT (route_stop_id) DO UPDATE SET
        order_id = EXCLUDED.order_id,
        driver_id = EXCLUDED.driver_id,
        status = EXCLUDED.status,
        completion_status = EXCLUDED.completion_status,
        non_delivery_reason = EXCLUDED.non_delivery_reason,
        planned_quantity = EXCLUDED.planned_quantity,
        delivered_quantity = EXCLUDED.delivered_quantity,
        rejected_quantity = EXCLUDED.rejected_quantity,
        damaged_quantity = EXCLUDED.damaged_quantity,
        missing_quantity = EXCLUDED.missing_quantity,
        returned_quantity = EXCLUDED.returned_quantity,
        added_quantity = EXCLUDED.added_quantity,
        planned_amount = EXCLUDED.planned_amount,
        final_amount = EXCLUDED.final_amount,
        tax_amount = EXCLUDED.tax_amount,
        total_amount = EXCLUDED.total_amount,
        payment_method = EXCLUDED.payment_method,
        amount_paid = EXCLUDED.amount_paid,
        unpaid_balance = EXCLUDED.unpaid_balance,
        customer_signature = EXCLUDED.customer_signature,
        driver_signature = EXCLUDED.driver_signature,
        supervisor_review_required = EXCLUDED.supervisor_review_required,
        notes = EXCLUDED.notes,
        completed_at = CASE WHEN EXCLUDED.status = 'completed' THEN COALESCE(delivery_settlements.completed_at, NOW()) ELSE NULL END,
        raw = EXCLUDED.raw,
        updated_at = NOW()
      RETURNING *
    `, [
      settlementId,
      cleanedStopId,
      orderRow?.id || null,
      cleanedDriverId,
      requestedStatus,
      requestedStatus === 'completed' ? completionStatus : null,
      nonDeliveryReason,
      totals.plannedQuantity,
      totals.deliveredQuantity,
      totals.rejectedQuantity,
      totals.damagedQuantity,
      totals.missingQuantity,
      totals.returnedQuantity,
      totals.addedQuantity,
      normalizeMoney(totals.plannedAmount),
      normalizeMoney(totals.finalAmount),
      taxAmount,
      totalAmount,
      paymentMethod,
      effectiveAmountPaid,
      unpaidBalance,
      customerSignature,
      driverSignature,
      supervisorReviewRequired,
      notes,
      JSON.stringify({
        source: 'driver_delivery_settlement',
        clientUpdatedAt: input.clientUpdatedAt || null
      })
    ]);

    await client.query('DELETE FROM delivery_settlement_items WHERE settlement_id = $1', [settlementId]);
    for (const item of normalizedItems) {
      await client.query(`
        INSERT INTO delivery_settlement_items (
          id, settlement_id, order_item_id, sku, product_name, brand,
          package_size, category, planned_quantity, delivered_quantity,
          rejected_quantity, damaged_quantity, missing_quantity, returned_quantity,
          added_quantity, unit_price, final_amount, adjustment_reason, notes, raw, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20::jsonb, NOW()
        )
      `, [
        item.id,
        settlementId,
        item.orderItemId,
        item.sku,
        item.productName,
        item.brand,
        item.packageSize,
        item.category,
        item.plannedQuantity,
        item.deliveredQuantity,
        item.rejectedQuantity,
        item.damagedQuantity,
        item.missingQuantity,
        item.returnedQuantity,
        item.addedQuantity,
        item.unitPrice,
        item.finalAmount,
        item.adjustmentReason,
        item.notes,
        JSON.stringify(item.raw || {})
      ]);
    }

    await client.query('DELETE FROM route_truck_inventory_allocations WHERE route_stop_id = $1', [cleanedStopId]);
    for (const [sku, allocation] of addedBySku) {
      await client.query(`
        INSERT INTO route_truck_inventory_allocations
          (id, manifest_id, route_stop_id, driver_id, sku, scanned_barcode, quantity, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        stableRepositoryId('truck_inventory_allocation', [cleanedStopId, sku]),
        stopRow.manifest_id,
        cleanedStopId,
        cleanedDriverId,
        sku,
        allocation.barcode,
        allocation.quantity
      ]);
    }

    if (orderRow && requestedStatus === 'completed') {
      await client.query(`
        DELETE FROM account_order_items
        WHERE order_id = $1
          AND raw->>'settlementId' = $2
          AND raw->>'settlementAdditional' = 'true'
      `, [orderRow.id, settlementId]);

      for (const item of normalizedItems) {
        if (item.orderItemId) {
          const nonDeliveredQuantity = item.rejectedQuantity + item.damagedQuantity + item.missingQuantity + item.returnedQuantity;
          await client.query(`
            UPDATE account_order_items
            SET
              deduction_quantity = $2,
              deduction_amount = $3,
              net_amount = $4,
              updated_at = NOW()
            WHERE id = $1
          `, [
            item.orderItemId,
            nonDeliveredQuantity,
            normalizeMoney(nonDeliveredQuantity * item.unitPrice),
            normalizeMoney(item.deliveredQuantity * item.unitPrice)
          ]);
        } else if (item.addedQuantity > 0) {
          await client.query(`
            INSERT INTO account_order_items (
              id, order_id, sku, product_name, brand, package_size, category,
              quantity, unit_price, gross_amount, deduction_quantity,
              deduction_amount, net_amount, raw, updated_at
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, 0,
              0, $10, $11::jsonb, NOW()
            )
          `, [
            stableRepositoryId('order_item_addition', [settlementId, item.id]),
            orderRow.id,
            item.sku,
            item.productName,
            item.brand,
            item.packageSize,
            item.category,
            item.addedQuantity,
            item.unitPrice,
            item.finalAmount,
            JSON.stringify({
              settlementId,
              settlementAdditional: true,
              adjustmentReason: item.adjustmentReason
            })
          ]);
        }
      }

      await client.query(`
        UPDATE account_orders
        SET
          subtotal_amount = $2,
          deduction_amount = $3,
          net_amount = $4,
          status = CASE WHEN $5 = 'completed' THEN 'delivered' ELSE status END,
          raw = COALESCE(raw, '{}'::jsonb) || $6::jsonb,
          updated_at = NOW()
        WHERE id = $1
      `, [
        orderRow.id,
        normalizeMoney(totals.plannedAmount + normalizedItems.reduce((sum, item) => sum + (item.addedQuantity * item.unitPrice), 0)),
        normalizeMoney(normalizedItems.reduce((sum, item) =>
          sum + ((item.rejectedQuantity + item.damagedQuantity + item.missingQuantity + item.returnedQuantity) * item.unitPrice), 0)),
        normalizeMoney(totals.finalAmount),
        requestedStatus,
        JSON.stringify({
          deliverySettlementId: settlementId,
          deliverySettlementStatus: requestedStatus
        })
      ]);
    }

    return deliverySettlementFromRow(settlementResult.rows[0], normalizedItems);
  });

  if (!saved) return null;
  return getDriverStopDeliverySettlement(cleanedStopId, cleanedDriverId);
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

  const routeContextResult = await postgres.query(`
    SELECT
      stop.account_name,
      stop.destination_address,
      stop.city,
      stop.state_code,
      stop.postal_code,
      stop.case_count,
      stop.pallet_count,
      stop.status,
      stop.stop_sequence,
      manifest.route_date,
      manifest.route_number,
      manifest.route_name,
      manifest.assigned_driver_id,
      manifest.assigned_driver_name
    FROM daily_route_stops AS stop
    JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
    WHERE stop.account_number = $1
    ORDER BY manifest.route_date DESC, manifest.created_at DESC, stop.stop_sequence ASC
    LIMIT 5
  `, [cleanedAccountNumber]);

  const recentOrders = await listAccountOrders({ accountNumber: cleanedAccountNumber, limit: 10 });
  const latestRouteContext = routeContextResult.rows[0] || null;
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
    accountName: totals.account_name || latestRouteContext?.account_name || null,
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
    recentOrders,
    recentRouteStops: routeContextResult.rows.map((row) => ({
      routeDate: toDateOnly(row.route_date),
      routeNumber: row.route_number || null,
      routeName: row.route_name || null,
      stopSequence: Number(row.stop_sequence) || null,
      accountName: row.account_name || null,
      destinationAddress: row.destination_address || null,
      city: row.city || null,
      stateCode: row.state_code || null,
      postalCode: row.postal_code || null,
      caseCount: Number(row.case_count) || 0,
      palletCount: Number(row.pallet_count) || 0,
      status: row.status || null,
      assignedDriverId: row.assigned_driver_id || null,
      assignedDriverName: row.assigned_driver_name || null
    }))
  };
}

async function getAccountForecastSignals(accountNumber, options = {}) {
  const cleanedAccountNumber = cleanRepositoryText(accountNumber, 120);
  if (!cleanedAccountNumber) {
    const error = new Error('accountNumber is required.');
    error.status = 400;
    throw error;
  }

  const periodDays = normalizeLimit(options.periodDays, 90, 365);
  const asOfDate = toDateOnly(options.routeDate || options.asOfDate) || new Date().toISOString().slice(0, 10);
  const [orderResult, productResult, stopResult, reasonResult] = await Promise.all([
    postgres.query(`
      WITH dated_orders AS (
        SELECT
          *,
          COALESCE(delivery_date, order_date) AS activity_date
        FROM account_orders
        WHERE account_number = $1
          AND COALESCE(delivery_date, order_date) BETWEEN
            $3::date - (($2::int * 2 - 1) * INTERVAL '1 day')
            AND $3::date
      ),
      ordered_activity AS (
        SELECT
          activity_date,
          activity_date - LAG(activity_date) OVER (ORDER BY activity_date, created_at) AS order_gap
        FROM dated_orders
        WHERE activity_date IS NOT NULL
      )
      SELECT
        COUNT(*) FILTER (
          WHERE activity_date >= $3::date - (($2::int - 1) * INTERVAL '1 day')
        )::int AS current_order_count,
        COUNT(*) FILTER (
          WHERE activity_date < $3::date - (($2::int - 1) * INTERVAL '1 day')
        )::int AS previous_order_count,
        COALESCE(SUM(subtotal_amount) FILTER (
          WHERE activity_date >= $3::date - (($2::int - 1) * INTERVAL '1 day')
        ), 0) AS current_subtotal_amount,
        COALESCE(SUM(deduction_amount) FILTER (
          WHERE activity_date >= $3::date - (($2::int - 1) * INTERVAL '1 day')
        ), 0) AS current_deduction_amount,
        COALESCE(SUM(net_amount) FILTER (
          WHERE activity_date >= $3::date - (($2::int - 1) * INTERVAL '1 day')
        ), 0) AS current_net_amount,
        COALESCE(SUM(subtotal_amount) FILTER (
          WHERE activity_date < $3::date - (($2::int - 1) * INTERVAL '1 day')
        ), 0) AS previous_subtotal_amount,
        COALESCE(SUM(deduction_amount) FILTER (
          WHERE activity_date < $3::date - (($2::int - 1) * INTERVAL '1 day')
        ), 0) AS previous_deduction_amount,
        COALESCE(SUM(net_amount) FILTER (
          WHERE activity_date < $3::date - (($2::int - 1) * INTERVAL '1 day')
        ), 0) AS previous_net_amount,
        MIN(activity_date) FILTER (
          WHERE activity_date >= $3::date - (($2::int - 1) * INTERVAL '1 day')
        ) AS current_first_order_date,
        MAX(activity_date) FILTER (
          WHERE activity_date >= $3::date - (($2::int - 1) * INTERVAL '1 day')
        ) AS current_last_order_date,
        MIN(activity_date) FILTER (
          WHERE activity_date < $3::date - (($2::int - 1) * INTERVAL '1 day')
        ) AS previous_first_order_date,
        MAX(activity_date) FILTER (
          WHERE activity_date < $3::date - (($2::int - 1) * INTERVAL '1 day')
        ) AS previous_last_order_date,
        (
          SELECT AVG(order_gap::numeric)
          FROM ordered_activity
          WHERE order_gap IS NOT NULL
        ) AS average_order_interval_days
      FROM dated_orders
    `, [cleanedAccountNumber, periodDays, asOfDate]),
    postgres.query(`
      SELECT
        item.sku,
        item.product_name,
        MAX(item.brand) AS brand,
        MAX(item.category) AS category,
        COALESCE(SUM(item.quantity) FILTER (
          WHERE COALESCE(ord.delivery_date, ord.order_date) >=
            $3::date - (($2::int - 1) * INTERVAL '1 day')
        ), 0) AS current_quantity,
        COALESCE(SUM(item.net_amount) FILTER (
          WHERE COALESCE(ord.delivery_date, ord.order_date) >=
            $3::date - (($2::int - 1) * INTERVAL '1 day')
        ), 0) AS current_net_amount,
        COALESCE(SUM(item.quantity) FILTER (
          WHERE COALESCE(ord.delivery_date, ord.order_date) <
            $3::date - (($2::int - 1) * INTERVAL '1 day')
        ), 0) AS previous_quantity,
        COALESCE(SUM(item.net_amount) FILTER (
          WHERE COALESCE(ord.delivery_date, ord.order_date) <
            $3::date - (($2::int - 1) * INTERVAL '1 day')
        ), 0) AS previous_net_amount
      FROM account_order_items AS item
      JOIN account_orders AS ord ON ord.id = item.order_id
      WHERE ord.account_number = $1
        AND COALESCE(ord.delivery_date, ord.order_date) BETWEEN
          $3::date - (($2::int * 2 - 1) * INTERVAL '1 day')
          AND $3::date
      GROUP BY item.sku, item.product_name
      ORDER BY current_quantity DESC, current_net_amount DESC
      LIMIT 20
    `, [cleanedAccountNumber, periodDays, asOfDate]),
    postgres.query(`
      SELECT
        COUNT(stop.id) FILTER (
          WHERE manifest.route_date >= $3::date - (($2::int - 1) * INTERVAL '1 day')
        )::int AS current_route_stop_count,
        COUNT(stop.id) FILTER (
          WHERE manifest.route_date >= $3::date - (($2::int - 1) * INTERVAL '1 day')
            AND stop.status IN ('completed', 'departed', 'skipped', 'undelivered')
        )::int AS current_finished_stop_count,
        COUNT(stop.id) FILTER (
          WHERE manifest.route_date >= $3::date - (($2::int - 1) * INTERVAL '1 day')
            AND stop.status = 'undelivered'
        )::int AS current_undelivered_stop_count,
        COUNT(stop.id) FILTER (
          WHERE manifest.route_date < $3::date - (($2::int - 1) * INTERVAL '1 day')
        )::int AS previous_route_stop_count,
        COUNT(stop.id) FILTER (
          WHERE manifest.route_date < $3::date - (($2::int - 1) * INTERVAL '1 day')
            AND stop.status IN ('completed', 'departed', 'skipped', 'undelivered')
        )::int AS previous_finished_stop_count,
        COUNT(stop.id) FILTER (
          WHERE manifest.route_date < $3::date - (($2::int - 1) * INTERVAL '1 day')
            AND stop.status = 'undelivered'
        )::int AS previous_undelivered_stop_count
      FROM daily_route_stops AS stop
      JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
      WHERE stop.account_number = $1
        AND manifest.route_date BETWEEN
          $3::date - (($2::int * 2 - 1) * INTERVAL '1 day')
          AND $3::date
    `, [cleanedAccountNumber, periodDays, asOfDate]),
    postgres.query(`
      SELECT
        COALESCE(NULLIF(stop.non_delivery_reason, ''), 'unspecified') AS reason,
        COUNT(*)::int AS count
      FROM daily_route_stops AS stop
      JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
      WHERE stop.account_number = $1
        AND stop.status = 'undelivered'
        AND manifest.route_date >= $3::date - (($2::int - 1) * INTERVAL '1 day')
        AND manifest.route_date <= $3::date
      GROUP BY COALESCE(NULLIF(stop.non_delivery_reason, ''), 'unspecified')
      ORDER BY count DESC
    `, [cleanedAccountNumber, periodDays, asOfDate])
  ]);

  const order = orderResult.rows[0] || {};
  const stop = stopResult.rows[0] || {};
  const currentItemQuantity = productResult.rows.reduce(
    (sum, row) => sum + normalizeQuantity(row.current_quantity),
    0
  );
  const previousItemQuantity = productResult.rows.reduce(
    (sum, row) => sum + normalizeQuantity(row.previous_quantity),
    0
  );
  const currentPeriodStart = new Date(`${asOfDate}T00:00:00.000Z`);
  currentPeriodStart.setUTCDate(currentPeriodStart.getUTCDate() - (periodDays - 1));
  const previousPeriodEnd = new Date(currentPeriodStart);
  previousPeriodEnd.setUTCDate(previousPeriodEnd.getUTCDate() - 1);
  const previousPeriodStart = new Date(previousPeriodEnd);
  previousPeriodStart.setUTCDate(previousPeriodStart.getUTCDate() - (periodDays - 1));

  return {
    accountNumber: cleanedAccountNumber,
    asOfDate,
    periodDays,
    averageOrderIntervalDays: order.average_order_interval_days == null
      ? null
      : Number(order.average_order_interval_days),
    currentPeriod: {
      periodStart: currentPeriodStart.toISOString().slice(0, 10),
      periodEnd: asOfDate,
      orderCount: Number(order.current_order_count) || 0,
      subtotalAmount: normalizeMoney(order.current_subtotal_amount),
      deductionAmount: normalizeMoney(order.current_deduction_amount),
      netAmount: normalizeMoney(order.current_net_amount),
      itemQuantity: normalizeQuantity(currentItemQuantity),
      firstOrderDate: toDateOnly(order.current_first_order_date),
      lastOrderDate: toDateOnly(order.current_last_order_date),
      routeStopCount: Number(stop.current_route_stop_count) || 0,
      finishedStopCount: Number(stop.current_finished_stop_count) || 0,
      undeliveredStopCount: Number(stop.current_undelivered_stop_count) || 0
    },
    previousPeriod: {
      periodStart: previousPeriodStart.toISOString().slice(0, 10),
      periodEnd: previousPeriodEnd.toISOString().slice(0, 10),
      orderCount: Number(order.previous_order_count) || 0,
      subtotalAmount: normalizeMoney(order.previous_subtotal_amount),
      deductionAmount: normalizeMoney(order.previous_deduction_amount),
      netAmount: normalizeMoney(order.previous_net_amount),
      itemQuantity: normalizeQuantity(previousItemQuantity),
      firstOrderDate: toDateOnly(order.previous_first_order_date),
      lastOrderDate: toDateOnly(order.previous_last_order_date),
      routeStopCount: Number(stop.previous_route_stop_count) || 0,
      finishedStopCount: Number(stop.previous_finished_stop_count) || 0,
      undeliveredStopCount: Number(stop.previous_undelivered_stop_count) || 0
    },
    products: productResult.rows.map((row) => ({
      sku: row.sku || null,
      productName: row.product_name,
      brand: row.brand || null,
      category: row.category || null,
      currentQuantity: normalizeQuantity(row.current_quantity),
      currentNetAmount: normalizeMoney(row.current_net_amount),
      previousQuantity: normalizeQuantity(row.previous_quantity),
      previousNetAmount: normalizeMoney(row.previous_net_amount)
    })),
    failureReasons: reasonResult.rows.map((row) => ({
      reason: row.reason,
      count: Number(row.count) || 0
    }))
  };
}

async function getDeliveryFailureSignals(options = {}) {
  const periodDays = normalizeLimit(options.periodDays, 90, 365);
  const asOfDate = toDateOnly(options.routeDate || options.asOfDate) || new Date().toISOString().slice(0, 10);
  const accountNumber = cleanRepositoryText(options.accountNumber, 120) || null;
  const result = await postgres.query(`
    SELECT
      COUNT(stop.id) FILTER (
        WHERE manifest.route_date >= $2::date - (($1::int - 1) * INTERVAL '1 day')
          AND stop.status IN ('completed', 'departed', 'skipped', 'undelivered')
      )::int AS current_finished_stop_count,
      COUNT(stop.id) FILTER (
        WHERE manifest.route_date >= $2::date - (($1::int - 1) * INTERVAL '1 day')
          AND stop.status = 'undelivered'
      )::int AS current_undelivered_stop_count,
      COUNT(stop.id) FILTER (
        WHERE manifest.route_date < $2::date - (($1::int - 1) * INTERVAL '1 day')
          AND stop.status IN ('completed', 'departed', 'skipped', 'undelivered')
      )::int AS previous_finished_stop_count,
      COUNT(stop.id) FILTER (
        WHERE manifest.route_date < $2::date - (($1::int - 1) * INTERVAL '1 day')
          AND stop.status = 'undelivered'
      )::int AS previous_undelivered_stop_count
    FROM daily_route_stops AS stop
    JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
    WHERE manifest.route_date BETWEEN
      $2::date - (($1::int * 2 - 1) * INTERVAL '1 day')
      AND $2::date
      AND ($3::text IS NULL OR stop.account_number = $3)
  `, [periodDays, asOfDate, accountNumber]);
  const reasonResult = await postgres.query(`
    SELECT
      COALESCE(NULLIF(stop.non_delivery_reason, ''), 'unspecified') AS reason,
      COUNT(*)::int AS count
    FROM daily_route_stops AS stop
    JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
    WHERE stop.status = 'undelivered'
      AND manifest.route_date >= $2::date - (($1::int - 1) * INTERVAL '1 day')
      AND manifest.route_date <= $2::date
      AND ($3::text IS NULL OR stop.account_number = $3)
    GROUP BY COALESCE(NULLIF(stop.non_delivery_reason, ''), 'unspecified')
    ORDER BY count DESC
  `, [periodDays, asOfDate, accountNumber]);

  const row = result.rows[0] || {};
  const currentPeriodStart = new Date(`${asOfDate}T00:00:00.000Z`);
  currentPeriodStart.setUTCDate(currentPeriodStart.getUTCDate() - (periodDays - 1));
  const previousPeriodEnd = new Date(currentPeriodStart);
  previousPeriodEnd.setUTCDate(previousPeriodEnd.getUTCDate() - 1);
  const previousPeriodStart = new Date(previousPeriodEnd);
  previousPeriodStart.setUTCDate(previousPeriodStart.getUTCDate() - (periodDays - 1));

  return {
    accountNumber,
    asOfDate,
    periodDays,
    currentPeriod: {
      periodStart: currentPeriodStart.toISOString().slice(0, 10),
      periodEnd: asOfDate,
      finishedStopCount: Number(row.current_finished_stop_count) || 0,
      undeliveredStopCount: Number(row.current_undelivered_stop_count) || 0
    },
    previousPeriod: {
      periodStart: previousPeriodStart.toISOString().slice(0, 10),
      periodEnd: previousPeriodEnd.toISOString().slice(0, 10),
      finishedStopCount: Number(row.previous_finished_stop_count) || 0,
      undeliveredStopCount: Number(row.previous_undelivered_stop_count) || 0
    },
    failureReasons: reasonResult.rows.map((reason) => ({
      reason: reason.reason,
      count: Number(reason.count) || 0
    }))
  };
}

async function listProductDemandSignals(options = {}) {
  const periodDays = normalizeLimit(options.periodDays, 180, 1095);
  const limit = normalizeLimit(options.limit, 25, 100);
  const asOfDate = toDateOnly(options.routeDate) || new Date().toISOString().slice(0, 10);
  const values = [periodDays, asOfDate];
  const where = [
    `COALESCE(ord.delivery_date, ord.order_date) BETWEEN
      $2::date - (($1::int * 2 - 1) * INTERVAL '1 day')
      AND $2::date`
  ];

  if (options.accountNumber) {
    values.push(cleanRepositoryText(options.accountNumber, 120));
    where.push(`ord.account_number = $${values.length}`);
  }

  values.push(limit);
  const result = await postgres.query(`
    SELECT
      item.sku,
      item.product_name,
      MAX(item.brand) AS brand,
      MAX(item.category) AS category,
      COUNT(DISTINCT ord.id) FILTER (
        WHERE COALESCE(ord.delivery_date, ord.order_date) >=
          $2::date - (($1::int - 1) * INTERVAL '1 day')
      )::int AS current_order_count,
      COUNT(DISTINCT ord.id) FILTER (
        WHERE COALESCE(ord.delivery_date, ord.order_date) <
          $2::date - (($1::int - 1) * INTERVAL '1 day')
      )::int AS previous_order_count,
      COUNT(DISTINCT ord.account_number) FILTER (
        WHERE COALESCE(ord.delivery_date, ord.order_date) >=
          $2::date - (($1::int - 1) * INTERVAL '1 day')
      )::int AS current_account_count,
      COALESCE(SUM(item.quantity) FILTER (
        WHERE COALESCE(ord.delivery_date, ord.order_date) >=
          $2::date - (($1::int - 1) * INTERVAL '1 day')
      ), 0) AS current_quantity,
      COALESCE(SUM(item.quantity) FILTER (
        WHERE COALESCE(ord.delivery_date, ord.order_date) <
          $2::date - (($1::int - 1) * INTERVAL '1 day')
      ), 0) AS previous_quantity,
      COALESCE(SUM(item.gross_amount) FILTER (
        WHERE COALESCE(ord.delivery_date, ord.order_date) >=
          $2::date - (($1::int - 1) * INTERVAL '1 day')
      ), 0) AS current_gross_amount,
      COALESCE(SUM(item.deduction_amount) FILTER (
        WHERE COALESCE(ord.delivery_date, ord.order_date) >=
          $2::date - (($1::int - 1) * INTERVAL '1 day')
      ), 0) AS current_deduction_amount,
      COALESCE(SUM(item.net_amount) FILTER (
        WHERE COALESCE(ord.delivery_date, ord.order_date) >=
          $2::date - (($1::int - 1) * INTERVAL '1 day')
      ), 0) AS current_net_amount,
      COALESCE(SUM(item.net_amount) FILTER (
        WHERE COALESCE(ord.delivery_date, ord.order_date) <
          $2::date - (($1::int - 1) * INTERVAL '1 day')
      ), 0) AS previous_net_amount,
      MIN(COALESCE(ord.delivery_date, ord.order_date)) AS first_order_date,
      MAX(COALESCE(ord.delivery_date, ord.order_date)) AS last_order_date
    FROM account_order_items AS item
    JOIN account_orders AS ord ON ord.id = item.order_id
    WHERE ${where.join(' AND ')}
    GROUP BY item.sku, item.product_name
    ORDER BY current_quantity DESC, current_net_amount DESC
    LIMIT $${values.length}
  `, values);

  return result.rows.map((row) => ({
    sku: row.sku || null,
    productName: row.product_name,
    brand: row.brand || null,
    category: row.category || null,
    orderCount: Number(row.current_order_count) || 0,
    currentOrderCount: Number(row.current_order_count) || 0,
    previousOrderCount: Number(row.previous_order_count) || 0,
    accountCount: Number(row.current_account_count) || 0,
    quantity: normalizeQuantity(row.current_quantity),
    currentQuantity: normalizeQuantity(row.current_quantity),
    previousQuantity: normalizeQuantity(row.previous_quantity),
    grossAmount: normalizeMoney(row.current_gross_amount),
    deductionAmount: normalizeMoney(row.current_deduction_amount),
    netAmount: normalizeMoney(row.current_net_amount),
    currentNetAmount: normalizeMoney(row.current_net_amount),
    previousNetAmount: normalizeMoney(row.previous_net_amount),
    firstOrderDate: toDateOnly(row.first_order_date),
    lastOrderDate: toDateOnly(row.last_order_date)
  }));
}

async function listRouteCompletionSignals(options = {}) {
  const routeDate = toDateOnly(options.routeDate) || new Date().toISOString().slice(0, 10);
  const limit = normalizeLimit(options.limit, 100, 300);
  const result = await postgres.query(`
    SELECT
      manifest.id,
      manifest.route_date,
      manifest.route_number,
      manifest.route_name,
      manifest.assigned_driver_id,
      manifest.assigned_driver_name,
      manifest.status,
      manifest.planned_start_at,
      manifest.planned_end_at,
      manifest.started_at,
      manifest.completed_at,
      manifest.total_stops,
      manifest.total_pallets,
      manifest.total_cases,
      COUNT(stop.id)::int AS recorded_stop_count,
      COUNT(stop.id) FILTER (
        WHERE stop.status IN ('completed', 'departed', 'skipped', 'undelivered')
      )::int AS finished_stop_count,
      COUNT(stop.id) FILTER (WHERE stop.status = 'undelivered')::int AS undelivered_stop_count,
      COUNT(stop.id) FILTER (
        WHERE stop.status NOT IN ('completed', 'departed', 'skipped', 'undelivered')
      )::int AS remaining_stop_count,
      COALESCE(SUM(
        CASE
          WHEN stop.status NOT IN ('completed', 'departed', 'skipped', 'undelivered')
            THEN COALESCE(stop.planned_service_minutes, 0) + COALESCE(stop.drive_minutes_to_next, 0)
          ELSE 0
        END
      ), 0)::int AS remaining_planned_minutes,
      MAX(COALESCE(
        stop.actual_departure_at,
        stop.actual_completed_at,
        stop.actual_service_started_at,
        stop.actual_arrival_at
      )) AS latest_actual_activity_at,
      MAX(stop.planned_departure_at) FILTER (
        WHERE stop.status IN ('completed', 'departed', 'skipped', 'undelivered')
      ) AS latest_finished_planned_departure_at,
      EXTRACT(EPOCH FROM (
        MAX(COALESCE(
          stop.actual_departure_at,
          stop.actual_completed_at,
          stop.actual_service_started_at,
          stop.actual_arrival_at
        )) -
        MAX(stop.planned_departure_at) FILTER (
          WHERE stop.status IN ('completed', 'departed', 'skipped', 'undelivered')
        )
      )) / 60.0 AS schedule_variance_minutes
    FROM daily_route_manifests AS manifest
    LEFT JOIN daily_route_stops AS stop ON stop.manifest_id = manifest.id
    WHERE manifest.route_date = $1::date
    GROUP BY manifest.id
    ORDER BY manifest.route_number ASC
    LIMIT $2
  `, [routeDate, limit]);

  return result.rows.map((row) => ({
    id: row.id,
    routeDate: toDateOnly(row.route_date),
    routeNumber: row.route_number,
    routeName: row.route_name || null,
    assignedDriverId: row.assigned_driver_id || null,
    assignedDriverName: row.assigned_driver_name || null,
    status: row.status || null,
    plannedStartAt: toIsoString(row.planned_start_at),
    plannedEndAt: toIsoString(row.planned_end_at),
    startedAt: toIsoString(row.started_at),
    completedAt: toIsoString(row.completed_at),
    finalInventoryPrintedAt: toIsoString(row.final_inventory_printed_at),
    actualDurationMinutes: row.actual_duration_minutes == null ? null : Number(row.actual_duration_minutes),
    finalInventorySupervisorStatus: row.final_inventory_supervisor_status || null,
    totalStops: Number(row.total_stops) || 0,
    totalPallets: Number(row.total_pallets) || 0,
    totalCases: Number(row.total_cases) || 0,
    recordedStopCount: Number(row.recorded_stop_count) || 0,
    finishedStopCount: Number(row.finished_stop_count) || 0,
    undeliveredStopCount: Number(row.undelivered_stop_count) || 0,
    remainingStopCount: Number(row.remaining_stop_count) || 0,
    remainingPlannedMinutes: Number(row.remaining_planned_minutes) || 0,
    latestActualActivityAt: toIsoString(row.latest_actual_activity_at),
    latestFinishedPlannedDepartureAt: toIsoString(row.latest_finished_planned_departure_at),
    scheduleVarianceMinutes: row.schedule_variance_minutes == null
      ? null
      : Math.round(Number(row.schedule_variance_minutes))
  }));
}

async function listOperationalHeatmapSignals(options = {}) {
  const periodDays = normalizeLimit(options.periodDays, 30, 365);
  const routeDate = toDateOnly(options.routeDate) || null;
  const supervisorUsername = cleanRepositoryText(options.supervisorUsername, 120) || null;
  const limit = normalizeLimit(options.limit, 1000, 5000);
  const result = await postgres.query(`
    WITH signals AS (
      SELECT
        'delay'::text AS category,
        'late_stop'::text AS signal_type,
        LEAST(10.0, GREATEST(
          1.0,
          EXTRACT(EPOCH FROM (stop.actual_arrival_at - stop.planned_arrival_at)) / 900.0
        )) AS weight,
        stop.latitude,
        stop.longitude,
        stop.actual_arrival_at AS occurred_at,
        manifest.route_number,
        stop.account_number,
        stop.account_name,
        stop.destination_address,
        stop.city,
        stop.state_code,
        manifest.start_location AS distribution_center,
        driver.territory,
        driver.route_group,
        driver.supervisor_username,
        driver.team_name,
        driver.driver_id,
        'route_stop'::text AS source_type,
        stop.id::text AS source_id,
        manifest.id::text AS manifest_id,
        stop.id::text AS stop_id,
        NULL::text AS route_session_id,
        NULL::text AS account_order_id,
        jsonb_build_object(
          'plannedArrivalAt', stop.planned_arrival_at,
          'actualArrivalAt', stop.actual_arrival_at,
          'delayMinutes', ROUND(EXTRACT(EPOCH FROM (stop.actual_arrival_at - stop.planned_arrival_at)) / 60.0)
        ) AS details
      FROM daily_route_stops AS stop
      JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
      LEFT JOIN drivers AS driver ON driver.driver_id = manifest.assigned_driver_id
      WHERE stop.latitude IS NOT NULL
        AND stop.longitude IS NOT NULL
        AND stop.actual_arrival_at > stop.planned_arrival_at + INTERVAL '10 minutes'
        AND manifest.route_date >= CURRENT_DATE - ($1::int * INTERVAL '1 day')
        AND ($2::date IS NULL OR manifest.route_date = $2::date)
        AND ($3::text IS NULL OR LOWER(COALESCE(driver.supervisor_username, '')) = LOWER($3::text))

      UNION ALL

      SELECT
        'delivery_failure'::text AS category,
        COALESCE(NULLIF(stop.non_delivery_reason, ''), 'undelivered')::text AS signal_type,
        6.0 AS weight,
        stop.latitude,
        stop.longitude,
        COALESCE(stop.non_delivery_reported_at, stop.updated_at) AS occurred_at,
        manifest.route_number,
        stop.account_number,
        stop.account_name,
        stop.destination_address,
        stop.city,
        stop.state_code,
        manifest.start_location AS distribution_center,
        driver.territory,
        driver.route_group,
        driver.supervisor_username,
        driver.team_name,
        driver.driver_id,
        'route_stop'::text AS source_type,
        stop.id::text AS source_id,
        manifest.id::text AS manifest_id,
        stop.id::text AS stop_id,
        NULL::text AS route_session_id,
        NULL::text AS account_order_id,
        jsonb_build_object(
          'reason', stop.non_delivery_reason,
          'redeliveryStatus', stop.redelivery_status
        ) AS details
      FROM daily_route_stops AS stop
      JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
      LEFT JOIN drivers AS driver ON driver.driver_id = manifest.assigned_driver_id
      WHERE stop.status = 'undelivered'
        AND stop.latitude IS NOT NULL
        AND stop.longitude IS NOT NULL
        AND manifest.route_date >= CURRENT_DATE - ($1::int * INTERVAL '1 day')
        AND ($2::date IS NULL OR manifest.route_date = $2::date)
        AND ($3::text IS NULL OR LOWER(COALESCE(driver.supervisor_username, '')) = LOWER($3::text))

      UNION ALL

      SELECT
        'deduction'::text AS category,
        deduction.reason::text AS signal_type,
        LEAST(10.0, GREATEST(2.0, deduction.amount / 25.0)) AS weight,
        stop.latitude,
        stop.longitude,
        deduction.created_at AS occurred_at,
        manifest.route_number,
        deduction.account_number,
        stop.account_name,
        stop.destination_address,
        stop.city,
        stop.state_code,
        manifest.start_location AS distribution_center,
        driver.territory,
        driver.route_group,
        driver.supervisor_username,
        driver.team_name,
        driver.driver_id,
        'delivery_deduction'::text AS source_type,
        deduction.id::text AS source_id,
        manifest.id::text AS manifest_id,
        stop.id::text AS stop_id,
        NULL::text AS route_session_id,
        deduction.order_id::text AS account_order_id,
        jsonb_build_object(
          'sku', deduction.sku,
          'productName', deduction.product_name,
          'quantity', deduction.quantity,
          'amount', deduction.amount
        ) AS details
      FROM delivery_deductions AS deduction
      JOIN daily_route_stops AS stop ON stop.id = deduction.route_stop_id
      JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
      LEFT JOIN drivers AS driver ON driver.driver_id = manifest.assigned_driver_id
      WHERE stop.latitude IS NOT NULL
        AND stop.longitude IS NOT NULL
        AND deduction.created_at >= NOW() - ($1::int * INTERVAL '1 day')
        AND ($2::date IS NULL OR manifest.route_date = $2::date)
        AND ($3::text IS NULL OR LOWER(COALESCE(driver.supervisor_username, '')) = LOWER($3::text))

      UNION ALL

      SELECT
        CASE
          WHEN LOWER(COALESCE(event.event_type, '')) ~ '(hazard|bridge|clearance|no[_ -]?truck|residential)'
            THEN 'hazard'::text
          ELSE 'route_event'::text
        END AS category,
        event.event_type::text AS signal_type,
        CASE LOWER(COALESCE(event.severity, ''))
          WHEN 'critical' THEN 10.0
          WHEN 'high' THEN 8.0
          WHEN 'warning' THEN 6.0
          WHEN 'medium' THEN 5.0
          ELSE 3.0
        END AS weight,
        event.latitude,
        event.longitude,
        event.created_at AS occurred_at,
        COALESCE(event.payload->>'routeNumber', event.payload->>'route_number') AS route_number,
        COALESCE(event.payload->>'accountNumber', event.payload->>'account_number') AS account_number,
        COALESCE(event.payload->>'accountName', event.payload->>'account_name') AS account_name,
        COALESCE(
          event.payload->>'destinationAddress',
          event.payload->>'destination_address',
          session.destination_label
        ) AS destination_address,
        COALESCE(
          event.payload->>'city',
          event.payload #>> '{destination,city}',
          event.payload #>> '{hazard,location_city}'
        ) AS city,
        UPPER(COALESCE(
          event.payload->>'stateCode',
          event.payload->>'state_code',
          event.payload #>> '{destination,stateCode}',
          event.payload #>> '{hazard,state_code}',
          event.payload #>> '{hazard,state}'
        )) AS state_code,
        COALESCE(
          event.payload->>'distributionCenter',
          event.payload->>'distribution_center',
          event.payload->>'startLocation'
        ) AS distribution_center,
        driver.territory,
        driver.route_group,
        driver.supervisor_username,
        driver.team_name,
        driver.driver_id,
        'route_event'::text AS source_type,
        event.id::text AS source_id,
        NULL::text AS manifest_id,
        NULL::text AS stop_id,
        event.route_session_id::text AS route_session_id,
        NULL::text AS account_order_id,
        event.payload AS details
      FROM route_session_events AS event
      LEFT JOIN route_sessions AS session ON session.id = event.route_session_id
      LEFT JOIN drivers AS driver ON driver.driver_id = COALESCE(
        event.payload #>> '{driver,driverId}',
        event.payload->>'driverId',
        event.payload->>'driver_id'
      )
      WHERE event.latitude IS NOT NULL
        AND event.longitude IS NOT NULL
        AND event.created_at >= NOW() - ($1::int * INTERVAL '1 day')
        AND ($2::date IS NULL OR event.created_at::date = $2::date)
        AND ($3::text IS NULL OR LOWER(COALESCE(driver.supervisor_username, '')) = LOWER($3::text))

      UNION ALL

      SELECT
        'revenue'::text AS category,
        'recorded_net_revenue'::text AS signal_type,
        LEAST(10.0, GREATEST(1.0, order_record.net_amount / 250.0)) AS weight,
        stop.latitude,
        stop.longitude,
        COALESCE(order_record.delivery_date, order_record.order_date)::timestamptz AS occurred_at,
        manifest.route_number,
        order_record.account_number,
        COALESCE(order_record.account_name, stop.account_name) AS account_name,
        stop.destination_address,
        stop.city,
        stop.state_code,
        manifest.start_location AS distribution_center,
        driver.territory,
        driver.route_group,
        driver.supervisor_username,
        driver.team_name,
        driver.driver_id,
        'account_order'::text AS source_type,
        order_record.id::text AS source_id,
        manifest.id::text AS manifest_id,
        stop.id::text AS stop_id,
        NULL::text AS route_session_id,
        order_record.id::text AS account_order_id,
        jsonb_build_object(
          'invoiceNumber', order_record.invoice_number,
          'subtotalAmount', order_record.subtotal_amount,
          'deductionAmount', order_record.deduction_amount,
          'netAmount', order_record.net_amount
        ) AS details
      FROM account_orders AS order_record
      JOIN daily_route_stops AS stop ON stop.id = order_record.route_stop_id
      LEFT JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
      LEFT JOIN drivers AS driver ON driver.driver_id = manifest.assigned_driver_id
      WHERE stop.latitude IS NOT NULL
        AND stop.longitude IS NOT NULL
        AND COALESCE(order_record.delivery_date, order_record.order_date, CURRENT_DATE)
          >= CURRENT_DATE - ($1::int * INTERVAL '1 day')
        AND ($2::date IS NULL OR COALESCE(order_record.delivery_date, order_record.order_date) = $2::date)
        AND ($3::text IS NULL OR LOWER(COALESCE(driver.supervisor_username, '')) = LOWER($3::text))
    )
    SELECT *
    FROM signals
    ORDER BY occurred_at DESC
    LIMIT $4
  `, [periodDays, routeDate, supervisorUsername, limit]);

  const filters = {
    stateCode: cleanRepositoryText(options.stateCode, 8).toUpperCase(),
    city: cleanRepositoryText(options.city, 160).toLowerCase(),
    territory: cleanRepositoryText(options.territory, 160).toLowerCase(),
    routeGroup: cleanRepositoryText(options.routeGroup, 160).toLowerCase(),
    distributionCenter: cleanRepositoryText(options.distributionCenter, 200).toLowerCase()
  };

  return result.rows
    .map((row) => {
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      return {
        category: row.category,
        signalType: row.signal_type,
        weight: Number(row.weight) || 0,
        latitude,
        longitude,
        occurredAt: toIsoString(row.occurred_at),
        routeNumber: row.route_number || null,
        accountNumber: row.account_number || null,
        accountName: row.account_name || null,
        destinationAddress: row.destination_address || null,
        city: row.city || null,
        stateCode: String(row.state_code || inferServiceAreaStateCode(latitude, longitude) || '').toUpperCase() || null,
        distributionCenter: row.distribution_center || null,
        territory: row.territory || null,
        routeGroup: row.route_group || null,
        supervisorUsername: row.supervisor_username || null,
        teamName: row.team_name || null,
        driverId: row.driver_id || null,
        sourceType: row.source_type || null,
        sourceId: row.source_id || null,
        manifestId: row.manifest_id || null,
        stopId: row.stop_id || null,
        routeSessionId: row.route_session_id || null,
        accountOrderId: row.account_order_id || null,
        details: row.details || {}
      };
    })
    .filter((signal) => (
      (!filters.stateCode || signal.stateCode === filters.stateCode) &&
      (!filters.city || String(signal.city || '').toLowerCase() === filters.city) &&
      (!filters.territory || String(signal.territory || '').toLowerCase() === filters.territory) &&
      (!filters.routeGroup || String(signal.routeGroup || '').toLowerCase() === filters.routeGroup) &&
      (!filters.distributionCenter ||
        String(signal.distributionCenter || '').toLowerCase() === filters.distributionCenter)
    ));
}

async function listOperationalGeographyConfiguration(options = {}) {
  const includeInactive = options.includeInactive === true || options.includeInactive === 'true';
  const activeClause = includeInactive ? '' : 'WHERE active = true';
  const [centerResult, territoryResult, routeGroupResult] = await Promise.all([
    postgres.query(`
      SELECT *
      FROM operational_distribution_centers
      ${activeClause}
      ORDER BY active DESC, name, code
    `),
    postgres.query(`
      SELECT *
      FROM operational_territories
      ${activeClause}
      ORDER BY active DESC, name, code
    `),
    postgres.query(`
      SELECT *
      FROM operational_route_groups
      ${activeClause}
      ORDER BY active DESC, name, code
    `)
  ]);

  return {
    distributionCenters: centerResult.rows.map((row) => ({
      code: row.code,
      name: row.name,
      address: row.address || null,
      city: row.city || null,
      stateCode: row.state_code || null,
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
      active: row.active === true,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at)
    })),
    territories: territoryResult.rows.map((row) => ({
      code: row.code,
      name: row.name,
      distributionCenterCode: row.distribution_center_code || null,
      stateCodes: asArray(row.state_codes),
      cities: asArray(row.cities),
      active: row.active === true,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at)
    })),
    routeGroups: routeGroupResult.rows.map((row) => ({
      code: row.code,
      name: row.name,
      territoryCode: row.territory_code || null,
      distributionCenterCode: row.distribution_center_code || null,
      active: row.active === true,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at)
    }))
  };
}

async function upsertOperationalDistributionCenter(input = {}, actor = 'admin') {
  const code = normalizeOperationalCode(input.code || input.name);
  const name = cleanRepositoryText(input.name, 160);
  const stateCode = cleanRepositoryText(input.stateCode || input.state_code, 8).toUpperCase();
  if (!code || !name) {
    const error = new Error('Distribution center code and name are required.');
    error.status = 400;
    throw error;
  }
  if (stateCode && !SERVICE_AREA_STATE_CODES.includes(stateCode)) {
    const error = new Error('Distribution center state must be TX, OK, NM, or AR.');
    error.status = 400;
    throw error;
  }
  const latitude = input.latitude === '' || input.latitude == null ? null : Number(input.latitude);
  const longitude = input.longitude === '' || input.longitude == null ? null : Number(input.longitude);
  if ((latitude != null && !Number.isFinite(latitude)) || (longitude != null && !Number.isFinite(longitude))) {
    const error = new Error('Distribution center latitude and longitude must be valid numbers.');
    error.status = 400;
    throw error;
  }
  const result = await postgres.query(`
    INSERT INTO operational_distribution_centers (
      code, name, address, city, state_code, latitude, longitude,
      active, created_by, updated_by, created_at, updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,NOW(),NOW())
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state_code = EXCLUDED.state_code,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      active = EXCLUDED.active,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING *
  `, [
    code,
    name,
    cleanRepositoryText(input.address, 300) || null,
    cleanRepositoryText(input.city, 160) || null,
    stateCode || null,
    latitude,
    longitude,
    input.active !== false && input.active !== 'false',
    cleanRepositoryText(actor, 120) || 'admin'
  ]);
  return (await listOperationalGeographyConfiguration({ includeInactive: true }))
    .distributionCenters.find((item) => item.code === result.rows[0].code);
}

async function upsertOperationalTerritory(input = {}, actor = 'admin') {
  const code = normalizeOperationalCode(input.code || input.name);
  const name = cleanRepositoryText(input.name, 160);
  if (!code || !name) {
    const error = new Error('Territory code and name are required.');
    error.status = 400;
    throw error;
  }
  const stateCodes = normalizeTextList(input.stateCodes || input.state_codes, 4, 8)
    .map((item) => item.toUpperCase())
    .filter((item) => SERVICE_AREA_STATE_CODES.includes(item));
  const cities = normalizeTextList(input.cities, 1000, 160);
  const distributionCenterCode =
    normalizeOperationalCode(input.distributionCenterCode || input.distribution_center_code) || null;
  if (distributionCenterCode) {
    const centerResult = await postgres.query(
      'SELECT 1 FROM operational_distribution_centers WHERE code = $1 AND active = true',
      [distributionCenterCode]
    );
    if (!centerResult.rowCount) {
      const error = new Error('Selected distribution center is not active or does not exist.');
      error.status = 400;
      throw error;
    }
  }
  const result = await postgres.query(`
    INSERT INTO operational_territories (
      code, name, distribution_center_code, state_codes, cities,
      active, created_by, updated_by, created_at, updated_at
    )
    VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$7,NOW(),NOW())
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      distribution_center_code = EXCLUDED.distribution_center_code,
      state_codes = EXCLUDED.state_codes,
      cities = EXCLUDED.cities,
      active = EXCLUDED.active,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING code
  `, [
    code,
    name,
    distributionCenterCode,
    JSON.stringify(stateCodes),
    JSON.stringify(cities),
    input.active !== false && input.active !== 'false',
    cleanRepositoryText(actor, 120) || 'admin'
  ]);
  return (await listOperationalGeographyConfiguration({ includeInactive: true }))
    .territories.find((item) => item.code === result.rows[0].code);
}

async function upsertOperationalRouteGroup(input = {}, actor = 'admin') {
  const code = normalizeOperationalCode(input.code || input.name);
  const name = cleanRepositoryText(input.name, 160);
  if (!code || !name) {
    const error = new Error('Route group code and name are required.');
    error.status = 400;
    throw error;
  }
  const territoryCode = normalizeOperationalCode(input.territoryCode || input.territory_code) || null;
  let distributionCenterCode =
    normalizeOperationalCode(input.distributionCenterCode || input.distribution_center_code) || null;
  if (territoryCode) {
    const territoryResult = await postgres.query(
      `SELECT distribution_center_code
       FROM operational_territories
       WHERE code = $1 AND active = true`,
      [territoryCode]
    );
    if (!territoryResult.rowCount) {
      const error = new Error('Selected territory is not active or does not exist.');
      error.status = 400;
      throw error;
    }
    const territoryCenterCode = territoryResult.rows[0].distribution_center_code || null;
    if (territoryCenterCode && distributionCenterCode && territoryCenterCode !== distributionCenterCode) {
      const error = new Error('Route group distribution center must match the selected territory.');
      error.status = 400;
      throw error;
    }
    distributionCenterCode = distributionCenterCode || territoryCenterCode;
  }
  if (distributionCenterCode) {
    const centerResult = await postgres.query(
      'SELECT 1 FROM operational_distribution_centers WHERE code = $1 AND active = true',
      [distributionCenterCode]
    );
    if (!centerResult.rowCount) {
      const error = new Error('Selected distribution center is not active or does not exist.');
      error.status = 400;
      throw error;
    }
  }
  const result = await postgres.query(`
    INSERT INTO operational_route_groups (
      code, name, territory_code, distribution_center_code,
      active, created_by, updated_by, created_at, updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$6,NOW(),NOW())
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      territory_code = EXCLUDED.territory_code,
      distribution_center_code = EXCLUDED.distribution_center_code,
      active = EXCLUDED.active,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING code
  `, [
    code,
    name,
    territoryCode,
    distributionCenterCode,
    input.active !== false && input.active !== 'false',
    cleanRepositoryText(actor, 120) || 'admin'
  ]);
  return (await listOperationalGeographyConfiguration({ includeInactive: true }))
    .routeGroups.find((item) => item.code === result.rows[0].code);
}

async function setOperationalGeographyActive(entityType, codeInput, active, actor = 'admin') {
  const code = normalizeOperationalCode(codeInput);
  const tables = {
    distribution_center: 'operational_distribution_centers',
    territory: 'operational_territories',
    route_group: 'operational_route_groups'
  };
  const table = tables[cleanRepositoryText(entityType, 40).toLowerCase()];
  if (!table || !code) {
    const error = new Error('Valid geography entity type and code are required.');
    error.status = 400;
    throw error;
  }
  const result = await postgres.query(`
    UPDATE ${table}
    SET active = $2, updated_by = $3, updated_at = NOW()
    WHERE code = $1
    RETURNING code
  `, [code, active === true, cleanRepositoryText(actor, 120) || 'admin']);
  return result.rows[0] || null;
}

async function listOperationalHeatmapGeography(options = {}) {
  const supervisorUsername = cleanRepositoryText(options.supervisorUsername, 120) || null;
  const stateCode = cleanRepositoryText(options.stateCode, 8).toUpperCase();
  const stateFilter = SERVICE_AREA_STATE_CODES.includes(stateCode) ? stateCode : null;

  const [routeCityResult, driverDimensionResult, distributionCenterResult, censusTableResult, configuredGeography] =
    await Promise.all([
      postgres.query(`
        SELECT DISTINCT
          UPPER(stop.state_code) AS state_code,
          BTRIM(stop.city) AS city,
          AVG(stop.latitude) FILTER (WHERE stop.latitude IS NOT NULL) AS latitude,
          AVG(stop.longitude) FILTER (WHERE stop.longitude IS NOT NULL) AS longitude
        FROM daily_route_stops AS stop
        JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
        LEFT JOIN drivers AS driver ON driver.driver_id = manifest.assigned_driver_id
        WHERE NULLIF(BTRIM(stop.city), '') IS NOT NULL
          AND UPPER(COALESCE(stop.state_code, '')) = ANY($1::text[])
          AND ($2::text IS NULL OR UPPER(stop.state_code) = $2::text)
          AND ($3::text IS NULL OR LOWER(COALESCE(driver.supervisor_username, '')) = LOWER($3::text))
        GROUP BY UPPER(stop.state_code), BTRIM(stop.city)
        ORDER BY state_code, city
      `, [SERVICE_AREA_STATE_CODES, stateFilter, supervisorUsername]),
      postgres.query(`
        SELECT DISTINCT
          NULLIF(BTRIM(territory), '') AS territory,
          NULLIF(BTRIM(route_group), '') AS route_group,
          NULLIF(BTRIM(team_name), '') AS team_name
        FROM drivers
        WHERE active = true
          AND ($1::text IS NULL OR LOWER(COALESCE(supervisor_username, '')) = LOWER($1::text))
        ORDER BY territory, route_group, team_name
      `, [supervisorUsername]),
      postgres.query(`
        SELECT DISTINCT NULLIF(BTRIM(manifest.start_location), '') AS distribution_center
        FROM daily_route_manifests AS manifest
        LEFT JOIN drivers AS driver ON driver.driver_id = manifest.assigned_driver_id
        WHERE NULLIF(BTRIM(manifest.start_location), '') IS NOT NULL
          AND ($1::text IS NULL OR LOWER(COALESCE(driver.supervisor_username, '')) = LOWER($1::text))
        ORDER BY distribution_center
      `, [supervisorUsername]),
      postgres.query(`SELECT TO_REGCLASS('public.census_places') IS NOT NULL AS exists`),
      listOperationalGeographyConfiguration()
    ]);

  let censusCities = [];
  if (stateFilter && censusTableResult.rows[0]?.exists) {
    const censusResult = await postgres.query(`
      SELECT DISTINCT
        state_code,
        place_name AS city,
        intptlat AS latitude,
        intptlng AS longitude
      FROM census_places
      WHERE state_code = $1
        AND NULLIF(BTRIM(place_name), '') IS NOT NULL
      ORDER BY city
      LIMIT 5000
    `, [stateFilter]);
    censusCities = censusResult.rows;
  } else if (stateFilter) {
    censusCities = asArray(censusServiceAreaPlaces.places)
      .filter((place) => cleanRepositoryText(place.stateCode, 8).toUpperCase() === stateFilter)
      .map((place) => ({
        state_code: stateFilter,
        city: cleanRepositoryText(place.name, 160),
        latitude: Number.isFinite(Number(place.latitude)) ? Number(place.latitude) : null,
        longitude: Number.isFinite(Number(place.longitude)) ? Number(place.longitude) : null
      }));
  }

  const cityMap = new Map();
  for (const row of [...routeCityResult.rows, ...censusCities]) {
    const city = cleanRepositoryText(row.city, 160);
    const cityStateCode = cleanRepositoryText(row.state_code, 8).toUpperCase();
    if (!city || !SERVICE_AREA_STATE_CODES.includes(cityStateCode)) continue;
    cityMap.set(`${cityStateCode}|${city.toLowerCase()}`, {
      value: city,
      label: `${city}, ${cityStateCode}`,
      stateCode: cityStateCode,
      latitude: Number.isFinite(Number(row.latitude)) ? Number(row.latitude) : null,
      longitude: Number.isFinite(Number(row.longitude)) ? Number(row.longitude) : null
    });
  }

  return {
    cities: [...cityMap.values()]
      .sort((left, right) => left.label.localeCompare(right.label)),
    territories: [...new Set([
      ...driverDimensionResult.rows.map((row) => cleanRepositoryText(row.territory, 160)),
      ...configuredGeography.territories.map((item) => cleanRepositoryText(item.name, 160))
    ].filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
    routeGroups: [...new Set([
      ...driverDimensionResult.rows.map((row) => cleanRepositoryText(row.route_group, 160)),
      ...configuredGeography.routeGroups.map((item) => cleanRepositoryText(item.name, 160))
    ].filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
    teamNames: [...new Set(driverDimensionResult.rows
      .map((row) => cleanRepositoryText(row.team_name, 160))
      .filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
    distributionCenters: [...new Set([
      ...distributionCenterResult.rows.map((row) => cleanRepositoryText(row.distribution_center, 200)),
      ...configuredGeography.distributionCenters.map((item) => cleanRepositoryText(item.name, 200))
    ].filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
    censusPlacesAvailable: Boolean(
      censusTableResult.rows[0]?.exists || asArray(censusServiceAreaPlaces.places).length
    ),
    censusPlacesSource: censusTableResult.rows[0]?.exists ? 'postgres' : 'bundled_fallback'
  };
}

async function listDriverCoachingSignals(options = {}) {
  const periodDays = normalizeLimit(options.periodDays, 30, 365);
  const routeDate = toDateOnly(options.routeDate) || null;
  const driverId = cleanRepositoryText(options.driverId, 120) || null;
  const supervisorUsername = cleanRepositoryText(options.supervisorUsername, 120) || null;
  const routeResult = await postgres.query(`
    SELECT
      driver.driver_id,
      driver.driver_name,
      driver.route_group,
      driver.territory,
      driver.supervisor_username,
      driver.supervisor_name,
      driver.team_name,
      COUNT(DISTINCT manifest.id)::int AS route_count,
      COUNT(DISTINCT manifest.id) FILTER (
        WHERE manifest.status IN ('completed', 'completed_with_exceptions')
      )::int AS completed_route_count,
      COUNT(DISTINCT stop.id)::int AS stop_count,
      COUNT(DISTINCT stop.id) FILTER (
        WHERE stop.status IN ('completed', 'departed', 'skipped', 'undelivered')
      )::int AS finished_stop_count,
      COUNT(DISTINCT stop.id) FILTER (WHERE stop.status = 'undelivered')::int AS undelivered_stop_count,
      COUNT(DISTINCT stop.id) FILTER (
        WHERE stop.actual_arrival_at > stop.planned_arrival_at + INTERVAL '10 minutes'
      )::int AS late_arrival_count,
      AVG(
        EXTRACT(EPOCH FROM (stop.actual_arrival_at - stop.planned_arrival_at)) / 60.0
      ) FILTER (
        WHERE stop.actual_arrival_at IS NOT NULL
          AND stop.planned_arrival_at IS NOT NULL
      ) AS average_arrival_variance_minutes,
      AVG(
        EXTRACT(EPOCH FROM (stop.actual_completed_at - stop.actual_service_started_at)) / 60.0
          - COALESCE(stop.planned_service_minutes, 0)
      ) FILTER (
        WHERE stop.actual_completed_at IS NOT NULL
          AND stop.actual_service_started_at IS NOT NULL
      ) AS average_service_variance_minutes
    FROM drivers AS driver
    LEFT JOIN daily_route_manifests AS manifest
      ON manifest.assigned_driver_id = driver.driver_id
      AND manifest.route_date >= CURRENT_DATE - ($1::int * INTERVAL '1 day')
      AND ($2::date IS NULL OR manifest.route_date = $2::date)
    LEFT JOIN daily_route_stops AS stop ON stop.manifest_id = manifest.id
    WHERE driver.active = true
      AND ($3::text IS NULL OR driver.driver_id = $3::text)
      AND ($4::text IS NULL OR driver.supervisor_username = $4::text)
    GROUP BY
      driver.driver_id,
      driver.driver_name,
      driver.route_group,
      driver.territory,
      driver.supervisor_username,
      driver.supervisor_name,
      driver.team_name
    ORDER BY driver.driver_name ASC
  `, [periodDays, routeDate, driverId, supervisorUsername]);

  const eventResult = await postgres.query(`
    SELECT
      payload #>> '{driver,driverId}' AS driver_id,
      event_type,
      severity,
      COUNT(*)::int AS event_count
    FROM route_session_events
    WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
      AND ($2::date IS NULL OR created_at::date = $2::date)
      AND payload #>> '{driver,driverId}' IS NOT NULL
      AND ($3::text IS NULL OR payload #>> '{driver,driverId}' = $3::text)
    GROUP BY payload #>> '{driver,driverId}', event_type, severity
  `, [periodDays, routeDate, driverId]);

  const eventsByDriver = new Map();
  for (const row of eventResult.rows) {
    if (!eventsByDriver.has(row.driver_id)) eventsByDriver.set(row.driver_id, []);
    eventsByDriver.get(row.driver_id).push({
      eventType: row.event_type,
      severity: row.severity || null,
      count: Number(row.event_count) || 0
    });
  }

  return routeResult.rows.map((row) => {
    const events = eventsByDriver.get(row.driver_id) || [];
    return {
      driverId: row.driver_id,
      driverName: row.driver_name,
      routeGroup: row.route_group || null,
      territory: row.territory || null,
      supervisorUsername: row.supervisor_username || null,
      supervisorName: row.supervisor_name || null,
      teamName: row.team_name || null,
      routeCount: Number(row.route_count) || 0,
      completedRouteCount: Number(row.completed_route_count) || 0,
      stopCount: Number(row.stop_count) || 0,
      finishedStopCount: Number(row.finished_stop_count) || 0,
      undeliveredStopCount: Number(row.undelivered_stop_count) || 0,
      lateArrivalCount: Number(row.late_arrival_count) || 0,
      averageArrivalVarianceMinutes: row.average_arrival_variance_minutes == null
        ? null
        : Math.round(Number(row.average_arrival_variance_minutes)),
      averageServiceVarianceMinutes: row.average_service_variance_minutes == null
        ? null
        : Math.round(Number(row.average_service_variance_minutes)),
      recordedEvents: events,
      recordedEventCount: events.reduce((total, event) => total + event.count, 0)
    };
  });
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

async function saveAccountInsight(input = {}) {
  const accountNumber = cleanRepositoryText(input.accountNumber || input.account_number, 120);
  const title = cleanRepositoryText(input.title, 240);
  const summary = cleanRepositoryText(input.summary, 4000);
  if (!accountNumber || !title || !summary) {
    const error = new Error('accountNumber, title, and summary are required.');
    error.status = 400;
    throw error;
  }

  const generatedBy = cleanRepositoryText(input.generatedBy || input.generated_by, 120) || 'system';
  const defaultStatus = generatedBy.startsWith('openai:') ? 'pending_review' : 'active';
  const result = await postgres.query(`
    INSERT INTO account_ai_insights (
      id, account_number, insight_type, title, summary, confidence,
      source_period_start, source_period_end, generated_by, status, raw, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10, $11::jsonb, NOW())
    RETURNING *
  `, [
    cleanRepositoryText(input.id, 160) || generateRepositoryId('insight'),
    accountNumber,
    cleanRepositoryText(input.insightType || input.insight_type, 120) || 'account_summary',
    title,
    summary,
    cleanRepositoryText(input.confidence, 40) || 'medium',
    toDateOnly(input.sourcePeriodStart || input.source_period_start) || null,
    toDateOnly(input.sourcePeriodEnd || input.source_period_end) || null,
    generatedBy,
    cleanRepositoryText(input.status, 80) || defaultStatus,
    JSON.stringify(input.raw || {})
  ]);

  return accountAiInsightFromRow(result.rows[0]);
}

async function savePredictionRun(input = {}) {
  const predictionType = cleanRepositoryText(input.predictionType || input.prediction_type, 120);
  const entityType = cleanRepositoryText(input.entityType || input.entity_type, 120);
  const engineVersion = cleanRepositoryText(input.engineVersion || input.engine_version, 120);
  if (!predictionType || !entityType || !engineVersion) {
    const error = new Error('predictionType, entityType, and engineVersion are required.');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    INSERT INTO prediction_runs (
      id, prediction_type, entity_type, entity_id, route_date,
      source_period_start, source_period_end, sample_count, confidence,
      engine_version, features, prediction, created_by
    )
    VALUES (
      $1, $2, $3, $4, $5::date,
      $6::date, $7::date, $8, $9,
      $10, $11::jsonb, $12::jsonb, $13
    )
    RETURNING *
  `, [
    cleanRepositoryText(input.id, 160) || generateRepositoryId('prediction'),
    predictionType,
    entityType,
    cleanRepositoryText(input.entityId || input.entity_id, 200) || null,
    toDateOnly(input.routeDate || input.route_date) || null,
    toDateOnly(input.sourcePeriodStart || input.source_period_start) || null,
    toDateOnly(input.sourcePeriodEnd || input.source_period_end) || null,
    Number(input.sampleCount || input.sample_count) || 0,
    cleanRepositoryText(input.confidence, 40) || 'low',
    engineVersion,
    JSON.stringify(input.features || {}),
    JSON.stringify(input.prediction || {}),
    cleanRepositoryText(input.createdBy || input.created_by, 160) || null
  ]);

  const row = result.rows[0];
  return {
    id: row.id,
    predictionType: row.prediction_type,
    entityType: row.entity_type,
    entityId: row.entity_id || null,
    routeDate: toDateOnly(row.route_date),
    sourcePeriodStart: toDateOnly(row.source_period_start),
    sourcePeriodEnd: toDateOnly(row.source_period_end),
    sampleCount: Number(row.sample_count) || 0,
    confidence: row.confidence,
    engineVersion: row.engine_version,
    features: row.features || {},
    prediction: row.prediction || {},
    createdBy: row.created_by || null,
    createdAt: toIsoString(row.created_at)
  };
}

async function listPredictionRuns(options = {}) {
  const limit = normalizeLimit(options.limit, 50, 200);
  const values = [];
  const where = [];
  if (options.predictionType) {
    values.push(cleanRepositoryText(options.predictionType, 120));
    where.push(`prediction_type = $${values.length}`);
  }
  if (options.entityType) {
    values.push(cleanRepositoryText(options.entityType, 120));
    where.push(`entity_type = $${values.length}`);
  }
  if (options.entityId) {
    values.push(cleanRepositoryText(options.entityId, 200));
    where.push(`entity_id = $${values.length}`);
  }
  if (options.routeDate) {
    values.push(toDateOnly(options.routeDate));
    where.push(`route_date = $${values.length}::date`);
  }
  values.push(limit);
  const result = await postgres.query(`
    SELECT *
    FROM prediction_runs
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
    LIMIT $${values.length}
  `, values);

  return result.rows.map((row) => ({
    id: row.id,
    predictionType: row.prediction_type,
    entityType: row.entity_type,
    entityId: row.entity_id || null,
    routeDate: toDateOnly(row.route_date),
    sourcePeriodStart: toDateOnly(row.source_period_start),
    sourcePeriodEnd: toDateOnly(row.source_period_end),
    sampleCount: Number(row.sample_count) || 0,
    confidence: row.confidence,
    engineVersion: row.engine_version,
    features: row.features || {},
    prediction: row.prediction || {},
    createdBy: row.created_by || null,
    createdAt: toIsoString(row.created_at)
  }));
}

function supervisorAlertFromRow(row) {
  return {
    id: row.id,
    alertKey: row.alert_key,
    supervisorUsername: row.supervisor_username || null,
    alertType: row.alert_type,
    severity: row.severity,
    title: row.title,
    message: row.message,
    entityType: row.entity_type || null,
    entityId: row.entity_id || null,
    routeDate: toDateOnly(row.route_date),
    status: row.status,
    source: row.source,
    sourcePayload: row.source_payload || {},
    firstDetectedAt: toIsoString(row.first_detected_at),
    lastDetectedAt: toIsoString(row.last_detected_at),
    acknowledgedBy: row.acknowledged_by || null,
    acknowledgedAt: toIsoString(row.acknowledged_at),
    resolvedBy: row.resolved_by || null,
    resolvedAt: toIsoString(row.resolved_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function scheduledReportScheduleFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    reportType: row.report_type,
    supervisorUsername: row.supervisor_username || null,
    cadence: row.cadence,
    localHour: Number(row.local_hour) || 0,
    timezone: row.timezone,
    enabled: row.enabled !== false,
    nextRunAt: toIsoString(row.next_run_at),
    lastRunAt: toIsoString(row.last_run_at),
    config: row.config || {},
    createdBy: row.created_by || null,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function scheduledReportFromRow(row) {
  return {
    id: row.id,
    scheduleId: row.schedule_id || null,
    reportType: row.report_type,
    supervisorUsername: row.supervisor_username || null,
    routeDate: toDateOnly(row.route_date),
    status: row.status,
    title: row.title,
    summary: row.summary,
    content: row.content || {},
    generatedBy: row.generated_by,
    errorMessage: row.error_message || null,
    generatedAt: toIsoString(row.generated_at)
  };
}

async function upsertSupervisorAlert(input = {}) {
  const alertKey = cleanRepositoryText(input.alertKey || input.alert_key, 240);
  const alertType = cleanRepositoryText(input.alertType || input.alert_type, 120);
  const title = cleanRepositoryText(input.title, 240);
  const message = cleanRepositoryText(input.message, 4000);
  if (!alertKey || !alertType || !title || !message) {
    const error = new Error('alertKey, alertType, title, and message are required.');
    error.status = 400;
    throw error;
  }

  const result = await postgres.query(`
    INSERT INTO supervisor_alerts (
      id, alert_key, supervisor_username, alert_type, severity, title, message,
      entity_type, entity_id, route_date, status, source, source_payload
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10::date, 'open', $11, $12::jsonb
    )
    ON CONFLICT (alert_key) DO UPDATE SET
      supervisor_username = EXCLUDED.supervisor_username,
      severity = EXCLUDED.severity,
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      entity_type = EXCLUDED.entity_type,
      entity_id = EXCLUDED.entity_id,
      route_date = EXCLUDED.route_date,
      status = CASE
        WHEN supervisor_alerts.status = 'resolved' THEN 'open'
        ELSE supervisor_alerts.status
      END,
      source = EXCLUDED.source,
      source_payload = EXCLUDED.source_payload,
      last_detected_at = NOW(),
      updated_at = NOW()
    RETURNING *
  `, [
    cleanRepositoryText(input.id, 160) || generateRepositoryId('alert'),
    alertKey,
    cleanRepositoryText(input.supervisorUsername || input.supervisor_username, 120) || null,
    alertType,
    cleanRepositoryText(input.severity, 40) || 'medium',
    title,
    message,
    cleanRepositoryText(input.entityType || input.entity_type, 120) || null,
    cleanRepositoryText(input.entityId || input.entity_id, 200) || null,
    toDateOnly(input.routeDate || input.route_date) || null,
    cleanRepositoryText(input.source, 120) || 'rules_engine',
    JSON.stringify(input.sourcePayload || input.source_payload || {})
  ]);
  return supervisorAlertFromRow(result.rows[0]);
}

async function listSupervisorAlerts(options = {}) {
  const limit = normalizeLimit(options.limit, 100, 500);
  const values = [];
  const where = [];
  if (options.status) {
    values.push(cleanRepositoryText(options.status, 40));
    where.push(`status = $${values.length}`);
  }
  if (options.severity) {
    values.push(cleanRepositoryText(options.severity, 40));
    where.push(`severity = $${values.length}`);
  }
  if (options.supervisorUsername) {
    values.push(cleanRepositoryText(options.supervisorUsername, 120).toLowerCase());
    where.push(`LOWER(COALESCE(supervisor_username, '')) IN ('', $${values.length})`);
  }
  values.push(limit);
  const result = await postgres.query(`
    SELECT *
    FROM supervisor_alerts
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY
      CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      last_detected_at DESC
    LIMIT $${values.length}
  `, values);
  return result.rows.map(supervisorAlertFromRow);
}

async function updateSupervisorAlertStatus(alertId, input = {}) {
  const id = cleanRepositoryText(alertId, 160);
  const status = cleanRepositoryText(input.status, 40);
  if (!id || !['open', 'acknowledged', 'resolved'].includes(status)) {
    const error = new Error('A valid alert ID and status are required.');
    error.status = 400;
    throw error;
  }
  const actor = cleanRepositoryText(input.actor, 120) || 'supervisor';
  const result = await postgres.query(`
    UPDATE supervisor_alerts
    SET
      status = $2,
      acknowledged_by = CASE WHEN $2 = 'acknowledged' THEN $3 ELSE acknowledged_by END,
      acknowledged_at = CASE WHEN $2 = 'acknowledged' THEN NOW() ELSE acknowledged_at END,
      resolved_by = CASE WHEN $2 = 'resolved' THEN $3 ELSE resolved_by END,
      resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE resolved_at END,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, status, actor]);
  if (!result.rows[0]) {
    const error = new Error('Supervisor alert not found.');
    error.status = 404;
    throw error;
  }
  return supervisorAlertFromRow(result.rows[0]);
}

async function upsertScheduledReportSchedule(input = {}) {
  const name = cleanRepositoryText(input.name, 200);
  const reportType = cleanRepositoryText(input.reportType || input.report_type, 120)
    || 'supervisor_daily_brief';
  const timezone = cleanRepositoryText(input.timezone, 120) || 'America/Chicago';
  const localHour = Math.min(Math.max(Number.parseInt(input.localHour ?? input.local_hour, 10) || 6, 0), 23);
  if (!name) {
    const error = new Error('Schedule name is required.');
    error.status = 400;
    throw error;
  }
  const id = cleanRepositoryText(input.id, 160) || generateRepositoryId('report_schedule');
  const result = await postgres.query(`
    INSERT INTO scheduled_report_schedules (
      id, name, report_type, supervisor_username, cadence, local_hour,
      timezone, enabled, next_run_at, config, created_by
    )
    VALUES (
      $1, $2, $3, $4, 'daily', $5,
      $6, $7,
      CASE
        WHEN (((NOW() AT TIME ZONE $6)::date + make_interval(hours => $5)) AT TIME ZONE $6) > NOW()
          THEN (((NOW() AT TIME ZONE $6)::date + make_interval(hours => $5)) AT TIME ZONE $6)
        ELSE ((((NOW() AT TIME ZONE $6)::date + 1) + make_interval(hours => $5)) AT TIME ZONE $6)
      END,
      $8::jsonb, $9
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      report_type = EXCLUDED.report_type,
      supervisor_username = EXCLUDED.supervisor_username,
      local_hour = EXCLUDED.local_hour,
      timezone = EXCLUDED.timezone,
      enabled = EXCLUDED.enabled,
      config = EXCLUDED.config,
      updated_at = NOW()
    RETURNING *
  `, [
    id,
    name,
    reportType,
    cleanRepositoryText(input.supervisorUsername || input.supervisor_username, 120).toLowerCase() || null,
    localHour,
    timezone,
    input.enabled !== false,
    JSON.stringify(input.config || {}),
    cleanRepositoryText(input.createdBy || input.created_by, 120) || null
  ]);
  return scheduledReportScheduleFromRow(result.rows[0]);
}

async function listScheduledReportSchedules(options = {}) {
  const values = [];
  const where = [];
  if (options.supervisorUsername) {
    values.push(cleanRepositoryText(options.supervisorUsername, 120).toLowerCase());
    where.push(`LOWER(COALESCE(supervisor_username, '')) IN ('', $${values.length})`);
  }
  const result = await postgres.query(`
    SELECT *
    FROM scheduled_report_schedules
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY enabled DESC, next_run_at ASC, name ASC
  `, values);
  return result.rows.map(scheduledReportScheduleFromRow);
}

async function setScheduledReportScheduleEnabled(scheduleId, enabled) {
  const result = await postgres.query(`
    UPDATE scheduled_report_schedules
    SET enabled = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [cleanRepositoryText(scheduleId, 160), enabled === true]);
  if (!result.rows[0]) {
    const error = new Error('Scheduled report definition not found.');
    error.status = 404;
    throw error;
  }
  return scheduledReportScheduleFromRow(result.rows[0]);
}

async function queueScheduledReportNow(scheduleId) {
  const result = await postgres.query(`
    UPDATE scheduled_report_schedules
    SET enabled = TRUE, next_run_at = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [cleanRepositoryText(scheduleId, 160)]);
  if (!result.rows[0]) {
    const error = new Error('Scheduled report definition not found.');
    error.status = 404;
    throw error;
  }
  return scheduledReportScheduleFromRow(result.rows[0]);
}

async function claimDueScheduledReports(limit = 5) {
  const normalizedLimit = normalizeLimit(limit, 5, 20);
  const result = await postgres.query(`
    WITH due AS (
      SELECT id
      FROM scheduled_report_schedules
      WHERE enabled = TRUE AND next_run_at <= NOW()
      ORDER BY next_run_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT $1
    )
    UPDATE scheduled_report_schedules AS schedule
    SET
      last_run_at = NOW(),
      next_run_at = (
        (((NOW() AT TIME ZONE schedule.timezone)::date + 1)
          + make_interval(hours => schedule.local_hour))
        AT TIME ZONE schedule.timezone
      ),
      updated_at = NOW()
    FROM due
    WHERE schedule.id = due.id
    RETURNING schedule.*
  `, [normalizedLimit]);
  return result.rows.map(scheduledReportScheduleFromRow);
}

async function saveScheduledReport(input = {}) {
  const title = cleanRepositoryText(input.title, 240);
  const summary = cleanRepositoryText(input.summary, 4000);
  if (!title || !summary) {
    const error = new Error('Scheduled report title and summary are required.');
    error.status = 400;
    throw error;
  }
  const result = await postgres.query(`
    INSERT INTO scheduled_reports (
      id, schedule_id, report_type, supervisor_username, route_date,
      status, title, summary, content, generated_by, error_message
    )
    VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9::jsonb, $10, $11)
    RETURNING *
  `, [
    cleanRepositoryText(input.id, 160) || generateRepositoryId('scheduled_report'),
    cleanRepositoryText(input.scheduleId || input.schedule_id, 160) || null,
    cleanRepositoryText(input.reportType || input.report_type, 120) || 'supervisor_daily_brief',
    cleanRepositoryText(input.supervisorUsername || input.supervisor_username, 120).toLowerCase() || null,
    toDateOnly(input.routeDate || input.route_date) || null,
    cleanRepositoryText(input.status, 40) || 'completed',
    title,
    summary,
    JSON.stringify(input.content || {}),
    cleanRepositoryText(input.generatedBy || input.generated_by, 120) || 'rules_engine',
    cleanRepositoryText(input.errorMessage || input.error_message, 2000) || null
  ]);
  return scheduledReportFromRow(result.rows[0]);
}

async function listScheduledReports(options = {}) {
  const limit = normalizeLimit(options.limit, 50, 200);
  const values = [];
  const where = [];
  if (options.supervisorUsername) {
    values.push(cleanRepositoryText(options.supervisorUsername, 120).toLowerCase());
    where.push(`LOWER(COALESCE(supervisor_username, '')) IN ('', $${values.length})`);
  }
  values.push(limit);
  const result = await postgres.query(`
    SELECT *
    FROM scheduled_reports
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY generated_at DESC
    LIMIT $${values.length}
  `, values);
  return result.rows.map(scheduledReportFromRow);
}

async function reviewAccountInsight(insightId, input = {}) {
  const id = cleanRepositoryText(insightId, 160);
  const status = cleanRepositoryText(input.status, 80);
  if (!id || !['pending_review', 'approved', 'rejected'].includes(status)) {
    const error = new Error('A valid insight ID and review status are required.');
    error.status = 400;
    throw error;
  }
  const result = await postgres.query(`
    UPDATE account_ai_insights
    SET
      status = $2,
      reviewed_by = $3,
      reviewed_at = NOW(),
      review_notes = $4,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [
    id,
    status,
    cleanRepositoryText(input.reviewedBy || input.reviewed_by, 160) || 'supervisor',
    cleanRepositoryText(input.reviewNotes || input.review_notes, 2000) || null
  ]);
  if (!result.rows[0]) {
    const error = new Error('AI recommendation not found.');
    error.status = 404;
    throw error;
  }
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
    const status = cleanRepositoryText(options.status, 80);
    if (status !== 'all') {
      values.push(status);
      where.push(`status = $${values.length}`);
    }
  } else {
    where.push("status IN ('active', 'approved')");
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

async function getKnowledgeGraphSnapshot(options = {}) {
  const periodDays = normalizeLimit(options.periodDays, 180, 730);
  const routeDate = toDateOnly(options.routeDate) || null;
  const limit = normalizeLimit(options.limit, 500, 2000);
  const [driverResult, routeResult, stopResult, orderResult, itemResult, deductionResult] = await Promise.all([
    postgres.query(`
      SELECT *
      FROM drivers
      WHERE active = true
      ORDER BY driver_id
      LIMIT $1
    `, [limit]),
    postgres.query(`
    SELECT
      daily_route_manifests.*,
      inventory_closeout.printed_at AS final_inventory_printed_at,
      inventory_closeout.actual_duration_minutes,
      inventory_closeout.supervisor_status AS final_inventory_supervisor_status
    FROM daily_route_manifests
    LEFT JOIN route_inventory_closeouts AS inventory_closeout
      ON inventory_closeout.manifest_id = daily_route_manifests.id
      WHERE (
        $2::date IS NOT NULL AND route_date = $2::date
      ) OR (
        $2::date IS NULL AND route_date >= CURRENT_DATE - ($1::int - 1)
      )
      ORDER BY route_date DESC, route_number
      LIMIT $3
    `, [periodDays, routeDate, limit]),
    postgres.query(`
      SELECT
        stop.*,
        manifest.route_date,
        manifest.route_number,
        manifest.assigned_driver_id
      FROM daily_route_stops AS stop
      JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
      WHERE (
        $2::date IS NOT NULL AND manifest.route_date = $2::date
      ) OR (
        $2::date IS NULL AND manifest.route_date >= CURRENT_DATE - ($1::int - 1)
      )
      ORDER BY manifest.route_date DESC, manifest.route_number, stop.stop_sequence
      LIMIT $3
    `, [periodDays, routeDate, limit]),
    postgres.query(`
      SELECT *
      FROM account_orders
      WHERE COALESCE(delivery_date, order_date, created_at::date) >= CURRENT_DATE - ($1::int - 1)
      ORDER BY COALESCE(delivery_date, order_date) DESC, created_at DESC
      LIMIT $2
    `, [periodDays, limit]),
    postgres.query(`
      SELECT item.*
      FROM account_order_items AS item
      JOIN account_orders AS account_order ON account_order.id = item.order_id
      WHERE COALESCE(account_order.delivery_date, account_order.order_date, account_order.created_at::date)
        >= CURRENT_DATE - ($1::int - 1)
      ORDER BY account_order.created_at DESC, item.id
      LIMIT $2
    `, [periodDays, limit]),
    postgres.query(`
      SELECT *
      FROM delivery_deductions
      WHERE created_at::date >= CURRENT_DATE - ($1::int - 1)
      ORDER BY created_at DESC
      LIMIT $2
    `, [periodDays, limit])
  ]);

  const nodes = new Map();
  const edges = [];
  const addNode = (id, type, label, properties = {}) => {
    if (!id || nodes.has(id)) return;
    nodes.set(id, { id, type, label: label || id, properties });
  };
  const addEdge = (from, to, type, properties = {}) => {
    if (!from || !to) return;
    edges.push({ from, to, type, properties });
  };

  for (const row of driverResult.rows) {
    const driver = driverFromRow(row);
    const driverNodeId = `driver:${driver.driverId}`;
    addNode(driverNodeId, 'driver', driver.driverName || driver.driverId, {
      driverId: driver.driverId,
      teamName: driver.teamName,
      routeGroup: driver.routeGroup,
      territory: driver.territory
    });
    if (driver.supervisorUsername) {
      const supervisorNodeId = `supervisor:${driver.supervisorUsername}`;
      addNode(supervisorNodeId, 'supervisor', driver.supervisorName || driver.supervisorUsername, {
        username: driver.supervisorUsername
      });
      addEdge(supervisorNodeId, driverNodeId, 'supervises');
    }
  }

  for (const row of routeResult.rows) {
    const route = routeManifestFromRow(row);
    const routeNodeId = `route:${route.id}`;
    addNode(routeNodeId, 'route', route.routeName || route.routeNumber || route.id, {
      routeDate: route.routeDate,
      routeNumber: route.routeNumber,
      status: route.status,
      totalStops: route.totalStops,
      totalPallets: route.totalPallets,
      totalCases: route.totalCases
    });
    if (route.assignedDriverId) {
      const driverNodeId = `driver:${route.assignedDriverId}`;
      addNode(driverNodeId, 'driver', route.assignedDriverName || route.assignedDriverId, {
        driverId: route.assignedDriverId
      });
      addEdge(driverNodeId, routeNodeId, 'assigned_to');
    }
  }

  for (const row of stopResult.rows) {
    const stop = routeStopFromRow(row);
    if (!stop.accountNumber) continue;
    const routeNodeId = `route:${stop.manifestId}`;
    const accountNodeId = `account:${stop.accountNumber}`;
    addNode(accountNodeId, 'account', stop.accountName || stop.accountNumber, {
      accountNumber: stop.accountNumber,
      address: stop.destinationAddress,
      city: stop.city,
      stateCode: stop.stateCode
    });
    addEdge(routeNodeId, accountNodeId, 'serves_account', {
      stopId: stop.id,
      stopSequence: stop.stopSequence,
      status: stop.status,
      plannedArrivalAt: stop.plannedArrivalAt,
      actualArrivalAt: stop.actualArrivalAt,
      palletCount: stop.palletCount,
      caseCount: stop.caseCount
    });
  }

  for (const row of orderResult.rows) {
    const order = accountOrderFromRow(row);
    const accountNodeId = `account:${order.accountNumber}`;
    const orderNodeId = `order:${order.id}`;
    addNode(accountNodeId, 'account', order.accountName || order.accountNumber, {
      accountNumber: order.accountNumber
    });
    addNode(orderNodeId, 'order', order.invoiceNumber || order.id, {
      orderDate: order.orderDate,
      deliveryDate: order.deliveryDate,
      subtotalAmount: order.subtotalAmount,
      deductionAmount: order.deductionAmount,
      netAmount: order.netAmount,
      status: order.status
    });
    addEdge(accountNodeId, orderNodeId, 'placed_order');
    if (order.routeManifestId) {
      addEdge(orderNodeId, `route:${order.routeManifestId}`, 'scheduled_on_route');
    }
  }

  for (const row of itemResult.rows) {
    const item = accountOrderItemFromRow(row);
    const productId = item.sku || item.productName;
    if (!productId) continue;
    const productNodeId = `product:${productId}`;
    addNode(productNodeId, 'product', item.productName || item.sku, {
      sku: item.sku,
      brand: item.brand,
      category: item.category,
      packageSize: item.packageSize
    });
    addEdge(`order:${item.orderId}`, productNodeId, 'contains_product', {
      quantity: item.quantity,
      grossAmount: item.grossAmount,
      deductionAmount: item.deductionAmount,
      netAmount: item.netAmount
    });
  }

  for (const row of deductionResult.rows) {
    const deduction = deliveryDeductionFromRow(row);
    const deductionNodeId = `deduction:${deduction.id}`;
    addNode(deductionNodeId, 'deduction', deduction.reason || deduction.id, {
      reason: deduction.reason,
      quantity: deduction.quantity,
      amount: deduction.amount,
      productName: deduction.productName,
      createdAt: deduction.createdAt
    });
    addEdge(`account:${deduction.accountNumber}`, deductionNodeId, 'has_deduction');
    if (deduction.orderId) addEdge(`order:${deduction.orderId}`, deductionNodeId, 'includes_deduction');
    if (deduction.sku) addEdge(deductionNodeId, `product:${deduction.sku}`, 'applies_to_product');
  }

  const nodeList = [...nodes.values()];
  const nodeTypeCounts = nodeList.reduce((counts, node) => {
    counts[node.type] = (counts[node.type] || 0) + 1;
    return counts;
  }, {});
  const edgeTypeCounts = edges.reduce((counts, edge) => {
    counts[edge.type] = (counts[edge.type] || 0) + 1;
    return counts;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    routeDate,
    periodDays,
    nodeCount: nodeList.length,
    edgeCount: edges.length,
    nodeTypeCounts,
    edgeTypeCounts,
    nodes: nodeList,
    edges
  };
}

async function saveAiInteractionLog(input = {}) {
  const outputSummary = input.outputSummary || input.output_summary || {};
  const metadata = outputSummary?.__aiMetadata || {};
  const usage = input.usage || metadata.usage || {};
  const inputTokens = Number(usage.input_tokens);
  const outputTokens = Number(usage.output_tokens);
  const totalTokens = Number(usage.total_tokens);
  const estimatedCostUsd = Number(input.estimatedCostUsd ?? input.estimated_cost_usd ?? metadata.estimatedCostUsd);
  const result = await postgres.query(`
    INSERT INTO ai_interaction_logs (
      id, endpoint, requester_type, requester_id, account_number,
      route_manifest_id, route_stop_id, model, status, input_summary,
      output_summary, error_message, latency_ms, provider_request_id,
      input_tokens, output_tokens, total_tokens, estimated_cost_usd
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10::jsonb,
      $11::jsonb, $12, $13, $14,
      $15, $16, $17, $18
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
    JSON.stringify(outputSummary),
    cleanRepositoryText(input.errorMessage || input.error_message, 1000) || null,
    Number.isFinite(Number(input.latencyMs ?? input.latency_ms)) ? Math.max(0, Math.round(Number(input.latencyMs ?? input.latency_ms))) : null,
    cleanRepositoryText(input.providerRequestId || input.provider_request_id || metadata.requestId, 200) || null,
    Number.isFinite(inputTokens) ? Math.max(0, Math.round(inputTokens)) : null,
    Number.isFinite(outputTokens) ? Math.max(0, Math.round(outputTokens)) : null,
    Number.isFinite(totalTokens) ? Math.max(0, Math.round(totalTokens)) : null,
    Number.isFinite(estimatedCostUsd) ? Math.max(0, estimatedCostUsd) : null
  ]);
  return aiInteractionLogFromRow(result.rows[0]);
}

async function getAiOperationsMetrics(options = {}) {
  const periodDays = normalizeLimit(options.periodDays, 30, 365);
  const endpointLimit = normalizeLimit(options.endpointLimit, 100, 250);
  const errorLimit = normalizeLimit(options.errorLimit, 25, 100);

  const [overallResult, endpointResult, errorResult] = await Promise.all([
    postgres.query(`
      SELECT
        COUNT(*)::integer AS request_count,
        COUNT(*) FILTER (WHERE status = 'success')::integer AS success_count,
        COUNT(*) FILTER (WHERE status <> 'success')::integer AS error_count,
        ROUND(AVG(latency_ms))::integer AS average_latency_ms,
        ROUND((
          percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
          FILTER (WHERE latency_ms IS NOT NULL)
        )::numeric)::integer AS p95_latency_ms,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
        SUM(estimated_cost_usd) AS estimated_cost_usd,
        MAX(created_at) AS last_request_at
      FROM ai_interaction_logs
      WHERE created_at >= NOW() - ($1::integer * INTERVAL '1 day')
    `, [periodDays]),
    postgres.query(`
      SELECT
        endpoint,
        COUNT(*)::integer AS request_count,
        COUNT(*) FILTER (WHERE status = 'success')::integer AS success_count,
        COUNT(*) FILTER (WHERE status <> 'success')::integer AS error_count,
        ROUND(AVG(latency_ms))::integer AS average_latency_ms,
        ROUND((
          percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
          FILTER (WHERE latency_ms IS NOT NULL)
        )::numeric)::integer AS p95_latency_ms,
        COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
        SUM(estimated_cost_usd) AS estimated_cost_usd,
        MAX(created_at) AS last_request_at
      FROM ai_interaction_logs
      WHERE created_at >= NOW() - ($1::integer * INTERVAL '1 day')
      GROUP BY endpoint
      ORDER BY request_count DESC, endpoint ASC
      LIMIT $2
    `, [periodDays, endpointLimit]),
    postgres.query(`
      SELECT *
      FROM ai_interaction_logs
      WHERE created_at >= NOW() - ($1::integer * INTERVAL '1 day')
        AND status <> 'success'
      ORDER BY created_at DESC
      LIMIT $2
    `, [periodDays, errorLimit])
  ]);

  const overallRow = overallResult.rows[0] || {};
  const requestCount = Number(overallRow.request_count) || 0;
  const successCount = Number(overallRow.success_count) || 0;
  const errorCount = Number(overallRow.error_count) || 0;

  return {
    generatedAt: new Date().toISOString(),
    periodDays,
    overall: {
      requestCount,
      successCount,
      errorCount,
      successRate: requestCount > 0
        ? Math.round((successCount / requestCount) * 1000) / 10
        : null,
      averageLatencyMs: overallRow.average_latency_ms ?? null,
      p95LatencyMs: overallRow.p95_latency_ms ?? null,
      inputTokens: Number(overallRow.input_tokens) || 0,
      outputTokens: Number(overallRow.output_tokens) || 0,
      totalTokens: Number(overallRow.total_tokens) || 0,
      estimatedCostUsd: overallRow.estimated_cost_usd === null
        ? null
        : Number(overallRow.estimated_cost_usd),
      lastRequestAt: toIsoString(overallRow.last_request_at)
    },
    endpoints: endpointResult.rows.map((row) => {
      const endpointRequestCount = Number(row.request_count) || 0;
      const endpointSuccessCount = Number(row.success_count) || 0;
      return {
        endpoint: row.endpoint,
        requestCount: endpointRequestCount,
        successCount: endpointSuccessCount,
        errorCount: Number(row.error_count) || 0,
        successRate: endpointRequestCount > 0
          ? Math.round((endpointSuccessCount / endpointRequestCount) * 1000) / 10
          : null,
        averageLatencyMs: row.average_latency_ms ?? null,
        p95LatencyMs: row.p95_latency_ms ?? null,
        totalTokens: Number(row.total_tokens) || 0,
        estimatedCostUsd: row.estimated_cost_usd === null
          ? null
          : Number(row.estimated_cost_usd),
        lastRequestAt: toIsoString(row.last_request_at)
      };
    }),
    recentErrors: errorResult.rows.map(aiInteractionLogFromRow)
  };
}

module.exports = {
  getAdminUser,
  createDriverSession,
  assignDailyRouteManifest,
  deleteDriver,
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
  getRouteReturnInventorySummary,
  getAssignedDailyRouteForDriver,
  getAccountOrder,
  getAccountForecastSignals,
  getAccountProductSummary,
  getDeliveryFailureSignals,
  getDriverStopDeliverySettlement,
  getDailyRouteManifest,
  getDailyRouteManifestWithAccountIntelligence,
  getDriver,
  getDriverAuthRecord,
  getActiveDriverSession,
  getAiOperationsMetrics,
  getKnowledgeGraphSnapshot,
  getStaticHazardLocationBackfillStats,
  getRouteSessionAnalytics,
  isDatabaseEnabled,
  isPostgisEnabled,
  generateAccountInsight,
  listAccountInsights,
  listAccountOrders,
  listAdminUsers,
  listCustomerAccounts,
  listDailyRouteManifests,
  listDataImportBatches,
  listDrivers,
  listProducts,
  lookupProductByBarcodeOrSku,
  addRouteTruckInventoryForDriver,
  getRouteTruckInventoryForDriver,
  upsertWarehouseEmployee,
  listWarehouseEmployees,
  getWarehouseEmployeeWithPin,
  prepareDepartureInventoryConfirmation,
  confirmDepartureInventoryPrint,
  confirmDepartureInventoryPrintForWarehouse,
  getDepartureInventoryConfirmation,
  listPredictionRuns,
  listScheduledReports,
  listScheduledReportSchedules,
  listSupervisorAlerts,
  listUndeliveredRouteStops,
  listRouteSessionEvents,
  listRouteSessions,
  listStaticHazardLocationBackfillQueue,
  listStaticHazardsForVerification,
  listDeliveryNotes,
  listDeliveryDocumentsForDriverStop,
  listDeliveryDocumentsForAdmin,
  getRouteCloseoutDocumentForDriver,
  listRouteCloseoutDocumentsForAdmin,
  prepareRouteInventoryCloseoutForDriver,
  confirmRouteInventoryCloseoutPrintForDriver,
  confirmRouteInventoryCloseoutPrintForWarehouse,
  listRouteInventoryCloseoutsForAdmin,
  reviewRouteInventoryCloseout,
  listDriverCoachingSignals,
  listManualHazards,
  listOperationalGeographyConfiguration,
  listOperationalHeatmapGeography,
  listOperationalHeatmapSignals,
  listRecentDestinations,
  listProductDemandSignals,
  listRouteCompletionSignals,
  listStaticBridgesInBounds,
  listStaticBridgesNearRoute,
  listStaticZonesInBounds,
  listStaticZonesNearRoute,
  saveAiInteractionLog,
  saveAccountInsight,
  savePredictionRun,
  saveScheduledReport,
  saveDataImportBatch,
  reviewAccountInsight,
  saveRecentDestination,
  saveRouteSession,
  recordDeliveryDeduction,
  recordDeliveryDeductionForDriverStop,
  saveDriverStopDeliverySettlement,
  saveDeliveryDocument,
  saveRouteCloseoutDocument,
  recordAdminUserLogin,
  revokeDriverSession,
  setAdminUserActive,
  setDriverActive,
  setDriverPinHash,
  setScheduledReportScheduleEnabled,
  setOperationalGeographyActive,
  unassignDailyRouteManifest,
  upsertOperationalDistributionCenter,
  upsertOperationalRouteGroup,
  upsertOperationalTerritory,
  swapDailyRouteAssignments,
  updateRouteSessionReview,
  updateStaticHazardVerification,
  updateDailyRouteStopStatusForDriver,
  updateUndeliveredStopDisposition,
  upsertCustomerAccount,
  upsertScheduledReportSchedule,
  upsertSupervisorAlert,
  upsertProduct,
  upsertAdminUser,
  createAccountOrder,
  upsertDailyRouteManifest,
  upsertDriver,
  upsertDeliveryNote,
  upsertManualHazard,
  upsertStaticBridge,
  upsertStaticZone,
  replaceDailyRouteStops,
  claimDueScheduledReports,
  queueScheduledReportNow,
  updateSupervisorAlertStatus
};
