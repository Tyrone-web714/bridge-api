const path = require('path');
const governance = require('./decisionGovernance');
const registry = require('./enterpriseCapabilityRegistry');
const orchestration = require('./intelligenceCapabilityOrchestration');
const lifecycle = require('./intelligenceLifecycleFramework');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'implementation');
const generatedRoot = path.join(docsRoot, 'route-intelligence-foundation', 'generated');
const ROUTE_INTELLIGENCE_SCHEMA_VERSION = 'route.intelligence.foundation.v1';
const ROUTE_INTELLIGENCE_ENGINE_VERSION = 'route.intelligence.foundation.engine.v1';
const DETERMINISTIC_GENERATED_AT = '2026-07-25T00:00:00.000Z';

const ASSESSMENT_STATUSES = Object.freeze({
  PASS: 'PASS',
  FAIL_CLOSED: 'FAIL_CLOSED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  NOT_APPLICABLE: 'NOT_APPLICABLE'
});

const ROUTE_SAFETY_STATUSES = Object.freeze({
  ELIGIBLE: 'ELIGIBLE',
  UNSAFE: 'UNSAFE',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
});

const DEFAULT_POLICY = Object.freeze({
  heightSafetyBufferInches: 6,
  minimumClearanceMarginInches: 3,
  maxEvidenceAgeDays: 365,
  hazardProximityYards: 60,
  failClosedOnUnknownClearance: true,
  failClosedOnMissingVehicleDimensions: true,
  residentialAvoidanceAdvisoryOnly: true
});

const LENGTH_UNITS_TO_INCHES = Object.freeze({
  in: 1,
  inch: 1,
  inches: 1,
  ft: 12,
  foot: 12,
  feet: 12,
  yd: 36,
  yard: 36,
  yards: 36,
  m: 39.37007874015748,
  meter: 39.37007874015748,
  meters: 39.37007874015748,
  cm: 0.3937007874015748,
  centimeter: 0.3937007874015748,
  centimeters: 0.3937007874015748
});

const WEIGHT_UNITS_TO_POUNDS = Object.freeze({
  lb: 1,
  lbs: 1,
  pound: 1,
  pounds: 1,
  ton: 2000,
  tons: 2000,
  us_ton: 2000,
  kg: 2.2046226218487757
});

const ROUTE_CAPABILITIES = Object.freeze([
  {
    capabilityId: 'route.safety.assessment',
    displayName: 'Route Safety Assessment',
    authoritative: true,
    executionStrategy: 'DETERMINISTIC_RULES',
    description: 'Deterministic assessment of vehicle profile compatibility with route restrictions and hazards.'
  },
  {
    capabilityId: 'route.clearance.assessment',
    displayName: 'Clearance Assessment',
    authoritative: true,
    executionStrategy: 'DETERMINISTIC_RULES',
    description: 'Fail-closed low-clearance bridge assessment using vehicle height, safety buffer, and evidence freshness.'
  },
  {
    capabilityId: 'route.alternative.comparison',
    displayName: 'Route Alternative Comparison',
    authoritative: false,
    executionStrategy: 'DETERMINISTIC_RULES',
    description: 'Advisory comparison of route alternatives after all mandatory safety gates have run.'
  },
  {
    capabilityId: 'route.safety.explanation',
    displayName: 'Route Safety Explanation',
    authoritative: false,
    executionStrategy: 'DETERMINISTIC_RULES',
    description: 'Plain-language explanation over deterministic route safety facts without provider inference.'
  }
]);

const REASON_CODES = Object.freeze({
  ROUTE_SAFETY_PASS: 'ROUTE_SAFETY_PASS',
  VEHICLE_PROFILE_VALID: 'VEHICLE_PROFILE_VALID',
  VEHICLE_PROFILE_MISSING_HEIGHT: 'VEHICLE_PROFILE_MISSING_HEIGHT',
  VEHICLE_PROFILE_MISSING_WEIGHT: 'VEHICLE_PROFILE_MISSING_WEIGHT',
  VEHICLE_PROFILE_MISSING_DIMENSION: 'VEHICLE_PROFILE_MISSING_DIMENSION',
  CLEARANCE_PASS: 'CLEARANCE_PASS',
  CLEARANCE_CONFLICT: 'CLEARANCE_CONFLICT',
  CLEARANCE_INSUFFICIENT: 'CLEARANCE_INSUFFICIENT',
  CLEARANCE_MINIMAL_MARGIN: 'CLEARANCE_MINIMAL_MARGIN',
  CLEARANCE_STALE: 'CLEARANCE_STALE',
  CLEARANCE_FAIL_CLOSED: 'CLEARANCE_FAIL_CLOSED',
  WEIGHT_PASS: 'WEIGHT_PASS',
  WEIGHT_RESTRICTED: 'WEIGHT_RESTRICTED',
  WEIGHT_UNKNOWN: 'WEIGHT_UNKNOWN',
  DIMENSION_PASS: 'DIMENSION_PASS',
  DIMENSION_RESTRICTED: 'DIMENSION_RESTRICTED',
  TRUCK_ROUTE_PASS: 'TRUCK_ROUTE_PASS',
  TRUCK_PROHIBITED: 'TRUCK_PROHIBITED',
  NO_THROUGH_TRUCKS: 'NO_THROUGH_TRUCKS',
  ROAD_CLOSED: 'ROAD_CLOSED',
  RESTRICTED_ROAD_CLASS: 'RESTRICTED_ROAD_CLASS',
  RESIDENTIAL_AVOIDANCE: 'RESIDENTIAL_AVOIDANCE',
  RESIDENTIAL_PROHIBITION: 'RESIDENTIAL_PROHIBITION',
  HAZARD_PROXIMITY_PASS: 'HAZARD_PROXIMITY_PASS',
  HAZARD_PROXIMITY_REVIEW: 'HAZARD_PROXIMITY_REVIEW',
  HAZARD_INTERSECTION: 'HAZARD_INTERSECTION',
  HAZARD_GEOMETRY_INVALID: 'HAZARD_GEOMETRY_INVALID',
  ALTERNATIVE_UNSAFE_REJECTED: 'ALTERNATIVE_UNSAFE_REJECTED',
  PROVIDER_CONTROL_REJECTED: 'PROVIDER_CONTROL_REJECTED',
  TENANT_CONTEXT_REQUIRED: 'TENANT_CONTEXT_REQUIRED'
});

function stable(value) { return governance.stable(value); }
function stableStringify(value) { return governance.stableStringify(value); }
function sha256(value) { return governance.sha256(value); }

function round(value, places = 6) {
  return Number.isFinite(value) ? Number(value.toFixed(places)) : null;
}

function normalizeUnit(unit, table) {
  return String(unit || '').trim().toLowerCase().replace(/\s+/g, '_') || null;
}

