const path = require('path');
const governance = require('./decisionGovernance');
const registry = require('./enterpriseCapabilityRegistry');
const orchestration = require('./intelligenceCapabilityOrchestration');
const lifecycle = require('./intelligenceLifecycleFramework');
const routeIntel = require('./routeIntelligence');
const driverIntel = require('./driverIntelligence');
const supervisorIntel = require('./supervisorOperationalIntelligence');
const warehouseIntel = require('./warehouseIntelligence');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'implementation');
const generatedRoot = path.join(docsRoot, 'fleet-intelligence-foundation', 'generated');
const FLEET_INTELLIGENCE_SCHEMA_VERSION = 'fleet.intelligence.foundation.v1';
const FLEET_INTELLIGENCE_ENGINE_VERSION = 'fleet.intelligence.foundation.engine.v1';
const DETERMINISTIC_GENERATED_AT = '2026-08-08T00:00:00.000Z';

const AVAILABILITY_STATES = Object.freeze(['AVAILABLE','ASSIGNED','IN_USE','UNAVAILABLE','OUT_OF_SERVICE','RESERVED','INSUFFICIENT_EVIDENCE','UNKNOWN']);
const READINESS_STATES = Object.freeze(['READY','READY_WITH_REVIEW','NOT_READY','BLOCKED','INSUFFICIENT_EVIDENCE','UNKNOWN']);
const COMPATIBILITY_STATES = Object.freeze(['COMPATIBLE','INCOMPATIBLE','REVIEW_REQUIRED','INSUFFICIENT_EVIDENCE','UNKNOWN']);
const MAINTENANCE_STATES = Object.freeze(['NO_KNOWN_BLOCKER','MAINTENANCE_DUE','MAINTENANCE_OVERDUE','OPEN_CRITICAL_ISSUE','OUT_OF_SERVICE','MAINTENANCE_STATUS_UNKNOWN','INSUFFICIENT_EVIDENCE']);
const ISSUE_TYPES = Object.freeze(['VEHICLE_UNAVAILABLE','VEHICLE_OUT_OF_SERVICE','VEHICLE_ASSIGNMENT_MISMATCH','VEHICLE_PROFILE_MISSING','ROUTE_VEHICLE_INCOMPATIBLE','VEHICLE_EVIDENCE_STALE','VEHICLE_EVIDENCE_CONFLICT','MAINTENANCE_STATUS_UNKNOWN','MAINTENANCE_DUE','MAINTENANCE_OVERDUE','CRITICAL_VEHICLE_ISSUE_OPEN','ROUTE_IMPACTED_BY_VEHICLE_STATE','SUPERVISOR_REVIEW_REQUIRED','HUMAN_REVIEW_REQUIRED','INSUFFICIENT_EVIDENCE']);
const ROUTE_IMPACT_STATES = Object.freeze(['NO_KNOWN_IMPACT','ROUTE_AT_RISK','ROUTE_BLOCKED','REVIEW_REQUIRED','INSUFFICIENT_EVIDENCE','UNKNOWN']);
const SEVERITIES = Object.freeze(['INFORMATIONAL','LOW','MODERATE','HIGH','CRITICAL','UNKNOWN']);
const ALERT_STATUSES = Object.freeze(['OPEN','ACKNOWLEDGED','UNDER_REVIEW','RESOLVED','DISMISSED_AS_DUPLICATE','INVALIDATED_BY_NEW_EVIDENCE','UNKNOWN']);
const NEXT_STEPS = Object.freeze(['REVIEW_VEHICLE_STATUS','REVIEW_ASSIGNMENT','REVIEW_ROUTE_COMPATIBILITY','REVIEW_MAINTENANCE_STATUS','REVIEW_OPEN_VEHICLE_ISSUE','CONTACT_SUPERVISOR','HOLD_ROUTE_FOR_REVIEW','REVIEW_SUBSTITUTE_VEHICLE','NO_ACTION_REQUIRED','UNABLE_TO_DETERMINE']);
const REASON_CODES = Object.freeze({
  VEHICLE_AVAILABLE: 'VEHICLE_AVAILABLE',
  VEHICLE_ASSIGNED: 'VEHICLE_ASSIGNED',
  VEHICLE_IN_USE: 'VEHICLE_IN_USE',
  VEHICLE_UNAVAILABLE: 'VEHICLE_UNAVAILABLE',
  VEHICLE_OUT_OF_SERVICE: 'VEHICLE_OUT_OF_SERVICE',
  VEHICLE_ASSIGNMENT_VERIFIED: 'VEHICLE_ASSIGNMENT_VERIFIED',
  VEHICLE_ASSIGNMENT_MISMATCH: 'VEHICLE_ASSIGNMENT_MISMATCH',
  VEHICLE_PROFILE_AVAILABLE: 'VEHICLE_PROFILE_AVAILABLE',
  VEHICLE_PROFILE_MISSING: 'VEHICLE_PROFILE_MISSING',
  ROUTE_VEHICLE_COMPATIBLE: 'ROUTE_VEHICLE_COMPATIBLE',
  ROUTE_VEHICLE_INCOMPATIBLE: 'ROUTE_VEHICLE_INCOMPATIBLE',
  ROUTE_VEHICLE_REVIEW_REQUIRED: 'ROUTE_VEHICLE_REVIEW_REQUIRED',
  VEHICLE_EVIDENCE_STALE: 'VEHICLE_EVIDENCE_STALE',
  VEHICLE_EVIDENCE_CONFLICT: 'VEHICLE_EVIDENCE_CONFLICT',
  MAINTENANCE_STATUS_AVAILABLE: 'MAINTENANCE_STATUS_AVAILABLE',
  MAINTENANCE_STATUS_UNKNOWN: 'MAINTENANCE_STATUS_UNKNOWN',
  MAINTENANCE_DUE: 'MAINTENANCE_DUE',
  MAINTENANCE_OVERDUE: 'MAINTENANCE_OVERDUE',
  CRITICAL_VEHICLE_ISSUE_OPEN: 'CRITICAL_VEHICLE_ISSUE_OPEN',
  ROUTE_IMPACT_NONE: 'ROUTE_IMPACT_NONE',
  ROUTE_IMPACT_AT_RISK: 'ROUTE_IMPACT_AT_RISK',
  ROUTE_IMPACT_BLOCKED: 'ROUTE_IMPACT_BLOCKED',
  VEHICLE_READY: 'VEHICLE_READY',
  VEHICLE_READY_WITH_REVIEW: 'VEHICLE_READY_WITH_REVIEW',
  VEHICLE_NOT_READY: 'VEHICLE_NOT_READY',
  VEHICLE_BLOCKED: 'VEHICLE_BLOCKED',
  SUPERVISOR_REVIEW_REQUIRED: 'SUPERVISOR_REVIEW_REQUIRED',
  HUMAN_REVIEW_REQUIRED: 'HUMAN_REVIEW_REQUIRED',
  EVIDENCE_INSUFFICIENT: 'EVIDENCE_INSUFFICIENT',
  ALERT_ACKNOWLEDGED: 'ALERT_ACKNOWLEDGED',
  ALERT_RESOLVED: 'ALERT_RESOLVED',
  ALERT_INVALIDATED_BY_NEW_EVIDENCE: 'ALERT_INVALIDATED_BY_NEW_EVIDENCE'
});
const PROHIBITED_FIELDS = Object.freeze(['predictiveFailureProbability','predictedBreakdownDate','recommendedReplacement','autonomousDispatch','autonomousRepairApproval','autonomousPartsPurchase','employeeScore','driverScore','productivityRating','disciplinaryRecommendation','provider','providerId','model','modelId','modelSelection','productionActivation','implementationPackageNumber','customerIntelligenceImplemented']);
const FLEET_CAPABILITIES = Object.freeze([
  { capabilityId: 'fleet.operational_context.validation', displayName: 'Fleet Operational Context Validation', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'fleet.vehicle_availability.assessment', displayName: 'Vehicle Availability Assessment', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'fleet.vehicle_readiness.assessment', displayName: 'Vehicle Readiness Assessment', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'fleet.route_vehicle_compatibility.summary', displayName: 'Route Vehicle Compatibility Summary', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'fleet.exception.alerting', displayName: 'Fleet Exception Alerting', executionStrategy: 'DETERMINISTIC_RULES' }
]);

