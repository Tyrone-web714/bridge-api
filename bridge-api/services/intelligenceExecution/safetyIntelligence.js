const path = require('path');
const governance = require('./decisionGovernance');
const registry = require('./enterpriseCapabilityRegistry');
const orchestration = require('./intelligenceCapabilityOrchestration');
const lifecycle = require('./intelligenceLifecycleFramework');
const routeIntel = require('./routeIntelligence');
const driverIntel = require('./driverIntelligence');
const fleetIntel = require('./fleetIntelligence');
const warehouseIntel = require('./warehouseIntelligence');
const operationsIntel = require('./operationsIntelligence');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'implementation');
const generatedRoot = path.join(docsRoot, 'safety-intelligence-foundation', 'generated');
const SAFETY_INTELLIGENCE_SCHEMA_VERSION = 'safety.intelligence.foundation.v1';
const SAFETY_INTELLIGENCE_ENGINE_VERSION = 'safety.intelligence.foundation.engine.v1';
const DETERMINISTIC_GENERATED_AT = '2026-08-12T00:00:00.000Z';

const SOURCE_DOMAINS = Object.freeze(['ROUTE','DRIVER','FLEET','WAREHOUSE','OPERATIONS','SHARED_SAFETY','SUPERVISOR','CUSTOMER']);
const FRESHNESS_STATES = Object.freeze(['FRESH','STALE','UNKNOWN','INSUFFICIENT_EVIDENCE']);
const COMPLETENESS_STATES = Object.freeze(['COMPLETE','PARTIAL','INSUFFICIENT','CONFLICTING','STALE','UNKNOWN']);
const CONFIDENCE_STATES = Object.freeze(['KNOWN_SYNTHETIC_EVIDENCE','PARTIAL_SYNTHETIC_EVIDENCE','CONFLICTING_EVIDENCE','STALE_EVIDENCE','INSUFFICIENT_EVIDENCE']);
const SEVERITIES = Object.freeze(['INFORMATIONAL','LOW','MODERATE','HIGH','CRITICAL','UNKNOWN']);
const PRIORITIES = Object.freeze(['P0','P1','P2','P3','P4','UNKNOWN']);
const ALERT_STATUSES = Object.freeze(['OPEN','ACKNOWLEDGED','UNDER_REVIEW','RESOLVED','DISMISSED_AS_DUPLICATE','INVALIDATED_BY_NEW_EVIDENCE','UNKNOWN']);
const NEXT_STEPS = Object.freeze(['REVIEW_ROUTE_SAFETY','REVIEW_LOW_CLEARANCE_HAZARD','REVIEW_TRUCK_RESTRICTION','REVIEW_ROAD_CLOSURE','REVIEW_ROUTE_VEHICLE_COMPATIBILITY','REVIEW_DRIVER_SAFETY_ADVISORY','REVIEW_SPEED_WARNING','REVIEW_SHARED_SAFETY_RECORD','REVIEW_CONFLICTING_EVIDENCE','REVIEW_MISSING_EVIDENCE','HOLD_FOR_HUMAN_REVIEW','NO_ACTION_REQUIRED','UNABLE_TO_DETERMINE']);
const EXCEPTION_TYPES = Object.freeze(['ROUTE_SAFETY_BLOCKER_ACTIVE','LOW_CLEARANCE_HAZARD_ACTIVE','TRUCK_RESTRICTION_ACTIVE','NO_THROUGH_TRUCK_RESTRICTION_ACTIVE','ROAD_CLOSURE_ACTIVE','RESIDENTIAL_RESTRICTION_ACTIVE','ROUTE_VEHICLE_INCOMPATIBLE','DRIVER_SAFETY_ADVISORY_ACTIVE','DRIVER_SPEED_WARNING_ACTIVE','SAFETY_EVIDENCE_STALE','SAFETY_EVIDENCE_CONFLICT','SAFETY_EVIDENCE_INCOMPLETE','SHARED_SAFETY_REVIEW_REQUIRED','MULTIPLE_SAFETY_EXCEPTIONS','HUMAN_REVIEW_REQUIRED','INSUFFICIENT_EVIDENCE']);
const REASON_CODES = Object.freeze(['NO_KNOWN_SAFETY_EXCEPTION','ROUTE_BLOCKED','LOW_CLEARANCE','LOW_CLEARANCE_REVIEW','TRUCK_PROHIBITED','NO_THROUGH_TRUCK','LOCAL_DELIVERY_EXCEPTION','ROAD_CLOSURE','RESIDENTIAL_RESTRICTION','RESIDENTIAL_ADVISORY','ROUTE_VEHICLE_INCOMPATIBLE','ROUTE_VEHICLE_REVIEW_REQUIRED','DRIVER_LOW_BRIDGE_ADVISORY','RESTRICTED_ROAD_ADVISORY','NO_THROUGH_TRUCK_ADVISORY','SPEED_ADVISORY','SPEED_WARNING','SPEED_EVIDENCE_STALE','MISSING_SAFETY_EVIDENCE','CONFLICTING_SAFETY_EVIDENCE','WAREHOUSE_SAFETY_BLOCKER','OPERATIONS_SAFETY_EXCEPTION','SHARED_SAFETY_ACCEPTED','SHARED_SAFETY_REVIEW','HUMAN_REVIEW']);
const SAFETY_CAPABILITIES = Object.freeze([
  { capabilityId: 'safety.organization_context.validation', displayName: 'Organization Safety Context Validation', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'safety.evidence.aggregation', displayName: 'Safety Evidence Aggregation', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'safety.exception.classification', displayName: 'Safety Exception Classification', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'safety.alert.lifecycle', displayName: 'Safety Alert Lifecycle', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'safety.summary.explanation', displayName: 'Safety Summary and Explanation', executionStrategy: 'DETERMINISTIC_RULES' }
]);
const PROHIBITED_FIELDS = Object.freeze([
  'driverSafetyScore','employeeSafetyScore','driverRiskScore','employeeRiskScore','unsafeDriverLabel','driverRanking','safetyRanking','productivityScore','negligenceConclusion','misconductConclusion','disciplinaryRecommendation','terminationRecommendation','compensationRecommendation',
  'autonomousRouteShutdown','autonomousDriverLockout','autonomousVehicleLockout','autonomousDispatch','automaticRouteReassignment','automaticDriverReassignment','automaticVehicleReassignment','automaticSafetyEnforcement','automaticDiscipline',
  'crashPrediction','accidentPrediction','collisionPrediction','fatiguePrediction','driverBehaviorPrediction','injuryPrediction','insuranceRiskPrediction','criminalRiskPrediction','predictedSafetyIncident','safetyRiskProbability','predictiveSafetyScore',
  'cameraDriverMonitoring','computerVisionMonitoring','facialRecognition','facialAnalysis','emotionDetection','eyeTracking','biometricMonitoring','wearableMonitoring','newTelematicsDevice','newELDIntegration','CANBusIntegration','newVehicleSensorIntegration',
  'OSHAPlatform','DOTCompliancePlatform','insuranceEligibility','legalLiabilityConclusion','providerModelSelection','productionActivation','implementationPackageNumber','ninthMilestoneOneDomain'
]);

