const path = require('path');
const governance = require('./decisionGovernance');
const registry = require('./enterpriseCapabilityRegistry');
const orchestration = require('./intelligenceCapabilityOrchestration');
const lifecycle = require('./intelligenceLifecycleFramework');
const routeIntel = require('./routeIntelligence');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'implementation');
const generatedRoot = path.join(docsRoot, 'driver-intelligence-foundation', 'generated');
const DRIVER_INTELLIGENCE_SCHEMA_VERSION = 'driver.intelligence.foundation.v1';
const DRIVER_INTELLIGENCE_ENGINE_VERSION = 'driver.intelligence.foundation.engine.v1';
const DETERMINISTIC_GENERATED_AT = '2026-07-25T00:00:00.000Z';

const DRIVER_STATES = Object.freeze(['OFF_DUTY','ON_DUTY','DRIVING','AT_STOP','DELIVERING','WAITING','RETURNING','ROUTE_COMPLETE','UNKNOWN']);
const DRIVER_EVENTS = Object.freeze(['ROUTE_STARTED','ROUTE_COMPLETED','STOP_ARRIVED','STOP_DEPARTED','ROUTE_DEVIATED','ROUTE_RESUMED','SPEED_WARNING','LOW_BRIDGE_WARNING','RESTRICTED_ROAD_WARNING','RESIDENTIAL_AREA_WARNING','ROUTE_CANCELLED','EMERGENCY_STOP','GPS_LOST','EVIDENCE_MISSING','MANUAL_REVIEW_REQUIRED']);
const ASSESSMENT_STATUSES = Object.freeze({ PASS: 'PASS', ADVISORY: 'ADVISORY', WARNING: 'WARNING', FAIL_CLOSED: 'FAIL_CLOSED', INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE', REVIEW_REQUIRED: 'REVIEW_REQUIRED', NOT_APPLICABLE: 'NOT_APPLICABLE' });
const DRIVER_ASSESSMENT_STATUSES = Object.freeze({ NORMAL: 'NORMAL', ADVISORY: 'ADVISORY', WARNING: 'WARNING', REVIEW_REQUIRED: 'REVIEW_REQUIRED', INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE' });
const ADVISORY_TYPES = Object.freeze(['REDUCE_SPEED','RETURN_TO_ROUTE','LOW_BRIDGE_AHEAD','RESTRICTED_ROAD_AHEAD','NO_THROUGH_TRUCK_AHEAD','RESIDENTIAL_AREA_ADVISORY','REVIEW_REQUIRED','UNABLE_TO_DETERMINE','ACKNOWLEDGE_HAZARD']);
const DEFAULT_POLICY = Object.freeze({ routeDeviationAdvisoryYards: 100, routeDeviationWarningYards: 300, offRouteWarningMinutes: 5, stopArrivalThresholdYards: 30, stopDepartureThresholdYards: 60, speedAdvisoryMph: 60, speedWarningMph: 65, speedEvidenceStaleMinutes: 5, repeatedSpeedingWindowEvents: 3, approachThresholdYards: routeIntel.DEFAULT_POLICY.hazardProximityYards, deterministicNow: DETERMINISTIC_GENERATED_AT });

const REASON_CODES = Object.freeze({
  DRIVER_PROFILE_VALID: 'DRIVER_PROFILE_VALID',
  DRIVER_PROFILE_MISSING: 'DRIVER_PROFILE_MISSING',
  TENANT_CONTEXT_REQUIRED: 'TENANT_CONTEXT_REQUIRED',
  PROVIDER_CONTROL_REJECTED: 'PROVIDER_CONTROL_REJECTED',
  DRIVER_STATE_VALID: 'DRIVER_STATE_VALID',
  DRIVER_STATE_UNKNOWN: 'DRIVER_STATE_UNKNOWN',
  DRIVER_EVENT_VALID: 'DRIVER_EVENT_VALID',
  DRIVER_EVENT_UNKNOWN: 'DRIVER_EVENT_UNKNOWN',
  ROUTE_ADHERENCE_PASS: 'ROUTE_ADHERENCE_PASS',
  ROUTE_DEVIATION_ADVISORY: 'ROUTE_DEVIATION_ADVISORY',
  ROUTE_DEVIATION_WARNING: 'ROUTE_DEVIATION_WARNING',
  ROUTE_EVIDENCE_INSUFFICIENT: 'ROUTE_EVIDENCE_INSUFFICIENT',
  ROUTE_GEOMETRY_MALFORMED: 'ROUTE_GEOMETRY_MALFORMED',
  ROUTE_RESUMED: 'ROUTE_RESUMED',
  STOP_ARRIVED: 'STOP_ARRIVED',
  STOP_DEPARTED: 'STOP_DEPARTED',
  STOP_GEOMETRY_INSUFFICIENT: 'STOP_GEOMETRY_INSUFFICIENT',
  STOP_PROGRESS_UNKNOWN: 'STOP_PROGRESS_UNKNOWN',
  SPEED_WITHIN_POLICY: 'SPEED_WITHIN_POLICY',
  SPEED_ADVISORY_60: 'SPEED_ADVISORY_60',
  SPEED_WARNING_65: 'SPEED_WARNING_65',
  SPEED_REPEATED_WARNING: 'SPEED_REPEATED_WARNING',
  SPEED_EVIDENCE_STALE: 'SPEED_EVIDENCE_STALE',
  SPEED_UNKNOWN: 'SPEED_UNKNOWN',
  GPS_UNAVAILABLE: 'GPS_UNAVAILABLE',
  LOW_BRIDGE_APPROACH: 'LOW_BRIDGE_APPROACH',
  LOW_BRIDGE_UNKNOWN: 'LOW_BRIDGE_UNKNOWN',
  RESTRICTED_ROAD_APPROACH: 'RESTRICTED_ROAD_APPROACH',
  NO_THROUGH_TRUCK_APPROACH: 'NO_THROUGH_TRUCK_APPROACH',
  LOCAL_DELIVERY_EXCEPTION: 'LOCAL_DELIVERY_EXCEPTION',
  RESIDENTIAL_AREA_APPROACH: 'RESIDENTIAL_AREA_APPROACH',
  RESIDENTIAL_PROHIBITION_APPROACH: 'RESIDENTIAL_PROHIBITION_APPROACH',
  ROAD_CLOSURE_APPROACH: 'ROAD_CLOSURE_APPROACH',
  RESTRICTION_UNKNOWN: 'RESTRICTION_UNKNOWN',
  HAZARD_ACKNOWLEDGED: 'HAZARD_ACKNOWLEDGED',
  HAZARD_ACKNOWLEDGEMENT_MISSING: 'HAZARD_ACKNOWLEDGEMENT_MISSING',
  HUMAN_REVIEW_REQUIRED: 'HUMAN_REVIEW_REQUIRED'
});

const DRIVER_CAPABILITIES = Object.freeze([
  { capabilityId: 'driver.operational_state.assessment', displayName: 'Driver Operational State Assessment', executionStrategy: 'DETERMINISTIC_RULES', employeeScoring: false },
  { capabilityId: 'driver.route_adherence.assessment', displayName: 'Driver Route Adherence Assessment', executionStrategy: 'DETERMINISTIC_RULES', employeeScoring: false },
  { capabilityId: 'driver.safety_advisory.generation', displayName: 'Driver Safety Advisory Generation', executionStrategy: 'DETERMINISTIC_RULES', employeeScoring: false },
  { capabilityId: 'driver.evidence.explanation', displayName: 'Driver Evidence Explanation', executionStrategy: 'DETERMINISTIC_RULES', employeeScoring: false }
]);
const PROHIBITED_EMPLOYMENT_IMPACT_FIELDS = Object.freeze(['driverScore','employeeRank','disciplinaryStatus','terminationRecommendation','compensationDecision','bonusRecommendation','productivityRating','fatiguePrediction','behaviorPrediction']);

function stable(value) { return governance.stable(value); }
function stableStringify(value) { return governance.stableStringify(value); }
function sha256(value) { return governance.sha256(value); }
function round(value, places = 6) { return Number.isFinite(value) ? Number(value.toFixed(places)) : null; }
function mergePolicy(policy = {}) { return stable({ ...DEFAULT_POLICY, ...(policy || {}) }); }

function pushResult(results, result) {
  results.push(stable({ ...result, resultHash: sha256(result) }));
}

function pointDistanceYards(a, b) {
  if (!Number.isFinite(a?.latitude) || !Number.isFinite(a?.longitude) || !Number.isFinite(b?.latitude) || !Number.isFinite(b?.longitude)) return null;
  const latFactor = 364000;
  const lonFactor = 364000 * Math.cos(((a.latitude + b.latitude) / 2) * Math.PI / 180);
  const dx = (a.longitude - b.longitude) * lonFactor;
  const dy = (a.latitude - b.latitude) * latFactor;
  return Math.sqrt(dx * dx + dy * dy) / 3;
}

function minDistanceToRouteYards(routePoints, point) {
  const distances = (routePoints || []).map((candidate) => pointDistanceYards(candidate, point)).filter(Number.isFinite);
  return distances.length ? round(Math.min(...distances), 3) : null;
}

function hasMalformedPoints(points) {
  return Array.isArray(points) && points.some((point) => !Number.isFinite(point?.latitude) || !Number.isFinite(point?.longitude));
}

function minutesBetween(later, earlier) {
  const laterTime = Date.parse(later);
  const earlierTime = Date.parse(earlier);
  if (!Number.isFinite(laterTime) || !Number.isFinite(earlierTime)) return null;
  return Math.max(0, (laterTime - earlierTime) / 60000);
}

function orderedEvents(events = []) {
  return [...events].sort((a, b) => String(a.observedAt || '').localeCompare(String(b.observedAt || '')) || String(a.eventType || '').localeCompare(String(b.eventType || '')));
}

function validateDriverProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object') errors.push({ rule: 'MISSING_DRIVER_PROFILE', reasonCode: REASON_CODES.DRIVER_PROFILE_MISSING });
  if (profile && !profile.driverId) errors.push({ rule: 'MISSING_DRIVER_ID', reasonCode: REASON_CODES.DRIVER_PROFILE_MISSING });
  if (profile && !profile.organizationId) errors.push({ rule: 'MISSING_ORGANIZATION_ID', reasonCode: REASON_CODES.TENANT_CONTEXT_REQUIRED });
  if (profile && profile.employeeScoringEnabled === true) errors.push({ rule: 'EMPLOYEE_SCORING_PROHIBITED', reasonCode: REASON_CODES.HUMAN_REVIEW_REQUIRED });
  return stable({ valid: errors.length === 0, errors, syntheticOnly: profile?.syntheticOnly === true, validationHash: sha256({ profile, errors }) });
}

function validateDriverRequest(request) {
  const errors = [];
  for (const field of ['provider','providerId','model','modelId','premium','performanceScore','employeeRank']) {
    if (Object.prototype.hasOwnProperty.call(request || {}, field)) errors.push({ rule: 'CALLER_PROVIDER_OR_EMPLOYEE_SCORING_CONTROL', field, reasonCode: REASON_CODES.PROVIDER_CONTROL_REJECTED });
  }
  if (!request?.tenantContext?.organizationId) errors.push({ rule: 'TENANT_CONTEXT_REQUIRED', reasonCode: REASON_CODES.TENANT_CONTEXT_REQUIRED });
  const profileValidation = validateDriverProfile(request?.driverProfile);
  return stable({ valid: errors.length === 0 && profileValidation.valid, errors: errors.concat(profileValidation.errors), profileValidation, validationHash: sha256({ request, errors, profileValidation }) });
}

function assessOperationalState(snapshot = {}) {
  const state = DRIVER_STATES.includes(snapshot.driverState) ? snapshot.driverState : 'UNKNOWN';
  const eventTypes = (snapshot.events || []).map((event) => event.eventType);
  const unknownEvents = eventTypes.filter((eventType) => !DRIVER_EVENTS.includes(eventType));
  const result = {
    assessmentType: 'DRIVER_OPERATIONAL_STATE',
    driverState: state,
    eventTypes,
    status: state === 'UNKNOWN' || unknownEvents.length ? ASSESSMENT_STATUSES.REVIEW_REQUIRED : ASSESSMENT_STATUSES.PASS,
    reasonCode: state === 'UNKNOWN' ? REASON_CODES.DRIVER_STATE_UNKNOWN : unknownEvents.length ? REASON_CODES.DRIVER_EVENT_UNKNOWN : REASON_CODES.DRIVER_STATE_VALID,
    facts: { knownState: state !== 'UNKNOWN', unknownEvents },
    employeeScoring: false
  };
  result.resultHash = sha256(result);
  return stable(result);
}

function assessRouteAdherence(snapshot = {}, policyInput = {}) {
  const policy = mergePolicy(policyInput);
  const routePoints = snapshot.assignedRoute?.geometry?.points || [];
  const currentPosition = snapshot.currentPosition;
  const distanceYards = minDistanceToRouteYards(routePoints, currentPosition);
  const offRouteDurationMinutes = Number(snapshot.offRouteDurationMinutes);
  const routeResumed = (snapshot.events || []).some((event) => event.eventType === 'ROUTE_RESUMED');
  const base = { assessmentType: 'DRIVER_ROUTE_ADHERENCE', facts: { distanceFromAssignedRouteYards: distanceYards, offRouteDurationMinutes: Number.isFinite(offRouteDurationMinutes) ? offRouteDurationMinutes : null, routePointCount: routePoints.length, routeResumed, contextualExplanationsRemainPossible: ['local delivery', 'road closure', 'safety reroute', 'supervisor instruction'] }, employeeScoring: false };
  if (!Array.isArray(routePoints) || hasMalformedPoints(routePoints)) return stable({ ...base, status: ASSESSMENT_STATUSES.FAIL_CLOSED, reasonCode: REASON_CODES.ROUTE_GEOMETRY_MALFORMED, humanReviewRequired: true, resultHash: sha256(base) });
  if (!routePoints.length || !currentPosition) return stable({ ...base, status: ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE, reasonCode: REASON_CODES.ROUTE_EVIDENCE_INSUFFICIENT, humanReviewRequired: true, resultHash: sha256(base) });
  if (!Number.isFinite(distanceYards)) return stable({ ...base, status: ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE, reasonCode: REASON_CODES.GPS_UNAVAILABLE, humanReviewRequired: true, resultHash: sha256(base) });
  if (distanceYards >= policy.routeDeviationWarningYards || offRouteDurationMinutes >= policy.offRouteWarningMinutes) return stable({ ...base, status: ASSESSMENT_STATUSES.WARNING, reasonCode: REASON_CODES.ROUTE_DEVIATION_WARNING, humanReviewRequired: true, resultHash: sha256(base) });
  if (distanceYards >= policy.routeDeviationAdvisoryYards) return stable({ ...base, status: ASSESSMENT_STATUSES.ADVISORY, reasonCode: REASON_CODES.ROUTE_DEVIATION_ADVISORY, humanReviewRequired: false, resultHash: sha256(base) });
  if (routeResumed) return stable({ ...base, status: ASSESSMENT_STATUSES.PASS, reasonCode: REASON_CODES.ROUTE_RESUMED, humanReviewRequired: false, resultHash: sha256(base) });
  return stable({ ...base, status: ASSESSMENT_STATUSES.PASS, reasonCode: REASON_CODES.ROUTE_ADHERENCE_PASS, humanReviewRequired: false, resultHash: sha256(base) });
}

function assessStopProgress(snapshot = {}, policyInput = {}) {
  const policy = mergePolicy(policyInput);
  const stop = snapshot.currentStop || null;
  const eventTypes = orderedEvents(snapshot.events || []).map((event) => event.eventType);
  const latestStopEvent = orderedEvents(snapshot.events || []).filter((event) => ['STOP_ARRIVED', 'STOP_DEPARTED'].includes(event.eventType)).at(-1) || null;
  const distanceToStopYards = stop?.point ? pointDistanceYards(snapshot.currentPosition, stop.point) : null;
  const arrived = eventTypes.includes('STOP_ARRIVED') || snapshot.driverState === 'AT_STOP' || snapshot.driverState === 'DELIVERING';
  const departed = eventTypes.includes('STOP_DEPARTED');
  const withinArrivalThreshold = Number.isFinite(distanceToStopYards) && distanceToStopYards <= policy.stopArrivalThresholdYards;
  const beyondDepartureThreshold = Number.isFinite(distanceToStopYards) && distanceToStopYards >= policy.stopDepartureThresholdYards;
  const base = { assessmentType: 'DRIVER_STOP_PROGRESS', stopId: stop?.stopId || null, facts: { arrived, departed, latestStopEventType: latestStopEvent?.eventType || null, distanceToStopYards: round(distanceToStopYards, 3), arrivalThresholdYards: policy.stopArrivalThresholdYards, departureThresholdYards: policy.stopDepartureThresholdYards, driverState: snapshot.driverState || 'UNKNOWN' }, employeeScoring: false };
  if (!stop) return stable({ ...base, status: ASSESSMENT_STATUSES.NOT_APPLICABLE, reasonCode: REASON_CODES.STOP_PROGRESS_UNKNOWN, resultHash: sha256(base) });
  if (!stop.point || !Number.isFinite(distanceToStopYards)) return stable({ ...base, status: ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE, reasonCode: REASON_CODES.STOP_GEOMETRY_INSUFFICIENT, humanReviewRequired: true, resultHash: sha256(base) });
  if (latestStopEvent?.eventType === 'STOP_DEPARTED' || (departed && beyondDepartureThreshold)) return stable({ ...base, status: ASSESSMENT_STATUSES.PASS, reasonCode: REASON_CODES.STOP_DEPARTED, resultHash: sha256(base) });
  if (latestStopEvent?.eventType === 'STOP_ARRIVED' || arrived || withinArrivalThreshold) return stable({ ...base, status: ASSESSMENT_STATUSES.PASS, reasonCode: REASON_CODES.STOP_ARRIVED, resultHash: sha256(base) });
  return stable({ ...base, status: ASSESSMENT_STATUSES.REVIEW_REQUIRED, reasonCode: REASON_CODES.STOP_PROGRESS_UNKNOWN, humanReviewRequired: true, resultHash: sha256(base) });
}

function assessSpeedCompliance(snapshot = {}, policyInput = {}) {
  const policy = mergePolicy(policyInput);
  const speedMph = snapshot.speedMph === null || snapshot.speedMph === undefined ? NaN : Number(snapshot.speedMph);
  const recent = (snapshot.recentSpeedEvents || []).filter((event) => Number(event.speedMph) >= policy.speedWarningMph);
  const speedAgeMinutes = snapshot.speedObservedAt ? minutesBetween(policy.deterministicNow, snapshot.speedObservedAt) : null;
  const base = { assessmentType: 'DRIVER_SPEED_COMPLIANCE', facts: { speedMph: Number.isFinite(speedMph) ? speedMph : null, speedUnit: 'mph', speedAgeMinutes: round(speedAgeMinutes, 3), staleAfterMinutes: policy.speedEvidenceStaleMinutes, recentWarningCount: recent.length, advisoryMph: policy.speedAdvisoryMph, warningMphExclusive: policy.speedWarningMph }, employeeScoring: false };
  if (snapshot.gpsAvailable === false) return stable({ ...base, status: ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE, reasonCode: REASON_CODES.GPS_UNAVAILABLE, resultHash: sha256(base) });
  if (!Number.isFinite(speedMph)) return stable({ ...base, status: ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE, reasonCode: REASON_CODES.SPEED_UNKNOWN, resultHash: sha256(base) });
  if (Number.isFinite(speedAgeMinutes) && speedAgeMinutes > policy.speedEvidenceStaleMinutes) return stable({ ...base, status: ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE, reasonCode: REASON_CODES.SPEED_EVIDENCE_STALE, resultHash: sha256(base) });
  if (recent.length >= policy.repeatedSpeedingWindowEvents) return stable({ ...base, status: ASSESSMENT_STATUSES.WARNING, reasonCode: REASON_CODES.SPEED_REPEATED_WARNING, humanReviewRequired: true, resultHash: sha256(base) });
  if (speedMph > policy.speedWarningMph) return stable({ ...base, status: ASSESSMENT_STATUSES.WARNING, reasonCode: REASON_CODES.SPEED_WARNING_65, humanReviewRequired: true, resultHash: sha256(base) });
  if (speedMph >= policy.speedAdvisoryMph) return stable({ ...base, status: ASSESSMENT_STATUSES.ADVISORY, reasonCode: REASON_CODES.SPEED_ADVISORY_60, humanReviewRequired: false, resultHash: sha256(base) });
  return stable({ ...base, status: ASSESSMENT_STATUSES.PASS, reasonCode: REASON_CODES.SPEED_WITHIN_POLICY, humanReviewRequired: false, resultHash: sha256(base) });
}

function assessLowBridgeApproach(snapshot = {}, policyInput = {}) {
  const policy = mergePolicy(policyInput);
  const position = snapshot.currentPosition;
  const bridges = snapshot.upcomingBridges || [];
  const distances = bridges.map((bridge) => ({ bridgeId: bridge.bridgeId, clearance: bridge.clearance || null, distanceYards: pointDistanceYards(position, bridge.point), confidence: bridge.confidence ?? null })).filter((item) => Number.isFinite(item.distanceYards)).sort((a, b) => a.distanceYards - b.distanceYards || String(a.bridgeId).localeCompare(String(b.bridgeId)));
  const nearest = distances[0] || null;
  const base = { assessmentType: 'DRIVER_LOW_BRIDGE_APPROACH', facts: { nearest, thresholdYards: policy.approachThresholdYards, bridgeCount: bridges.length }, routeIntelligencePolicyVersion: routeIntel.ROUTE_INTELLIGENCE_SCHEMA_VERSION, employeeScoring: false };
  if (!position) return stable({ ...base, status: ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE, reasonCode: REASON_CODES.GPS_UNAVAILABLE, humanReviewRequired: true, resultHash: sha256(base) });
  if (!bridges.length) return stable({ ...base, status: ASSESSMENT_STATUSES.REVIEW_REQUIRED, reasonCode: REASON_CODES.LOW_BRIDGE_UNKNOWN, humanReviewRequired: true, resultHash: sha256(base) });
  if (nearest && nearest.distanceYards <= policy.approachThresholdYards) return stable({ ...base, status: ASSESSMENT_STATUSES.WARNING, reasonCode: REASON_CODES.LOW_BRIDGE_APPROACH, humanReviewRequired: true, resultHash: sha256(base) });
  return stable({ ...base, status: ASSESSMENT_STATUSES.PASS, reasonCode: REASON_CODES.ROUTE_ADHERENCE_PASS, humanReviewRequired: false, resultHash: sha256(base) });
}

function assessRestrictedRoadApproach(snapshot = {}, policyInput = {}) {
  const policy = mergePolicy(policyInput);
  const position = snapshot.currentPosition;
  const restrictions = (snapshot.upcomingRestrictions || []).map((restriction) => ({ ...restriction, distanceYards: pointDistanceYards(position, restriction.point) })).filter((restriction) => Number.isFinite(restriction.distanceYards)).sort((a, b) => a.distanceYards - b.distanceYards || String(a.restrictionId).localeCompare(String(b.restrictionId)));
  const nearest = restrictions[0] || null;
  const purpose = snapshot.routePurpose || 'THROUGH_ROUTE';
  const base = { assessmentType: 'DRIVER_RESTRICTED_ROAD_APPROACH', facts: { nearest, thresholdYards: policy.approachThresholdYards, restrictionCount: snapshot.upcomingRestrictions?.length || 0, routePurpose: purpose }, employeeScoring: false };
  if (!position) return stable({ ...base, status: ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE, reasonCode: REASON_CODES.GPS_UNAVAILABLE, humanReviewRequired: true, resultHash: sha256(base) });
  if (!snapshot.upcomingRestrictions?.length) return stable({ ...base, status: ASSESSMENT_STATUSES.REVIEW_REQUIRED, reasonCode: REASON_CODES.RESTRICTION_UNKNOWN, humanReviewRequired: true, resultHash: sha256(base) });
  if (nearest && nearest.distanceYards <= policy.approachThresholdYards) {
    if (nearest.type === 'NO_THROUGH_TRUCKS' && purpose === 'LOCAL_DELIVERY') return stable({ ...base, status: ASSESSMENT_STATUSES.ADVISORY, reasonCode: REASON_CODES.LOCAL_DELIVERY_EXCEPTION, humanReviewRequired: false, resultHash: sha256(base) });
    const reasonCode =
      nearest.type === 'NO_THROUGH_TRUCKS' ? REASON_CODES.NO_THROUGH_TRUCK_APPROACH :
      nearest.type === 'RESIDENTIAL_AVOID' ? REASON_CODES.RESIDENTIAL_AREA_APPROACH :
      nearest.type === 'RESIDENTIAL_TRUCK_PROHIBITED' ? REASON_CODES.RESIDENTIAL_PROHIBITION_APPROACH :
      nearest.type === 'ROAD_CLOSED' ? REASON_CODES.ROAD_CLOSURE_APPROACH :
      REASON_CODES.RESTRICTED_ROAD_APPROACH;
    const requiresReview = !['RESIDENTIAL_AVOID'].includes(nearest.type);
    return stable({ ...base, status: ASSESSMENT_STATUSES.WARNING, reasonCode, humanReviewRequired: requiresReview, resultHash: sha256(base) });
  }
  return stable({ ...base, status: ASSESSMENT_STATUSES.PASS, reasonCode: REASON_CODES.ROUTE_ADHERENCE_PASS, humanReviewRequired: false, resultHash: sha256(base) });
}

function assessHazardAcknowledgement(snapshot = {}) {
  const warnings = (snapshot.activeWarnings || []).filter((warning) => warning.requiresAcknowledgement === true);
  const acknowledged = new Set((snapshot.hazardAcknowledgements || []).map((item) => item.warningId));
  const missing = warnings.filter((warning) => !acknowledged.has(warning.warningId));
  const base = { assessmentType: 'DRIVER_HAZARD_ACKNOWLEDGEMENT', facts: { required: warnings.map((warning) => warning.warningId), missing: missing.map((warning) => warning.warningId) }, employeeScoring: false };
  if (!warnings.length) return stable({ ...base, status: ASSESSMENT_STATUSES.NOT_APPLICABLE, reasonCode: REASON_CODES.HAZARD_ACKNOWLEDGED, resultHash: sha256(base) });
  if (missing.length) return stable({ ...base, status: ASSESSMENT_STATUSES.REVIEW_REQUIRED, reasonCode: REASON_CODES.HAZARD_ACKNOWLEDGEMENT_MISSING, humanReviewRequired: true, resultHash: sha256(base) });
  return stable({ ...base, status: ASSESSMENT_STATUSES.PASS, reasonCode: REASON_CODES.HAZARD_ACKNOWLEDGED, humanReviewRequired: false, resultHash: sha256(base) });
}

function evidenceCompleteness(snapshot = {}) {
  return stable([
    { name: 'driverProfile', present: Boolean(snapshot.driverProfile?.driverId) },
    { name: 'driverState', present: DRIVER_STATES.includes(snapshot.driverState) },
    { name: 'currentPosition', present: Boolean(snapshot.currentPosition) },
    { name: 'assignedRoute', present: Array.isArray(snapshot.assignedRoute?.geometry?.points) && snapshot.assignedRoute.geometry.points.length > 0 },
    { name: 'speed', present: (snapshot.speedMph !== null && snapshot.speedMph !== undefined && Number.isFinite(Number(snapshot.speedMph))) || snapshot.gpsAvailable === false },
    { name: 'events', present: Array.isArray(snapshot.events) }
  ]);
}

function buildAdvisories(assessmentResults) {
  const advisories = [];
  for (const result of assessmentResults) {
    if (result.status === ASSESSMENT_STATUSES.PASS || result.status === ASSESSMENT_STATUSES.NOT_APPLICABLE) continue;
    let advisoryType = 'REVIEW_REQUIRED';
    if ([REASON_CODES.SPEED_ADVISORY_60, REASON_CODES.SPEED_WARNING_65, REASON_CODES.SPEED_REPEATED_WARNING].includes(result.reasonCode)) advisoryType = 'REDUCE_SPEED';
    if ([REASON_CODES.ROUTE_DEVIATION_ADVISORY, REASON_CODES.ROUTE_DEVIATION_WARNING].includes(result.reasonCode)) advisoryType = 'RETURN_TO_ROUTE';
    if (result.reasonCode === REASON_CODES.LOW_BRIDGE_APPROACH) advisoryType = 'LOW_BRIDGE_AHEAD';
    if ([REASON_CODES.RESTRICTED_ROAD_APPROACH, REASON_CODES.RESIDENTIAL_PROHIBITION_APPROACH, REASON_CODES.ROAD_CLOSURE_APPROACH].includes(result.reasonCode)) advisoryType = 'RESTRICTED_ROAD_AHEAD';
    if (result.reasonCode === REASON_CODES.NO_THROUGH_TRUCK_APPROACH) advisoryType = 'NO_THROUGH_TRUCK_AHEAD';
    if ([REASON_CODES.RESIDENTIAL_AREA_APPROACH, REASON_CODES.LOCAL_DELIVERY_EXCEPTION].includes(result.reasonCode)) advisoryType = 'RESIDENTIAL_AREA_ADVISORY';
    if ([REASON_CODES.SPEED_UNKNOWN, REASON_CODES.SPEED_EVIDENCE_STALE, REASON_CODES.GPS_UNAVAILABLE, REASON_CODES.ROUTE_EVIDENCE_INSUFFICIENT, REASON_CODES.STOP_GEOMETRY_INSUFFICIENT, REASON_CODES.LOW_BRIDGE_UNKNOWN, REASON_CODES.RESTRICTION_UNKNOWN].includes(result.reasonCode)) advisoryType = 'UNABLE_TO_DETERMINE';
    if (result.reasonCode === REASON_CODES.HAZARD_ACKNOWLEDGEMENT_MISSING) advisoryType = 'ACKNOWLEDGE_HAZARD';
    const advisory = { advisoryId: `driver.advisory.${result.assessmentType.toLowerCase()}.${result.reasonCode.toLowerCase()}`, advisoryType, reasonCode: result.reasonCode, sourceAssessmentType: result.assessmentType, structuredOnly: true, providerGenerated: false, employeeScoring: false };
    advisory.advisoryHash = sha256(advisory);
    advisories.push(stable(advisory));
  }
  return stable(advisories);
}

function buildDriverExplanation(assessment) {
  const explanation = {
    assessmentId: assessment.assessmentId,
    summary: assessment.status === DRIVER_ASSESSMENT_STATUSES.NORMAL
      ? 'Driver operational evidence is normal for the supplied synthetic state.'
      : 'Driver advisory state was derived from deterministic evidence and reason codes.',
    reasonCodes: assessment.reasonCodes,
    insufficientEvidence: assessment.ruleResults.filter((result) => result.status === ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE).map((result) => result.reasonCode),
    reviewRequired: assessment.ruleResults.filter((result) => result.humanReviewRequired === true).map((result) => result.reasonCode),
    providerGenerated: false,
    employeeScoring: false,
    disciplinaryRecommendation: false
  };
  explanation.explanationHash = sha256(explanation);
  return stable(explanation);
}

function deriveDriverAssessmentStatus(results) {
  if (results.some((result) => result.status === ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE)) return DRIVER_ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE;
  if (results.some((result) => result.status === ASSESSMENT_STATUSES.FAIL_CLOSED || result.humanReviewRequired === true)) return DRIVER_ASSESSMENT_STATUSES.REVIEW_REQUIRED;
  if (results.some((result) => result.status === ASSESSMENT_STATUSES.WARNING)) return DRIVER_ASSESSMENT_STATUSES.WARNING;
  if (results.some((result) => result.status === ASSESSMENT_STATUSES.ADVISORY || result.status === ASSESSMENT_STATUSES.REVIEW_REQUIRED)) return DRIVER_ASSESSMENT_STATUSES.ADVISORY;
  return DRIVER_ASSESSMENT_STATUSES.NORMAL;
}

function assessDriverOperationalSnapshot(request, options = {}) {
  const snapshot = request?.snapshot || {};
  const policy = mergePolicy(options.policy || request?.policy);
  const ruleResults = [];
  const validation = validateDriverRequest({ ...request, driverProfile: snapshot.driverProfile || request?.driverProfile });
  if (!validation.valid) {
    for (const error of validation.errors) pushResult(ruleResults, { assessmentType: 'DRIVER_REQUEST_VALIDATION', status: error.reasonCode === REASON_CODES.PROVIDER_CONTROL_REJECTED ? ASSESSMENT_STATUSES.FAIL_CLOSED : ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE, reasonCode: error.reasonCode, facts: { rule: error.rule }, humanReviewRequired: true, employeeScoring: false });
  }
  ruleResults.push(assessOperationalState(snapshot));
  ruleResults.push(assessRouteAdherence(snapshot, policy));
  ruleResults.push(assessStopProgress(snapshot, policy));
  ruleResults.push(assessSpeedCompliance(snapshot, policy));
  ruleResults.push(assessLowBridgeApproach(snapshot, policy));
  ruleResults.push(assessRestrictedRoadApproach(snapshot, policy));
  ruleResults.push(assessHazardAcknowledgement(snapshot));
  const completeness = evidenceCompleteness({ ...snapshot, driverProfile: snapshot.driverProfile || request?.driverProfile });
  if (completeness.some((item) => !item.present)) pushResult(ruleResults, { assessmentType: 'DRIVER_EVIDENCE_COMPLETENESS', status: ASSESSMENT_STATUSES.REVIEW_REQUIRED, reasonCode: REASON_CODES.HUMAN_REVIEW_REQUIRED, facts: { completeness }, humanReviewRequired: true, employeeScoring: false });
  const status = deriveDriverAssessmentStatus(ruleResults);
  const assessment = {
    schemaVersion: DRIVER_INTELLIGENCE_SCHEMA_VERSION,
    engineVersion: DRIVER_INTELLIGENCE_ENGINE_VERSION,
    assessmentId: `driver.assessment.${snapshot.snapshotId || 'synthetic'}`,
    tenantContext: { organizationId: request?.tenantContext?.organizationId || request?.driverProfile?.organizationId || null },
    driverId: (snapshot.driverProfile || request?.driverProfile)?.driverId || null,
    status,
    driverState: DRIVER_STATES.includes(snapshot.driverState) ? snapshot.driverState : 'UNKNOWN',
    ruleResults: stable(ruleResults),
    advisories: buildAdvisories(ruleResults),
    evidenceCompleteness: completeness,
    reasonCodes: [...new Set(ruleResults.map((result) => result.reasonCode))].sort(),
    confidence: status === DRIVER_ASSESSMENT_STATUSES.NORMAL ? { status: 'KNOWN_SYNTHETIC_EVIDENCE', score: 1 } : { status: 'NOT_PERFORMANCE_SCORE', score: null },
    sourceHashes: stable(ruleResults.map((result) => ({ assessmentType: result.assessmentType, hash: result.resultHash }))),
    humanReviewFlags: stable(ruleResults.filter((result) => result.humanReviewRequired === true).map((result) => ({ assessmentType: result.assessmentType, reasonCode: result.reasonCode }))),
    policy,
    providerCallInvoked: false,
    hostedAiInvoked: false,
    predictiveModelInvoked: false,
    employeeScoring: false,
    disciplinaryRecommendation: false,
    productionApplicable: false,
    testOnly: true,
    generatedAt: DETERMINISTIC_GENERATED_AT
  };
  assessment.explanation = buildDriverExplanation(assessment);
  assessment.assessmentHash = sha256(assessment);
  return stable(assessment);
}

function driverProfileContract() {
  return stable({
    schemaVersion: 'driver.profile.contract.v1',
    required: ['driverId','organizationId','syntheticOnly'],
    optional: ['assignedVehicleId','routeAssignmentId','dutyState','qualificationClass'],
    prohibited: ['performanceScore','employeeRank','disciplinaryStatus','terminationRecommendation'],
    tenantDerived: ['organizationId'],
    employeeScoringAllowed: false,
    testOnly: true
  });
}

function driverEventContract() {
  return stable({ schemaVersion: 'driver.event.contract.v1', eventTypes: DRIVER_EVENTS, required: ['eventType','observedAt','source'], syntheticOnly: true, providerGenerated: false });
}

function buildSyntheticDriverProfiles() {
  return stable([
    { driverId: 'driver-synthetic-001', organizationId: 'org_synthetic_driver_intelligence', assignedVehicleId: 'vehicle-box-12ft-6in', routeAssignmentId: 'route-assignment-001', syntheticOnly: true },
    { driverId: 'driver-synthetic-002', organizationId: 'org_synthetic_driver_intelligence', assignedVehicleId: 'vehicle-tractor-13ft-6in', routeAssignmentId: 'route-assignment-002', syntheticOnly: true },
    { driverId: 'driver-synthetic-003', organizationId: 'org_synthetic_driver_intelligence', assignedVehicleId: 'vehicle-local-delivery', routeAssignmentId: 'route-assignment-003', syntheticOnly: true }
  ]);
}

function routePoints() {
  return [{ latitude: 33.5000, longitude: -86.8000 }, { latitude: 33.5005, longitude: -86.7995 }, { latitude: 33.5010, longitude: -86.7990 }];
}

function baseSnapshot(overrides = {}) {
  const profiles = buildSyntheticDriverProfiles();
  return stable({
    snapshotId: overrides.snapshotId || 'snapshot-on-route',
    driverProfile: overrides.driverProfile || profiles[0],
    driverState: overrides.driverState || 'DRIVING',
    currentPosition: Object.prototype.hasOwnProperty.call(overrides, 'currentPosition') ? overrides.currentPosition : { latitude: 33.5005, longitude: -86.7995 },
    speedMph: Object.prototype.hasOwnProperty.call(overrides, 'speedMph') ? overrides.speedMph : 45,
    gpsAvailable: overrides.gpsAvailable !== false,
    assignedRoute: overrides.assignedRoute || { routeCandidateId: 'route-clear-pass', geometry: { points: routePoints() } },
    routePurpose: overrides.routePurpose || 'THROUGH_ROUTE',
    offRouteDurationMinutes: Object.prototype.hasOwnProperty.call(overrides, 'offRouteDurationMinutes') ? overrides.offRouteDurationMinutes : 0,
    currentStop: Object.prototype.hasOwnProperty.call(overrides, 'currentStop') ? overrides.currentStop : null,
    upcomingBridges: Object.prototype.hasOwnProperty.call(overrides, 'upcomingBridges') ? overrides.upcomingBridges : [{ bridgeId: 'bridge-clear-far', point: { latitude: 33.503, longitude: -86.797 }, clearance: { value: 15, unit: 'ft' }, confidence: 1 }],
    upcomingRestrictions: Object.prototype.hasOwnProperty.call(overrides, 'upcomingRestrictions') ? overrides.upcomingRestrictions : [{ restrictionId: 'residential-far', type: 'RESIDENTIAL_AVOID', point: { latitude: 33.503, longitude: -86.797 }, confidence: 1 }],
    recentSpeedEvents: overrides.recentSpeedEvents || [],
    speedObservedAt: overrides.speedObservedAt || '2026-07-24T23:59:00.000Z',
    activeWarnings: overrides.activeWarnings || [],
    hazardAcknowledgements: overrides.hazardAcknowledgements || [],
    events: overrides.events || [{ eventType: 'ROUTE_STARTED', observedAt: '2026-07-25T00:00:00.000Z', source: 'synthetic.driver.fixture' }]
  });
}

function buildBenchmarkCases() {
  const profiles = buildSyntheticDriverProfiles();
  const requestBase = { tenantContext: { organizationId: 'org_synthetic_driver_intelligence' }, driverProfile: profiles[0] };
  const near = { latitude: 33.50062, longitude: -86.7995 };
  return stable([
    ['driver_on_route', baseSnapshot(), DRIVER_ASSESSMENT_STATUSES.NORMAL],
    ['driver_route_resumed', baseSnapshot({ snapshotId: 'snapshot-route-resumed', events: [{ eventType: 'ROUTE_DEVIATED', observedAt: '2026-07-24T23:58:00.000Z', source: 'synthetic.driver.fixture' }, { eventType: 'ROUTE_RESUMED', observedAt: '2026-07-24T23:59:00.000Z', source: 'synthetic.driver.fixture' }] }), DRIVER_ASSESSMENT_STATUSES.NORMAL],
    ['driver_off_route', baseSnapshot({ snapshotId: 'snapshot-off-route', currentPosition: { latitude: 33.506, longitude: -86.790 }, offRouteDurationMinutes: 6 }), DRIVER_ASSESSMENT_STATUSES.REVIEW_REQUIRED],
    ['driver_speeding_at_threshold', baseSnapshot({ snapshotId: 'snapshot-speed-60-exact', speedMph: 60 }), DRIVER_ASSESSMENT_STATUSES.ADVISORY],
    ['driver_speeding_advisory', baseSnapshot({ snapshotId: 'snapshot-speed-60', speedMph: 62 }), DRIVER_ASSESSMENT_STATUSES.ADVISORY],
    ['driver_speeding_between_thresholds', baseSnapshot({ snapshotId: 'snapshot-speed-between', speedMph: 65 }), DRIVER_ASSESSMENT_STATUSES.ADVISORY],
    ['driver_speeding_warning', baseSnapshot({ snapshotId: 'snapshot-speed-65', speedMph: 67 }), DRIVER_ASSESSMENT_STATUSES.REVIEW_REQUIRED],
    ['driver_repeated_speeding', baseSnapshot({ snapshotId: 'snapshot-repeat-speed', speedMph: 58, recentSpeedEvents: [{ speedMph: 66 }, { speedMph: 68 }, { speedMph: 70 }] }), DRIVER_ASSESSMENT_STATUSES.REVIEW_REQUIRED],
    ['driver_stale_speed_evidence', baseSnapshot({ snapshotId: 'snapshot-stale-speed', speedMph: 45, speedObservedAt: '2026-07-24T23:40:00.000Z' }), DRIVER_ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE],
    ['driver_stop_arrival', baseSnapshot({ snapshotId: 'snapshot-stop-arrival', driverState: 'AT_STOP', currentStop: { stopId: 'stop-001', point: { latitude: 33.5005, longitude: -86.7995 } }, events: [{ eventType: 'STOP_ARRIVED', observedAt: '2026-07-24T23:59:00.000Z', source: 'synthetic.driver.fixture' }] }), DRIVER_ASSESSMENT_STATUSES.NORMAL],
    ['driver_stop_departure', baseSnapshot({ snapshotId: 'snapshot-stop-departure', currentPosition: { latitude: 33.5013, longitude: -86.7987 }, currentStop: { stopId: 'stop-001', point: { latitude: 33.5005, longitude: -86.7995 } }, events: [{ eventType: 'STOP_ARRIVED', observedAt: '2026-07-24T23:58:00.000Z', source: 'synthetic.driver.fixture' }, { eventType: 'STOP_DEPARTED', observedAt: '2026-07-24T23:59:00.000Z', source: 'synthetic.driver.fixture' }] }), DRIVER_ASSESSMENT_STATUSES.NORMAL],
    ['unknown_stop_geometry', baseSnapshot({ snapshotId: 'snapshot-stop-unknown', currentStop: { stopId: 'stop-unknown' } }), DRIVER_ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE],
    ['driver_approaching_bridge', baseSnapshot({ snapshotId: 'snapshot-bridge', upcomingBridges: [{ bridgeId: 'bridge-near', point: near, clearance: { value: 12.8, unit: 'ft' }, confidence: 1 }] }), DRIVER_ASSESSMENT_STATUSES.REVIEW_REQUIRED],
    ['driver_bridge_outside_threshold', baseSnapshot({ snapshotId: 'snapshot-bridge-outside', upcomingBridges: [{ bridgeId: 'bridge-far', point: { latitude: 33.503, longitude: -86.797 }, clearance: { value: 15, unit: 'ft' }, confidence: 1 }] }), DRIVER_ASSESSMENT_STATUSES.NORMAL],
    ['driver_approaching_restricted_road', baseSnapshot({ snapshotId: 'snapshot-restricted', upcomingRestrictions: [{ restrictionId: 'truck-prohibited-near', type: 'TRUCK_PROHIBITED', point: near, confidence: 1 }] }), DRIVER_ASSESSMENT_STATUSES.REVIEW_REQUIRED],
    ['driver_no_through_truck_approach', baseSnapshot({ snapshotId: 'snapshot-no-through', upcomingRestrictions: [{ restrictionId: 'no-through-near', type: 'NO_THROUGH_TRUCKS', point: near, confidence: 1 }] }), DRIVER_ASSESSMENT_STATUSES.REVIEW_REQUIRED],
    ['driver_no_through_local_delivery', baseSnapshot({ snapshotId: 'snapshot-no-through-local', routePurpose: 'LOCAL_DELIVERY', upcomingRestrictions: [{ restrictionId: 'no-through-local-near', type: 'NO_THROUGH_TRUCKS', point: near, confidence: 1 }] }), DRIVER_ASSESSMENT_STATUSES.ADVISORY],
    ['driver_residential_approach', baseSnapshot({ snapshotId: 'snapshot-residential', upcomingRestrictions: [{ restrictionId: 'residential-near', type: 'RESIDENTIAL_AVOID', point: near, confidence: 1 }] }), DRIVER_ASSESSMENT_STATUSES.WARNING],
    ['driver_residential_prohibition', baseSnapshot({ snapshotId: 'snapshot-residential-prohibited', upcomingRestrictions: [{ restrictionId: 'residential-prohibited-near', type: 'RESIDENTIAL_TRUCK_PROHIBITED', point: near, confidence: 1 }] }), DRIVER_ASSESSMENT_STATUSES.REVIEW_REQUIRED],
    ['driver_road_closure', baseSnapshot({ snapshotId: 'snapshot-road-closed', upcomingRestrictions: [{ restrictionId: 'road-closed-near', type: 'ROAD_CLOSED', point: near, confidence: 1 }] }), DRIVER_ASSESSMENT_STATUSES.REVIEW_REQUIRED],
    ['unknown_gps', baseSnapshot({ snapshotId: 'snapshot-gps-unknown', gpsAvailable: false, currentPosition: null }), DRIVER_ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE],
    ['unknown_speed', baseSnapshot({ snapshotId: 'snapshot-speed-unknown', speedMph: null }), DRIVER_ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE],
    ['unknown_location', baseSnapshot({ snapshotId: 'snapshot-location-unknown', currentPosition: null }), DRIVER_ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE],
    ['evidence_conflict_unknown_state', baseSnapshot({ snapshotId: 'snapshot-state-unknown', driverState: 'UNKNOWN', events: [{ eventType: 'UNKNOWN_EVENT', observedAt: '2026-07-25T00:00:00.000Z', source: 'synthetic.driver.fixture' }] }), DRIVER_ASSESSMENT_STATUSES.ADVISORY],
    ['hazard_ack_missing', baseSnapshot({ snapshotId: 'snapshot-hazard-ack', activeWarnings: [{ warningId: 'warning-low-bridge', requiresAcknowledgement: true }], hazardAcknowledgements: [] }), DRIVER_ASSESSMENT_STATUSES.REVIEW_REQUIRED],
    ['manual_review_required', baseSnapshot({ snapshotId: 'snapshot-review', assignedRoute: { routeCandidateId: 'missing-route', geometry: { points: [] } } }), DRIVER_ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE]
  ].map(([caseId, snapshot, expectedStatus]) => ({ caseId, request: { ...requestBase, snapshot }, expectedStatus, syntheticOnly: true, providerCallExpected: false, employeeScoringExpected: false })));
}

function buildDriverIntelligenceEvidence() {
  const benchmarkCases = buildBenchmarkCases();
  const assessments = benchmarkCases.map((benchmark) => ({ caseId: benchmark.caseId, assessment: assessDriverOperationalSnapshot(benchmark.request) }));
  const orchestrationEvidence = orchestration.buildOrchestrationEvidence();
  const lifecycleEvidence = lifecycle.buildLifecycleEvidence();
  const catalog = {
    schemaVersion: DRIVER_INTELLIGENCE_SCHEMA_VERSION,
    engineVersion: DRIVER_INTELLIGENCE_ENGINE_VERSION,
    generatedAt: DETERMINISTIC_GENERATED_AT,
    capabilityCount: DRIVER_CAPABILITIES.length,
    benchmarkCaseCount: benchmarkCases.length,
    integratedWithEnterpriseRegistry: registry.listEnterpriseCapabilities().length > 0,
    directEnterpriseRegistryCapability: null,
    directRegistryCapabilityDeferred: true,
    integratedWithCapabilityOrchestration: orchestrationEvidence.capabilities.some((capability) => capability.capabilityId === 'driver.intelligence.performance'),
    integratedWithLifecycleFramework: lifecycleEvidence.lifecycleRecords.some((record) => record.capabilityId === 'driver.intelligence.performance'),
    integratedWithRouteIntelligence: true,
    providerCallInvoked: false,
    hostedAiInvoked: false,
    predictiveModelInvoked: false,
    employeeScoring: false,
    productionApplicable: false,
    testOnly: true
  };
  catalog.catalogHash = sha256(catalog);
  return stable({
    catalog,
    capabilities: DRIVER_CAPABILITIES,
    contracts: { driverProfile: driverProfileContract(), driverEvent: driverEventContract() },
    driverStates: DRIVER_STATES,
    driverEvents: DRIVER_EVENTS,
    advisoryTypes: ADVISORY_TYPES,
    reasonCodes: REASON_CODES,
    benchmarkCases,
    assessments,
    integrationReferences: {
      enterpriseCapabilityRegistry: { available: registry.listEnterpriseCapabilities().length > 0, directDriverCapabilityDeferred: true },
      capabilityOrchestration: orchestrationEvidence.capabilities.find((capability) => capability.capabilityId === 'driver.intelligence.performance') || null,
      lifecycleFramework: lifecycleEvidence.lifecycleRecords.find((record) => record.capabilityId === 'driver.intelligence.performance') || null,
      routeIntelligence: { schemaVersion: routeIntel.ROUTE_INTELLIGENCE_SCHEMA_VERSION, approachThresholdYards: routeIntel.DEFAULT_POLICY.hazardProximityYards }
    }
  });
}

function validateDriverAssessment(assessment) {
  const errors = [];
  if (!Object.values(DRIVER_ASSESSMENT_STATUSES).includes(assessment?.status)) errors.push({ rule: 'UNKNOWN_DRIVER_ASSESSMENT_STATUS' });
  if (assessment?.providerCallInvoked !== false || assessment?.hostedAiInvoked !== false) errors.push({ rule: 'PROVIDER_OR_HOSTED_AI_PROHIBITED' });
  if (assessment?.predictiveModelInvoked !== false) errors.push({ rule: 'PREDICTIVE_MODEL_PROHIBITED' });
  if (assessment?.employeeScoring !== false || assessment?.disciplinaryRecommendation !== false) errors.push({ rule: 'EMPLOYEE_SCORING_OR_DISCIPLINE_PROHIBITED' });
  for (const field of PROHIBITED_EMPLOYMENT_IMPACT_FIELDS) {
    if (new RegExp(`"${field}"\\s*:`).test(stableStringify(assessment))) errors.push({ rule: 'PROHIBITED_EMPLOYMENT_IMPACT_FIELD', field });
  }
  if (assessment?.productionApplicable === true) errors.push({ rule: 'PRODUCTION_DRIVER_INTELLIGENCE_PROHIBITED' });
  if (!assessment?.assessmentHash || assessment.assessmentHash !== sha256({ ...assessment, assessmentHash: undefined })) errors.push({ rule: 'ASSESSMENT_HASH_MISMATCH' });
  return stable({ valid: errors.length === 0, errors });
}

function validateDriverIntelligenceEvidence(evidence = buildDriverIntelligenceEvidence()) {
  const errors = [];
  if (evidence.catalog.providerCallInvoked !== false || evidence.catalog.hostedAiInvoked !== false) errors.push({ rule: 'PROVIDER_OR_HOSTED_AI_PROHIBITED' });
  if (evidence.catalog.predictiveModelInvoked !== false) errors.push({ rule: 'PREDICTIVE_MODEL_PROHIBITED' });
  if (evidence.catalog.employeeScoring !== false) errors.push({ rule: 'EMPLOYEE_SCORING_PROHIBITED' });
  if (!evidence.catalog.integratedWithEnterpriseRegistry) errors.push({ rule: 'ENTERPRISE_REGISTRY_INTEGRATION_MISSING' });
  if (!evidence.catalog.integratedWithCapabilityOrchestration) errors.push({ rule: 'ORCHESTRATION_INTEGRATION_MISSING' });
  if (!evidence.catalog.integratedWithLifecycleFramework) errors.push({ rule: 'LIFECYCLE_INTEGRATION_MISSING' });
  if (!evidence.catalog.integratedWithRouteIntelligence) errors.push({ rule: 'ROUTE_INTELLIGENCE_INTEGRATION_MISSING' });
  for (const record of evidence.assessments || []) {
    const validation = validateDriverAssessment(record.assessment);
    for (const error of validation.errors) errors.push({ ...error, caseId: record.caseId });
  }
  for (const benchmark of evidence.benchmarkCases || []) {
    const record = evidence.assessments.find((item) => item.caseId === benchmark.caseId);
    if (!record) errors.push({ rule: 'MISSING_BENCHMARK_ASSESSMENT', caseId: benchmark.caseId });
    else if (record.assessment.status !== benchmark.expectedStatus) errors.push({ rule: 'BENCHMARK_EXPECTATION_MISMATCH', caseId: benchmark.caseId, expected: benchmark.expectedStatus, actual: record.assessment.status });
  }
  return stable({ valid: errors.length === 0, errors });
}

module.exports = {
  ADVISORY_TYPES,
  ASSESSMENT_STATUSES,
  DEFAULT_POLICY,
  DETERMINISTIC_GENERATED_AT,
  DRIVER_ASSESSMENT_STATUSES,
  DRIVER_CAPABILITIES,
  DRIVER_EVENTS,
  DRIVER_INTELLIGENCE_ENGINE_VERSION,
  DRIVER_INTELLIGENCE_SCHEMA_VERSION,
  DRIVER_STATES,
  PROHIBITED_EMPLOYMENT_IMPACT_FIELDS,
  REASON_CODES,
  assessDriverOperationalSnapshot,
  assessHazardAcknowledgement,
  assessLowBridgeApproach,
  assessOperationalState,
  assessRestrictedRoadApproach,
  assessRouteAdherence,
  assessSpeedCompliance,
  assessStopProgress,
  baseSnapshot,
  buildAdvisories,
  buildBenchmarkCases,
  buildDriverExplanation,
  buildDriverIntelligenceEvidence,
  buildSyntheticDriverProfiles,
  driverEventContract,
  driverProfileContract,
  sha256,
  stable,
  stableStringify,
  validateDriverAssessment,
  validateDriverIntelligenceEvidence,
  validateDriverProfile,
  validateDriverRequest,
  paths: { backendRoot, repoRoot, docsRoot, generatedRoot }
};
