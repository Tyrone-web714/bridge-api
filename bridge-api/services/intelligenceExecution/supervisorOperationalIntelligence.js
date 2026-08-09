const path = require('path');
const governance = require('./decisionGovernance');
const registry = require('./enterpriseCapabilityRegistry');
const orchestration = require('./intelligenceCapabilityOrchestration');
const lifecycle = require('./intelligenceLifecycleFramework');
const routeIntel = require('./routeIntelligence');
const driverIntel = require('./driverIntelligence');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'implementation');
const generatedRoot = path.join(docsRoot, 'supervisor-intelligence-foundation', 'generated');
const SUPERVISOR_INTELLIGENCE_SCHEMA_VERSION = 'supervisor.intelligence.foundation.v1';
const SUPERVISOR_INTELLIGENCE_ENGINE_VERSION = 'supervisor.intelligence.foundation.engine.v1';
const DETERMINISTIC_GENERATED_AT = '2026-08-01T00:00:00.000Z';

const AUTHORIZED_ROLES = Object.freeze(['SUPERVISOR', 'ORGANIZATION_ADMIN', 'PLATFORM_ADMIN']);
const ROUTE_STATES = Object.freeze(['NOT_STARTED','STARTED','IN_PROGRESS','DELAYED','BLOCKED','RETURNING','COMPLETE','CANCELLED','INSUFFICIENT_EVIDENCE','UNKNOWN']);
const STOP_STATES = Object.freeze(['NOT_STARTED','EN_ROUTE','ARRIVED','IN_SERVICE','DEPARTED','COMPLETE','SKIPPED','BLOCKED','UNRESOLVED','INSUFFICIENT_EVIDENCE','UNKNOWN']);
const EXCEPTION_TYPES = Object.freeze(['ROUTE_NOT_STARTED','ROUTE_START_DELAY','ROUTE_PROGRESS_DELAY','ROUTE_BLOCKED','ROUTE_DEVIATION','ROUTE_SAFETY_REJECTION','LOW_BRIDGE_EVENT','RESTRICTED_ROAD_EVENT','NO_THROUGH_TRUCK_EVENT','ROAD_CLOSURE_EVENT','SPEED_ADVISORY_EVENT','SPEED_WARNING_EVENT','DRIVER_GPS_UNAVAILABLE','ROUTE_EVIDENCE_STALE','ROUTE_EVIDENCE_CONFLICT','STOP_NOT_ARRIVED','STOP_DELAY','STOP_SKIPPED','STOP_UNRESOLVED','DELIVERY_EVIDENCE_MISSING','DRIVER_ASSISTANCE_MAY_BE_REQUIRED','HUMAN_REVIEW_REQUIRED','INSUFFICIENT_EVIDENCE']);
const SEVERITIES = Object.freeze(['INFORMATIONAL','LOW','MODERATE','HIGH','CRITICAL','UNKNOWN']);
const ALERT_STATUSES = Object.freeze(['OPEN','ACKNOWLEDGED','UNDER_REVIEW','RESOLVED','DISMISSED_AS_DUPLICATE','INVALIDATED_BY_NEW_EVIDENCE','UNKNOWN']);
const NEXT_STEPS = Object.freeze(['REVIEW_ROUTE_STATUS','CONTACT_DRIVER_FOR_OPERATIONAL_STATUS','REVIEW_ROUTE_DEVIATION','REVIEW_HAZARD','REVIEW_STOP_STATUS','REVIEW_MISSING_EVIDENCE','REVIEW_ROUTE_ALTERNATIVE','ESCALATE_SAFETY_EVENT','NO_ACTION_REQUIRED','UNABLE_TO_DETERMINE']);
const REASON_CODES = Object.freeze({
  ROUTE_NOT_STARTED_BY_THRESHOLD: 'ROUTE_NOT_STARTED_BY_THRESHOLD',
  ROUTE_BEHIND_EXPECTED_PROGRESS: 'ROUTE_BEHIND_EXPECTED_PROGRESS',
  ROUTE_BLOCKED_BY_SAFETY_RULE: 'ROUTE_BLOCKED_BY_SAFETY_RULE',
  ROUTE_DEVIATION_ACTIVE: 'ROUTE_DEVIATION_ACTIVE',
  ROUTE_DEVIATION_RESOLVED: 'ROUTE_DEVIATION_RESOLVED',
  LOW_BRIDGE_HAZARD_ACTIVE: 'LOW_BRIDGE_HAZARD_ACTIVE',
  RESTRICTED_ROAD_HAZARD_ACTIVE: 'RESTRICTED_ROAD_HAZARD_ACTIVE',
  NO_THROUGH_TRUCK_HAZARD_ACTIVE: 'NO_THROUGH_TRUCK_HAZARD_ACTIVE',
  ROAD_CLOSURE_ACTIVE: 'ROAD_CLOSURE_ACTIVE',
  SPEED_ADVISORY_ACTIVE: 'SPEED_ADVISORY_ACTIVE',
  SPEED_WARNING_ACTIVE: 'SPEED_WARNING_ACTIVE',
  GPS_EVIDENCE_UNAVAILABLE: 'GPS_EVIDENCE_UNAVAILABLE',
  ROUTE_EVIDENCE_STALE: 'ROUTE_EVIDENCE_STALE',
  ROUTE_EVIDENCE_CONFLICT: 'ROUTE_EVIDENCE_CONFLICT',
  STOP_PROGRESS_DELAYED: 'STOP_PROGRESS_DELAYED',
  STOP_STATUS_UNRESOLVED: 'STOP_STATUS_UNRESOLVED',
  DELIVERY_EVIDENCE_INCOMPLETE: 'DELIVERY_EVIDENCE_INCOMPLETE',
  DRIVER_OPERATIONAL_ASSISTANCE_REVIEW: 'DRIVER_OPERATIONAL_ASSISTANCE_REVIEW',
  HUMAN_REVIEW_REQUIRED: 'HUMAN_REVIEW_REQUIRED',
  EVIDENCE_INSUFFICIENT: 'EVIDENCE_INSUFFICIENT',
  ALERT_ACKNOWLEDGED: 'ALERT_ACKNOWLEDGED',
  ALERT_RESOLVED: 'ALERT_RESOLVED',
  ALERT_INVALIDATED_BY_NEW_EVIDENCE: 'ALERT_INVALIDATED_BY_NEW_EVIDENCE'
});
const PROHIBITED_FIELDS = Object.freeze(['employeeScore','driverScore','employeeRank','driverRank','disciplinaryRecommendation','terminationRecommendation','compensationDecision','bonusRecommendation','productivityRating','unsafeDriverLabel','fatiguePrediction','personalityInference','emotionalStateInference']);
const SUPERVISOR_CAPABILITIES = Object.freeze([
  { capabilityId: 'supervisor.operational_context.validation', displayName: 'Supervisor Operational Context Validation', executionStrategy: 'DETERMINISTIC_RULES', employeeScoring: false },
  { capabilityId: 'supervisor.route_portfolio.assessment', displayName: 'Supervisor Route Portfolio Assessment', executionStrategy: 'DETERMINISTIC_RULES', employeeScoring: false },
  { capabilityId: 'supervisor.exception.detection', displayName: 'Supervisor Operational Exception Detection', executionStrategy: 'DETERMINISTIC_RULES', employeeScoring: false },
  { capabilityId: 'supervisor.alert.prioritization', displayName: 'Supervisor Alert Prioritization', executionStrategy: 'DETERMINISTIC_RULES', employeeScoring: false },
  { capabilityId: 'supervisor.summary.explanation', displayName: 'Supervisor Summary and Explanation', executionStrategy: 'DETERMINISTIC_RULES', employeeScoring: false }
]);