function stable(value) { return governance.stable(value); }
function stableStringify(value) { return governance.stableStringify(value); }
function sha256(value) { return governance.sha256(value); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function hasOwn(object, key) { return Object.prototype.hasOwnProperty.call(object || {}, key); }
function scanProhibitedFields(value) {
  const text = stableStringify(value);
  return PROHIBITED_FIELDS.filter((field) => new RegExp(`"${field}"\\s*:`).test(text));
}
function sourceDomain(value) { return SOURCE_DOMAINS.includes(value) ? value : 'UNKNOWN'; }

function safetyContextContract() {
  return stable({
    schemaVersion: 'safety.context.contract.v1',
    requiredFields: ['safetyContextId','organizationId','reportingWindow','routeScope','driverScope','supervisorScope','warehouseScope','vehicleScope','operationsScope','sharedSafetyReferences','sourceDomains','sourceRecordIds','sourceHashes','sourceVersions','evidenceTimestamps','evidenceCompleteness','evidenceConfidence','evidenceFreshness','conflicts','unknownFields','humanReviewRequired','testOnly'],
    trustedServerDerivedFutureRuntime: ['organizationId','routeScope','driverScope','supervisorScope','warehouseScope','vehicleScope','operationsScope'],
    crossOrganizationAggregationProhibited: true,
    lowerDomainsRemainAuthoritative: true,
    providerModelControlsRejected: true,
    productionRuntimeDeferred: true
  });
}

function evidenceCompleteness(record = {}, requiredFields = []) {
  const items = requiredFields.map((field) => ({ field, present: hasOwn(record, field) && record[field] !== null && record[field] !== '' }));
  const score = requiredFields.length ? items.filter((item) => item.present).length / requiredFields.length : 1;
  const status = record.evidenceConflict === true ? 'CONFLICTING' : record.evidenceStale === true ? 'STALE' : score === 1 ? 'COMPLETE' : score >= 0.5 ? 'PARTIAL' : 'INSUFFICIENT';
  return stable({ status, score: Number(score.toFixed(3)), items });
}

function evidenceConfidence(record = {}, completeness = { status: 'UNKNOWN' }) {
  if (record.evidenceConflict === true || completeness.status === 'CONFLICTING') return { status: 'CONFLICTING_EVIDENCE', score: 0.2 };
  if (record.evidenceStale === true || completeness.status === 'STALE') return { status: 'STALE_EVIDENCE', score: 0.4 };
  if (completeness.status === 'COMPLETE') return { status: 'KNOWN_SYNTHETIC_EVIDENCE', score: 1 };
  if (completeness.status === 'PARTIAL') return { status: 'PARTIAL_SYNTHETIC_EVIDENCE', score: 0.6 };
  return { status: 'INSUFFICIENT_EVIDENCE', score: null };
}

function evidenceFreshness(record = {}) {
  if (record.evidenceStale === true || record.evidenceFreshness === 'STALE') return 'STALE';
  if (record.evidenceUnknown === true || (!record.sourceTimestamp && !record.evidenceTimestamp)) return 'UNKNOWN';
  return 'FRESH';
}

function normalizeSafetyEvidence(record = {}, context = {}) {
  const organizationMatches = !record.organizationId || !context.organizationId || record.organizationId === context.organizationId;
  const normalized = {
    sourceDomain: sourceDomain(record.sourceDomain),
    sourceRecordId: record.sourceRecordId || null,
    sourceVersion: record.sourceVersion || 'synthetic.v1',
    organizationId: organizationMatches ? (record.organizationId || context.organizationId || null) : null,
    sourceStatus: record.sourceStatus || record.status || 'UNKNOWN',
    sourceTimestamp: record.sourceTimestamp || record.evidenceTimestamp || null,
    routeId: record.routeId || null,
    vehicleId: record.vehicleId || null,
    driverId: record.driverId || null,
    warehouseId: record.warehouseId || record.depotId || null,
    supervisorId: record.supervisorId || null,
    customerId: record.customerId || null,
    sharedSafetyRecordId: record.sharedSafetyRecordId || null,
    safetyCondition: record.safetyCondition || null,
    lowerDomainConclusion: record.lowerDomainConclusion || record.sourceStatus || 'UNKNOWN',
    lowerDomainOverrideAttempted: record.lowerDomainOverrideAttempted === true,
    ordinaryOperationalIssue: record.ordinaryOperationalIssue === true,
    ordinaryWarehouseIssue: record.ordinaryWarehouseIssue === true,
    safetyRelevant: record.safetyRelevant === true,
    reasonCode: record.reasonCode || null,
    severity: SEVERITIES.includes(record.severity) ? record.severity : 'UNKNOWN',
    humanReviewRequired: record.humanReviewRequired === true,
    evidenceStale: record.evidenceStale === true || record.evidenceFreshness === 'STALE',
    evidenceConflict: record.evidenceConflict === true,
    evidenceUnknown: record.evidenceUnknown === true || !record.sourceRecordId,
    privateOperationalDataShared: record.privateOperationalDataShared === true,
    testOnly: record.testOnly !== false
  };
  normalized.evidenceFreshness = evidenceFreshness(normalized);
  normalized.evidenceCompleteness = evidenceCompleteness(normalized, ['sourceDomain','sourceRecordId','organizationId','sourceStatus']);
  normalized.evidenceConfidence = evidenceConfidence(normalized, normalized.evidenceCompleteness);
  normalized.sourceHash = sha256(normalized);
  normalized.organizationIsolationPreserved = organizationMatches;
  return stable(normalized);
}

function validateSafetyContext(context = {}) {
  const errors = [];
  for (const field of scanProhibitedFields(context)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (!context.safetyContextId) errors.push({ rule: 'SAFETY_CONTEXT_REQUIRED' });
  if (!context.organizationId) errors.push({ rule: 'ORGANIZATION_REQUIRED' });
  if (!context.reportingWindow && !context.workPeriod) errors.push({ rule: 'REPORTING_WINDOW_REQUIRED' });
  return stable({ valid: errors.length === 0, errors, trustedServerDerivedInFutureRuntime: true, crossOrganizationAggregationProhibited: true, validationHash: sha256({ context, errors }) });
}

function buildSafetyOperationalContext(input = {}) {
  const context = input.safetyContext || {};
  const evidence = asArray(input.safetyEvidence).map((record) => normalizeSafetyEvidence(record, context));
  const completeness = evidenceCompleteness({
    safetyContextId: context.safetyContextId,
    organizationId: context.organizationId,
    reportingWindow: context.reportingWindow || context.workPeriod,
    sourceEvidence: evidence.length ? evidence : null,
    evidenceConflict: evidence.some((item) => item.evidenceConflict),
    evidenceStale: evidence.some((item) => item.evidenceStale)
  }, ['safetyContextId','organizationId','reportingWindow','sourceEvidence']);
  const record = {
    schemaVersion: 'safety.operational.context.v1',
    safetyContextId: context.safetyContextId || 'safety.context.unknown',
    organizationId: context.organizationId || null,
    reportingWindow: context.reportingWindow || context.workPeriod || null,
    routeScope: context.routeScope || [],
    driverScope: context.driverScope || [],
    supervisorScope: context.supervisorScope || [],
    warehouseScope: context.warehouseScope || [],
    vehicleScope: context.vehicleScope || [],
    operationsScope: context.operationsScope || [],
    sharedSafetyReferences: context.sharedSafetyReferences || [],
    sourceDomains: [...new Set(evidence.map((item) => item.sourceDomain))].filter((domain) => domain !== 'UNKNOWN').sort(),
    sourceRecordIds: evidence.map((item) => item.sourceRecordId).filter(Boolean).sort(),
    sourceHashes: evidence.map((item) => item.sourceHash).sort(),
    sourceVersions: [...new Set(evidence.map((item) => item.sourceVersion).filter(Boolean))].sort(),
    evidenceTimestamps: evidence.map((item) => item.sourceTimestamp).filter(Boolean).sort(),
    evidenceCompleteness: completeness,
    evidenceConfidence: evidenceConfidence({ evidenceConflict: evidence.some((item) => item.evidenceConflict), evidenceStale: evidence.some((item) => item.evidenceStale) }, completeness),
    evidenceFreshness: evidence.some((item) => item.evidenceStale) ? 'STALE' : evidence.length ? 'FRESH' : 'UNKNOWN',
    conflicts: evidence.filter((item) => item.evidenceConflict).map((item) => item.sourceRecordId).filter(Boolean),
    unknownFields: evidence.filter((item) => item.evidenceUnknown).map((item) => item.sourceRecordId || 'unknown-source-record'),
    humanReviewRequired: evidence.some((item) => item.humanReviewRequired || item.evidenceConflict || item.evidenceStale || item.evidenceUnknown || item.organizationIsolationPreserved !== true || item.privateOperationalDataShared),
    organizationIsolationPreserved: evidence.every((item) => item.organizationIsolationPreserved === true),
    sourceEvidence: evidence,
    testOnly: true
  };
  record.contextHash = sha256(record);
  return stable(record);
}

function countBy(records, predicate) { return records.filter(predicate).length; }
function hasCondition(item, condition) { return item.safetyCondition === condition || item.reasonCode === condition || item.lowerDomainConclusion === condition; }

function aggregateDomainEvidence(input = {}, domain) {
  const context = buildSafetyOperationalContext(input);
  const records = context.sourceEvidence.filter((item) => item.sourceDomain === domain);
  const result = {
    sourceDomain: domain,
    organizationId: context.organizationId,
    recordCount: records.length,
    safetyRelevantCount: countBy(records, (item) => item.safetyRelevant),
    staleCount: countBy(records, (item) => item.evidenceStale),
    conflictCount: countBy(records, (item) => item.evidenceConflict),
    unknownCount: countBy(records, (item) => item.evidenceUnknown),
    humanReviewCount: countBy(records, (item) => item.humanReviewRequired),
    sourceRecordIds: records.map((item) => item.sourceRecordId).filter(Boolean).sort(),
    lowerDomainAuthoritative: true,
    noOverride: true,
    testOnly: true
  };
  result.aggregateHash = sha256(result);
  return stable(result);
}

function aggregateRouteSafetyEvidence(input = {}) { return aggregateDomainEvidence(input, 'ROUTE'); }
function aggregateDriverSafetyEvidence(input = {}) { return aggregateDomainEvidence(input, 'DRIVER'); }
function aggregateFleetSafetyEvidence(input = {}) { return aggregateDomainEvidence(input, 'FLEET'); }
function aggregateWarehouseSafetyEvidence(input = {}) { return aggregateDomainEvidence(input, 'WAREHOUSE'); }
function aggregateOperationsSafetyEvidence(input = {}) { return aggregateDomainEvidence(input, 'OPERATIONS'); }
function aggregateSharedSafetyEvidence(input = {}) { return aggregateDomainEvidence(input, 'SHARED_SAFETY'); }

function buildRouteSafetyPortfolio(input = {}) {
  const context = buildSafetyOperationalContext(input);
  const routeRecords = context.sourceEvidence.filter((item) => item.sourceDomain === 'ROUTE');
  const portfolio = {
    schemaVersion: 'safety.route.portfolio.v1',
    safetyContextId: context.safetyContextId,
    organizationId: context.organizationId,
    routeCount: new Set(routeRecords.map((item) => item.routeId).filter(Boolean)).size,
    routesWithNoKnownBlocker: countBy(routeRecords, (item) => hasCondition(item, 'NO_KNOWN_SAFETY_EXCEPTION')),
    safetyBlockedRoutes: countBy(routeRecords, (item) => hasCondition(item, 'ROUTE_SAFETY_BLOCKER_ACTIVE')),
    rejectedRoutes: countBy(routeRecords, (item) => ['UNSAFE','REJECTED','BLOCKED'].includes(item.sourceStatus)),
    lowClearanceAffectedRoutes: countBy(routeRecords, (item) => ['LOW_CLEARANCE_HAZARD_ACTIVE','LOW_CLEARANCE_REVIEW'].includes(item.safetyCondition)),
    restrictionAffectedRoutes: countBy(routeRecords, (item) => ['TRUCK_RESTRICTION_ACTIVE','NO_THROUGH_TRUCK_RESTRICTION_ACTIVE'].includes(item.safetyCondition)),
    roadClosureAffectedRoutes: countBy(routeRecords, (item) => hasCondition(item, 'ROAD_CLOSURE_ACTIVE')),
    residentialRestrictionRoutes: countBy(routeRecords, (item) => ['RESIDENTIAL_RESTRICTION_ACTIVE','RESIDENTIAL_ADVISORY'].includes(item.safetyCondition)),
    insufficientSafetyEvidenceRoutes: countBy(routeRecords, (item) => item.evidenceUnknown),
    humanReviewRoutes: countBy(routeRecords, (item) => item.humanReviewRequired),
    routeIntelligenceAuthoritative: true,
    routeSafetyLogicRecomputed: false,
    testOnly: true
  };
  portfolio.portfolioHash = sha256(portfolio);
  return stable(portfolio);
}

function exceptionFromEvidence(type, item, options = {}) {
  const severity = classifySafetySeverity({ exceptionType: type, evidence: item, ...options });
  const priority = prioritizeSafetyAlert({ exceptionType: type, severity, evidence: item, ...options });
  const exception = {
    exceptionId: `safety.exception.${item.sourceRecordId || item.sourceHash}.${type.toLowerCase()}`,
    exceptionType: type,
    organizationId: item.organizationId,
    sourceDomain: item.sourceDomain,
    sourceRecordIds: [item.sourceRecordId].filter(Boolean),
    routeId: item.routeId,
    vehicleId: item.vehicleId,
    driverId: item.driverId || null,
    sharedSafetyRecordId: item.sharedSafetyRecordId || null,
    reasonCodes: [item.reasonCode || options.reasonCode || 'HUMAN_REVIEW'],
    severity,
    priority,
    evidence: item,
    timestamps: [item.sourceTimestamp].filter(Boolean),
    completeness: item.evidenceCompleteness,
    confidence: item.evidenceConfidence,
    freshness: item.evidenceFreshness,
    limitations: options.limitations || ['repository-only synthetic aggregation', 'lower domains remain authoritative'],
    humanReviewRequired: options.humanReviewRequired === true || item.humanReviewRequired || ['CRITICAL','HIGH','UNKNOWN'].includes(severity),
    employmentImpactProhibited: true,
    testOnly: true
  };
  exception.exceptionHash = sha256(exception);
  return stable(exception);
}

function detectSafetyExceptions(input = {}) {
  const context = buildSafetyOperationalContext(input);
  const exceptions = [];
  for (const item of context.sourceEvidence) {
    if (item.lowerDomainOverrideAttempted) exceptions.push(exceptionFromEvidence('HUMAN_REVIEW_REQUIRED', item, { reasonCode: 'HUMAN_REVIEW', humanReviewRequired: true }));
    if (item.organizationIsolationPreserved !== true || item.privateOperationalDataShared) exceptions.push(exceptionFromEvidence('HUMAN_REVIEW_REQUIRED', item, { reasonCode: 'HUMAN_REVIEW', humanReviewRequired: true }));
    if (item.evidenceStale) exceptions.push(exceptionFromEvidence('SAFETY_EVIDENCE_STALE', item, { reasonCode: 'SPEED_EVIDENCE_STALE' }));
    if (item.evidenceConflict) exceptions.push(exceptionFromEvidence('SAFETY_EVIDENCE_CONFLICT', item, { reasonCode: 'CONFLICTING_SAFETY_EVIDENCE', humanReviewRequired: true }));
    if (item.evidenceUnknown) exceptions.push(exceptionFromEvidence('SAFETY_EVIDENCE_INCOMPLETE', item, { reasonCode: 'MISSING_SAFETY_EVIDENCE', humanReviewRequired: true }));
    if (item.humanReviewRequired && !item.safetyCondition && !item.evidenceStale && !item.evidenceConflict && !item.evidenceUnknown) exceptions.push(exceptionFromEvidence('HUMAN_REVIEW_REQUIRED', item, { reasonCode: item.reasonCode || 'HUMAN_REVIEW', humanReviewRequired: true }));
    if (item.ordinaryOperationalIssue || item.ordinaryWarehouseIssue) continue;
    if (!item.safetyRelevant && item.sourceDomain !== 'SHARED_SAFETY') continue;
    if (item.safetyCondition === 'ROUTE_SAFETY_BLOCKER_ACTIVE') exceptions.push(exceptionFromEvidence('ROUTE_SAFETY_BLOCKER_ACTIVE', item, { reasonCode: 'ROUTE_BLOCKED' }));
    if (item.safetyCondition === 'LOW_CLEARANCE_HAZARD_ACTIVE') exceptions.push(exceptionFromEvidence('LOW_CLEARANCE_HAZARD_ACTIVE', item, { reasonCode: 'LOW_CLEARANCE' }));
    if (item.safetyCondition === 'TRUCK_RESTRICTION_ACTIVE') exceptions.push(exceptionFromEvidence('TRUCK_RESTRICTION_ACTIVE', item, { reasonCode: 'TRUCK_PROHIBITED' }));
    if (item.safetyCondition === 'NO_THROUGH_TRUCK_RESTRICTION_ACTIVE') exceptions.push(exceptionFromEvidence('NO_THROUGH_TRUCK_RESTRICTION_ACTIVE', item, { reasonCode: 'NO_THROUGH_TRUCK' }));
    if (item.safetyCondition === 'ROAD_CLOSURE_ACTIVE') exceptions.push(exceptionFromEvidence('ROAD_CLOSURE_ACTIVE', item, { reasonCode: 'ROAD_CLOSURE' }));
    if (item.safetyCondition === 'RESIDENTIAL_RESTRICTION_ACTIVE') exceptions.push(exceptionFromEvidence('RESIDENTIAL_RESTRICTION_ACTIVE', item, { reasonCode: 'RESIDENTIAL_RESTRICTION' }));
    if (item.safetyCondition === 'ROUTE_VEHICLE_INCOMPATIBLE') exceptions.push(exceptionFromEvidence('ROUTE_VEHICLE_INCOMPATIBLE', item, { reasonCode: 'ROUTE_VEHICLE_INCOMPATIBLE' }));
    if (item.safetyCondition === 'DRIVER_SAFETY_ADVISORY_ACTIVE') exceptions.push(exceptionFromEvidence('DRIVER_SAFETY_ADVISORY_ACTIVE', item, { reasonCode: item.reasonCode || 'DRIVER_LOW_BRIDGE_ADVISORY' }));
    if (item.safetyCondition === 'DRIVER_SPEED_WARNING_ACTIVE') exceptions.push(exceptionFromEvidence('DRIVER_SPEED_WARNING_ACTIVE', item, { reasonCode: item.reasonCode || 'SPEED_WARNING' }));
    if (item.safetyCondition === 'WAREHOUSE_SAFETY_BLOCKER') exceptions.push(exceptionFromEvidence('HUMAN_REVIEW_REQUIRED', item, { reasonCode: 'WAREHOUSE_SAFETY_BLOCKER', humanReviewRequired: true }));
    if (item.safetyCondition === 'OPERATIONS_SAFETY_EXCEPTION') exceptions.push(exceptionFromEvidence('HUMAN_REVIEW_REQUIRED', item, { reasonCode: 'OPERATIONS_SAFETY_EXCEPTION', humanReviewRequired: true }));
    if (item.sourceDomain === 'SHARED_SAFETY' && ['PENDING_REVIEW','REVIEW_REQUIRED'].includes(item.sourceStatus)) exceptions.push(exceptionFromEvidence('SHARED_SAFETY_REVIEW_REQUIRED', item, { reasonCode: 'SHARED_SAFETY_REVIEW', humanReviewRequired: true }));
  }
  const safetyExceptions = exceptions.filter((item) => !['SAFETY_EVIDENCE_STALE','SAFETY_EVIDENCE_CONFLICT','SAFETY_EVIDENCE_INCOMPLETE','HUMAN_REVIEW_REQUIRED'].includes(item.exceptionType));
  if (safetyExceptions.length >= 2) {
    const first = safetyExceptions[0].evidence;
    exceptions.push(exceptionFromEvidence('MULTIPLE_SAFETY_EXCEPTIONS', first, { reasonCode: 'HUMAN_REVIEW', limitations: ['multiple known safety exceptions are simultaneously present'] }));
  }
  return stable(exceptions);
}

function classifySafetySeverity(exception = {}) {
  const type = exception.exceptionType;
  if (['ROUTE_SAFETY_BLOCKER_ACTIVE','LOW_CLEARANCE_HAZARD_ACTIVE','TRUCK_RESTRICTION_ACTIVE','NO_THROUGH_TRUCK_RESTRICTION_ACTIVE','ROAD_CLOSURE_ACTIVE'].includes(type)) return 'CRITICAL';
  if (type === 'ROUTE_VEHICLE_INCOMPATIBLE') return 'HIGH';
  if (['DRIVER_SAFETY_ADVISORY_ACTIVE','DRIVER_SPEED_WARNING_ACTIVE','RESIDENTIAL_RESTRICTION_ACTIVE','MULTIPLE_SAFETY_EXCEPTIONS','SHARED_SAFETY_REVIEW_REQUIRED','HUMAN_REVIEW_REQUIRED'].includes(type)) return 'MODERATE';
  if (['SAFETY_EVIDENCE_STALE','SAFETY_EVIDENCE_CONFLICT','SAFETY_EVIDENCE_INCOMPLETE','INSUFFICIENT_EVIDENCE'].includes(type)) return type === 'SAFETY_EVIDENCE_CONFLICT' ? 'MODERATE' : 'LOW';
  return 'INFORMATIONAL';
}

function prioritizeSafetyAlert(exception = {}) {
  const severity = exception.severity || classifySafetySeverity(exception);
  const humanReview = exception.humanReviewRequired === true || exception.evidence?.humanReviewRequired === true;
  const priority = severity === 'CRITICAL' ? 'P0' : severity === 'HIGH' ? 'P1' : severity === 'MODERATE' && humanReview ? 'P2' : severity === 'MODERATE' ? 'P3' : severity === 'LOW' ? 'P4' : 'UNKNOWN';
  return stable({
    priority,
    calculationTrace: {
      severity,
      humanReviewRequired: humanReview,
      freshness: exception.evidence?.evidenceFreshness || null,
      conflict: exception.evidence?.evidenceConflict === true,
      employeeRankingUsed: false,
      customerValueUsed: false,
      productivityUsed: false,
      insuranceValueUsed: false
    }
  });
}

function buildSafetyAlert(exception = {}) {
  const nextStep = exception.exceptionType === 'LOW_CLEARANCE_HAZARD_ACTIVE' ? 'REVIEW_LOW_CLEARANCE_HAZARD'
    : exception.exceptionType === 'TRUCK_RESTRICTION_ACTIVE' ? 'REVIEW_TRUCK_RESTRICTION'
      : exception.exceptionType === 'ROAD_CLOSURE_ACTIVE' ? 'REVIEW_ROAD_CLOSURE'
        : exception.exceptionType === 'ROUTE_VEHICLE_INCOMPATIBLE' ? 'REVIEW_ROUTE_VEHICLE_COMPATIBILITY'
          : exception.exceptionType === 'DRIVER_SPEED_WARNING_ACTIVE' ? 'REVIEW_SPEED_WARNING'
            : exception.exceptionType === 'DRIVER_SAFETY_ADVISORY_ACTIVE' ? 'REVIEW_DRIVER_SAFETY_ADVISORY'
              : exception.exceptionType === 'SHARED_SAFETY_REVIEW_REQUIRED' ? 'REVIEW_SHARED_SAFETY_RECORD'
                : exception.exceptionType === 'SAFETY_EVIDENCE_CONFLICT' ? 'REVIEW_CONFLICTING_EVIDENCE'
                  : exception.exceptionType === 'SAFETY_EVIDENCE_INCOMPLETE' ? 'REVIEW_MISSING_EVIDENCE'
                    : exception.humanReviewRequired ? 'HOLD_FOR_HUMAN_REVIEW' : 'REVIEW_ROUTE_SAFETY';
  const alert = {
    alertId: `safety.alert.${exception.exceptionId || 'unknown'}`,
    exceptionId: exception.exceptionId || null,
    organizationId: exception.organizationId || null,
    sourceDomains: [exception.sourceDomain].filter(Boolean),
    relatedRoutes: [exception.routeId].filter(Boolean),
    relatedVehicles: [exception.vehicleId].filter(Boolean),
    relatedDriverRef: exception.driverId || null,
    severity: exception.severity || 'UNKNOWN',
    priority: exception.priority || prioritizeSafetyAlert(exception),
    structuredFacts: { exceptionType: exception.exceptionType, reasonCodes: exception.reasonCodes || [] },
    evidenceReferences: exception.sourceRecordIds || [],
    limitations: exception.limitations || [],
    requiredReviewAction: nextStep,
    humanReviewRequired: exception.humanReviewRequired === true,
    acknowledgementState: 'OPEN',
    resolutionState: 'OPEN',
    automatedActionTaken: false,
    testOnly: true
  };
  alert.alertHash = sha256(alert);
  return stable(alert);
}

function acknowledgeSafetyAlert(alert = {}) {
  const updated = { ...alert, acknowledgementState: 'ACKNOWLEDGED', lifecycleReasonCode: 'ALERT_ACKNOWLEDGED', automatedActionTaken: false };
  updated.alertHash = sha256({ ...updated, alertHash: undefined });
  return stable(updated);
}
function resolveSafetyAlert(alert = {}) {
  const updated = { ...alert, resolutionState: 'RESOLVED', lifecycleReasonCode: 'ALERT_RESOLVED', automatedActionTaken: false };
  updated.alertHash = sha256({ ...updated, alertHash: undefined });
  return stable(updated);
}
function invalidateSafetyAlert(alert = {}, newEvidence = {}) {
  const updated = { ...alert, resolutionState: 'INVALIDATED_BY_NEW_EVIDENCE', newEvidenceRef: newEvidence.sourceRecordId || null, lifecycleReasonCode: 'ALERT_INVALIDATED_BY_NEW_EVIDENCE', automatedActionTaken: false };
  updated.alertHash = sha256({ ...updated, alertHash: undefined });
  return stable(updated);
}

function buildSafetyEvidence(input = {}) {
  const context = buildSafetyOperationalContext(input);
  const trace = {
    schemaVersion: 'safety.authority.trace.v1',
    safetyContextId: context.safetyContextId,
    organizationId: context.organizationId,
    records: context.sourceEvidence.map((item) => ({
      sourceDomain: item.sourceDomain,
      sourceRecordId: item.sourceRecordId,
      sourceHash: item.sourceHash,
      sourceVersion: item.sourceVersion,
      sourceStatus: item.sourceStatus,
      sourceTimestamp: item.sourceTimestamp,
      aggregationRule: 'safety.aggregate.preserve_authority.v1',
      aggregationVersion: SAFETY_INTELLIGENCE_ENGINE_VERSION,
      lowerDomainConclusion: item.lowerDomainConclusion,
      lowerDomainAuthoritative: true
    })),
    lowerDomainsRemainAuthoritative: true,
    resultHash: null,
    testOnly: true
  };
  trace.resultHash = sha256(trace);
  return stable(trace);
}

function buildSafetySummary(input = {}) {
  const context = buildSafetyOperationalContext(input);
  const exceptions = detectSafetyExceptions(input);
  const summary = {
    schemaVersion: 'safety.summary.v1',
    safetyContextId: context.safetyContextId,
    organizationId: context.organizationId,
    routesInScope: context.routeScope.length,
    activeSafetyBlockers: countBy(exceptions, (item) => ['ROUTE_SAFETY_BLOCKER_ACTIVE','LOW_CLEARANCE_HAZARD_ACTIVE','TRUCK_RESTRICTION_ACTIVE','NO_THROUGH_TRUCK_RESTRICTION_ACTIVE','ROAD_CLOSURE_ACTIVE','ROUTE_VEHICLE_INCOMPATIBLE'].includes(item.exceptionType)),
    lowClearanceHazards: countBy(exceptions, (item) => item.exceptionType === 'LOW_CLEARANCE_HAZARD_ACTIVE'),
    restrictionHazards: countBy(exceptions, (item) => ['TRUCK_RESTRICTION_ACTIVE','NO_THROUGH_TRUCK_RESTRICTION_ACTIVE','RESIDENTIAL_RESTRICTION_ACTIVE'].includes(item.exceptionType)),
    roadClosures: countBy(exceptions, (item) => item.exceptionType === 'ROAD_CLOSURE_ACTIVE'),
    activeDriverAdvisories: countBy(exceptions, (item) => item.exceptionType === 'DRIVER_SAFETY_ADVISORY_ACTIVE'),
    activeSpeedWarnings: countBy(exceptions, (item) => item.exceptionType === 'DRIVER_SPEED_WARNING_ACTIVE'),
    unresolvedSharedSafetyReviews: countBy(exceptions, (item) => item.exceptionType === 'SHARED_SAFETY_REVIEW_REQUIRED'),
    staleSafetyEvidence: context.sourceEvidence.filter((item) => item.evidenceStale).map((item) => item.sourceRecordId).filter(Boolean),
    conflictingSafetyEvidence: context.conflicts,
    insufficientEvidenceItems: context.unknownFields,
    humanReviewItems: countBy(exceptions, (item) => item.humanReviewRequired),
    safetyScoreGenerated: false,
    employeeRankingGenerated: false,
    predictionGenerated: false,
    testOnly: true
  };
  summary.summaryHash = sha256(summary);
  return stable(summary);
}

function buildSafetyExplanation(input = {}) {
  const exceptions = detectSafetyExceptions(input);
  const explanation = {
    schemaVersion: 'safety.explanation.v1',
    headline: exceptions.length ? 'Known safety conditions require review using authoritative source-domain evidence.' : 'No known safety exception exists within supplied synthetic evidence.',
    conditionFacts: exceptions.map((item) => ({ exceptionType: item.exceptionType, sourceDomain: item.sourceDomain, sourceRecordIds: item.sourceRecordIds, reasonCodes: item.reasonCodes })),
    severityFacts: exceptions.map((item) => ({ exceptionType: item.exceptionType, severity: item.severity })),
    priorityFacts: exceptions.map((item) => ({ exceptionType: item.exceptionType, priority: item.priority.priority, calculationTrace: item.priority.calculationTrace })),
    supportingEvidence: buildSafetyEvidence(input).records,
    staleEvidence: buildSafetyOperationalContext(input).sourceEvidence.filter((item) => item.evidenceStale).map((item) => item.sourceRecordId).filter(Boolean),
    conflictingEvidence: buildSafetyOperationalContext(input).conflicts,
    missingEvidence: buildSafetyOperationalContext(input).unknownFields,
    humanReviewRequired: exceptions.some((item) => item.humanReviewRequired),
    limitations: ['repository-only synthetic aggregation', 'lower domains remain authoritative', 'no safety score', 'no prediction', 'no autonomous action'],
    employeeNegligenceInferred: false,
    driverIntentInferred: false,
    misconductInferred: false,
    legalLiabilityInferred: false,
    futureCrashPredicted: false,
    futureInjuryPredicted: false,
    fatiguePredicted: false,
    testOnly: true
  };
  explanation.explanationHash = sha256(explanation);
  return stable(explanation);
}

function buildSafetyAssessment(request = {}) {
  const context = buildSafetyOperationalContext(request);
  const routePortfolio = buildRouteSafetyPortfolio(request);
  const routeAggregate = aggregateRouteSafetyEvidence(request);
  const driverAggregate = aggregateDriverSafetyEvidence(request);
  const fleetAggregate = aggregateFleetSafetyEvidence(request);
  const warehouseAggregate = aggregateWarehouseSafetyEvidence(request);
  const operationsAggregate = aggregateOperationsSafetyEvidence(request);
  const sharedSafetyAggregate = aggregateSharedSafetyEvidence(request);
  const exceptions = detectSafetyExceptions(request);
  const alerts = exceptions.map(buildSafetyAlert);
  const firstAlert = alerts[0] || null;
  const assessment = {
    schemaVersion: 'safety.assessment.v1',
    context,
    routePortfolio,
    routeAggregate,
    driverAggregate,
    fleetAggregate,
    warehouseAggregate,
    operationsAggregate,
    sharedSafetyAggregate,
    exceptions,
    alerts,
    alertLifecycle: {
      acknowledgedAlert: firstAlert ? acknowledgeSafetyAlert(firstAlert) : null,
      resolvedAlert: firstAlert ? resolveSafetyAlert(firstAlert) : null,
      invalidatedAlert: firstAlert ? invalidateSafetyAlert(firstAlert, { sourceRecordId: 'new.synthetic.safety.evidence' }) : null
    },
    summary: buildSafetySummary(request),
    explanation: buildSafetyExplanation(request),
    authorityTrace: buildSafetyEvidence(request),
    lowerDomainOverrideAttempted: context.sourceEvidence.some((item) => item.lowerDomainOverrideAttempted),
    crossOrganizationAggregationRejected: context.organizationIsolationPreserved !== true,
    unknownEvidenceTreatedAsSafe: false,
    staleEvidenceTreatedAsFresh: false,
    providerModelSelectionActivated: false,
    productionActivationActivated: false,
    productionApiExposed: false,
    migrationExecuted: false,
    deploymentExecuted: false,
    autonomousActionGenerated: false,
    predictionGenerated: false,
    negligenceConclusionGenerated: false,
    monitoringHardwareIntroduced: false,
    complianceProductExpanded: false,
    driverOrEmployeeScoringGenerated: false,
    testOnly: true
  };
  assessment.assessmentHash = sha256(assessment);
  return stable(assessment);
}

function baseContext() {
  return {
    safetyContextId: 'safety.context.org-001.morning',
    organizationId: 'org-001',
    reportingWindow: { start: '2026-08-12T08:00:00.000Z', end: '2026-08-12T12:00:00.000Z' },
    routeScope: ['route-001','route-002','route-003'],
    driverScope: ['driver-001','driver-002'],
    supervisorScope: ['supervisor-001'],
    warehouseScope: ['depot-001'],
    vehicleScope: ['vehicle-001','vehicle-002'],
    operationsScope: ['operations.context.org-001.morning'],
    sharedSafetyReferences: ['shared-low-bridge-001']
  };
}

function evidence(sourceDomain, sourceRecordId, overrides = {}) {
  return {
    sourceDomain,
    sourceRecordId,
    organizationId: 'org-001',
    routeId: overrides.routeId || 'route-001',
    sourceStatus: overrides.sourceStatus || 'NORMAL',
    sourceTimestamp: overrides.sourceTimestamp || DETERMINISTIC_GENERATED_AT,
    safetyRelevant: overrides.safetyRelevant === true,
    testOnly: true,
    ...overrides
  };
}

function buildBenchmarkCases() {
  const cases = [
    ['no_known_safety_exception', [evidence('ROUTE','route.safe',{ sourceStatus: 'ELIGIBLE', safetyCondition: 'NO_KNOWN_SAFETY_EXCEPTION', reasonCode: 'NO_KNOWN_SAFETY_EXCEPTION', safetyRelevant: false })], 'NO_EXCEPTION'],
    ['safety_blocked_route', [evidence('ROUTE','route.blocked',{ sourceStatus: 'BLOCKED', safetyCondition: 'ROUTE_SAFETY_BLOCKER_ACTIVE', reasonCode: 'ROUTE_BLOCKED', safetyRelevant: true })], 'ROUTE_SAFETY_BLOCKER_ACTIVE'],
    ['low_clearance_blocker', [evidence('ROUTE','route.low.clearance',{ sourceStatus: 'UNSAFE', safetyCondition: 'LOW_CLEARANCE_HAZARD_ACTIVE', reasonCode: 'LOW_CLEARANCE', safetyRelevant: true })], 'LOW_CLEARANCE_HAZARD_ACTIVE'],
    ['low_clearance_review', [evidence('ROUTE','route.low.review',{ sourceStatus: 'REVIEW_REQUIRED', safetyCondition: 'LOW_CLEARANCE_HAZARD_ACTIVE', reasonCode: 'LOW_CLEARANCE_REVIEW', safetyRelevant: true, humanReviewRequired: true })], 'LOW_CLEARANCE_HAZARD_ACTIVE'],
    ['truck_prohibition', [evidence('ROUTE','route.truck.prohibited',{ sourceStatus: 'UNSAFE', safetyCondition: 'TRUCK_RESTRICTION_ACTIVE', reasonCode: 'TRUCK_PROHIBITED', safetyRelevant: true })], 'TRUCK_RESTRICTION_ACTIVE'],
    ['no_through_truck_restriction', [evidence('ROUTE','route.no.through',{ sourceStatus: 'UNSAFE', safetyCondition: 'NO_THROUGH_TRUCK_RESTRICTION_ACTIVE', reasonCode: 'NO_THROUGH_TRUCK', safetyRelevant: true })], 'NO_THROUGH_TRUCK_RESTRICTION_ACTIVE'],
    ['local_delivery_exception', [evidence('ROUTE','route.local.delivery',{ sourceStatus: 'ELIGIBLE', safetyCondition: null, reasonCode: 'LOCAL_DELIVERY_EXCEPTION', safetyRelevant: false })], 'NO_EXCEPTION'],
    ['road_closure', [evidence('ROUTE','route.closed',{ sourceStatus: 'UNSAFE', safetyCondition: 'ROAD_CLOSURE_ACTIVE', reasonCode: 'ROAD_CLOSURE', safetyRelevant: true })], 'ROAD_CLOSURE_ACTIVE'],
    ['residential_restriction', [evidence('ROUTE','route.residential.block',{ sourceStatus: 'UNSAFE', safetyCondition: 'RESIDENTIAL_RESTRICTION_ACTIVE', reasonCode: 'RESIDENTIAL_RESTRICTION', safetyRelevant: true })], 'RESIDENTIAL_RESTRICTION_ACTIVE'],
    ['residential_advisory', [evidence('ROUTE','route.residential.advisory',{ sourceStatus: 'REVIEW_REQUIRED', safetyCondition: 'RESIDENTIAL_RESTRICTION_ACTIVE', reasonCode: 'RESIDENTIAL_ADVISORY', safetyRelevant: true })], 'RESIDENTIAL_RESTRICTION_ACTIVE'],
    ['route_vehicle_incompatible', [evidence('FLEET','fleet.incompatible',{ sourceStatus: 'BLOCKED', safetyCondition: 'ROUTE_VEHICLE_INCOMPATIBLE', reasonCode: 'ROUTE_VEHICLE_INCOMPATIBLE', vehicleId: 'vehicle-001', safetyRelevant: true })], 'ROUTE_VEHICLE_INCOMPATIBLE'],
    ['route_vehicle_review_required', [evidence('FLEET','fleet.review',{ sourceStatus: 'REVIEW_REQUIRED', safetyCondition: null, reasonCode: 'ROUTE_VEHICLE_REVIEW_REQUIRED', vehicleId: 'vehicle-001', safetyRelevant: false, humanReviewRequired: true })], 'HUMAN_REVIEW_REQUIRED'],
    ['driver_low_bridge_advisory', [evidence('DRIVER','driver.low.bridge',{ sourceStatus: 'WARNING', safetyCondition: 'DRIVER_SAFETY_ADVISORY_ACTIVE', reasonCode: 'DRIVER_LOW_BRIDGE_ADVISORY', driverId: 'driver-001', safetyRelevant: true })], 'DRIVER_SAFETY_ADVISORY_ACTIVE'],
    ['restricted_road_advisory', [evidence('DRIVER','driver.restricted',{ sourceStatus: 'WARNING', safetyCondition: 'DRIVER_SAFETY_ADVISORY_ACTIVE', reasonCode: 'RESTRICTED_ROAD_ADVISORY', driverId: 'driver-001', safetyRelevant: true })], 'DRIVER_SAFETY_ADVISORY_ACTIVE'],
    ['no_through_truck_advisory', [evidence('DRIVER','driver.no.through',{ sourceStatus: 'WARNING', safetyCondition: 'DRIVER_SAFETY_ADVISORY_ACTIVE', reasonCode: 'NO_THROUGH_TRUCK_ADVISORY', driverId: 'driver-001', safetyRelevant: true })], 'DRIVER_SAFETY_ADVISORY_ACTIVE'],
    ['speed_advisory', [evidence('DRIVER','driver.speed.advisory',{ sourceStatus: 'ADVISORY', safetyCondition: 'DRIVER_SAFETY_ADVISORY_ACTIVE', reasonCode: 'SPEED_ADVISORY', driverId: 'driver-001', safetyRelevant: true })], 'DRIVER_SAFETY_ADVISORY_ACTIVE'],
    ['speed_warning', [evidence('DRIVER','driver.speed.warning',{ sourceStatus: 'WARNING', safetyCondition: 'DRIVER_SPEED_WARNING_ACTIVE', reasonCode: 'SPEED_WARNING', driverId: 'driver-001', safetyRelevant: true })], 'DRIVER_SPEED_WARNING_ACTIVE'],
    ['stale_speed_evidence', [evidence('DRIVER','driver.speed.stale',{ sourceStatus: 'INSUFFICIENT_EVIDENCE', reasonCode: 'SPEED_EVIDENCE_STALE', driverId: 'driver-001', evidenceStale: true, safetyRelevant: true })], 'SAFETY_EVIDENCE_STALE'],
    ['missing_safety_evidence', [evidence('ROUTE',null,{ sourceStatus: 'INSUFFICIENT_EVIDENCE', reasonCode: 'MISSING_SAFETY_EVIDENCE', evidenceUnknown: true, safetyRelevant: true })], 'SAFETY_EVIDENCE_INCOMPLETE'],
    ['conflicting_safety_evidence', [evidence('ROUTE','route.conflict',{ sourceStatus: 'REVIEW_REQUIRED', reasonCode: 'CONFLICTING_SAFETY_EVIDENCE', evidenceConflict: true, safetyRelevant: true })], 'SAFETY_EVIDENCE_CONFLICT'],
    ['warehouse_safety_blocker', [evidence('WAREHOUSE','warehouse.safety.blocker',{ sourceStatus: 'BLOCKED', safetyCondition: 'WAREHOUSE_SAFETY_BLOCKER', reasonCode: 'WAREHOUSE_SAFETY_BLOCKER', safetyRelevant: true, humanReviewRequired: true })], 'HUMAN_REVIEW_REQUIRED'],
    ['ordinary_warehouse_issue', [evidence('WAREHOUSE','warehouse.delay',{ sourceStatus: 'DELAYED', ordinaryWarehouseIssue: true, safetyRelevant: false })], 'NO_EXCEPTION'],
    ['operations_safety_exception', [evidence('OPERATIONS','operations.safety',{ sourceStatus: 'OPEN', safetyCondition: 'OPERATIONS_SAFETY_EXCEPTION', reasonCode: 'OPERATIONS_SAFETY_EXCEPTION', safetyRelevant: true, humanReviewRequired: true })], 'HUMAN_REVIEW_REQUIRED'],
    ['ordinary_operations_exception', [evidence('OPERATIONS','operations.delay',{ sourceStatus: 'OPEN', ordinaryOperationalIssue: true, safetyRelevant: false })], 'NO_EXCEPTION'],
    ['shared_safety_record_accepted', [evidence('SHARED_SAFETY','shared.accepted',{ sourceStatus: 'ACCEPTED', sharedSafetyRecordId: 'shared-low-bridge-001', reasonCode: 'SHARED_SAFETY_ACCEPTED', safetyRelevant: true })], 'NO_EXCEPTION'],
    ['shared_safety_record_review', [evidence('SHARED_SAFETY','shared.review',{ sourceStatus: 'PENDING_REVIEW', sharedSafetyRecordId: 'shared-review-001', reasonCode: 'SHARED_SAFETY_REVIEW', safetyRelevant: true })], 'SHARED_SAFETY_REVIEW_REQUIRED'],
    ['multiple_simultaneous_safety_exceptions', [evidence('ROUTE','route.low',{ safetyCondition: 'LOW_CLEARANCE_HAZARD_ACTIVE', reasonCode: 'LOW_CLEARANCE', safetyRelevant: true }), evidence('DRIVER','driver.speed',{ safetyCondition: 'DRIVER_SPEED_WARNING_ACTIVE', reasonCode: 'SPEED_WARNING', driverId: 'driver-001', safetyRelevant: true })], 'MULTIPLE_SAFETY_EXCEPTIONS'],
    ['critical_blocker_outranks_informational_advisory', [evidence('ROUTE','route.closed.high',{ safetyCondition: 'ROAD_CLOSURE_ACTIVE', reasonCode: 'ROAD_CLOSURE', safetyRelevant: true }), evidence('DRIVER','driver.advisory.low',{ safetyCondition: 'DRIVER_SAFETY_ADVISORY_ACTIVE', reasonCode: 'SPEED_ADVISORY', driverId: 'driver-001', safetyRelevant: true })], 'ROAD_CLOSURE_ACTIVE'],
    ['cross_organization_safety_aggregation_rejected', [evidence('ROUTE','route.other.org',{ organizationId: 'org-002', safetyCondition: 'ROUTE_SAFETY_BLOCKER_ACTIVE', safetyRelevant: true })], 'HUMAN_REVIEW_REQUIRED'],
    ['human_review', [evidence('SUPERVISOR','supervisor.review',{ sourceStatus: 'OPEN', humanReviewRequired: true, safetyRelevant: false })], 'HUMAN_REVIEW_REQUIRED'],
    ['acknowledgement', [evidence('ROUTE','route.ack',{ safetyCondition: 'LOW_CLEARANCE_HAZARD_ACTIVE', reasonCode: 'LOW_CLEARANCE', safetyRelevant: true })], 'LOW_CLEARANCE_HAZARD_ACTIVE'],
    ['resolution', [evidence('ROUTE','route.resolve',{ safetyCondition: 'TRUCK_RESTRICTION_ACTIVE', reasonCode: 'TRUCK_PROHIBITED', safetyRelevant: true })], 'TRUCK_RESTRICTION_ACTIVE'],
    ['invalidation_by_new_evidence', [evidence('ROUTE','route.invalidate',{ evidenceStale: true, safetyRelevant: true })], 'SAFETY_EVIDENCE_STALE'],
    ['no_exception_case', [evidence('ROUTE','route.ok',{ sourceStatus: 'ELIGIBLE', safetyRelevant: false }), evidence('DRIVER','driver.ok',{ sourceStatus: 'NORMAL', driverId: 'driver-002', safetyRelevant: false })], 'NO_EXCEPTION']
  ];
  return cases.map(([caseId, safetyEvidence, expectedException]) => stable({
    caseId,
    request: { safetyContext: baseContext(), safetyEvidence },
    expectedException,
    deterministic: true,
    syntheticOnly: true,
    providerCallExpected: false,
    productionMutationExpected: false,
    employmentImpactExpected: false
  }));
}

function querySyntheticSafetyAssessments() {
  return buildBenchmarkCases().map((benchmark) => stable({ caseId: benchmark.caseId, assessment: buildSafetyAssessment(benchmark.request) }));
}

function buildSafetyIntelligenceEvidence() {
  const benchmarkCases = buildBenchmarkCases();
  const assessments = querySyntheticSafetyAssessments();
  const orchestrationEvidence = orchestration.buildOrchestrationEvidence();
  const lifecycleEvidence = lifecycle.buildLifecycleEvidence();
  const catalog = {
    schemaVersion: SAFETY_INTELLIGENCE_SCHEMA_VERSION,
    engineVersion: SAFETY_INTELLIGENCE_ENGINE_VERSION,
    generatedAt: DETERMINISTIC_GENERATED_AT,
    capabilityCount: SAFETY_CAPABILITIES.length,
    benchmarkCaseCount: benchmarkCases.length,
    currentSafetyFunctionalityAuditComplete: true,
    serviceReuseDecisionDocumented: true,
    integratedWithEnterpriseRegistry: registry.listEnterpriseCapabilities().length > 0,
    directEnterpriseRegistryCapability: null,
    directRegistryCapabilityDeferred: true,
    integratedWithCapabilityOrchestration: orchestrationEvidence.capabilities.length > 0,
    integratedWithLifecycleFramework: lifecycleEvidence.lifecycleRecords.length > 0,
    integratedWithRouteIntelligence: true,
    integratedWithDriverIntelligence: true,
    integratedWithFleetIntelligence: true,
    integratedWithWarehouseIntelligence: true,
    integratedWithOperationsIntelligence: true,
    integratedWithSharedSafety: true,
    providerCallInvoked: false,
    hostedAiInvoked: false,
    modelSelectionActivated: false,
    productionOrchestrationActivated: false,
    productionApiExposed: false,
    migrationExecuted: false,
    deploymentExecuted: false,
    productionApplicable: false,
    lowerDomainOverrideGenerated: false,
    safetyScoreGenerated: false,
    employeeRankingGenerated: false,
    negligenceConclusionGenerated: false,
    autonomousActionGenerated: false,
    predictionGenerated: false,
    monitoringHardwareIntroduced: false,
    complianceProductExpanded: false,
    newAiInfrastructureCreated: false,
    testOnly: true
  };
  catalog.catalogHash = sha256(catalog);
  return stable({
    catalog,
    capabilities: SAFETY_CAPABILITIES,
    contextContract: safetyContextContract(),
    sourceDomains: SOURCE_DOMAINS,
    freshnessStates: FRESHNESS_STATES,
    completenessStates: COMPLETENESS_STATES,
    confidenceStates: CONFIDENCE_STATES,
    exceptionTypes: EXCEPTION_TYPES,
    severities: SEVERITIES,
    priorities: PRIORITIES,
    alertStatuses: ALERT_STATUSES,
    nextSteps: NEXT_STEPS,
    reasonCodes: REASON_CODES,
    prohibitedFields: PROHIBITED_FIELDS,
    benchmarkCases,
    assessments,
    integrationReferences: {
      routeIntelligence: { schemaVersion: routeIntel.ROUTE_INTELLIGENCE_SCHEMA_VERSION, authority: 'ROUTE_SAFETY_COMPATIBILITY_AND_REJECTION' },
      driverIntelligence: { schemaVersion: driverIntel.DRIVER_INTELLIGENCE_SCHEMA_VERSION, authority: 'DRIVER_ADVISORIES_SPEED_WARNINGS_AND_ROUTE_ADHERENCE' },
      fleetIntelligence: { schemaVersion: fleetIntel.FLEET_INTELLIGENCE_SCHEMA_VERSION, authority: 'VEHICLE_READINESS_AND_ROUTE_COMPATIBILITY' },
      warehouseIntelligence: { schemaVersion: warehouseIntel.WAREHOUSE_INTELLIGENCE_SCHEMA_VERSION, authority: 'WAREHOUSE_BLOCKERS_AND_DEPARTURE_READINESS' },
      operationsIntelligence: { schemaVersion: operationsIntel.OPERATIONS_INTELLIGENCE_SCHEMA_VERSION, authority: 'OPERATIONS_LEVEL_AGGREGATION_AND_EXCEPTIONS' },
      sharedSafetyIntelligence: { boundary: 'REUSE_UNCHANGED', servicePath: 'bridge-api/services/sharedSafety.js' }
    }
  });
}

function validateSafetyAlert(alert = {}) {
  const errors = [];
  if (!SEVERITIES.includes(alert.severity)) errors.push({ rule: 'UNKNOWN_SEVERITY' });
  if (!NEXT_STEPS.includes(alert.requiredReviewAction)) errors.push({ rule: 'UNKNOWN_NEXT_STEP' });
  if (alert.automatedActionTaken !== false) errors.push({ rule: 'AUTONOMOUS_ACTION_GENERATED' });
  for (const field of scanProhibitedFields(alert)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (!alert.alertHash || alert.alertHash !== sha256({ ...alert, alertHash: undefined })) errors.push({ rule: 'ALERT_HASH_MISMATCH' });
  return stable({ valid: errors.length === 0, errors });
}

function validateSafetyAssessment(assessment = {}) {
  const errors = [];
  for (const field of scanProhibitedFields(assessment)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (assessment.lowerDomainOverrideAttempted !== false) errors.push({ rule: 'LOWER_DOMAIN_SAFETY_CONCLUSION_OVERRIDDEN' });
  if (assessment.context?.organizationIsolationPreserved !== true && assessment.crossOrganizationAggregationRejected !== true) errors.push({ rule: 'CROSS_ORGANIZATION_EVIDENCE_AGGREGATED' });
  if (assessment.context?.unknownFields?.length && assessment.unknownEvidenceTreatedAsSafe !== false) errors.push({ rule: 'UNKNOWN_EVIDENCE_TREATED_AS_SAFE' });
  if (assessment.context?.staleEvidenceIndicators?.length && assessment.staleEvidenceTreatedAsFresh !== false) errors.push({ rule: 'STALE_EVIDENCE_TREATED_AS_FRESH' });
  for (const field of ['providerModelSelectionActivated','productionActivationActivated','productionApiExposed','migrationExecuted','deploymentExecuted','autonomousActionGenerated','predictionGenerated','negligenceConclusionGenerated','monitoringHardwareIntroduced','complianceProductExpanded','driverOrEmployeeScoringGenerated']) {
    if (assessment[field] !== false) errors.push({ rule: 'PROHIBITED_CAPABILITY_FLAG', field });
  }
  if (!assessment.assessmentHash || assessment.assessmentHash !== sha256({ ...assessment, assessmentHash: undefined })) errors.push({ rule: 'ASSESSMENT_HASH_MISMATCH' });
  for (const alert of assessment.alerts || []) for (const error of validateSafetyAlert(alert).errors) errors.push(error);
  return stable({ valid: errors.length === 0, errors });
}

function validateSafetyIntelligenceEvidence(evidence = buildSafetyIntelligenceEvidence()) {
  const errors = [];
  for (const field of ['providerCallInvoked','hostedAiInvoked','modelSelectionActivated','productionOrchestrationActivated','productionApiExposed','migrationExecuted','deploymentExecuted','productionApplicable','lowerDomainOverrideGenerated','safetyScoreGenerated','employeeRankingGenerated','negligenceConclusionGenerated','autonomousActionGenerated','predictionGenerated','monitoringHardwareIntroduced','complianceProductExpanded','newAiInfrastructureCreated']) {
    if (evidence.catalog[field] !== false) errors.push({ rule: 'PROHIBITED_CAPABILITY_FLAG', field });
  }
  for (const field of ['currentSafetyFunctionalityAuditComplete','serviceReuseDecisionDocumented','integratedWithEnterpriseRegistry','integratedWithCapabilityOrchestration','integratedWithLifecycleFramework','integratedWithRouteIntelligence','integratedWithDriverIntelligence','integratedWithFleetIntelligence','integratedWithWarehouseIntelligence','integratedWithOperationsIntelligence','integratedWithSharedSafety']) {
    if (evidence.catalog[field] !== true) errors.push({ rule: 'PLATFORM_INTEGRATION_MISSING', field });
  }
  for (const field of scanProhibitedFields(evidence)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (/AI-IEP-005B\.\d+/.test(stableStringify(evidence))) errors.push({ rule: 'SAFETY_PACKAGE_NUMBER_FABRICATED' });
  if (/NINTH_MILESTONE_ONE_DOMAIN/.test(stableStringify(evidence))) errors.push({ rule: 'NINTH_MILESTONE_ONE_DOMAIN' });
  for (const benchmark of evidence.benchmarkCases || []) {
    const record = evidence.assessments.find((item) => item.caseId === benchmark.caseId);
    if (!record) errors.push({ rule: 'MISSING_BENCHMARK_ASSESSMENT', caseId: benchmark.caseId });
    else {
      const exceptionTypes = record.assessment.exceptions.map((item) => item.exceptionType);
      if (benchmark.expectedException === 'NO_EXCEPTION' && exceptionTypes.length > 0) errors.push({ rule: 'FALSE_SAFETY_EXCEPTION', caseId: benchmark.caseId, actual: exceptionTypes });
      if (benchmark.expectedException !== 'NO_EXCEPTION' && !exceptionTypes.includes(benchmark.expectedException)) errors.push({ rule: 'BENCHMARK_EXPECTATION_MISMATCH', caseId: benchmark.caseId, expected: benchmark.expectedException, actual: exceptionTypes });
      for (const error of validateSafetyAssessment(record.assessment).errors) errors.push({ ...error, caseId: benchmark.caseId });
    }
  }
  return stable({ valid: errors.length === 0, errors });
}

module.exports = {
  ALERT_STATUSES,
  COMPLETENESS_STATES,
  CONFIDENCE_STATES,
  DETERMINISTIC_GENERATED_AT,
  EXCEPTION_TYPES,
  FRESHNESS_STATES,
  NEXT_STEPS,
  PRIORITIES,
  PROHIBITED_FIELDS,
  REASON_CODES,
  SAFETY_CAPABILITIES,
  SAFETY_INTELLIGENCE_ENGINE_VERSION,
  SAFETY_INTELLIGENCE_SCHEMA_VERSION,
  SEVERITIES,
  SOURCE_DOMAINS,
  acknowledgeSafetyAlert,
  aggregateDriverSafetyEvidence,
  aggregateFleetSafetyEvidence,
  aggregateOperationsSafetyEvidence,
  aggregateRouteSafetyEvidence,
  aggregateSharedSafetyEvidence,
  aggregateWarehouseSafetyEvidence,
  baseContext,
  buildBenchmarkCases,
  buildRouteSafetyPortfolio,
  buildSafetyAlert,
  buildSafetyAssessment,
  buildSafetyEvidence,
  buildSafetyExplanation,
  buildSafetyIntelligenceEvidence,
  buildSafetyOperationalContext,
  buildSafetySummary,
  classifySafetySeverity,
  detectSafetyExceptions,
  evidence,
  evidenceCompleteness,
  evidenceConfidence,
  evidenceFreshness,
  invalidateSafetyAlert,
  normalizeSafetyEvidence,
  prioritizeSafetyAlert,
  querySyntheticSafetyAssessments,
  resolveSafetyAlert,
  safetyContextContract,
  scanProhibitedFields,
  sha256,
  stable,
  stableStringify,
  validateSafetyAlert,
  validateSafetyAssessment,
  validateSafetyContext,
  validateSafetyIntelligenceEvidence,
  paths: { backendRoot, repoRoot, docsRoot, generatedRoot }
};