function measurementToInches(measurement) {
  if (!measurement || typeof measurement !== 'object') return null;
  const unit = normalizeUnit(measurement.unit, LENGTH_UNITS_TO_INCHES);
  const value = Number(measurement.value);
  if (!Number.isFinite(value) || value < 0 || !Object.prototype.hasOwnProperty.call(LENGTH_UNITS_TO_INCHES, unit)) return null;
  const inches = value * LENGTH_UNITS_TO_INCHES[unit];
  return stable({ value, unit, inches: round(inches), feet: round(inches / 12), source: measurement.source || null, confidence: Number.isFinite(Number(measurement.confidence)) ? Number(measurement.confidence) : null });
}

function measurementToPounds(measurement) {
  if (!measurement || typeof measurement !== 'object') return null;
  const unit = normalizeUnit(measurement.unit, WEIGHT_UNITS_TO_POUNDS);
  const value = Number(measurement.value);
  if (!Number.isFinite(value) || value < 0 || !Object.prototype.hasOwnProperty.call(WEIGHT_UNITS_TO_POUNDS, unit)) return null;
  const pounds = value * WEIGHT_UNITS_TO_POUNDS[unit];
  return stable({ value, unit, pounds: round(pounds), tons: round(pounds / 2000), source: measurement.source || null, confidence: Number.isFinite(Number(measurement.confidence)) ? Number(measurement.confidence) : null });
}

function mergePolicy(policy = {}) {
  return stable({ ...DEFAULT_POLICY, ...(policy || {}) });
}

function daysBetween(olderIso, newerIso) {
  const older = Date.parse(olderIso || '');
  const newer = Date.parse(newerIso || DETERMINISTIC_GENERATED_AT);
  if (!Number.isFinite(older) || !Number.isFinite(newer)) return null;
  return Math.floor((newer - older) / 86400000);
}

function pushResult(results, result) {
  results.push(stable({ ...result, resultHash: sha256(result) }));
}

function validateVehicleProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object') errors.push({ rule: 'MISSING_VEHICLE_PROFILE', reasonCode: REASON_CODES.VEHICLE_PROFILE_MISSING_DIMENSION });
  if (profile && !profile.vehicleId) errors.push({ rule: 'MISSING_VEHICLE_ID', reasonCode: REASON_CODES.VEHICLE_PROFILE_MISSING_DIMENSION });
  if (profile && !profile.vehicleClass) errors.push({ rule: 'MISSING_VEHICLE_CLASS', reasonCode: REASON_CODES.VEHICLE_PROFILE_MISSING_DIMENSION });
  if (profile && !measurementToInches(profile.height)) errors.push({ rule: 'MISSING_OR_INVALID_HEIGHT', reasonCode: REASON_CODES.VEHICLE_PROFILE_MISSING_HEIGHT });
  if (profile && !measurementToPounds(profile.grossWeight)) errors.push({ rule: 'MISSING_OR_INVALID_GROSS_WEIGHT', reasonCode: REASON_CODES.VEHICLE_PROFILE_MISSING_WEIGHT });
  for (const field of ['height', 'width', 'length']) {
    if (profile?.[field] && !profile[field].source) errors.push({ rule: `MISSING_${field.toUpperCase()}_SOURCE`, reasonCode: REASON_CODES.VEHICLE_PROFILE_MISSING_DIMENSION });
  }
  if (profile?.grossWeight && !profile.grossWeight.source) errors.push({ rule: 'MISSING_WEIGHT_SOURCE', reasonCode: REASON_CODES.VEHICLE_PROFILE_MISSING_WEIGHT });
  return stable({
    valid: errors.length === 0,
    errors,
    normalizedHeight: profile ? measurementToInches(profile.height) : null,
    normalizedGrossWeight: profile ? measurementToPounds(profile.grossWeight) : null,
    normalizedWidth: profile ? measurementToInches(profile.width) : null,
    normalizedLength: profile ? measurementToInches(profile.length) : null,
    validationHash: sha256({ profile, errors })
  });
}

function validateRouteIntelligenceRequest(request) {
  const errors = [];
  const forbiddenFields = ['provider', 'providerId', 'model', 'modelId', 'premium', 'executionStrategyOverride'];
  for (const field of forbiddenFields) {
    if (Object.prototype.hasOwnProperty.call(request || {}, field)) errors.push({ rule: 'CALLER_PROVIDER_OR_MODEL_CONTROL', field, reasonCode: REASON_CODES.PROVIDER_CONTROL_REJECTED });
  }
  if (!request?.tenantContext?.organizationId) errors.push({ rule: 'TENANT_CONTEXT_REQUIRED', reasonCode: REASON_CODES.TENANT_CONTEXT_REQUIRED });
  if (!request?.vehicleProfile) errors.push({ rule: 'VEHICLE_PROFILE_REQUIRED', reasonCode: REASON_CODES.VEHICLE_PROFILE_MISSING_DIMENSION });
  if (!Array.isArray(request?.routeCandidates)) errors.push({ rule: 'ROUTE_CANDIDATES_REQUIRED', reasonCode: REASON_CODES.CLEARANCE_INSUFFICIENT });
  const vehicleValidation = validateVehicleProfile(request?.vehicleProfile);
  return stable({ valid: errors.length === 0 && vehicleValidation.valid, errors: errors.concat(vehicleValidation.errors), vehicleValidation, validationHash: sha256({ request, errors, vehicleValidation }) });
}

function requestErrorStatus(error) {
  if ([
    'MISSING_OR_INVALID_HEIGHT',
    'MISSING_OR_INVALID_GROSS_WEIGHT',
    'MISSING_VEHICLE_CLASS',
    'MISSING_HEIGHT_SOURCE',
    'MISSING_WIDTH_SOURCE',
    'MISSING_LENGTH_SOURCE',
    'MISSING_WEIGHT_SOURCE',
    'VEHICLE_PROFILE_REQUIRED'
  ].includes(error.rule)) return ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE;
  return ASSESSMENT_STATUSES.FAIL_CLOSED;
}

function effectiveHeightInches(vehicleProfile, policy = DEFAULT_POLICY) {
  const normalized = measurementToInches(vehicleProfile?.height);
  if (!normalized) return null;
  const buffer = Number(policy.heightSafetyBufferInches);
  return round(normalized.inches + (Number.isFinite(buffer) ? buffer : 0));
}