function stable(value) { return governance.stable(value); }
function stableStringify(value) { return governance.stableStringify(value); }
function sha256(value) { return governance.sha256(value); }
function clamp01(value) { return Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : null; }
function omitProhibitedFields(value) {
  if (Array.isArray(value)) return value.map(omitProhibitedFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PROHIBITED_FIELDS.includes(key))
      .map(([key, item]) => [key, omitProhibitedFields(item)])
  );
}
function minutesBetween(later, earlier) {
  const l = Date.parse(later || '');
  const e = Date.parse(earlier || '');
  if (!Number.isFinite(l) || !Number.isFinite(e)) return null;
  return Math.max(0, (l - e) / 60000);
}

function validateSupervisorContext(context = {}) {
  const errors = [];
  for (const field of ['provider','providerId','model','modelId','premium','allowPremiumEscalation','organizationOverride','employeeScore','driverRank']) {
    if (Object.prototype.hasOwnProperty.call(context, field)) errors.push({ rule: 'CALLER_CONTROL_PROHIBITED', field, reasonCode: REASON_CODES.EVIDENCE_INSUFFICIENT });
  }
  if (!context.organizationId) errors.push({ rule: 'ORGANIZATION_REQUIRED', reasonCode: REASON_CODES.EVIDENCE_INSUFFICIENT });
  if (!context.supervisorUserId) errors.push({ rule: 'SUPERVISOR_USER_REQUIRED', reasonCode: REASON_CODES.EVIDENCE_INSUFFICIENT });
  if (!AUTHORIZED_ROLES.includes(context.authorizedRole)) errors.push({ rule: 'UNAUTHORIZED_ROLE', role: context.authorizedRole || null, reasonCode: REASON_CODES.HUMAN_REVIEW_REQUIRED });
  if (!context.reportingWindow?.start || !context.reportingWindow?.end) errors.push({ rule: 'REPORTING_WINDOW_REQUIRED', reasonCode: REASON_CODES.EVIDENCE_INSUFFICIENT });
  return stable({
    valid: errors.length === 0,
    errors,
    trustedServerDerivedRequired: true,
    providerModelControlsRejected: true,
    validationHash: sha256({ context, errors })
  });
}

function evidenceCompleteness(record = {}) {
  const fields = ['routeId','organizationId','scheduledStart','scheduledEnd','lastEvidenceTimestamp'];
  const items = fields.map((field) => ({ field, present: record[field] !== undefined && record[field] !== null && record[field] !== '' }));
  const score = items.filter((item) => item.present).length / items.length;
  return stable({ status: score === 1 ? 'COMPLETE' : score >= 0.6 ? 'PARTIAL' : 'INSUFFICIENT', score: Number(score.toFixed(3)), items });
}

function routeProgressPercent(route = {}) {
  const completed = Number(route.completedStopCount);
  const remaining = Number(route.remainingStopCount);
  const unresolved = Number(route.unresolvedStopCount || 0);
  if (!Number.isFinite(completed) || !Number.isFinite(remaining) || completed < 0 || remaining < 0) return null;
  const total = completed + remaining + (Number.isFinite(unresolved) ? unresolved : 0);
  if (total <= 0) return null;
  return Number(((completed / total) * 100).toFixed(3));
}

function normalizeRouteState(route = {}, now = DETERMINISTIC_GENERATED_AT) {
  if (ROUTE_STATES.includes(route.routeStatus)) return route.routeStatus;
  if (route.cancelled === true) return 'CANCELLED';
  if (route.blocked === true || route.routeSafetyAssessment?.status === routeIntel.ROUTE_SAFETY_STATUSES.UNSAFE) return 'BLOCKED';
  if (route.completed === true) return 'COMPLETE';
  if (!route.scheduledStart) return 'INSUFFICIENT_EVIDENCE';
  const startDelay = minutesBetween(now, route.scheduledStart);
  if (!route.actualStart && Number.isFinite(startDelay) && startDelay >= Number(route.startDelayThresholdMinutes || 15)) return 'DELAYED';
  if (route.actualStart && route.remainingStopCount > 0) return route.progressDelayMinutes > 0 ? 'DELAYED' : 'IN_PROGRESS';
  return route.actualStart ? 'STARTED' : 'NOT_STARTED';
}