function stable(value) { return governance.stable(value); }
function stableStringify(value) { return governance.stableStringify(value); }
function sha256(value) { return governance.sha256(value); }
function hasOwn(object, key) { return Object.prototype.hasOwnProperty.call(object || {}, key); }
function scanProhibitedFields(value) {
  const text = stableStringify(value);
  return PROHIBITED_FIELDS.filter((field) => new RegExp(`"${field}"\\s*:`).test(text));
}

function validateFleetContext(context = {}) {
  const errors = [];
  for (const field of scanProhibitedFields(context)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (!context.organizationId) errors.push({ rule: 'ORGANIZATION_REQUIRED', reasonCode: REASON_CODES.EVIDENCE_INSUFFICIENT });
  if (!context.fleetContextId) errors.push({ rule: 'FLEET_CONTEXT_REQUIRED', reasonCode: REASON_CODES.EVIDENCE_INSUFFICIENT });
  if (!Array.isArray(context.vehicleScope)) errors.push({ rule: 'VEHICLE_SCOPE_REQUIRED', reasonCode: REASON_CODES.EVIDENCE_INSUFFICIENT });
  return stable({ valid: errors.length === 0, errors, trustedServerDerivedInFutureRuntime: ['organizationId','vehicleScope','routeScope','driverScope'], providerModelControlsRejected: true, validationHash: sha256({ context, errors }) });
}

function evidenceCompleteness(record = {}) {
  const required = ['vehicleId','organizationId','vehicleProfile','assignmentEvidence','readinessEvidence','routeCompatibilityEvidence'];
  const items = required.map((field) => ({ field, present: hasOwn(record, field) && record[field] !== null && record[field] !== '' }));
  const score = items.filter((item) => item.present).length / items.length;
  return stable({ status: score === 1 ? 'COMPLETE' : score >= 0.6 ? 'PARTIAL' : 'INSUFFICIENT', score: Number(score.toFixed(3)), items });
}

function evidenceConfidence(record = {}, completeness = evidenceCompleteness(record)) {
  if (record.evidenceConflict === true) return { status: 'CONFLICTING_EVIDENCE', score: 0.2 };
  if (record.evidenceStale === true) return { status: 'STALE_EVIDENCE', score: 0.4 };
  if (completeness.status === 'COMPLETE') return { status: 'KNOWN_SYNTHETIC_EVIDENCE', score: 1 };
  if (completeness.status === 'PARTIAL') return { status: 'PARTIAL_SYNTHETIC_EVIDENCE', score: 0.6 };
  return { status: 'INSUFFICIENT_EVIDENCE', score: null };
}

function buildFleetEvidence(vehicle = {}) {
  const completeness = evidenceCompleteness(vehicle);
  const confidence = evidenceConfidence(vehicle, completeness);
  return stable({
    evidenceSources: vehicle.evidenceSources || ['synthetic.vehicle_record', 'synthetic.route_assignment'],
    evidenceTimestamps: vehicle.evidenceTimestamps || [],
    sourceHashes: stable((vehicle.evidenceSources || []).map((source) => ({ source, hash: sha256({ source, vehicleId: vehicle.vehicleId || null }) }))),
    completeness,
    confidence,
    stale: vehicle.evidenceStale === true,
    conflict: vehicle.evidenceConflict === true,
    unknownFields: vehicle.unknownFields || [],
    syntheticOnly: true
  });
}

function buildVehicleOperationalContext(input = {}) {
  const context = input.fleetContext || {};
  const vehicle = input.vehicle || {};
  const validation = validateFleetContext(context);
  const organizationMatches = !vehicle.organizationId || !context.organizationId || vehicle.organizationId === context.organizationId;
  const evidence = buildFleetEvidence(vehicle);
  const record = {
    schemaVersion: 'fleet.vehicle.operational.context.v1',
    fleetContextId: context.fleetContextId || null,
    organizationId: organizationMatches ? (vehicle.organizationId || context.organizationId || null) : null,
    vehicleId: vehicle.vehicleId || null,
    vehicleClass: vehicle.vehicleClass || vehicle.vehicleProfile?.vehicleClass || 'UNKNOWN',
    vehicleProfile: vehicle.vehicleProfile || null,
    assignedRouteId: vehicle.assignedRouteId || null,
    assignedDriverId: vehicle.assignedDriverId || null,
    currentUseState: vehicle.currentUseState || 'UNKNOWN',
    operationalStatus: vehicle.operationalStatus || 'UNKNOWN',
    maintenanceStatus: vehicle.maintenanceStatus || 'MAINTENANCE_STATUS_UNKNOWN',
    outOfServiceEvidence: vehicle.outOfServiceEvidence || null,
    activeIssueReferences: vehicle.activeIssueReferences || [],
    assignmentEvidence: vehicle.assignmentEvidence || null,
    readinessEvidence: vehicle.readinessEvidence || null,
    routeCompatibilityEvidence: vehicle.routeCompatibilityEvidence || null,
    warehouseDepartureEvidence: vehicle.warehouseDepartureEvidence || null,
    evidence,
    evidenceCompleteness: evidence.completeness,
    evidenceConfidence: evidence.confidence,
    humanReviewRequired: vehicle.humanReviewRequired === true || !validation.valid || !organizationMatches || evidence.completeness.status !== 'COMPLETE' || evidence.stale || evidence.conflict,
    organizationIsolationPreserved: organizationMatches,
    testOnly: true
  };
  record.vehicleContextHash = sha256(record);
  return stable(record);
}

function evaluateVehicleAvailability(vehicleContext = {}) {
  let state = 'UNKNOWN';
  let reasonCode = REASON_CODES.EVIDENCE_INSUFFICIENT;
  if (!vehicleContext.vehicleId || vehicleContext.organizationIsolationPreserved !== true) {
    state = 'INSUFFICIENT_EVIDENCE';
  } else if (vehicleContext.outOfServiceEvidence || vehicleContext.operationalStatus === 'OUT_OF_SERVICE') {
    state = 'OUT_OF_SERVICE';
    reasonCode = REASON_CODES.VEHICLE_OUT_OF_SERVICE;
  } else if (vehicleContext.operationalStatus === 'UNAVAILABLE') {
    state = 'UNAVAILABLE';
    reasonCode = REASON_CODES.VEHICLE_UNAVAILABLE;
  } else if (vehicleContext.currentUseState === 'IN_USE') {
    state = 'IN_USE';
    reasonCode = REASON_CODES.VEHICLE_IN_USE;
  } else if (vehicleContext.currentUseState === 'RESERVED') {
    state = 'RESERVED';
    reasonCode = REASON_CODES.VEHICLE_ASSIGNED;
  } else if (vehicleContext.assignedRouteId) {
    state = 'ASSIGNED';
    reasonCode = REASON_CODES.VEHICLE_ASSIGNED;
  } else if (vehicleContext.operationalStatus === 'AVAILABLE' && vehicleContext.evidenceCompleteness.status !== 'INSUFFICIENT') {
    state = 'AVAILABLE';
    reasonCode = REASON_CODES.VEHICLE_AVAILABLE;
  } else if (vehicleContext.evidenceCompleteness.status === 'INSUFFICIENT') {
    state = 'INSUFFICIENT_EVIDENCE';
  }
  const result = { state, reasonCode, deterministic: true, testOnly: true };
  result.availabilityHash = sha256(result);
  return stable(result);
}

function verifyVehicleAssignment(vehicleContext = {}) {
  const expected = vehicleContext.assignmentEvidence?.expectedVehicleId || vehicleContext.vehicleId || null;
  const assigned = vehicleContext.assignmentEvidence?.assignedVehicleId || vehicleContext.vehicleId || null;
  let outcome = 'UNKNOWN';
  let reasonCode = REASON_CODES.EVIDENCE_INSUFFICIENT;
  if (!vehicleContext.assignmentEvidence || !expected || !assigned) {
    outcome = 'INSUFFICIENT_EVIDENCE';
  } else if (expected === assigned) {
    outcome = 'MATCH';
    reasonCode = REASON_CODES.VEHICLE_ASSIGNMENT_VERIFIED;
  } else {
    outcome = 'MISMATCH';
    reasonCode = REASON_CODES.VEHICLE_ASSIGNMENT_MISMATCH;
  }
  const result = { outcome, reasonCode, facts: { expectedVehicleId: expected, assignedVehicleId: assigned, routeId: vehicleContext.assignedRouteId }, deterministic: true, employmentImpactProhibited: true, testOnly: true };
  result.assignmentHash = sha256(result);
  return stable(result);
}

function assessRouteVehicleCompatibility(vehicleContext = {}) {
  const evidence = vehicleContext.routeCompatibilityEvidence;
  let state = 'UNKNOWN';
  let reasonCode = REASON_CODES.EVIDENCE_INSUFFICIENT;
  let routeAssessment = evidence?.routeIntelligenceAssessment || null;
  if (!evidence) {
    state = 'INSUFFICIENT_EVIDENCE';
  } else if (routeAssessment) {
    if (routeAssessment.status === routeIntel.ROUTE_SAFETY_STATUSES.ELIGIBLE) {
      state = 'COMPATIBLE';
      reasonCode = REASON_CODES.ROUTE_VEHICLE_COMPATIBLE;
    } else if (routeAssessment.status === routeIntel.ROUTE_SAFETY_STATUSES.UNSAFE) {
      state = 'INCOMPATIBLE';
      reasonCode = REASON_CODES.ROUTE_VEHICLE_INCOMPATIBLE;
    } else if (routeAssessment.status === routeIntel.ROUTE_SAFETY_STATUSES.REVIEW_REQUIRED) {
      state = 'REVIEW_REQUIRED';
      reasonCode = REASON_CODES.ROUTE_VEHICLE_REVIEW_REQUIRED;
    } else {
      state = 'INSUFFICIENT_EVIDENCE';
    }
  } else if (evidence.state && COMPATIBILITY_STATES.includes(evidence.state)) {
    state = evidence.state;
    reasonCode = state === 'COMPATIBLE' ? REASON_CODES.ROUTE_VEHICLE_COMPATIBLE : state === 'INCOMPATIBLE' ? REASON_CODES.ROUTE_VEHICLE_INCOMPATIBLE : REASON_CODES.ROUTE_VEHICLE_REVIEW_REQUIRED;
  }
  const result = { state, reasonCode, routeAssessmentStatus: routeAssessment?.status || null, routeIntelligenceAuthoritative: true, routeSafetyOverrideAttempted: false, deterministic: true, testOnly: true };
  result.compatibilityHash = sha256(result);
  return stable(result);
}

function evaluateMaintenanceAwareness(vehicleContext = {}) {
  let state = 'MAINTENANCE_STATUS_UNKNOWN';
  let reasonCode = REASON_CODES.MAINTENANCE_STATUS_UNKNOWN;
  const status = vehicleContext.maintenanceStatus;
  if (vehicleContext.outOfServiceEvidence || status === 'OUT_OF_SERVICE') {
    state = 'OUT_OF_SERVICE';
    reasonCode = REASON_CODES.VEHICLE_OUT_OF_SERVICE;
  } else if (status === 'OPEN_CRITICAL_ISSUE') {
    state = 'OPEN_CRITICAL_ISSUE';
    reasonCode = REASON_CODES.CRITICAL_VEHICLE_ISSUE_OPEN;
  } else if (status === 'MAINTENANCE_OVERDUE') {
    state = 'MAINTENANCE_OVERDUE';
    reasonCode = REASON_CODES.MAINTENANCE_OVERDUE;
  } else if (status === 'MAINTENANCE_DUE') {
    state = 'MAINTENANCE_DUE';
    reasonCode = REASON_CODES.MAINTENANCE_DUE;
  } else if (status === 'NO_KNOWN_BLOCKER') {
    state = 'NO_KNOWN_BLOCKER';
    reasonCode = REASON_CODES.MAINTENANCE_STATUS_AVAILABLE;
  } else if (!hasOwn(vehicleContext, 'maintenanceStatus')) {
    state = 'INSUFFICIENT_EVIDENCE';
    reasonCode = REASON_CODES.EVIDENCE_INSUFFICIENT;
  }
  const result = { state, reasonCode, predictiveMaintenanceInvoked: false, repairAuthorizationGenerated: false, partsPurchaseRecommended: false, deterministic: true, testOnly: true };
  result.maintenanceHash = sha256(result);
  return stable(result);
}

function classifyFleetSeverity(issueType, evidence = {}) {
  if (['VEHICLE_OUT_OF_SERVICE','ROUTE_VEHICLE_INCOMPATIBLE','CRITICAL_VEHICLE_ISSUE_OPEN'].includes(issueType)) return 'CRITICAL';
  if (['VEHICLE_UNAVAILABLE','ROUTE_IMPACTED_BY_VEHICLE_STATE','VEHICLE_ASSIGNMENT_MISMATCH'].includes(issueType)) return 'HIGH';
  if (['MAINTENANCE_OVERDUE','HUMAN_REVIEW_REQUIRED','SUPERVISOR_REVIEW_REQUIRED'].includes(issueType)) return 'MODERATE';
  if (['VEHICLE_EVIDENCE_STALE','VEHICLE_EVIDENCE_CONFLICT','MAINTENANCE_DUE'].includes(issueType)) return 'LOW';
  if (issueType === 'INSUFFICIENT_EVIDENCE') return evidence.unknownSeverity ? 'UNKNOWN' : 'LOW';
  return 'INFORMATIONAL';
}

function issueRecord(type, vehicleContext, reasonCode, refs = [], options = {}) {
  const severity = classifyFleetSeverity(type, options);
  const issue = {
    issueId: `fleet.issue.${vehicleContext.vehicleId || 'unknown'}.${type.toLowerCase()}.${reasonCode.toLowerCase()}`,
    issueType: type,
    organizationId: vehicleContext.organizationId || null,
    vehicleId: vehicleContext.vehicleId || null,
    routeId: vehicleContext.assignedRouteId || null,
    driverId: vehicleContext.assignedDriverId || null,
    evidenceReferences: refs,
    evidence: vehicleContext.evidence,
    reasonCodes: [reasonCode],
    completeness: vehicleContext.evidenceCompleteness,
    confidence: vehicleContext.evidenceConfidence,
    severity,
    operationalImpact: options.operationalImpact || 'SUPERVISOR_REVIEW_MAY_BE_REQUIRED',
    humanReviewRequired: options.humanReviewRequired === true || ['CRITICAL','HIGH','UNKNOWN'].includes(severity),
    employmentImpactProhibited: true,
    testOnly: true
  };
  issue.issueHash = sha256(issue);
  return stable(issue);
}

function detectVehicleIssues(vehicleContext, availability, assignment, compatibility, maintenance) {
  const issues = [];
  if (availability.state === 'UNAVAILABLE') issues.push(issueRecord('VEHICLE_UNAVAILABLE', vehicleContext, REASON_CODES.VEHICLE_UNAVAILABLE, ['vehicle.availability']));
  if (availability.state === 'OUT_OF_SERVICE') issues.push(issueRecord('VEHICLE_OUT_OF_SERVICE', vehicleContext, REASON_CODES.VEHICLE_OUT_OF_SERVICE, ['vehicle.out_of_service'], { humanReviewRequired: true }));
  if (assignment.outcome === 'MISMATCH') issues.push(issueRecord('VEHICLE_ASSIGNMENT_MISMATCH', vehicleContext, REASON_CODES.VEHICLE_ASSIGNMENT_MISMATCH, ['route.assignment'], { humanReviewRequired: true }));
  if (!vehicleContext.vehicleProfile) issues.push(issueRecord('VEHICLE_PROFILE_MISSING', vehicleContext, REASON_CODES.VEHICLE_PROFILE_MISSING, ['vehicle.profile'], { humanReviewRequired: true }));
  if (compatibility.state === 'INCOMPATIBLE') issues.push(issueRecord('ROUTE_VEHICLE_INCOMPATIBLE', vehicleContext, REASON_CODES.ROUTE_VEHICLE_INCOMPATIBLE, ['route.intelligence'], { humanReviewRequired: true }));
  if (vehicleContext.evidence.stale) issues.push(issueRecord('VEHICLE_EVIDENCE_STALE', vehicleContext, REASON_CODES.VEHICLE_EVIDENCE_STALE, ['vehicle.evidence']));
  if (vehicleContext.evidence.conflict) issues.push(issueRecord('VEHICLE_EVIDENCE_CONFLICT', vehicleContext, REASON_CODES.VEHICLE_EVIDENCE_CONFLICT, ['vehicle.evidence'], { humanReviewRequired: true }));
  if (maintenance.state === 'MAINTENANCE_STATUS_UNKNOWN') issues.push(issueRecord('MAINTENANCE_STATUS_UNKNOWN', vehicleContext, REASON_CODES.MAINTENANCE_STATUS_UNKNOWN, ['maintenance.status']));
  if (maintenance.state === 'MAINTENANCE_DUE') issues.push(issueRecord('MAINTENANCE_DUE', vehicleContext, REASON_CODES.MAINTENANCE_DUE, ['maintenance.status']));
  if (maintenance.state === 'MAINTENANCE_OVERDUE') issues.push(issueRecord('MAINTENANCE_OVERDUE', vehicleContext, REASON_CODES.MAINTENANCE_OVERDUE, ['maintenance.status'], { humanReviewRequired: true }));
  if (maintenance.state === 'OPEN_CRITICAL_ISSUE') issues.push(issueRecord('CRITICAL_VEHICLE_ISSUE_OPEN', vehicleContext, REASON_CODES.CRITICAL_VEHICLE_ISSUE_OPEN, ['maintenance.issue'], { humanReviewRequired: true }));
  if (vehicleContext.evidenceCompleteness.status === 'INSUFFICIENT') issues.push(issueRecord('INSUFFICIENT_EVIDENCE', vehicleContext, REASON_CODES.EVIDENCE_INSUFFICIENT, ['vehicle.evidence'], { unknownSeverity: true, humanReviewRequired: true }));
  if (vehicleContext.humanReviewRequired) issues.push(issueRecord('HUMAN_REVIEW_REQUIRED', vehicleContext, REASON_CODES.HUMAN_REVIEW_REQUIRED, ['vehicle.review'], { humanReviewRequired: true }));
  return stable(issues.sort((a, b) => a.issueId.localeCompare(b.issueId)));
}

function assessRouteImpact(vehicleContext, availability, compatibility, maintenance) {
  let state = 'NO_KNOWN_IMPACT';
  let reasonCode = REASON_CODES.ROUTE_IMPACT_NONE;
  if (!vehicleContext.assignedRouteId) {
    state = 'UNKNOWN';
  } else if (compatibility.state === 'INCOMPATIBLE' || availability.state === 'OUT_OF_SERVICE' || maintenance.state === 'OPEN_CRITICAL_ISSUE') {
    state = 'ROUTE_BLOCKED';
    reasonCode = REASON_CODES.ROUTE_IMPACT_BLOCKED;
  } else if (['UNAVAILABLE','INSUFFICIENT_EVIDENCE'].includes(availability.state) || maintenance.state === 'MAINTENANCE_OVERDUE') {
    state = 'ROUTE_AT_RISK';
    reasonCode = REASON_CODES.ROUTE_IMPACT_AT_RISK;
  } else if (compatibility.state === 'REVIEW_REQUIRED' || vehicleContext.humanReviewRequired) {
    state = 'REVIEW_REQUIRED';
    reasonCode = REASON_CODES.ROUTE_VEHICLE_REVIEW_REQUIRED;
  }
  const result = { state, reasonCode, routeId: vehicleContext.assignedRouteId || null, autonomousSubstituteAssigned: false, autonomousDispatchPerformed: false, deterministic: true, testOnly: true };
  result.routeImpactHash = sha256(result);
  return stable(result);
}

function evaluateVehicleReadiness(vehicleContext, availability, assignment, compatibility, maintenance) {
  let state = 'UNKNOWN';
  let reasonCode = REASON_CODES.EVIDENCE_INSUFFICIENT;
  if (vehicleContext.evidenceCompleteness.status === 'INSUFFICIENT' || !vehicleContext.vehicleId || !vehicleContext.vehicleProfile || ['INSUFFICIENT_EVIDENCE','UNKNOWN'].includes(availability.state) || ['INSUFFICIENT_EVIDENCE','UNKNOWN'].includes(compatibility.state) || assignment.outcome === 'INSUFFICIENT_EVIDENCE') {
    state = 'INSUFFICIENT_EVIDENCE';
  } else if (availability.state === 'OUT_OF_SERVICE' || compatibility.state === 'INCOMPATIBLE' || maintenance.state === 'OPEN_CRITICAL_ISSUE') {
    state = 'BLOCKED';
    reasonCode = REASON_CODES.VEHICLE_BLOCKED;
  } else if (availability.state === 'UNAVAILABLE' || assignment.outcome === 'MISMATCH' || maintenance.state === 'MAINTENANCE_OVERDUE') {
    state = 'NOT_READY';
    reasonCode = REASON_CODES.VEHICLE_NOT_READY;
  } else if (vehicleContext.humanReviewRequired || compatibility.state === 'REVIEW_REQUIRED' || ['MAINTENANCE_DUE','MAINTENANCE_STATUS_UNKNOWN'].includes(maintenance.state)) {
    state = 'READY_WITH_REVIEW';
    reasonCode = REASON_CODES.VEHICLE_READY_WITH_REVIEW;
  } else if (['AVAILABLE','ASSIGNED','IN_USE','RESERVED'].includes(availability.state) && ['MATCH','INSUFFICIENT_EVIDENCE'].includes(assignment.outcome) && compatibility.state === 'COMPATIBLE') {
    state = 'READY';
    reasonCode = REASON_CODES.VEHICLE_READY;
  }
  const result = { state, reasonCode, humanReviewRequired: state === 'READY_WITH_REVIEW' || vehicleContext.humanReviewRequired, deterministic: true, testOnly: true };
  result.readinessHash = sha256(result);
  return stable(result);
}

function nextStepForIssue(issue) {
  if (issue.issueType === 'VEHICLE_OUT_OF_SERVICE' || issue.issueType === 'VEHICLE_UNAVAILABLE') return 'REVIEW_VEHICLE_STATUS';
  if (issue.issueType === 'VEHICLE_ASSIGNMENT_MISMATCH') return 'REVIEW_ASSIGNMENT';
  if (issue.issueType === 'ROUTE_VEHICLE_INCOMPATIBLE') return 'REVIEW_ROUTE_COMPATIBILITY';
  if (/MAINTENANCE|CRITICAL/.test(issue.issueType)) return 'REVIEW_MAINTENANCE_STATUS';
  if (issue.issueType === 'INSUFFICIENT_EVIDENCE') return 'UNABLE_TO_DETERMINE';
  return 'CONTACT_SUPERVISOR';
}

function buildFleetAlert(issue, lifecycleStatus = 'OPEN') {
  const alert = {
    alertId: `fleet.alert.${sha256(issue.issueId).slice(0, 16)}`,
    issueId: issue.issueId,
    vehicleId: issue.vehicleId,
    routeId: issue.routeId,
    driverId: issue.driverId,
    severity: issue.severity,
    priority: { CRITICAL: 100, HIGH: 80, MODERATE: 60, LOW: 40, INFORMATIONAL: 20, UNKNOWN: 50 }[issue.severity] || 0,
    structuredFacts: { issueType: issue.issueType, reasonCodes: issue.reasonCodes },
    evidence: issue.evidence,
    reasonCodes: issue.reasonCodes,
    operationalNextStep: nextStepForIssue(issue),
    acknowledgementState: lifecycleStatus === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'NOT_ACKNOWLEDGED',
    resolutionState: ['RESOLVED','INVALIDATED_BY_NEW_EVIDENCE','DISMISSED_AS_DUPLICATE'].includes(lifecycleStatus) ? lifecycleStatus : 'UNRESOLVED',
    limitations: issue.completeness.status === 'COMPLETE' ? [] : ['Evidence is incomplete; supervisor review is required before operational action.'],
    humanReviewRequired: issue.humanReviewRequired,
    employmentImpactProhibited: true,
    testOnly: true
  };
  alert.alertHash = sha256(alert);
  return stable(alert);
}

function acknowledgeFleetAlert(alert, actor = 'synthetic-supervisor') {
  return stable({ ...alert, acknowledgementState: 'ACKNOWLEDGED', lifecycleStatus: 'ACKNOWLEDGED', lifecycleReasonCode: REASON_CODES.ALERT_ACKNOWLEDGED, acknowledgedBy: actor, alertHash: sha256({ ...alert, acknowledgementState: 'ACKNOWLEDGED', lifecycleStatus: 'ACKNOWLEDGED' }) });
}
function resolveFleetAlert(alert, actor = 'synthetic-supervisor') {
  return stable({ ...alert, resolutionState: 'RESOLVED', lifecycleStatus: 'RESOLVED', lifecycleReasonCode: REASON_CODES.ALERT_RESOLVED, resolvedBy: actor, alertHash: sha256({ ...alert, resolutionState: 'RESOLVED', lifecycleStatus: 'RESOLVED' }) });
}
function invalidateFleetAlert(alert) {
  return stable({ ...alert, resolutionState: 'INVALIDATED_BY_NEW_EVIDENCE', lifecycleStatus: 'INVALIDATED_BY_NEW_EVIDENCE', lifecycleReasonCode: REASON_CODES.ALERT_INVALIDATED_BY_NEW_EVIDENCE, alertHash: sha256({ ...alert, resolutionState: 'INVALIDATED_BY_NEW_EVIDENCE', lifecycleStatus: 'INVALIDATED_BY_NEW_EVIDENCE' }) });
}

function buildFleetExplanation(assessment) {
  const explanation = {
    explanationId: `fleet.explanation.${sha256(assessment.assessmentId || assessment.vehicleContext.vehicleId || 'unknown').slice(0, 16)}`,
    vehicleId: assessment.vehicleContext.vehicleId,
    routeId: assessment.vehicleContext.assignedRouteId,
    availabilityState: assessment.availability.state,
    readinessState: assessment.readiness.state,
    compatibilityState: assessment.compatibility.state,
    reasonCodes: assessment.reasonCodes,
    text: `Fleet readiness for ${assessment.vehicleContext.vehicleId || 'unknown vehicle'} is ${assessment.readiness.state} based on availability ${assessment.availability.state}, route compatibility ${assessment.compatibility.state}, maintenance ${assessment.maintenance.state}, and explicit evidence completeness ${assessment.vehicleContext.evidenceCompleteness.status}.`,
    derivedFromFacts: true,
    mechanicalCauseInferred: false,
    futureBreakdownPredicted: false,
    employeeNegligenceInferred: false,
    providerGenerated: false,
    employmentImpactProhibited: true
  };
  explanation.explanationHash = sha256(explanation);
  return stable(explanation);
}

function buildFleetSummary(assessments = []) {
  const summary = {
    totalVehicles: assessments.length,
    availableVehicles: assessments.filter((item) => item.availability.state === 'AVAILABLE').length,
    assignedVehicles: assessments.filter((item) => item.availability.state === 'ASSIGNED').length,
    inUseVehicles: assessments.filter((item) => item.availability.state === 'IN_USE').length,
    unavailableVehicles: assessments.filter((item) => item.availability.state === 'UNAVAILABLE').length,
    outOfServiceVehicles: assessments.filter((item) => item.availability.state === 'OUT_OF_SERVICE').length,
    vehiclesRequiringReview: assessments.filter((item) => item.readiness.humanReviewRequired || item.issues.some((issue) => issue.humanReviewRequired)).length,
    vehiclesWithInsufficientEvidence: assessments.filter((item) => item.readiness.state === 'INSUFFICIENT_EVIDENCE').length,
    routeImpacts: Object.fromEntries(ROUTE_IMPACT_STATES.map((state) => [state, assessments.filter((item) => item.routeImpact.state === state).length])),
    limitations: ['Repository-only synthetic foundation', 'No predictive maintenance', 'No autonomous dispatch', 'No workforce scoring', 'No production API']
  };
  summary.summaryHash = sha256(summary);
  return stable(summary);
}

function assessFleetVehicle(input = {}) {
  const vehicleContext = buildVehicleOperationalContext(input);
  const availability = evaluateVehicleAvailability(vehicleContext);
  const assignment = verifyVehicleAssignment(vehicleContext);
  const compatibility = assessRouteVehicleCompatibility(vehicleContext);
  const maintenance = evaluateMaintenanceAwareness(vehicleContext);
  const readiness = evaluateVehicleReadiness(vehicleContext, availability, assignment, compatibility, maintenance);
  const routeImpact = assessRouteImpact(vehicleContext, availability, compatibility, maintenance);
  const issues = detectVehicleIssues(vehicleContext, availability, assignment, compatibility, maintenance);
  if (routeImpact.state !== 'NO_KNOWN_IMPACT' && routeImpact.state !== 'UNKNOWN') issues.push(issueRecord('ROUTE_IMPACTED_BY_VEHICLE_STATE', vehicleContext, routeImpact.reasonCode, ['route.impact'], { humanReviewRequired: routeImpact.state !== 'NO_KNOWN_IMPACT' }));
  const alerts = issues.map((issue) => buildFleetAlert(issue)).sort((a, b) => b.priority - a.priority || a.alertId.localeCompare(b.alertId));
  const assessment = {
    schemaVersion: FLEET_INTELLIGENCE_SCHEMA_VERSION,
    engineVersion: FLEET_INTELLIGENCE_ENGINE_VERSION,
    assessmentId: `fleet.assessment.${vehicleContext.vehicleId || 'unknown'}`,
    vehicleContext,
    availability,
    assignment,
    compatibility,
    maintenance,
    readiness,
    routeImpact,
    issues: stable(issues),
    alerts: stable(alerts),
    explanations: [],
    reasonCodes: [...new Set([availability.reasonCode, assignment.reasonCode, compatibility.reasonCode, maintenance.reasonCode, readiness.reasonCode, routeImpact.reasonCode].concat(issues.flatMap((issue) => issue.reasonCodes)))].sort(),
    providerCallInvoked: false,
    hostedAiInvoked: false,
    predictiveMaintenanceInvoked: false,
    autonomousDispatchPerformed: false,
    autonomousRepairApprovalPerformed: false,
    autonomousPartsPurchasePerformed: false,
    employeeScoring: false,
    driverScoring: false,
    productivityRanking: false,
    disciplineAdviceGenerated: false,
    productionApiExposed: false,
    migrationExecuted: false,
    deploymentExecuted: false,
    productionApplicable: false,
    testOnly: true,
    generatedAt: DETERMINISTIC_GENERATED_AT
  };
  assessment.explanations = [buildFleetExplanation(assessment)];
  assessment.assessmentHash = sha256(assessment);
  return stable(assessment);
}

function fleetContextContract() {
  return stable({
    schemaVersion: 'fleet.context.contract.v1',
    required: ['fleetContextId','organizationId','operationalAreaReference','workPeriodRef','vehicleScope','routeScope','driverScope','evidenceSources','evidenceTimestamps','sourceHashes','unknownFields','testOnly'],
    optional: ['depotReference'],
    serverDerivedInFutureRuntime: ['organizationId','vehicleScope','routeScope','driverScope'],
    callerProviderControlsAllowed: false,
    testOnly: true
  });
}

function buildSyntheticFleetContext() {
  return stable({
    fleetContextId: 'fleet.context.synthetic.001',
    organizationId: 'org_synthetic_fleet_intelligence',
    depotReference: 'depot.synthetic.birmingham',
    operationalAreaReference: 'area.synthetic.central',
    workPeriodRef: 'fleet.shift.synthetic.day',
    vehicleScope: ['vehicle-available','vehicle-assigned','vehicle-out-of-service'],
    routeScope: ['route-clear-pass','route-low-clearance'],
    driverScope: ['driver-synthetic-001','driver-synthetic-002'],
    evidenceSources: ['synthetic.vehicle_record','synthetic.route_assignment','synthetic.route_intelligence'],
    evidenceTimestamps: [DETERMINISTIC_GENERATED_AT],
    sourceHashes: [{ source: 'synthetic.vehicle_record', hash: sha256('synthetic.vehicle_record') }],
    unknownFields: [],
    testOnly: true
  });
}

function routeAssessment(caseId) {
  const benchmark = routeIntel.buildBenchmarkCases().find((item) => item.caseId === caseId);
  return routeIntel.compareRouteAlternatives(benchmark.request).assessments[0];
}

function baseVehicle(overrides = {}) {
  return stable({
    vehicleId: overrides.vehicleId || 'vehicle-available',
    organizationId: overrides.organizationId || 'org_synthetic_fleet_intelligence',
    vehicleClass: overrides.vehicleClass || 'BOX_TRUCK',
    vehicleProfile: hasOwn(overrides, 'vehicleProfile') ? overrides.vehicleProfile : routeIntel.buildSyntheticVehicleProfiles()[0],
    assignedRouteId: hasOwn(overrides, 'assignedRouteId') ? overrides.assignedRouteId : null,
    assignedDriverId: hasOwn(overrides, 'assignedDriverId') ? overrides.assignedDriverId : null,
    currentUseState: overrides.currentUseState || 'AVAILABLE',
    operationalStatus: overrides.operationalStatus || 'AVAILABLE',
    maintenanceStatus: hasOwn(overrides, 'maintenanceStatus') ? overrides.maintenanceStatus : 'NO_KNOWN_BLOCKER',
    outOfServiceEvidence: overrides.outOfServiceEvidence || null,
    activeIssueReferences: overrides.activeIssueReferences || [],
    assignmentEvidence: hasOwn(overrides, 'assignmentEvidence') ? overrides.assignmentEvidence : { evidenceId: 'assignment-none', expectedVehicleId: overrides.vehicleId || 'vehicle-available', assignedVehicleId: overrides.vehicleId || 'vehicle-available' },
    readinessEvidence: hasOwn(overrides, 'readinessEvidence') ? overrides.readinessEvidence : { evidenceId: 'readiness-known', source: 'synthetic.vehicle_record' },
    routeCompatibilityEvidence: hasOwn(overrides, 'routeCompatibilityEvidence') ? overrides.routeCompatibilityEvidence : { routeIntelligenceAssessment: routeAssessment('clearance_pass') },
    warehouseDepartureEvidence: overrides.warehouseDepartureEvidence || null,
    evidenceSources: overrides.evidenceSources || ['synthetic.vehicle_record','synthetic.assignment'],
    evidenceTimestamps: overrides.evidenceTimestamps || [DETERMINISTIC_GENERATED_AT],
    evidenceStale: overrides.evidenceStale === true,
    evidenceConflict: overrides.evidenceConflict === true,
    humanReviewRequired: overrides.humanReviewRequired === true,
    unknownFields: overrides.unknownFields || [],
    testOnly: true
  });
}

function buildBenchmarkCases() {
  const ctx = buildSyntheticFleetContext();
  const compatible = { routeIntelligenceAssessment: routeAssessment('clearance_pass') };
  const incompatible = { routeIntelligenceAssessment: routeAssessment('low_clearance_fail_closed') };
  const review = { routeIntelligenceAssessment: routeAssessment('hazard_proximity_review') };
  return stable([
    ['available_unassigned_vehicle', baseVehicle({ vehicleId: 'vehicle-available', assignedRouteId: null, assignedDriverId: null }), 'READY'],
    ['assigned_vehicle', baseVehicle({ vehicleId: 'vehicle-assigned', assignedRouteId: 'route-001', assignedDriverId: 'driver-synthetic-001', currentUseState: 'ASSIGNED' }), 'READY'],
    ['vehicle_in_use', baseVehicle({ vehicleId: 'vehicle-in-use', assignedRouteId: 'route-002', assignedDriverId: 'driver-synthetic-002', currentUseState: 'IN_USE' }), 'READY'],
    ['unavailable_vehicle', baseVehicle({ vehicleId: 'vehicle-unavailable', assignedRouteId: 'route-003', operationalStatus: 'UNAVAILABLE' }), 'NOT_READY'],
    ['out_of_service_vehicle', baseVehicle({ vehicleId: 'vehicle-oos', assignedRouteId: 'route-004', operationalStatus: 'OUT_OF_SERVICE', outOfServiceEvidence: { evidenceId: 'oos-explicit' } }), 'BLOCKED'],
    ['assignment_match', baseVehicle({ vehicleId: 'vehicle-match', assignedRouteId: 'route-match', assignmentEvidence: { expectedVehicleId: 'vehicle-match', assignedVehicleId: 'vehicle-match' } }), 'READY'],
    ['assignment_mismatch', baseVehicle({ vehicleId: 'vehicle-mismatch', assignedRouteId: 'route-mismatch', assignmentEvidence: { expectedVehicleId: 'vehicle-mismatch', assignedVehicleId: 'vehicle-other' } }), 'NOT_READY'],
    ['vehicle_profile_present', baseVehicle({ vehicleId: 'vehicle-profile-present' }), 'READY'],
    ['vehicle_profile_missing', baseVehicle({ vehicleId: 'vehicle-profile-missing', vehicleProfile: null }), 'INSUFFICIENT_EVIDENCE'],
    ['route_compatible_vehicle', baseVehicle({ vehicleId: 'vehicle-compatible', assignedRouteId: 'route-compatible', routeCompatibilityEvidence: compatible }), 'READY'],
    ['route_incompatible_vehicle', baseVehicle({ vehicleId: 'vehicle-incompatible', assignedRouteId: 'route-incompatible', routeCompatibilityEvidence: incompatible }), 'BLOCKED'],
    ['route_compatibility_review', baseVehicle({ vehicleId: 'vehicle-review-route', assignedRouteId: 'route-review', routeCompatibilityEvidence: review }), 'READY_WITH_REVIEW'],
    ['maintenance_known', baseVehicle({ vehicleId: 'vehicle-maintenance-known', maintenanceStatus: 'NO_KNOWN_BLOCKER' }), 'READY'],
    ['maintenance_due', baseVehicle({ vehicleId: 'vehicle-maintenance-due', maintenanceStatus: 'MAINTENANCE_DUE' }), 'READY_WITH_REVIEW'],
    ['maintenance_overdue', baseVehicle({ vehicleId: 'vehicle-maintenance-overdue', assignedRouteId: 'route-maint-overdue', maintenanceStatus: 'MAINTENANCE_OVERDUE' }), 'NOT_READY'],
    ['critical_issue_open', baseVehicle({ vehicleId: 'vehicle-critical-issue', assignedRouteId: 'route-critical', maintenanceStatus: 'OPEN_CRITICAL_ISSUE' }), 'BLOCKED'],
    ['maintenance_status_unknown', baseVehicle({ vehicleId: 'vehicle-maint-unknown', maintenanceStatus: 'MAINTENANCE_STATUS_UNKNOWN' }), 'READY_WITH_REVIEW'],
    ['stale_evidence', baseVehicle({ vehicleId: 'vehicle-stale', evidenceStale: true }), 'READY_WITH_REVIEW'],
    ['conflicting_evidence', baseVehicle({ vehicleId: 'vehicle-conflict', evidenceConflict: true }), 'READY_WITH_REVIEW'],
    ['ready_vehicle', baseVehicle({ vehicleId: 'vehicle-ready' }), 'READY'],
    ['ready_with_review', baseVehicle({ vehicleId: 'vehicle-ready-review', humanReviewRequired: true }), 'READY_WITH_REVIEW'],
    ['not_ready_vehicle', baseVehicle({ vehicleId: 'vehicle-not-ready', operationalStatus: 'UNAVAILABLE' }), 'NOT_READY'],
    ['blocked_vehicle', baseVehicle({ vehicleId: 'vehicle-blocked', assignedRouteId: 'route-blocked', routeCompatibilityEvidence: incompatible }), 'BLOCKED'],
    ['route_impacted_by_unavailable_vehicle', baseVehicle({ vehicleId: 'vehicle-route-risk', assignedRouteId: 'route-risk', operationalStatus: 'UNAVAILABLE' }), 'NOT_READY'],
    ['route_blocked_by_incompatible_vehicle', baseVehicle({ vehicleId: 'vehicle-route-blocked', assignedRouteId: 'route-blocked', routeCompatibilityEvidence: incompatible }), 'BLOCKED'],
    ['substitute_vehicle_review', baseVehicle({ vehicleId: 'vehicle-sub-review', assignedRouteId: 'route-substitute', humanReviewRequired: true }), 'READY_WITH_REVIEW'],
    ['insufficient_evidence', baseVehicle({ vehicleId: 'vehicle-insufficient', assignmentEvidence: null, routeCompatibilityEvidence: null }), 'INSUFFICIENT_EVIDENCE'],
    ['unknown_state', baseVehicle({ vehicleId: 'vehicle-unknown', operationalStatus: 'UNKNOWN', currentUseState: 'UNKNOWN', assignmentEvidence: null, routeCompatibilityEvidence: { state: 'UNKNOWN' } }), 'INSUFFICIENT_EVIDENCE'],
    ['supervisor_review', baseVehicle({ vehicleId: 'vehicle-supervisor-review', humanReviewRequired: true }), 'READY_WITH_REVIEW'],
    ['alert_acknowledgement', baseVehicle({ vehicleId: 'vehicle-alert-ack', operationalStatus: 'UNAVAILABLE' }), 'NOT_READY'],
    ['alert_resolution', baseVehicle({ vehicleId: 'vehicle-alert-resolve', operationalStatus: 'UNAVAILABLE' }), 'NOT_READY'],
    ['new_evidence_invalidates_prior_issue', baseVehicle({ vehicleId: 'vehicle-alert-invalidated', evidenceStale: true }), 'READY_WITH_REVIEW'],
    ['no_exception_case', baseVehicle({ vehicleId: 'vehicle-no-exception' }), 'READY'],
    ['cross_organization_vehicle', baseVehicle({ vehicleId: 'vehicle-cross-org', organizationId: 'org_other' }), 'INSUFFICIENT_EVIDENCE']
  ].map(([caseId, vehicle, expectedReadiness]) => ({ caseId, request: { fleetContext: ctx, vehicle }, expectedReadiness, syntheticOnly: true, providerCallExpected: false, productionActivationExpected: false, workforceScoringExpected: false })));
}

function querySyntheticFleetAssessments() {
  return buildBenchmarkCases().map((benchmark) => {
    const assessment = assessFleetVehicle(benchmark.request);
    const firstAlert = assessment.alerts[0] || buildFleetAlert(issueRecord('NO_EXCEPTION', assessment.vehicleContext, assessment.readiness.reasonCode, [], { operationalImpact: 'NO_KNOWN_IMPACT' }), 'OPEN');
    return stable({
      caseId: benchmark.caseId,
      assessment,
      lifecycleSamples: {
        acknowledged: acknowledgeFleetAlert(firstAlert),
        resolved: resolveFleetAlert(firstAlert),
        invalidated: invalidateFleetAlert(firstAlert)
      }
    });
  });
}

function buildFleetIntelligenceEvidence() {
  const benchmarkCases = buildBenchmarkCases();
  const assessments = querySyntheticFleetAssessments();
  const assessmentRecords = assessments.map((item) => item.assessment);
  const orchestrationEvidence = orchestration.buildOrchestrationEvidence();
  const lifecycleEvidence = lifecycle.buildLifecycleEvidence();
  const catalog = {
    schemaVersion: FLEET_INTELLIGENCE_SCHEMA_VERSION,
    engineVersion: FLEET_INTELLIGENCE_ENGINE_VERSION,
    generatedAt: DETERMINISTIC_GENERATED_AT,
    capabilityCount: FLEET_CAPABILITIES.length,
    benchmarkCaseCount: benchmarkCases.length,
    integratedWithEnterpriseRegistry: registry.listEnterpriseCapabilities().length > 0,
    directEnterpriseRegistryCapability: null,
    directRegistryCapabilityDeferred: true,
    integratedWithCapabilityOrchestration: orchestrationEvidence.capabilities.some((capability) => capability.businessDomain === 'Fleet Intelligence'),
    integratedWithLifecycleFramework: lifecycleEvidence.lifecycleRecords.some((record) => record.capabilityId === 'fleet.intelligence.utilization'),
    integratedWithRouteIntelligence: true,
    integratedWithDriverIntelligence: true,
    integratedWithSupervisorIntelligence: true,
    integratedWithWarehouseIntelligence: true,
    existingFleetScoringBoundaryPreserved: true,
    providerCallInvoked: false,
    hostedAiInvoked: false,
    modelSelectionActivated: false,
    predictiveMaintenanceInvoked: false,
    autonomousDispatchPerformed: false,
    autonomousRepairApprovalPerformed: false,
    autonomousPartsPurchasePerformed: false,
    employeeScoring: false,
    driverScoring: false,
    productivityRanking: false,
    disciplineAdviceGenerated: false,
    productionApiExposed: false,
    migrationExecuted: false,
    deploymentExecuted: false,
    productionApplicable: false,
    testOnly: true
  };
  catalog.catalogHash = sha256(catalog);
  return stable({
    catalog,
    capabilities: FLEET_CAPABILITIES,
    contextContract: fleetContextContract(),
    availabilityStates: AVAILABILITY_STATES,
    readinessStates: READINESS_STATES,
    compatibilityStates: COMPATIBILITY_STATES,
    maintenanceStates: MAINTENANCE_STATES,
    issueTypes: ISSUE_TYPES,
    routeImpactStates: ROUTE_IMPACT_STATES,
    severities: SEVERITIES,
    alertStatuses: ALERT_STATUSES,
    nextSteps: NEXT_STEPS,
    reasonCodes: REASON_CODES,
    benchmarkCases,
    assessments,
    summary: buildFleetSummary(assessmentRecords),
    integrationReferences: {
      enterpriseCapabilityRegistry: { available: registry.listEnterpriseCapabilities().length > 0, directFleetCapabilityDeferred: true },
      capabilityOrchestration: orchestrationEvidence.capabilities.find((capability) => capability.businessDomain === 'Fleet Intelligence') || null,
      lifecycleFramework: lifecycleEvidence.lifecycleRecords.find((record) => record.capabilityId === 'fleet.intelligence.utilization') || null,
      routeIntelligence: { schemaVersion: routeIntel.ROUTE_INTELLIGENCE_SCHEMA_VERSION },
      driverIntelligence: { schemaVersion: driverIntel.DRIVER_INTELLIGENCE_SCHEMA_VERSION },
      supervisorIntelligence: { schemaVersion: supervisorIntel.SUPERVISOR_INTELLIGENCE_SCHEMA_VERSION },
      warehouseIntelligence: { schemaVersion: warehouseIntel.WAREHOUSE_INTELLIGENCE_SCHEMA_VERSION },
      fleetIntelligenceScoring: { boundary: 'REFERENCE_ONLY', productionServicePath: 'bridge-api/services/fleetIntelligenceScoring.js' }
    }
  });
}

function validateFleetAlert(alert) {
  const errors = [];
  if (!SEVERITIES.includes(alert?.severity)) errors.push({ rule: 'UNKNOWN_SEVERITY' });
  if (!NEXT_STEPS.includes(alert?.operationalNextStep)) errors.push({ rule: 'UNKNOWN_NEXT_STEP' });
  if (alert?.employmentImpactProhibited !== true) errors.push({ rule: 'EMPLOYMENT_IMPACT_GUARDRAIL_MISSING' });
  for (const field of scanProhibitedFields(alert)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (!alert?.alertHash || alert.alertHash !== sha256({ ...alert, alertHash: undefined })) errors.push({ rule: 'ALERT_HASH_MISMATCH' });
  return stable({ valid: errors.length === 0, errors });
}

function validateFleetAssessment(assessment) {
  const errors = [];
  if (!READINESS_STATES.includes(assessment?.readiness?.state)) errors.push({ rule: 'UNKNOWN_READINESS_STATE' });
  if (assessment?.availability?.state === 'UNAVAILABLE' && assessment?.readiness?.state === 'READY') errors.push({ rule: 'UNAVAILABLE_VEHICLE_MARKED_READY' });
  if (assessment?.availability?.state === 'OUT_OF_SERVICE' && assessment?.readiness?.state === 'READY') errors.push({ rule: 'OUT_OF_SERVICE_VEHICLE_MARKED_READY' });
  if (assessment?.compatibility?.state === 'INCOMPATIBLE' && assessment?.readiness?.state === 'READY') errors.push({ rule: 'ROUTE_INCOMPATIBLE_VEHICLE_MARKED_READY' });
  if (assessment?.vehicleContext?.evidenceCompleteness?.status === 'INSUFFICIENT' && assessment?.readiness?.state === 'READY') errors.push({ rule: 'MISSING_CRITICAL_EVIDENCE_MARKED_READY' });
  if (assessment?.assignment?.outcome === 'INSUFFICIENT_EVIDENCE' && assessment?.readiness?.state === 'READY') errors.push({ rule: 'MISSING_CRITICAL_EVIDENCE_MARKED_READY' });
  if (['INSUFFICIENT_EVIDENCE','UNKNOWN'].includes(assessment?.compatibility?.state) && assessment?.readiness?.state === 'READY') errors.push({ rule: 'MISSING_CRITICAL_EVIDENCE_MARKED_READY' });
  if (assessment?.assignment?.outcome === 'MATCH' && assessment.assignment.facts.expectedVehicleId !== assessment.assignment.facts.assignedVehicleId) errors.push({ rule: 'ASSIGNMENT_MISMATCH_MARKED_VERIFIED' });
  if (assessment?.maintenance?.state === 'NO_KNOWN_BLOCKER' && assessment?.maintenance?.reasonCode === REASON_CODES.MAINTENANCE_STATUS_UNKNOWN) errors.push({ rule: 'UNKNOWN_MAINTENANCE_CONVERTED_TO_NO_BLOCKER' });
  for (const field of ['providerCallInvoked','hostedAiInvoked','predictiveMaintenanceInvoked','autonomousDispatchPerformed','autonomousRepairApprovalPerformed','autonomousPartsPurchasePerformed','employeeScoring','driverScoring','productivityRanking','disciplineAdviceGenerated','productionApiExposed','migrationExecuted','deploymentExecuted','productionApplicable']) {
    if (assessment?.[field] !== false) errors.push({ rule: 'PROHIBITED_CAPABILITY_FLAG', field });
  }
  for (const field of scanProhibitedFields(assessment)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (!assessment?.assessmentHash || assessment.assessmentHash !== sha256({ ...assessment, assessmentHash: undefined })) errors.push({ rule: 'ASSESSMENT_HASH_MISMATCH' });
  for (const alert of assessment.alerts || []) for (const error of validateFleetAlert(alert).errors) errors.push(error);
  return stable({ valid: errors.length === 0, errors });
}

function validateFleetIntelligenceEvidence(evidence = buildFleetIntelligenceEvidence()) {
  const errors = [];
  const text = stableStringify(evidence);
  for (const field of ['providerCallInvoked','hostedAiInvoked','modelSelectionActivated','predictiveMaintenanceInvoked','autonomousDispatchPerformed','autonomousRepairApprovalPerformed','autonomousPartsPurchasePerformed','employeeScoring','driverScoring','productivityRanking','disciplineAdviceGenerated','productionApiExposed','migrationExecuted','deploymentExecuted','productionApplicable']) {
    if (evidence.catalog[field] !== false) errors.push({ rule: 'PROHIBITED_CAPABILITY_FLAG', field });
  }
  for (const field of ['integratedWithEnterpriseRegistry','integratedWithCapabilityOrchestration','integratedWithLifecycleFramework','integratedWithRouteIntelligence','integratedWithDriverIntelligence','integratedWithSupervisorIntelligence','integratedWithWarehouseIntelligence','existingFleetScoringBoundaryPreserved']) {
    if (evidence.catalog[field] !== true) errors.push({ rule: 'PLATFORM_INTEGRATION_MISSING', field });
  }
  for (const field of scanProhibitedFields(evidence)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (/AI-IEP-005B\.3|CUSTOMER_INTELLIGENCE_IMPLEMENTED/.test(text)) errors.push({ rule: 'FABRICATED_PACKAGE_OR_CUSTOMER_SCOPE' });
  for (const benchmark of evidence.benchmarkCases || []) {
    const record = evidence.assessments.find((item) => item.caseId === benchmark.caseId);
    if (!record) errors.push({ rule: 'MISSING_BENCHMARK_ASSESSMENT', caseId: benchmark.caseId });
    else {
      if (record.assessment.readiness.state !== benchmark.expectedReadiness) errors.push({ rule: 'BENCHMARK_EXPECTATION_MISMATCH', caseId: benchmark.caseId, expected: benchmark.expectedReadiness, actual: record.assessment.readiness.state });
      for (const error of validateFleetAssessment(record.assessment).errors) errors.push({ ...error, caseId: benchmark.caseId });
    }
  }
  return stable({ valid: errors.length === 0, errors });
}

module.exports = {
  ALERT_STATUSES,
  AVAILABILITY_STATES,
  COMPATIBILITY_STATES,
  DETERMINISTIC_GENERATED_AT,
  FLEET_CAPABILITIES,
  FLEET_INTELLIGENCE_ENGINE_VERSION,
  FLEET_INTELLIGENCE_SCHEMA_VERSION,
  ISSUE_TYPES,
  MAINTENANCE_STATES,
  NEXT_STEPS,
  PROHIBITED_FIELDS,
  READINESS_STATES,
  REASON_CODES,
  ROUTE_IMPACT_STATES,
  SEVERITIES,
  acknowledgeFleetAlert,
  assessFleetVehicle,
  assessRouteImpact,
  assessRouteVehicleCompatibility,
  baseVehicle,
  buildBenchmarkCases,
  buildFleetAlert,
  buildFleetEvidence,
  buildFleetExplanation,
  buildFleetIntelligenceEvidence,
  buildFleetSummary,
  buildSyntheticFleetContext,
  buildVehicleOperationalContext,
  classifyFleetSeverity,
  detectVehicleIssues,
  evaluateMaintenanceAwareness,
  evaluateVehicleAvailability,
  evaluateVehicleReadiness,
  fleetContextContract,
  invalidateFleetAlert,
  querySyntheticFleetAssessments,
  resolveFleetAlert,
  scanProhibitedFields,
  sha256,
  stable,
  stableStringify,
  validateFleetAlert,
  validateFleetAssessment,
  validateFleetContext,
  validateFleetIntelligenceEvidence,
  verifyVehicleAssignment,
  paths: { backendRoot, repoRoot, docsRoot, generatedRoot }
};