function assessClearance(vehicleProfile, clearanceEvidence, policyInput = {}, now = DETERMINISTIC_GENERATED_AT) {
  const policy = mergePolicy(policyInput);
  const height = effectiveHeightInches(vehicleProfile, policy);
  const clearance = measurementToInches(clearanceEvidence?.clearance);
  const ageDays = daysBetween(clearanceEvidence?.observedAt || clearanceEvidence?.updatedAt, now);
  const result = {
    assessmentType: 'CLEARANCE',
    evidenceId: clearanceEvidence?.evidenceId || clearanceEvidence?.id || null,
    status: ASSESSMENT_STATUSES.PASS,
    reasonCode: REASON_CODES.CLEARANCE_PASS,
    facts: { vehicleEffectiveHeightInches: height, vehiclePhysicalHeightInches: measurementToInches(vehicleProfile?.height)?.inches || null, safetyBufferInches: policy.heightSafetyBufferInches, clearanceInches: clearance?.inches || null, marginInches: null, evidenceAgeDays: ageDays, clearanceSource: clearance?.source || clearanceEvidence?.source || null, clearanceConfidence: clearance?.confidence || clearanceEvidence?.confidence || null },
    safetyCritical: true
  };
  if (!height) return stable({ ...result, status: ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE, reasonCode: REASON_CODES.VEHICLE_PROFILE_MISSING_HEIGHT, facts: { ...result.facts, marginInches: null }, resultHash: sha256(result) });
  if (!clearance) return stable({ ...result, status: ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE, reasonCode: REASON_CODES.CLEARANCE_INSUFFICIENT, facts: { ...result.facts, marginInches: null }, resultHash: sha256(result) });
  const margin = round(clearance.inches - height);
  if (clearanceEvidence?.conflict === true) return stable({ ...result, status: ASSESSMENT_STATUSES.FAIL_CLOSED, reasonCode: REASON_CODES.CLEARANCE_CONFLICT, facts: { ...result.facts, marginInches: margin }, resultHash: sha256(result) });
  if (ageDays === null || ageDays > policy.maxEvidenceAgeDays) return stable({ ...result, status: ASSESSMENT_STATUSES.REVIEW_REQUIRED, reasonCode: REASON_CODES.CLEARANCE_STALE, facts: { ...result.facts, marginInches: margin }, resultHash: sha256(result) });
  if (margin <= 0) return stable({ ...result, status: ASSESSMENT_STATUSES.FAIL_CLOSED, reasonCode: REASON_CODES.CLEARANCE_FAIL_CLOSED, facts: { ...result.facts, marginInches: margin }, resultHash: sha256(result) });
  if (margin < policy.minimumClearanceMarginInches) return stable({ ...result, status: ASSESSMENT_STATUSES.REVIEW_REQUIRED, reasonCode: REASON_CODES.CLEARANCE_MINIMAL_MARGIN, facts: { ...result.facts, marginInches: margin }, resultHash: sha256(result) });
  return stable({ ...result, facts: { ...result.facts, marginInches: margin }, resultHash: sha256(result) });
}

function assessWeightRestriction(vehicleProfile, restriction) {
  const vehicleWeight = measurementToPounds(vehicleProfile?.grossWeight);
  const maxWeight = measurementToPounds(restriction?.maxGrossWeight);
  const base = { assessmentType: 'WEIGHT', restrictionId: restriction?.restrictionId || null, facts: { vehiclePounds: vehicleWeight?.pounds || null, maxPounds: maxWeight?.pounds || null }, safetyCritical: true };
  if (!vehicleWeight || !maxWeight) return stable({ ...base, status: ASSESSMENT_STATUSES.REVIEW_REQUIRED, reasonCode: REASON_CODES.WEIGHT_UNKNOWN, resultHash: sha256(base) });
  if (vehicleWeight.pounds > maxWeight.pounds) return stable({ ...base, status: ASSESSMENT_STATUSES.FAIL_CLOSED, reasonCode: REASON_CODES.WEIGHT_RESTRICTED, resultHash: sha256(base) });
  return stable({ ...base, status: ASSESSMENT_STATUSES.PASS, reasonCode: REASON_CODES.WEIGHT_PASS, resultHash: sha256(base) });
}

function assessDimensionRestriction(vehicleProfile, restriction) {
  const checks = [
    ['height', vehicleProfile?.height, restriction?.maxHeight],
    ['width', vehicleProfile?.width, restriction?.maxWidth],
    ['length', vehicleProfile?.length, restriction?.maxLength]
  ];
  const failures = [];
  const unknown = [];
  for (const [dimension, vehicleMeasurement, maxMeasurement] of checks) {
    if (!maxMeasurement) continue;
    const vehicleValue = measurementToInches(vehicleMeasurement);
    const maxValue = measurementToInches(maxMeasurement);
    if (!vehicleValue || !maxValue) unknown.push(dimension);
    else if (vehicleValue.inches > maxValue.inches) failures.push({ dimension, vehicleInches: vehicleValue.inches, maxInches: maxValue.inches });
  }
  const base = { assessmentType: 'DIMENSION', restrictionId: restriction?.restrictionId || null, facts: { failures, unknown }, safetyCritical: true };
  if (failures.length) return stable({ ...base, status: ASSESSMENT_STATUSES.FAIL_CLOSED, reasonCode: REASON_CODES.DIMENSION_RESTRICTED, resultHash: sha256(base) });
  if (unknown.length) return stable({ ...base, status: ASSESSMENT_STATUSES.REVIEW_REQUIRED, reasonCode: REASON_CODES.VEHICLE_PROFILE_MISSING_DIMENSION, resultHash: sha256(base) });
  return stable({ ...base, status: ASSESSMENT_STATUSES.PASS, reasonCode: REASON_CODES.DIMENSION_PASS, resultHash: sha256(base) });
}

function assessTruckRestriction(routeCandidate, restriction, request = {}) {
  const base = { assessmentType: 'TRUCK_RESTRICTION', restrictionId: restriction?.restrictionId || null, segmentId: restriction?.segmentId || null, facts: { restrictionType: restriction?.type || null, localDelivery: request?.purpose === 'LOCAL_DELIVERY' }, safetyCritical: true };
  if (restriction?.type === 'TRUCK_PROHIBITED') return stable({ ...base, status: ASSESSMENT_STATUSES.FAIL_CLOSED, reasonCode: REASON_CODES.TRUCK_PROHIBITED, resultHash: sha256(base) });
  if (restriction?.type === 'ROAD_CLOSED') return stable({ ...base, status: ASSESSMENT_STATUSES.FAIL_CLOSED, reasonCode: REASON_CODES.ROAD_CLOSED, resultHash: sha256(base) });
  if (restriction?.type === 'NO_THROUGH_TRUCKS' && request?.purpose !== 'LOCAL_DELIVERY') return stable({ ...base, status: ASSESSMENT_STATUSES.FAIL_CLOSED, reasonCode: REASON_CODES.NO_THROUGH_TRUCKS, resultHash: sha256(base) });
  if (restriction?.type === 'RESTRICTED_ROAD_CLASS') return stable({ ...base, status: ASSESSMENT_STATUSES.REVIEW_REQUIRED, reasonCode: REASON_CODES.RESTRICTED_ROAD_CLASS, resultHash: sha256(base) });
  return stable({ ...base, status: ASSESSMENT_STATUSES.PASS, reasonCode: REASON_CODES.TRUCK_ROUTE_PASS, resultHash: sha256(base) });
}