function buildRoutePortfolioState(input = {}) {
  const context = input.supervisorContext || {};
  const contextValidation = validateSupervisorContext(context);
  const routes = (input.routes || []).map((route) => {
    const completeness = evidenceCompleteness(route);
    const confidence = completeness.score === 1 ? 1 : completeness.score >= 0.6 ? 0.7 : 0.3;
    const state = contextValidation.valid && route.organizationId === context.organizationId
      ? normalizeRouteState(route, input.now)
      : 'INSUFFICIENT_EVIDENCE';
    const item = {
      routeId: route.routeId || null,
      organizationId: route.organizationId || null,
      assignedDriverId: route.assignedDriverId || null,
      assignedVehicleId: route.assignedVehicleId || null,
      scheduledStart: route.scheduledStart || null,
      scheduledEnd: route.scheduledEnd || null,
      actualStart: route.actualStart || null,
      routeStatus: state,
      completedStopCount: Number.isFinite(Number(route.completedStopCount)) ? Number(route.completedStopCount) : null,
      remainingStopCount: Number.isFinite(Number(route.remainingStopCount)) ? Number(route.remainingStopCount) : null,
      unresolvedStopCount: Number.isFinite(Number(route.unresolvedStopCount)) ? Number(route.unresolvedStopCount) : null,
      routeProgressPercentage: routeProgressPercent(route),
      routeDeviationState: route.routeDeviationState || 'UNKNOWN',
      activeRouteHazards: route.activeRouteHazards || [],
      unresolvedSafetyEvents: route.unresolvedSafetyEvents || [],
      evidenceCompleteness: completeness,
      evidenceConfidence: { status: 'NOT_PERFORMANCE_SCORE', score: confidence },
      lastEvidenceTimestamp: route.lastEvidenceTimestamp || null,
      humanReviewRequired: state === 'INSUFFICIENT_EVIDENCE' || route.humanReviewRequired === true,
      routeIntelligenceAssessment: route.routeSafetyAssessment || null,
      driverIntelligenceAssessment: route.driverAssessment ? omitProhibitedFields(route.driverAssessment) : null,
      routeEvidenceStale: route.routeEvidenceStale === true,
      routeEvidenceConflict: route.routeEvidenceConflict === true,
      testOnly: true
    };
    item.portfolioItemHash = sha256(item);
    return stable(item);
  });
  return stable({ contextValidation, routes, portfolioHash: sha256({ context, routes }) });
}

function classifyExceptionSeverity(type, reasonCode, evidence = {}) {
  if (reasonCode === REASON_CODES.LOW_BRIDGE_HAZARD_ACTIVE || reasonCode === REASON_CODES.ROUTE_BLOCKED_BY_SAFETY_RULE) return 'CRITICAL';
  if ([REASON_CODES.RESTRICTED_ROAD_HAZARD_ACTIVE, REASON_CODES.NO_THROUGH_TRUCK_HAZARD_ACTIVE, REASON_CODES.ROAD_CLOSURE_ACTIVE, REASON_CODES.SPEED_WARNING_ACTIVE].includes(reasonCode)) return 'HIGH';
  if ([REASON_CODES.ROUTE_DEVIATION_ACTIVE, REASON_CODES.ROUTE_BEHIND_EXPECTED_PROGRESS, REASON_CODES.STOP_PROGRESS_DELAYED].includes(reasonCode)) return 'MODERATE';
  if ([REASON_CODES.GPS_EVIDENCE_UNAVAILABLE, REASON_CODES.ROUTE_EVIDENCE_STALE, REASON_CODES.ROUTE_EVIDENCE_CONFLICT, REASON_CODES.EVIDENCE_INSUFFICIENT].includes(reasonCode)) return evidence.unknownSeverity ? 'UNKNOWN' : 'LOW';
  if (type === 'HUMAN_REVIEW_REQUIRED') return 'MODERATE';
  return 'INFORMATIONAL';
}

function exceptionRecord(type, route, reasonCode, sourceRefs = [], options = {}) {
  const severity = classifyExceptionSeverity(type, reasonCode, options);
  const record = {
    exceptionId: `supervisor.exception.${route.routeId || 'unknown'}.${type.toLowerCase()}.${reasonCode.toLowerCase()}`,
    exceptionType: type,
    organizationId: route.organizationId || null,
    routeId: route.routeId || null,
    driverId: route.assignedDriverId || null,
    stopId: options.stopId || null,
    sourceEventReferences: sourceRefs,
    severity,
    operationalImpact: options.operationalImpact || 'SUPERVISOR_REVIEW_MAY_BE_REQUIRED',
    safetyImpact: ['CRITICAL','HIGH'].includes(severity) ? 'SAFETY_REVIEW_REQUIRED' : 'NO_KNOWN_IMMEDIATE_SAFETY_IMPACT',
    detectedAt: options.detectedAt || DETERMINISTIC_GENERATED_AT,
    evidenceCompleteness: route.evidenceCompleteness || evidenceCompleteness(route),
    evidenceConfidence: route.evidenceConfidence || { status: 'NOT_PERFORMANCE_SCORE', score: null },
    status: 'OPEN',
    reasonCodes: [reasonCode],
    humanReviewRequired: options.humanReviewRequired === true || ['CRITICAL','HIGH','UNKNOWN'].includes(severity),
    employmentImpactProhibited: true,
    testOnly: true
  };
  record.exceptionHash = sha256(record);
  return stable(record);
}

function detectOperationalExceptions(portfolioState, input = {}) {
  const exceptions = [];
  for (const route of portfolioState.routes || []) {
    if (route.routeStatus === 'DELAYED' && !route.actualStart) exceptions.push(exceptionRecord('ROUTE_START_DELAY', route, REASON_CODES.ROUTE_NOT_STARTED_BY_THRESHOLD, ['route.schedule']));
    if (route.routeStatus === 'DELAYED' && route.actualStart) exceptions.push(exceptionRecord('ROUTE_PROGRESS_DELAY', route, REASON_CODES.ROUTE_BEHIND_EXPECTED_PROGRESS, ['route.progress']));
    if (route.routeStatus === 'BLOCKED') exceptions.push(exceptionRecord('ROUTE_BLOCKED', route, REASON_CODES.ROUTE_BLOCKED_BY_SAFETY_RULE, ['route.intelligence'], { humanReviewRequired: true }));
    if (route.routeDeviationState === 'ACTIVE') exceptions.push(exceptionRecord('ROUTE_DEVIATION', route, REASON_CODES.ROUTE_DEVIATION_ACTIVE, ['driver.intelligence'], { humanReviewRequired: true }));
    if (route.routeDeviationState === 'RESOLVED') exceptions.push(exceptionRecord('ROUTE_DEVIATION', route, REASON_CODES.ROUTE_DEVIATION_RESOLVED, ['driver.intelligence'], { operationalImpact: 'MONITOR_ONLY' }));
    for (const event of route.unresolvedSafetyEvents || []) {
      const map = {
        LOW_BRIDGE: ['LOW_BRIDGE_EVENT', REASON_CODES.LOW_BRIDGE_HAZARD_ACTIVE],
        RESTRICTED_ROAD: ['RESTRICTED_ROAD_EVENT', REASON_CODES.RESTRICTED_ROAD_HAZARD_ACTIVE],
        NO_THROUGH_TRUCKS: ['NO_THROUGH_TRUCK_EVENT', REASON_CODES.NO_THROUGH_TRUCK_HAZARD_ACTIVE],
        ROAD_CLOSURE: ['ROAD_CLOSURE_EVENT', REASON_CODES.ROAD_CLOSURE_ACTIVE],
        SPEED_ADVISORY: ['SPEED_ADVISORY_EVENT', REASON_CODES.SPEED_ADVISORY_ACTIVE],
        SPEED_WARNING: ['SPEED_WARNING_EVENT', REASON_CODES.SPEED_WARNING_ACTIVE],
        GPS_UNAVAILABLE: ['DRIVER_GPS_UNAVAILABLE', REASON_CODES.GPS_EVIDENCE_UNAVAILABLE]
      }[event.eventType];
      if (map) exceptions.push(exceptionRecord(map[0], route, map[1], [event.eventId || event.eventType], { humanReviewRequired: true }));
    }
    if (route.evidenceCompleteness?.status === 'INSUFFICIENT') exceptions.push(exceptionRecord('INSUFFICIENT_EVIDENCE', route, REASON_CODES.EVIDENCE_INSUFFICIENT, ['route.evidence'], { unknownSeverity: true, humanReviewRequired: true }));
    if (route.routeEvidenceStale === true) exceptions.push(exceptionRecord('ROUTE_EVIDENCE_STALE', route, REASON_CODES.ROUTE_EVIDENCE_STALE, ['route.evidence'], { humanReviewRequired: true }));
    if (route.routeEvidenceConflict === true) exceptions.push(exceptionRecord('ROUTE_EVIDENCE_CONFLICT', route, REASON_CODES.ROUTE_EVIDENCE_CONFLICT, ['route.evidence'], { humanReviewRequired: true }));
  }
  for (const stop of input.stops || []) {
    const route = (portfolioState.routes || []).find((item) => item.routeId === stop.routeId) || { routeId: stop.routeId, organizationId: stop.organizationId, assignedDriverId: stop.assignedDriverId };
    if (stop.stopStatus === 'DELAYED') exceptions.push(exceptionRecord('STOP_DELAY', route, REASON_CODES.STOP_PROGRESS_DELAYED, [stop.stopId], { stopId: stop.stopId }));
    if (stop.stopStatus === 'SKIPPED') exceptions.push(exceptionRecord('STOP_SKIPPED', route, REASON_CODES.STOP_STATUS_UNRESOLVED, [stop.stopId], { stopId: stop.stopId, humanReviewRequired: true }));
    if (stop.stopStatus === 'UNRESOLVED') exceptions.push(exceptionRecord('STOP_UNRESOLVED', route, REASON_CODES.STOP_STATUS_UNRESOLVED, [stop.stopId], { stopId: stop.stopId, humanReviewRequired: true }));
    if (stop.deliveryEvidenceMissing === true) exceptions.push(exceptionRecord('DELIVERY_EVIDENCE_MISSING', route, REASON_CODES.DELIVERY_EVIDENCE_INCOMPLETE, [stop.stopId], { stopId: stop.stopId, humanReviewRequired: true }));
  }
  return stable(exceptions.sort((a, b) => a.exceptionId.localeCompare(b.exceptionId)));
}

function priorityForAlert(exception) {
  const severityRank = { CRITICAL: 100, HIGH: 80, MODERATE: 60, LOW: 40, INFORMATIONAL: 20, UNKNOWN: 50 };
  const safetyBoost = exception.safetyImpact === 'SAFETY_REVIEW_REQUIRED' ? 20 : 0;
  const legalBoost = exception.reasonCodes.some((code) => [REASON_CODES.LOW_BRIDGE_HAZARD_ACTIVE, REASON_CODES.RESTRICTED_ROAD_HAZARD_ACTIVE, REASON_CODES.NO_THROUGH_TRUCK_HAZARD_ACTIVE, REASON_CODES.ROAD_CLOSURE_ACTIVE].includes(code)) ? 15 : 0;
  return severityRank[exception.severity] + safetyBoost + legalBoost;
}

function nextStepForException(exception) {
  const code = exception.reasonCodes[0];
  if ([REASON_CODES.LOW_BRIDGE_HAZARD_ACTIVE, REASON_CODES.RESTRICTED_ROAD_HAZARD_ACTIVE, REASON_CODES.NO_THROUGH_TRUCK_HAZARD_ACTIVE, REASON_CODES.ROAD_CLOSURE_ACTIVE].includes(code)) return 'ESCALATE_SAFETY_EVENT';
  if (code === REASON_CODES.ROUTE_DEVIATION_ACTIVE) return 'REVIEW_ROUTE_DEVIATION';
  if ([REASON_CODES.STOP_PROGRESS_DELAYED, REASON_CODES.STOP_STATUS_UNRESOLVED].includes(code)) return 'REVIEW_STOP_STATUS';
  if ([REASON_CODES.DELIVERY_EVIDENCE_INCOMPLETE, REASON_CODES.EVIDENCE_INSUFFICIENT].includes(code)) return 'REVIEW_MISSING_EVIDENCE';
  if (code === REASON_CODES.GPS_EVIDENCE_UNAVAILABLE) return 'CONTACT_DRIVER_FOR_OPERATIONAL_STATUS';
  return 'REVIEW_ROUTE_STATUS';
}