function assessResidentialRestriction(restriction) {
  const base = { assessmentType: 'RESIDENTIAL_RESTRICTION', restrictionId: restriction?.restrictionId || null, facts: { restrictionType: restriction?.type || null }, safetyCritical: restriction?.type === 'RESIDENTIAL_TRUCK_PROHIBITED' };
  if (restriction?.type === 'RESIDENTIAL_TRUCK_PROHIBITED') return stable({ ...base, status: ASSESSMENT_STATUSES.FAIL_CLOSED, reasonCode: REASON_CODES.RESIDENTIAL_PROHIBITION, resultHash: sha256(base) });
  if (restriction?.type === 'RESIDENTIAL_AVOID') return stable({ ...base, status: ASSESSMENT_STATUSES.REVIEW_REQUIRED, reasonCode: REASON_CODES.RESIDENTIAL_AVOIDANCE, resultHash: sha256(base) });
  return stable({ ...base, status: ASSESSMENT_STATUSES.NOT_APPLICABLE, reasonCode: REASON_CODES.TRUCK_ROUTE_PASS, resultHash: sha256(base) });
}

function pointDistanceYards(a, b) {
  if (!Number.isFinite(a?.latitude) || !Number.isFinite(a?.longitude) || !Number.isFinite(b?.latitude) || !Number.isFinite(b?.longitude)) return null;
  const latFactor = 364000;
  const lonFactor = 364000 * Math.cos(((a.latitude + b.latitude) / 2) * Math.PI / 180);
  const dx = (a.longitude - b.longitude) * lonFactor;
  const dy = (a.latitude - b.latitude) * latFactor;
  return Math.sqrt(dx * dx + dy * dy) / 3;
}

function minDistanceToRouteYards(routePoints, hazardPoint) {
  const distances = (routePoints || []).map((point) => pointDistanceYards(point, hazardPoint)).filter(Number.isFinite);
  return distances.length ? round(Math.min(...distances), 3) : null;
}