function buildSupervisorAlert(exception, lifecycleStatus = 'OPEN') {
  const priority = priorityForAlert(exception);
  const alert = {
    alertId: `supervisor.alert.${sha256(exception.exceptionId).slice(0, 16)}`,
    exceptionId: exception.exceptionId,
    alertType: exception.exceptionType,
    title: exception.exceptionType.toLowerCase().replace(/_/g, '.'),
    structuredFacts: { routeId: exception.routeId, driverId: exception.driverId, stopId: exception.stopId, reasonCodes: exception.reasonCodes },
    affectedRouteId: exception.routeId,
    affectedStopId: exception.stopId,
    driverId: exception.driverId,
    severity: exception.severity,
    priority,
    priorityTrace: ['safety_first', 'legal_or_physical_restrictions_before_delay', `score:${priority}`],
    requiredAttention: exception.humanReviewRequired ? 'HUMAN_REVIEW_REQUIRED' : 'SUPERVISOR_AWARENESS',
    recommendedOperationalNextStep: nextStepForException(exception),
    acknowledgementState: lifecycleStatus === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'NOT_ACKNOWLEDGED',
    resolutionState: ['RESOLVED','INVALIDATED_BY_NEW_EVIDENCE','DISMISSED_AS_DUPLICATE'].includes(lifecycleStatus) ? lifecycleStatus : 'UNRESOLVED',
    evidenceReferences: exception.sourceEventReferences,
    reasonCodes: exception.reasonCodes,
    limitations: exception.evidenceCompleteness.status === 'COMPLETE' ? [] : ['Evidence is incomplete; supervisor review is required before operational action.'],
    humanReviewRequired: exception.humanReviewRequired,
    employmentImpactProhibited: true,
    testOnly: true
  };
  alert.alertHash = sha256(alert);
  return stable(alert);
}

function prioritizeSupervisorAlerts(exceptions = []) {
  return stable(exceptions.map((exception) => buildSupervisorAlert(exception)).sort((a, b) => b.priority - a.priority || a.alertId.localeCompare(b.alertId)));
}

function acknowledgeSupervisorAlert(alert, actor = 'synthetic-supervisor') {
  return stable({ ...alert, acknowledgementState: 'ACKNOWLEDGED', resolutionState: 'UNRESOLVED', lifecycleStatus: 'ACKNOWLEDGED', lifecycleReasonCode: REASON_CODES.ALERT_ACKNOWLEDGED, acknowledgedBy: actor, alertHash: sha256({ ...alert, acknowledgementState: 'ACKNOWLEDGED', lifecycleStatus: 'ACKNOWLEDGED' }) });
}

function resolveSupervisorAlert(alert, actor = 'synthetic-supervisor') {
  return stable({ ...alert, resolutionState: 'RESOLVED', lifecycleStatus: 'RESOLVED', lifecycleReasonCode: REASON_CODES.ALERT_RESOLVED, resolvedBy: actor, alertHash: sha256({ ...alert, resolutionState: 'RESOLVED', lifecycleStatus: 'RESOLVED' }) });
}

function invalidateSupervisorAlert(alert) {
  return stable({ ...alert, resolutionState: 'INVALIDATED_BY_NEW_EVIDENCE', lifecycleStatus: 'INVALIDATED_BY_NEW_EVIDENCE', lifecycleReasonCode: REASON_CODES.ALERT_INVALIDATED_BY_NEW_EVIDENCE, alertHash: sha256({ ...alert, resolutionState: 'INVALIDATED_BY_NEW_EVIDENCE', lifecycleStatus: 'INVALIDATED_BY_NEW_EVIDENCE' }) });
}

function buildSupervisorOperationalSummary(portfolioState, exceptions, alerts) {
  const routes = portfolioState.routes || [];
  const bySeverity = alerts.reduce((acc, alert) => { acc[alert.severity] = (acc[alert.severity] || 0) + 1; return acc; }, {});
  const summary = {
    routesInScope: routes.length,
    routesCompleted: routes.filter((route) => route.routeStatus === 'COMPLETE').length,
    routesInProgress: routes.filter((route) => ['STARTED','IN_PROGRESS'].includes(route.routeStatus)).length,
    delayedRoutes: routes.filter((route) => route.routeStatus === 'DELAYED').length,
    blockedRoutes: routes.filter((route) => route.routeStatus === 'BLOCKED').length,
    routesWithSafetyExceptions: exceptions.filter((exception) => exception.safetyImpact === 'SAFETY_REVIEW_REQUIRED').length,
    unresolvedStops: exceptions.filter((exception) => String(exception.exceptionType).startsWith('STOP_') || exception.exceptionType === 'DELIVERY_EVIDENCE_MISSING').length,
    unresolvedAlerts: alerts.filter((alert) => alert.resolutionState === 'UNRESOLVED').length,
    alertsBySeverity: bySeverity,
    evidenceGaps: exceptions.filter((exception) => exception.reasonCodes.includes(REASON_CODES.EVIDENCE_INSUFFICIENT) || exception.reasonCodes.includes(REASON_CODES.DELIVERY_EVIDENCE_INCOMPLETE)).length,
    humanReviewItems: exceptions.filter((exception) => exception.humanReviewRequired).length,
    limitations: ['Repository-only synthetic foundation', 'No production notification', 'No employee scoring', 'No disciplinary recommendation', 'No autonomous workforce action']
  };
  summary.summaryHash = sha256(summary);
  return stable(summary);
}

function buildSupervisorExplanation(record) {
  const alert = record.alert || record;
  const explanation = {
    explanationId: `supervisor.explanation.${sha256(alert.alertId || alert.exceptionId || 'unknown').slice(0, 16)}`,
    derivedFromFacts: true,
    reasonCodes: alert.reasonCodes || [],
    severity: alert.severity || null,
    priority: alert.priority || null,
    text: `Detected ${alert.alertType || alert.exceptionType || 'operational exception'} from supplied route, driver, stop, and evidence records. Supervisor review is required when evidence is incomplete, safety impact is known, or operational facts conflict.`,
    limitations: alert.limitations || ['Explanation is limited to supplied synthetic facts.'],
    intentInferred: false,
    employeeMotivationInferred: false,
    providerGenerated: false,
    employmentImpactProhibited: true
  };
  explanation.explanationHash = sha256(explanation);
  return stable(explanation);
}

function buildSyntheticSupervisorContext() {
  return stable({
    supervisorContextId: 'supervisor.context.synthetic.001',
    organizationId: 'org_synthetic_supervisor_intelligence',
    supervisorUserId: 'user_supervisor_synthetic',
    authorizedRole: 'SUPERVISOR',
    shiftReference: 'shift.synthetic.day',
    routeAssignmentScope: ['route-normal','route-not-started','route-low-bridge'],
    driverAssignmentScope: ['driver-synthetic-001','driver-synthetic-002','driver-synthetic-003'],
    operationalAreaReference: 'depot.synthetic.birmingham',
    reportingWindow: { start: '2026-08-01T08:00:00.000Z', end: '2026-08-01T18:00:00.000Z' },
    sourceReferences: ['synthetic.route.fixture', 'synthetic.driver.fixture'],
    evidenceTimestamp: DETERMINISTIC_GENERATED_AT,
    unknownFields: [],
    testOnly: true
  });
}

function baseRoute(overrides = {}) {
  return stable({
    routeId: overrides.routeId || 'route-normal',
    organizationId: 'org_synthetic_supervisor_intelligence',
    assignedDriverId: overrides.assignedDriverId || 'driver-synthetic-001',
    assignedVehicleId: overrides.assignedVehicleId || 'vehicle-box-12ft-6in',
    scheduledStart: overrides.scheduledStart || '2026-08-01T08:00:00.000Z',
    scheduledEnd: overrides.scheduledEnd || '2026-08-01T16:00:00.000Z',
    actualStart: Object.prototype.hasOwnProperty.call(overrides, 'actualStart') ? overrides.actualStart : '2026-08-01T08:05:00.000Z',
    completedStopCount: Object.prototype.hasOwnProperty.call(overrides, 'completedStopCount') ? overrides.completedStopCount : 5,
    remainingStopCount: Object.prototype.hasOwnProperty.call(overrides, 'remainingStopCount') ? overrides.remainingStopCount : 5,
    unresolvedStopCount: overrides.unresolvedStopCount || 0,
    routeDeviationState: overrides.routeDeviationState || 'NONE',
    activeRouteHazards: overrides.activeRouteHazards || [],
    unresolvedSafetyEvents: overrides.unresolvedSafetyEvents || [],
    routeSafetyAssessment: overrides.routeSafetyAssessment || null,
    driverAssessment: overrides.driverAssessment ? omitProhibitedFields(overrides.driverAssessment) : null,
    lastEvidenceTimestamp: overrides.lastEvidenceTimestamp || '2026-08-01T10:00:00.000Z',
    routeEvidenceStale: overrides.routeEvidenceStale === true,
    routeEvidenceConflict: overrides.routeEvidenceConflict === true,
    progressDelayMinutes: overrides.progressDelayMinutes || 0,
    startDelayThresholdMinutes: overrides.startDelayThresholdMinutes || 15,
    testOnly: true
  });
}