function normalizeHazards(hazards = []) {
  const seen = new Set();
  return (hazards || [])
    .map((hazard) => ({
      ...hazard,
      hazardId: hazard?.hazardId || sha256({ type: hazard?.type || null, point: hazard?.point || hazard }).slice(0, 16)
    }))
    .sort((a, b) => String(a.hazardId).localeCompare(String(b.hazardId)))
    .filter((hazard) => {
      const key = `${hazard.hazardId}:${hazard.type || ''}:${hazard.point?.latitude || hazard.latitude || ''}:${hazard.point?.longitude || hazard.longitude || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function assessHazardProximity(routeCandidate, hazards = [], policyInput = {}) {
  const policy = mergePolicy(policyInput);
  const routePoints = routeCandidate?.geometry?.points || [];
  const results = [];
  if (!Array.isArray(routePoints) || !routePoints.length) {
    pushResult(results, { assessmentType: 'HAZARD_PROXIMITY', status: ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE, reasonCode: REASON_CODES.HAZARD_GEOMETRY_INVALID, facts: { routePointCount: 0 }, safetyCritical: true });
    return stable(results);
  }
  if (routePoints.some((point) => !Number.isFinite(point?.latitude) || !Number.isFinite(point?.longitude))) {
    pushResult(results, { assessmentType: 'HAZARD_PROXIMITY', status: ASSESSMENT_STATUSES.FAIL_CLOSED, reasonCode: REASON_CODES.HAZARD_GEOMETRY_INVALID, facts: { routePointCount: routePoints.length }, safetyCritical: true });
    return stable(results);
  }
  for (const hazard of normalizeHazards(hazards)) {
    const distanceYards = minDistanceToRouteYards(routePoints, hazard?.point || hazard);
    const base = { assessmentType: 'HAZARD_PROXIMITY', hazardId: hazard?.hazardId || null, facts: { distanceYards, hazardType: hazard?.type || null, thresholdYards: policy.hazardProximityYards }, safetyCritical: hazard?.safetyCritical !== false };
    if (!Number.isFinite(distanceYards)) pushResult(results, { ...base, status: ASSESSMENT_STATUSES.REVIEW_REQUIRED, reasonCode: REASON_CODES.HAZARD_GEOMETRY_INVALID });
    else if (distanceYards <= 0.001) pushResult(results, { ...base, status: ASSESSMENT_STATUSES.FAIL_CLOSED, reasonCode: REASON_CODES.HAZARD_INTERSECTION });
    else if (distanceYards <= policy.hazardProximityYards) pushResult(results, { ...base, status: ASSESSMENT_STATUSES.REVIEW_REQUIRED, reasonCode: REASON_CODES.HAZARD_PROXIMITY_REVIEW });
    else pushResult(results, { ...base, status: ASSESSMENT_STATUSES.PASS, reasonCode: REASON_CODES.HAZARD_PROXIMITY_PASS });
  }
  if (!results.length) pushResult(results, { assessmentType: 'HAZARD_PROXIMITY', status: ASSESSMENT_STATUSES.PASS, reasonCode: REASON_CODES.HAZARD_PROXIMITY_PASS, facts: { hazardCount: 0 }, safetyCritical: false });
  return stable(results);
}

function evidenceCompleteness(routeCandidate) {
  const checks = [
    ['clearanceEvidence', Array.isArray(routeCandidate?.clearanceEvidence)],
    ['restrictions', Array.isArray(routeCandidate?.restrictions)],
    ['hazards', Array.isArray(routeCandidate?.hazards)],
    ['geometry', Array.isArray(routeCandidate?.geometry?.points) && routeCandidate.geometry.points.length > 0]
  ];
  return stable(checks.map(([name, present]) => ({ name, present })));
}

function deriveRouteStatus(ruleResults) {
  if (ruleResults.some((result) => result.status === ASSESSMENT_STATUSES.FAIL_CLOSED)) return ROUTE_SAFETY_STATUSES.UNSAFE;
  if (ruleResults.some((result) => result.status === ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE)) return ROUTE_SAFETY_STATUSES.INSUFFICIENT_EVIDENCE;
  if (ruleResults.some((result) => result.status === ASSESSMENT_STATUSES.REVIEW_REQUIRED)) return ROUTE_SAFETY_STATUSES.REVIEW_REQUIRED;
  return ROUTE_SAFETY_STATUSES.ELIGIBLE;
}

function assessRouteCandidateSafety(request, routeCandidate, options = {}) {
  const policy = mergePolicy(options.policy || request?.policy);
  const ruleResults = [];
  const requestValidation = validateRouteIntelligenceRequest({ ...request, routeCandidates: [routeCandidate] });
  if (!requestValidation.valid) {
    for (const error of requestValidation.errors) pushResult(ruleResults, { assessmentType: 'REQUEST_VALIDATION', status: requestErrorStatus(error), reasonCode: error.reasonCode, facts: { rule: error.rule }, safetyCritical: true });
  }
  for (const evidence of routeCandidate?.clearanceEvidence || []) ruleResults.push(assessClearance(request?.vehicleProfile, evidence, policy, options.now));
  for (const restriction of routeCandidate?.restrictions || []) {
    if (restriction.type === 'WEIGHT_LIMIT') ruleResults.push(assessWeightRestriction(request?.vehicleProfile, restriction));
    if (['HEIGHT_LIMIT', 'WIDTH_LIMIT', 'LENGTH_LIMIT', 'DIMENSION_LIMIT'].includes(restriction.type)) ruleResults.push(assessDimensionRestriction(request?.vehicleProfile, restriction));
    if (['TRUCK_PROHIBITED', 'NO_THROUGH_TRUCKS', 'ROAD_CLOSED', 'RESTRICTED_ROAD_CLASS'].includes(restriction.type)) ruleResults.push(assessTruckRestriction(routeCandidate, restriction, request));
    if (['RESIDENTIAL_AVOID', 'RESIDENTIAL_TRUCK_PROHIBITED'].includes(restriction.type)) ruleResults.push(assessResidentialRestriction(restriction));
  }
  ruleResults.push(...assessHazardProximity(routeCandidate, routeCandidate?.hazards || [], policy));
  const completeness = evidenceCompleteness(routeCandidate);
  if (completeness.some((item) => !item.present)) {
    pushResult(ruleResults, { assessmentType: 'EVIDENCE_COMPLETENESS', status: ASSESSMENT_STATUSES.REVIEW_REQUIRED, reasonCode: REASON_CODES.CLEARANCE_INSUFFICIENT, facts: { completeness }, safetyCritical: true });
  }
  const status = deriveRouteStatus(ruleResults);
  const assessment = {
    schemaVersion: ROUTE_INTELLIGENCE_SCHEMA_VERSION,
    engineVersion: ROUTE_INTELLIGENCE_ENGINE_VERSION,
    routeCandidateId: routeCandidate?.routeCandidateId || null,
    tenantContext: { organizationId: request?.tenantContext?.organizationId || null },
    status,
    eligible: status === ROUTE_SAFETY_STATUSES.ELIGIBLE,
    advisoryOnly: true,
    productionApplicable: false,
    providerCallInvoked: false,
    routeEndpointModified: false,
    ruleResults: stable(ruleResults),
    reasonCodes: [...new Set(ruleResults.map((result) => result.reasonCode).concat(status === ROUTE_SAFETY_STATUSES.ELIGIBLE ? [REASON_CODES.ROUTE_SAFETY_PASS] : []))].sort(),
    evidenceCompleteness: completeness,
    policy,
    confidence: status === ROUTE_SAFETY_STATUSES.ELIGIBLE ? { status: 'KNOWN_EVIDENCE_ONLY', score: 1 } : { status: 'NOT_SAFE_TO_CERTIFY', score: null },
    sourceHashes: stable(ruleResults.map((result) => ({ assessmentType: result.assessmentType, id: result.evidenceId || result.restrictionId || result.hazardId || result.segmentId || null, hash: result.resultHash }))),
    safeWithinKnownEvidence: status === ROUTE_SAFETY_STATUSES.ELIGIBLE,
    generatedAt: DETERMINISTIC_GENERATED_AT
  };
  assessment.assessmentHash = sha256(assessment);
  return stable(assessment);
}

function buildRouteSafetyExplanation(assessment) {
  const blockers = assessment.ruleResults.filter((item) => item.status === ASSESSMENT_STATUSES.FAIL_CLOSED);
  const reviews = assessment.ruleResults.filter((item) => item.status === ASSESSMENT_STATUSES.REVIEW_REQUIRED || item.status === ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE);
  const explanation = {
    routeCandidateId: assessment.routeCandidateId,
    status: assessment.status,
    summary: blockers.length
      ? 'Route candidate rejected by deterministic truck-safety gates.'
      : reviews.length
        ? 'Route candidate requires human review because deterministic evidence is incomplete or advisory conditions are present.'
        : 'Route candidate passed deterministic truck-safety gates for the supplied repository-only evidence.',
    primaryReasonCodes: assessment.reasonCodes,
    blockerCount: blockers.length,
    reviewCount: reviews.length,
    providerGenerated: false,
    safetyRuleOverride: false
  };
  explanation.explanationHash = sha256(explanation);
  return stable(explanation);
}

function compareRouteAlternatives(request, options = {}) {
  const assessments = (request?.routeCandidates || []).map((candidate) => assessRouteCandidateSafety(request, candidate, options));
  const ranked = assessments
    .map((assessment) => {
      const candidate = request.routeCandidates.find((item) => item.routeCandidateId === assessment.routeCandidateId) || {};
      const penalty = assessment.status === ROUTE_SAFETY_STATUSES.ELIGIBLE ? 0 : assessment.status === ROUTE_SAFETY_STATUSES.REVIEW_REQUIRED ? 100000 : 1000000;
      return stable({
        routeCandidateId: assessment.routeCandidateId,
        status: assessment.status,
        eligible: assessment.eligible,
        score: round((candidate.estimatedDistanceMiles || 0) + ((candidate.estimatedDurationMinutes || 0) / 60) + penalty, 3),
        reasonCodes: assessment.reasonCodes
      });
    })
    .sort((a, b) => a.score - b.score || String(a.routeCandidateId).localeCompare(String(b.routeCandidateId)));
  const selected = ranked.find((item) => item.eligible) || null;
  const comparison = {
    schemaVersion: ROUTE_INTELLIGENCE_SCHEMA_VERSION,
    selectedRouteCandidateId: selected?.routeCandidateId || null,
    selectedStatus: selected?.status || null,
    unsafeRoutesRejected: ranked.filter((item) => item.status === ROUTE_SAFETY_STATUSES.UNSAFE).map((item) => ({ routeCandidateId: item.routeCandidateId, reasonCode: REASON_CODES.ALTERNATIVE_UNSAFE_REJECTED })),
    rankedAlternatives: ranked,
    assessments,
    advisoryOnly: true,
    providerCallInvoked: false,
    productionApplicable: false
  };
  comparison.comparisonHash = sha256(comparison);
  return stable(comparison);
}

function vehicleProfileContract() {
  return stable({
    schemaVersion: 'route.vehicle.profile.contract.v1',
    required: ['vehicleId', 'vehicleClass', 'height', 'grossWeight'],
    optional: ['width', 'length', 'axleCount', 'axleWeight', 'hazmat', 'trailerType', 'trailerDimensions', 'operationalRestrictions'],
    authoritativeFields: ['height', 'grossWeight', 'legalRestrictions', 'clearanceEvidence'],
    unknownFields: ['height', 'width', 'length', 'grossWeight', 'axleWeight', 'roadLimit'],
    measurementMetadata: ['unit', 'source', 'confidence'],
    derivedFields: ['effectiveRoutingHeight', 'safetyBuffer'],
    tenantDerived: ['organizationId'],
    validationStatus: ['VALID', 'INSUFFICIENT_EVIDENCE', 'FAIL_CLOSED'],
    testOnly: true,
    callerProviderControlsAllowed: false,
    units: { length: Object.keys(LENGTH_UNITS_TO_INCHES).sort(), weight: Object.keys(WEIGHT_UNITS_TO_POUNDS).sort() }
  });
}

function routeCandidateContract() {
  return stable({
    schemaVersion: 'route.candidate.contract.v1',
    required: ['routeCandidateId', 'geometry', 'clearanceEvidence', 'restrictions', 'hazards'],
    geometry: { points: ['latitude', 'longitude'] },
    authoritativeSources: ['truck restriction data', 'low-clearance bridge data', 'hazard rules'],
    productionRouteEndpointModified: false
  });
}

function buildSyntheticVehicleProfiles() {
  return stable([
    { vehicleId: 'vehicle-box-12ft-6in', vehicleClass: 'BOX_TRUCK', height: { value: 12.5, unit: 'ft', source: 'synthetic.vehicle.profile', confidence: 1 }, width: { value: 96, unit: 'in', source: 'synthetic.vehicle.profile', confidence: 1 }, length: { value: 26, unit: 'ft', source: 'synthetic.vehicle.profile', confidence: 1 }, grossWeight: { value: 26000, unit: 'lb', source: 'synthetic.vehicle.profile', confidence: 1 }, trailerType: 'NONE', operationalRestrictions: [], axleCount: 2 },
    { vehicleId: 'vehicle-tractor-13ft-6in', vehicleClass: 'TRACTOR_TRAILER', height: { value: 13.5, unit: 'ft', source: 'synthetic.vehicle.profile', confidence: 1 }, width: { value: 102, unit: 'in', source: 'synthetic.vehicle.profile', confidence: 1 }, length: { value: 53, unit: 'ft', source: 'synthetic.vehicle.profile', confidence: 1 }, grossWeight: { value: 78000, unit: 'lb', source: 'synthetic.vehicle.profile', confidence: 1 }, trailerType: 'DRY_VAN', trailerDimensions: { length: { value: 53, unit: 'ft', source: 'synthetic.vehicle.profile', confidence: 1 } }, operationalRestrictions: [], axleCount: 5 },
    { vehicleId: 'vehicle-overheight', vehicleClass: 'TRACTOR_TRAILER', height: { value: 14.2, unit: 'ft', source: 'synthetic.vehicle.profile', confidence: 1 }, width: { value: 102, unit: 'in', source: 'synthetic.vehicle.profile', confidence: 1 }, length: { value: 53, unit: 'ft', source: 'synthetic.vehicle.profile', confidence: 1 }, grossWeight: { value: 76000, unit: 'lb', source: 'synthetic.vehicle.profile', confidence: 1 }, trailerType: 'DRY_VAN', operationalRestrictions: [], axleCount: 5 },
    { vehicleId: 'vehicle-missing-height', vehicleClass: 'BOX_TRUCK', width: { value: 96, unit: 'in', source: 'synthetic.vehicle.profile', confidence: 1 }, length: { value: 24, unit: 'ft', source: 'synthetic.vehicle.profile', confidence: 1 }, grossWeight: { value: 18000, unit: 'lb', source: 'synthetic.vehicle.profile', confidence: 1 }, trailerType: 'NONE', operationalRestrictions: [], axleCount: 2 }
  ]);
}

function baseRoutePoints() {
  return [{ latitude: 33.5000, longitude: -86.8000 }, { latitude: 33.5005, longitude: -86.7995 }, { latitude: 33.5010, longitude: -86.7990 }];
}

function buildSyntheticRouteCandidates() {
  return stable([
    {
      routeCandidateId: 'route-clear-pass',
      geometry: { points: baseRoutePoints() },
      estimatedDistanceMiles: 12.4,
      estimatedDurationMinutes: 31,
      clearanceEvidence: [{ evidenceId: 'bridge-14ft-0in-current', clearance: { value: 14, unit: 'ft', source: 'synthetic.bridge.catalog', confidence: 1 }, observedAt: '2026-07-20T00:00:00.000Z' }],
      restrictions: [],
      hazards: []
    },
    {
      routeCandidateId: 'route-low-clearance',
      geometry: { points: baseRoutePoints() },
      estimatedDistanceMiles: 10.1,
      estimatedDurationMinutes: 25,
      clearanceEvidence: [{ evidenceId: 'bridge-13ft-0in-current', clearance: { value: 13, unit: 'ft', source: 'synthetic.bridge.catalog', confidence: 1 }, observedAt: '2026-07-20T00:00:00.000Z' }],
      restrictions: [],
      hazards: []
    },
    {
      routeCandidateId: 'route-truck-prohibited',
      geometry: { points: baseRoutePoints() },
      estimatedDistanceMiles: 11,
      estimatedDurationMinutes: 28,
      clearanceEvidence: [{ evidenceId: 'bridge-15ft-current', clearance: { value: 15, unit: 'ft', source: 'synthetic.bridge.catalog', confidence: 1 }, observedAt: '2026-07-20T00:00:00.000Z' }],
      restrictions: [{ restrictionId: 'no-trucks-main', type: 'TRUCK_PROHIBITED', segmentId: 'segment-main' }],
      hazards: []
    },
    {
      routeCandidateId: 'route-near-hazard',
      geometry: { points: baseRoutePoints() },
      estimatedDistanceMiles: 13,
      estimatedDurationMinutes: 32,
      clearanceEvidence: [{ evidenceId: 'bridge-15ft-current', clearance: { value: 15, unit: 'ft', source: 'synthetic.bridge.catalog', confidence: 1 }, observedAt: '2026-07-20T00:00:00.000Z' }],
      restrictions: [],
      hazards: [{ hazardId: 'manual-hazard-near-route', type: 'LOW_WIRE', point: { latitude: 33.50062, longitude: -86.7995 }, safetyCritical: true }]
    }
  ]);
}

function buildBenchmarkCases() {
  const vehicles = buildSyntheticVehicleProfiles();
  const routes = buildSyntheticRouteCandidates();
  const requestBase = { tenantContext: { organizationId: 'org_synthetic_route_intelligence' }, purpose: 'THROUGH_ROUTE' };
  return stable([
    ['clearance_pass', vehicles[0], [routes[0]], ROUTE_SAFETY_STATUSES.ELIGIBLE],
    ['low_clearance_fail_closed', vehicles[1], [routes[1]], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['truck_prohibited_fail_closed', vehicles[0], [routes[2]], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['hazard_proximity_review', vehicles[0], [routes[3]], ROUTE_SAFETY_STATUSES.REVIEW_REQUIRED],
    ['missing_vehicle_height_insufficient', vehicles[3], [routes[0]], ROUTE_SAFETY_STATUSES.INSUFFICIENT_EVIDENCE],
    ['unsafe_not_selected', vehicles[0], [routes[1], routes[0]], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['overheight_rejects', vehicles[2], [routes[0]], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['residential_advisory_review', vehicles[0], [{ ...routes[0], routeCandidateId: 'route-residential-avoid', restrictions: [{ restrictionId: 'residential-avoid', type: 'RESIDENTIAL_AVOID' }] }], ROUTE_SAFETY_STATUSES.REVIEW_REQUIRED],
    ['weight_limit_rejects', vehicles[1], [{ ...routes[0], routeCandidateId: 'route-weight-limit', restrictions: [{ restrictionId: 'weight-limit', type: 'WEIGHT_LIMIT', maxGrossWeight: { value: 20, unit: 'tons' } }] }], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['no_through_truck_rejects', vehicles[0], [{ ...routes[0], routeCandidateId: 'route-no-through', restrictions: [{ restrictionId: 'no-through', type: 'NO_THROUGH_TRUCKS' }] }], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['local_delivery_allows_no_through', vehicles[0], [{ ...routes[0], routeCandidateId: 'route-local-delivery', restrictions: [{ restrictionId: 'no-through', type: 'NO_THROUGH_TRUCKS' }] }], ROUTE_SAFETY_STATUSES.ELIGIBLE],
    ['stale_clearance_review', vehicles[0], [{ ...routes[0], routeCandidateId: 'route-stale', clearanceEvidence: [{ evidenceId: 'old', clearance: { value: 15, unit: 'ft', source: 'synthetic.bridge.catalog', confidence: 1 }, observedAt: '2020-01-01T00:00:00.000Z' }] }], ROUTE_SAFETY_STATUSES.REVIEW_REQUIRED],
    ['exact_height_rejects', vehicles[0], [{ ...routes[0], routeCandidateId: 'route-exact-height', clearanceEvidence: [{ evidenceId: 'exact', clearance: { value: 13, unit: 'ft', source: 'synthetic.bridge.catalog', confidence: 1 }, observedAt: '2026-07-20T00:00:00.000Z' }] }], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['safety_buffer_rejects', vehicles[0], [{ ...routes[0], routeCandidateId: 'route-buffer-fail', clearanceEvidence: [{ evidenceId: 'buffer', clearance: { value: 12.75, unit: 'ft', source: 'synthetic.bridge.catalog', confidence: 1 }, observedAt: '2026-07-20T00:00:00.000Z' }] }], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['minimal_margin_review', vehicles[0], [{ ...routes[0], routeCandidateId: 'route-minimal-margin', clearanceEvidence: [{ evidenceId: 'minimal', clearance: { value: 13.125, unit: 'ft', source: 'synthetic.bridge.catalog', confidence: 1 }, observedAt: '2026-07-20T00:00:00.000Z' }] }], ROUTE_SAFETY_STATUSES.REVIEW_REQUIRED],
    ['unknown_clearance_insufficient', vehicles[0], [{ ...routes[0], routeCandidateId: 'route-unknown-clearance', clearanceEvidence: [{ evidenceId: 'unknown', observedAt: '2026-07-20T00:00:00.000Z' }] }], ROUTE_SAFETY_STATUSES.INSUFFICIENT_EVIDENCE],
    ['conflicting_clearance_rejects', vehicles[0], [{ ...routes[0], routeCandidateId: 'route-conflict', clearanceEvidence: [{ evidenceId: 'conflict', clearance: { value: 15, unit: 'ft', source: 'synthetic.bridge.catalog', confidence: 1 }, conflict: true, observedAt: '2026-07-20T00:00:00.000Z' }] }], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['width_limit_rejects', vehicles[1], [{ ...routes[0], routeCandidateId: 'route-width-limit', restrictions: [{ restrictionId: 'width-limit', type: 'WIDTH_LIMIT', maxWidth: { value: 96, unit: 'in' } }] }], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['length_limit_rejects', vehicles[1], [{ ...routes[0], routeCandidateId: 'route-length-limit', restrictions: [{ restrictionId: 'length-limit', type: 'LENGTH_LIMIT', maxLength: { value: 40, unit: 'ft' } }] }], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['road_closure_rejects', vehicles[0], [{ ...routes[0], routeCandidateId: 'route-road-closed', restrictions: [{ restrictionId: 'closure', type: 'ROAD_CLOSED' }] }], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['restricted_road_class_review', vehicles[0], [{ ...routes[0], routeCandidateId: 'route-restricted-road-class', restrictions: [{ restrictionId: 'class', type: 'RESTRICTED_ROAD_CLASS' }] }], ROUTE_SAFETY_STATUSES.REVIEW_REQUIRED],
    ['malformed_geometry_rejects', vehicles[0], [{ ...routes[0], routeCandidateId: 'route-malformed-geometry', geometry: { points: [{ latitude: null, longitude: -86.8 }] } }], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['missing_geometry_insufficient', vehicles[0], [{ ...routes[0], routeCandidateId: 'route-missing-geometry', geometry: { points: [] } }], ROUTE_SAFETY_STATUSES.INSUFFICIENT_EVIDENCE],
    ['intersecting_hazard_rejects', vehicles[0], [{ ...routes[0], routeCandidateId: 'route-intersecting-hazard', hazards: [{ hazardId: 'intersection', type: 'LOW_WIRE', point: baseRoutePoints()[0], safetyCritical: true }] }], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['shorter_unsafe_not_selected', vehicles[0], [{ ...routes[1], estimatedDistanceMiles: 1, estimatedDurationMinutes: 2 }, routes[0]], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['cheaper_unsafe_not_selected', vehicles[0], [{ ...routes[1], estimatedDistanceMiles: 1, estimatedDurationMinutes: 1 }, routes[0]], ROUTE_SAFETY_STATUSES.UNSAFE],
    ['human_review_required', vehicles[0], [routes[3]], ROUTE_SAFETY_STATUSES.REVIEW_REQUIRED]
  ].map(([caseId, vehicleProfile, routeCandidates, expectedPrimaryStatus]) => ({
    caseId,
    request: { ...requestBase, purpose: caseId === 'local_delivery_allows_no_through' ? 'LOCAL_DELIVERY' : requestBase.purpose, vehicleProfile, routeCandidates },
    expectedPrimaryStatus,
    deterministic: true,
    providerCallExpected: false,
    productionRouteEndpointMutationExpected: false
  })));
}

function buildRouteIntelligenceEvidence() {
  const benchmarkCases = buildBenchmarkCases();
  const assessments = benchmarkCases.map((benchmark) => {
    const comparison = compareRouteAlternatives(benchmark.request);
    const primaryAssessment = comparison.assessments.find((assessment) => assessment.routeCandidateId === benchmark.request.routeCandidates[0].routeCandidateId);
    return stable({ caseId: benchmark.caseId, primaryAssessment, comparison, explanation: buildRouteSafetyExplanation(primaryAssessment) });
  });
  const existingRouteRiskCapability = registry.getEnterpriseCapability('route.risk_explanation');
  const orchestrationEvidence = orchestration.buildOrchestrationEvidence();
  const lifecycleEvidence = lifecycle.buildLifecycleEvidence();
  const catalog = {
    schemaVersion: ROUTE_INTELLIGENCE_SCHEMA_VERSION,
    engineVersion: ROUTE_INTELLIGENCE_ENGINE_VERSION,
    generatedAt: DETERMINISTIC_GENERATED_AT,
    capabilityCount: ROUTE_CAPABILITIES.length,
    benchmarkCaseCount: benchmarkCases.length,
    integratedWithEnterpriseRegistry: Boolean(existingRouteRiskCapability),
    integratedWithCapabilityOrchestration: orchestrationEvidence.capabilities.some((capability) => capability.capabilityId === 'route.intelligence.optimization'),
    integratedWithLifecycleFramework: lifecycleEvidence.lifecycleRecords.some((record) => record.capabilityId === 'route.intelligence.optimization'),
    deterministicRulesAuthoritative: true,
    providerCallInvoked: false,
    productionRouteEndpointModified: false,
    productionApplicable: false,
    testOnly: true
  };
  catalog.catalogHash = sha256(catalog);
  return stable({
    catalog,
    capabilities: ROUTE_CAPABILITIES,
    contracts: {
      vehicleProfile: vehicleProfileContract(),
      routeCandidate: routeCandidateContract()
    },
    reasonCodes: REASON_CODES,
    benchmarkCases,
    assessments,
    integrationReferences: {
      enterpriseCapabilityRegistry: existingRouteRiskCapability ? { capabilityId: existingRouteRiskCapability.capabilityId, lifecycleState: existingRouteRiskCapability.lifecycleState, deterministicVerificationRequired: existingRouteRiskCapability.deterministicVerificationRequired } : null,
      capabilityOrchestration: orchestrationEvidence.capabilities.find((capability) => capability.capabilityId === 'route.intelligence.optimization') || null,
      lifecycleFramework: lifecycleEvidence.lifecycleRecords.find((record) => record.capabilityId === 'route.intelligence.optimization') || null
    }
  });
}

function validateRouteSafetyAssessment(assessment) {
  const errors = [];
  if (!Object.values(ROUTE_SAFETY_STATUSES).includes(assessment?.status)) errors.push({ rule: 'UNKNOWN_ROUTE_SAFETY_STATUS' });
  if (assessment?.providerCallInvoked !== false) errors.push({ rule: 'PROVIDER_CALL_PROHIBITED' });
  if (assessment?.productionApplicable === true) errors.push({ rule: 'PRODUCTION_ROUTE_CLAIM_PROHIBITED' });
  if (assessment?.productionActivation === true || assessment?.guaranteedSafe === true) errors.push({ rule: 'PRODUCTION_OR_GUARANTEED_SAFE_CLAIM_PROHIBITED' });
  if (assessment?.routeEndpointModified === true) errors.push({ rule: 'PRODUCTION_ROUTE_ENDPOINT_MUTATION_PROHIBITED' });
  if (assessment?.status === ROUTE_SAFETY_STATUSES.ELIGIBLE && assessment.safeWithinKnownEvidence !== true) errors.push({ rule: 'ELIGIBLE_REQUIRES_KNOWN_EVIDENCE_SCOPE' });
  if (assessment?.status !== ROUTE_SAFETY_STATUSES.ELIGIBLE && assessment?.eligible === true) errors.push({ rule: 'INELIGIBLE_STATUS_MARKED_ELIGIBLE' });
  if (!assessment?.assessmentHash || assessment.assessmentHash !== sha256({ ...assessment, assessmentHash: undefined })) errors.push({ rule: 'ASSESSMENT_HASH_MISMATCH' });
  return stable({ valid: errors.length === 0, errors });
}

function validateRouteIntelligenceEvidence(evidence = buildRouteIntelligenceEvidence()) {
  const errors = [];
  if (evidence.catalog.providerCallInvoked !== false) errors.push({ rule: 'PROVIDER_CALL_PROHIBITED' });
  if (evidence.catalog.productionRouteEndpointModified !== false) errors.push({ rule: 'PRODUCTION_ROUTE_ENDPOINT_MUTATION_PROHIBITED' });
  if (!evidence.catalog.integratedWithEnterpriseRegistry) errors.push({ rule: 'ENTERPRISE_REGISTRY_INTEGRATION_MISSING' });
  if (!evidence.catalog.integratedWithCapabilityOrchestration) errors.push({ rule: 'ORCHESTRATION_INTEGRATION_MISSING' });
  if (!evidence.catalog.integratedWithLifecycleFramework) errors.push({ rule: 'LIFECYCLE_INTEGRATION_MISSING' });
  for (const record of evidence.assessments || []) {
    const validation = validateRouteSafetyAssessment(record.primaryAssessment);
    for (const error of validation.errors) errors.push({ ...error, caseId: record.caseId });
  }
  for (const benchmark of evidence.benchmarkCases || []) {
    const record = evidence.assessments.find((item) => item.caseId === benchmark.caseId);
    if (!record) errors.push({ rule: 'MISSING_BENCHMARK_ASSESSMENT', caseId: benchmark.caseId });
    else if (record.primaryAssessment.status !== benchmark.expectedPrimaryStatus) errors.push({ rule: 'BENCHMARK_EXPECTATION_MISMATCH', caseId: benchmark.caseId, expected: benchmark.expectedPrimaryStatus, actual: record.primaryAssessment.status });
  }
  return stable({ valid: errors.length === 0, errors });
}

module.exports = {
  ASSESSMENT_STATUSES,
  DEFAULT_POLICY,
  DETERMINISTIC_GENERATED_AT,
  REASON_CODES,
  ROUTE_CAPABILITIES,
  ROUTE_INTELLIGENCE_ENGINE_VERSION,
  ROUTE_INTELLIGENCE_SCHEMA_VERSION,
  ROUTE_SAFETY_STATUSES,
  assessClearance,
  assessDimensionRestriction,
  assessHazardProximity,
  assessResidentialRestriction,
  assessRouteCandidateSafety,
  assessTruckRestriction,
  assessWeightRestriction,
  buildBenchmarkCases,
  buildRouteIntelligenceEvidence,
  buildRouteSafetyExplanation,
  buildSyntheticRouteCandidates,
  buildSyntheticVehicleProfiles,
  compareRouteAlternatives,
  effectiveHeightInches,
  measurementToInches,
  measurementToPounds,
  routeCandidateContract,
  sha256,
  stable,
  stableStringify,
  validateRouteIntelligenceEvidence,
  validateRouteIntelligenceRequest,
  validateRouteSafetyAssessment,
  validateVehicleProfile,
  vehicleProfileContract,
  paths: { backendRoot, repoRoot, docsRoot, generatedRoot }
};