function buildBenchmarkCases() {
  const context = buildSyntheticSupervisorContext();
  const benchmarkNow = '2026-08-01T10:00:00.000Z';
  const unsafeRoute = routeIntel.compareRouteAlternatives(routeIntel.buildBenchmarkCases().find((item) => item.caseId === 'low_clearance_fail_closed').request).assessments[0];
  const warningDriver = driverIntel.assessDriverOperationalSnapshot(driverIntel.buildBenchmarkCases().find((item) => item.caseId === 'driver_speeding_warning').request);
  return stable([
    ['all_routes_normal', [baseRoute()], [], 0],
    ['route_not_started_by_threshold', [baseRoute({ routeId: 'route-not-started', actualStart: null, scheduledStart: '2026-08-01T08:00:00.000Z' })], [], 1],
    ['route_delayed', [baseRoute({ routeId: 'route-delayed', progressDelayMinutes: 20 })], [], 1],
    ['route_blocked_low_bridge', [baseRoute({ routeId: 'route-low-bridge', routeSafetyAssessment: unsafeRoute, unresolvedSafetyEvents: [{ eventId: 'evt-low-bridge', eventType: 'LOW_BRIDGE' }] })], [], 2],
    ['route_blocked_road_closure', [baseRoute({ routeId: 'route-road-closure', unresolvedSafetyEvents: [{ eventId: 'evt-road-closure', eventType: 'ROAD_CLOSURE' }] })], [], 1],
    ['route_deviation_active', [baseRoute({ routeId: 'route-deviation', routeDeviationState: 'ACTIVE' })], [], 1],
    ['route_deviation_resolved', [baseRoute({ routeId: 'route-deviation-resolved', routeDeviationState: 'RESOLVED' })], [], 1],
    ['no_through_truck_event', [baseRoute({ routeId: 'route-no-through', unresolvedSafetyEvents: [{ eventId: 'evt-no-through', eventType: 'NO_THROUGH_TRUCKS' }] })], [], 1],
    ['restricted_road_event', [baseRoute({ routeId: 'route-restricted', unresolvedSafetyEvents: [{ eventId: 'evt-restricted', eventType: 'RESTRICTED_ROAD' }] })], [], 1],
    ['driver_speed_advisory', [baseRoute({ routeId: 'route-speed-advisory', unresolvedSafetyEvents: [{ eventId: 'evt-speed-advisory', eventType: 'SPEED_ADVISORY' }] })], [], 1],
    ['driver_speed_warning', [baseRoute({ routeId: 'route-speed-warning', driverAssessment: warningDriver, unresolvedSafetyEvents: [{ eventId: 'evt-speed-warning', eventType: 'SPEED_WARNING' }] })], [], 1],
    ['gps_unavailable', [baseRoute({ routeId: 'route-gps', unresolvedSafetyEvents: [{ eventId: 'evt-gps', eventType: 'GPS_UNAVAILABLE' }] })], [], 1],
    ['stale_route_evidence', [baseRoute({ routeId: 'route-stale', routeEvidenceStale: true })], [], 1],
    ['conflicting_route_evidence', [baseRoute({ routeId: 'route-conflict', routeEvidenceConflict: true })], [], 1],
    ['stop_delayed', [baseRoute({ routeId: 'route-stop-delay' })], [{ routeId: 'route-stop-delay', stopId: 'stop-delay', stopStatus: 'DELAYED' }], 1],
    ['stop_skipped_unknown_reason', [baseRoute({ routeId: 'route-stop-skip' })], [{ routeId: 'route-stop-skip', stopId: 'stop-skip', stopStatus: 'SKIPPED' }], 1],
    ['stop_unresolved', [baseRoute({ routeId: 'route-stop-unresolved' })], [{ routeId: 'route-stop-unresolved', stopId: 'stop-unresolved', stopStatus: 'UNRESOLVED' }], 1],
    ['delivery_evidence_missing', [baseRoute({ routeId: 'route-evidence-missing' })], [{ routeId: 'route-evidence-missing', stopId: 'stop-missing', stopStatus: 'ARRIVED', deliveryEvidenceMissing: true }], 1],
    ['multiple_simultaneous_exceptions', [baseRoute({ routeId: 'route-multiple', progressDelayMinutes: 30, routeDeviationState: 'ACTIVE', unresolvedSafetyEvents: [{ eventId: 'evt-speed-warning', eventType: 'SPEED_WARNING' }] })], [{ routeId: 'route-multiple', stopId: 'stop-missing', deliveryEvidenceMissing: true }], 4],
    ['safety_outranks_delay', [baseRoute({ routeId: 'route-safety-priority', progressDelayMinutes: 30, unresolvedSafetyEvents: [{ eventId: 'evt-low-bridge', eventType: 'LOW_BRIDGE' }] })], [], 2],
    ['unknown_severity', [{ routeId: 'route-unknown', organizationId: 'org_synthetic_supervisor_intelligence', assignedDriverId: 'driver-synthetic-001' }], [], 1],
    ['insufficient_evidence', [{ routeId: 'route-insufficient', organizationId: 'org_synthetic_supervisor_intelligence' }], [], 1],
    ['human_review', [baseRoute({ routeId: 'route-review', unresolvedSafetyEvents: [{ eventId: 'evt-restricted', eventType: 'RESTRICTED_ROAD' }] })], [], 1],
    ['alert_acknowledgement', [baseRoute({ routeId: 'route-ack', routeDeviationState: 'ACTIVE' })], [], 1],
    ['alert_resolution', [baseRoute({ routeId: 'route-resolve', routeDeviationState: 'ACTIVE' })], [], 1],
    ['new_evidence_invalidates_alert', [baseRoute({ routeId: 'route-invalidated', routeDeviationState: 'ACTIVE' })], [], 1],
    ['no_exception_case', [baseRoute({ routeId: 'route-no-exception' })], [], 0]
  ].map(([caseId, routes, stops, expectedExceptionCount]) => ({ caseId, request: { supervisorContext: context, routes, stops, now: benchmarkNow }, expectedExceptionCount, syntheticOnly: true, productionNotificationExpected: false, employeeScoringExpected: false })));
}

function querySyntheticSupervisorAssessments() {
  return buildBenchmarkCases().map((benchmark) => {
    const portfolio = buildRoutePortfolioState(benchmark.request);
    const exceptions = detectOperationalExceptions(portfolio, benchmark.request);
    const alerts = prioritizeSupervisorAlerts(exceptions);
    return stable({ caseId: benchmark.caseId, portfolio, exceptions, alerts, summary: buildSupervisorOperationalSummary(portfolio, exceptions, alerts), explanations: alerts.map((alert) => buildSupervisorExplanation({ alert })) });
  });
}

function buildSupervisorIntelligenceEvidence() {
  const benchmarkCases = buildBenchmarkCases();
  const assessments = querySyntheticSupervisorAssessments();
  const orchestrationEvidence = orchestration.buildOrchestrationEvidence();
  const lifecycleEvidence = lifecycle.buildLifecycleEvidence();
  const catalog = {
    schemaVersion: SUPERVISOR_INTELLIGENCE_SCHEMA_VERSION,
    engineVersion: SUPERVISOR_INTELLIGENCE_ENGINE_VERSION,
    generatedAt: DETERMINISTIC_GENERATED_AT,
    capabilityCount: SUPERVISOR_CAPABILITIES.length,
    benchmarkCaseCount: benchmarkCases.length,
    integratedWithEnterpriseRegistry: Boolean(registry.getEnterpriseCapability('supervisor.daily_operations_report')),
    integratedWithCapabilityOrchestration: orchestrationEvidence.capabilities.some((capability) => capability.capabilityId === 'supervisor.intelligence.operations'),
    integratedWithLifecycleFramework: lifecycleEvidence.lifecycleRecords.some((record) => record.capabilityId === 'supervisor.intelligence.operations'),
    integratedWithRouteIntelligence: true,
    integratedWithDriverIntelligence: true,
    existingDailyReportCompatibilityPreserved: true,
    providerCallInvoked: false,
    hostedAiExpanded: false,
    predictiveModelInvoked: false,
    employeeScoring: false,
    disciplineAdviceGenerated: false,
    autonomousWorkforceAction: false,
    productionApiExposed: false,
    productionNotificationSent: false,
    migrationExecuted: false,
    deploymentExecuted: false,
    productionApplicable: false,
    testOnly: true
  };
  catalog.catalogHash = sha256(catalog);
  return stable({
    catalog,
    capabilities: SUPERVISOR_CAPABILITIES,
    contextContract: supervisorContextContract(),
    routeStates: ROUTE_STATES,
    stopStates: STOP_STATES,
    exceptionTypes: EXCEPTION_TYPES,
    severities: SEVERITIES,
    alertStatuses: ALERT_STATUSES,
    nextSteps: NEXT_STEPS,
    reasonCodes: REASON_CODES,
    benchmarkCases,
    assessments,
    integrationReferences: {
      enterpriseCapabilityRegistry: registry.getEnterpriseCapability('supervisor.daily_operations_report') ? { capabilityId: 'supervisor.daily_operations_report' } : null,
      capabilityOrchestration: orchestrationEvidence.capabilities.find((capability) => capability.capabilityId === 'supervisor.intelligence.operations') || null,
      lifecycleFramework: lifecycleEvidence.lifecycleRecords.find((record) => record.capabilityId === 'supervisor.intelligence.operations') || null,
      routeIntelligence: { schemaVersion: routeIntel.ROUTE_INTELLIGENCE_SCHEMA_VERSION },
      driverIntelligence: { schemaVersion: driverIntel.DRIVER_INTELLIGENCE_SCHEMA_VERSION }
    }
  });
}

function supervisorContextContract() {
  return stable({
    schemaVersion: 'supervisor.context.contract.v1',
    required: ['supervisorContextId','organizationId','supervisorUserId','authorizedRole','reportingWindow','sourceReferences','evidenceTimestamp','testOnly'],
    optional: ['shiftReference','routeAssignmentScope','driverAssignmentScope','operationalAreaReference','unknownFields'],
    serverDerivedInFutureRuntime: ['organizationId','supervisorUserId','authorizedRole','routeAssignmentScope','driverAssignmentScope'],
    callerProviderControlsAllowed: false,
    testOnly: true
  });
}

function validateSupervisorAlert(alert) {
  const errors = [];
  if (!SEVERITIES.includes(alert?.severity)) errors.push({ rule: 'UNKNOWN_SEVERITY' });
  if (!NEXT_STEPS.includes(alert?.recommendedOperationalNextStep)) errors.push({ rule: 'UNKNOWN_NEXT_STEP' });
  if (alert?.employmentImpactProhibited !== true) errors.push({ rule: 'EMPLOYMENT_IMPACT_GUARDRAIL_MISSING' });
  for (const field of PROHIBITED_FIELDS) if (new RegExp(`"${field}"\\s*:`).test(stableStringify(alert))) errors.push({ rule: 'PROHIBITED_EMPLOYMENT_FIELD', field });
  if (!alert?.alertHash || alert.alertHash !== sha256({ ...alert, alertHash: undefined })) errors.push({ rule: 'ALERT_HASH_MISMATCH' });
  return stable({ valid: errors.length === 0, errors });
}

function validateSupervisorIntelligenceEvidence(evidence = buildSupervisorIntelligenceEvidence()) {
  const errors = [];
  const text = stableStringify(evidence);
  if (!evidence.catalog.integratedWithEnterpriseRegistry) errors.push({ rule: 'ENTERPRISE_REGISTRY_INTEGRATION_MISSING' });
  if (!evidence.catalog.integratedWithCapabilityOrchestration) errors.push({ rule: 'ORCHESTRATION_INTEGRATION_MISSING' });
  if (!evidence.catalog.integratedWithLifecycleFramework) errors.push({ rule: 'LIFECYCLE_INTEGRATION_MISSING' });
  if (!evidence.catalog.integratedWithRouteIntelligence) errors.push({ rule: 'ROUTE_INTELLIGENCE_INTEGRATION_MISSING' });
  if (!evidence.catalog.integratedWithDriverIntelligence) errors.push({ rule: 'DRIVER_INTELLIGENCE_INTEGRATION_MISSING' });
  for (const field of ['providerCallInvoked','hostedAiExpanded','predictiveModelInvoked','employeeScoring','disciplineAdviceGenerated','autonomousWorkforceAction','productionApiExposed','productionNotificationSent','migrationExecuted','deploymentExecuted','productionApplicable']) {
    if (evidence.catalog[field] !== false) errors.push({ rule: 'PROHIBITED_CAPABILITY_FLAG', field });
  }
  for (const field of PROHIBITED_FIELDS) if (new RegExp(`"${field}"\\s*:`).test(text)) errors.push({ rule: 'PROHIBITED_EMPLOYMENT_FIELD', field });
  for (const benchmark of evidence.benchmarkCases || []) {
    const assessment = evidence.assessments.find((item) => item.caseId === benchmark.caseId);
    if (!assessment) errors.push({ rule: 'MISSING_BENCHMARK_ASSESSMENT', caseId: benchmark.caseId });
    else if (assessment.exceptions.length !== benchmark.expectedExceptionCount) errors.push({ rule: 'BENCHMARK_EXPECTATION_MISMATCH', caseId: benchmark.caseId, expected: benchmark.expectedExceptionCount, actual: assessment.exceptions.length });
    for (const alert of assessment?.alerts || []) {
      for (const error of validateSupervisorAlert(alert).errors) errors.push({ ...error, caseId: benchmark.caseId });
    }
  }
  return stable({ valid: errors.length === 0, errors });
}

module.exports = {
  ALERT_STATUSES,
  AUTHORIZED_ROLES,
  DETERMINISTIC_GENERATED_AT,
  EXCEPTION_TYPES,
  NEXT_STEPS,
  PROHIBITED_FIELDS,
  REASON_CODES,
  ROUTE_STATES,
  SEVERITIES,
  STOP_STATES,
  SUPERVISOR_CAPABILITIES,
  SUPERVISOR_INTELLIGENCE_ENGINE_VERSION,
  SUPERVISOR_INTELLIGENCE_SCHEMA_VERSION,
  acknowledgeSupervisorAlert,
  baseRoute,
  buildBenchmarkCases,
  buildRoutePortfolioState,
  buildSupervisorAlert,
  buildSupervisorExplanation,
  buildSupervisorIntelligenceEvidence,
  buildSupervisorOperationalSummary,
  buildSyntheticSupervisorContext,
  classifyExceptionSeverity,
  detectOperationalExceptions,
  evidenceCompleteness,
  invalidateSupervisorAlert,
  prioritizeSupervisorAlerts,
  querySyntheticSupervisorAssessments,
  resolveSupervisorAlert,
  routeProgressPercent,
  sha256,
  stable,
  stableStringify,
  supervisorContextContract,
  validateSupervisorAlert,
  validateSupervisorContext,
  validateSupervisorIntelligenceEvidence,
  paths: { backendRoot, repoRoot, docsRoot, generatedRoot }
};
