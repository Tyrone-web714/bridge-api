const path = require('path');
const governance = require('./decisionGovernance');
const registry = require('./enterpriseCapabilityRegistry');
const orchestration = require('./intelligenceCapabilityOrchestration');
const lifecycle = require('./intelligenceLifecycleFramework');
const routeIntel = require('./routeIntelligence');
const driverIntel = require('./driverIntelligence');
const supervisorIntel = require('./supervisorOperationalIntelligence');
const warehouseIntel = require('./warehouseIntelligence');
const fleetIntel = require('./fleetIntelligence');
const customerIntel = require('./customerIntelligence');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'implementation');
const generatedRoot = path.join(docsRoot, 'operations-intelligence-foundation', 'generated');
const OPERATIONS_INTELLIGENCE_SCHEMA_VERSION = 'operations.intelligence.foundation.v1';
const OPERATIONS_INTELLIGENCE_ENGINE_VERSION = 'operations.intelligence.foundation.engine.v1';
const DETERMINISTIC_GENERATED_AT = '2026-08-11T00:00:00.000Z';

const SOURCE_DOMAINS = Object.freeze(['ROUTE','DRIVER','SUPERVISOR','WAREHOUSE','FLEET','CUSTOMER']);
const EVIDENCE_FRESHNESS_STATES = Object.freeze(['FRESH','STALE','UNKNOWN','INSUFFICIENT_EVIDENCE']);
const EVIDENCE_COMPLETENESS_STATES = Object.freeze(['COMPLETE','PARTIAL','INSUFFICIENT','CONFLICTING','STALE','UNKNOWN']);
const EVIDENCE_CONFIDENCE_STATES = Object.freeze(['KNOWN_SYNTHETIC_EVIDENCE','PARTIAL_SYNTHETIC_EVIDENCE','CONFLICTING_EVIDENCE','STALE_EVIDENCE','INSUFFICIENT_EVIDENCE']);
const SEVERITIES = Object.freeze(['INFORMATIONAL','LOW','MODERATE','HIGH','CRITICAL','UNKNOWN']);
const ALERT_STATUSES = Object.freeze(['OPEN','ACKNOWLEDGED','UNDER_REVIEW','RESOLVED','DISMISSED_AS_DUPLICATE','INVALIDATED_BY_NEW_EVIDENCE','UNKNOWN']);
const NEXT_STEPS = Object.freeze(['REVIEW_ROUTE_STATUS','REVIEW_SAFETY_BLOCKER','REVIEW_WAREHOUSE_BLOCKER','REVIEW_VEHICLE_BLOCKER','REVIEW_CUSTOMER_SERVICE_EXCEPTION','REVIEW_DRIVER_OPERATIONAL_EVIDENCE','REVIEW_SUPERVISOR_ALERT','REVIEW_CONFLICTING_EVIDENCE','REVIEW_MISSING_EVIDENCE','COORDINATE_OPERATIONAL_REVIEW','NO_ACTION_REQUIRED','UNABLE_TO_DETERMINE']);
const EXCEPTION_TYPES = Object.freeze(['ROUTE_OPERATION_EXCEPTION','MULTIPLE_ROUTE_EXCEPTIONS','ROUTE_SAFETY_BLOCKER_ACTIVE','WAREHOUSE_DEPARTURE_BLOCKER_ACTIVE','VEHICLE_ROUTE_BLOCKER_ACTIVE','CUSTOMER_SERVICE_EXCEPTION_ACTIVE','DRIVER_OPERATIONAL_EVIDENCE_UNAVAILABLE','SUPERVISOR_ALERT_UNRESOLVED','CROSS_DOMAIN_OPERATIONAL_CONFLICT','OPERATIONAL_EVIDENCE_STALE','OPERATIONAL_EVIDENCE_CONFLICT','OPERATIONAL_EVIDENCE_INCOMPLETE','HUMAN_REVIEW_REQUIRED','INSUFFICIENT_EVIDENCE']);
const REASON_CODES = Object.freeze(['ROUTE_DELAYED','ROUTE_BLOCKED','SAFETY_BLOCKER','WAREHOUSE_BLOCKER','VEHICLE_BLOCKER','CUSTOMER_SERVICE_EXCEPTION','DRIVER_EVIDENCE_MISSING','SUPERVISOR_ALERT_OPEN','CROSS_DOMAIN_CORRELATION','EVIDENCE_STALE','EVIDENCE_CONFLICT','EVIDENCE_INCOMPLETE','HUMAN_REVIEW','NO_EXCEPTION']);
const OPERATIONS_CAPABILITIES = Object.freeze([
  { capabilityId: 'operations.operational_context.validation', displayName: 'Operations Operational Context Validation', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'operations.cross_domain.snapshot', displayName: 'Cross-Domain Operational Snapshot', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'operations.exception.correlation', displayName: 'Operations Exception Correlation', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'operations.alert.lifecycle', displayName: 'Operations Alert Lifecycle', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'operations.summary.explanation', displayName: 'Operations Summary and Explanation', executionStrategy: 'DETERMINISTIC_RULES' }
]);
const PROHIBITED_FIELDS = Object.freeze([
  'employeeScore','driverScore','supervisorScore','warehouseEmployeeScore','productivityScore','performanceRating','ranking','leaderboard','disciplinaryRecommendation','terminationRecommendation','compensationRecommendation','negligenceConclusion','unsafeDriverLabel',
  'autonomousDispatch','automaticRouteReassignment','automaticDriverReassignment','automaticVehicleReassignment','automaticWorkforceScheduling','autonomousWarehouseAction','autonomousPurchasing','autonomousPricing','autonomousCustomerDecision','autoResolveOperationalException',
  'predictedDelay','routeDelayPrediction','predictedOperationalFailure','demandForecast','workloadForecast','staffingForecast','serviceFailureProbability','operationalRiskPrediction','predictedRouteCompletion','predictiveScore',
  'erpWorkflow','tmsExpansion','wmsExpansion','crmExpansion','fleetManagementExpansion','provider','providerId','model','modelId','modelSelection','productionActivation','implementationPackageNumber','safetyIntelligenceImplemented'
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

function operationsContextContract() {
  return stable({
    schemaVersion: 'operations.context.contract.v1',
    requiredFields: ['operationsContextId','organizationId','workPeriod','reportingWindow','routeScope','driverScope','supervisorScope','warehouseScope','vehicleScope','customerScope','sourceDomainReferences','sourceEvidenceHashes','evidenceTimestamps','evidenceCompleteness','evidenceConfidence','staleEvidenceIndicators','conflictIndicators','unknownFields','humanReviewRequired','testOnly'],
    trustedServerDerivedFutureRuntime: ['organizationId','routeScope','driverScope','supervisorScope','warehouseScope','vehicleScope','customerScope'],
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

function evidenceFreshness(record = {}, options = {}) {
  if (record.evidenceStale === true) return 'STALE';
  if (record.evidenceFreshness === 'STALE') return 'STALE';
  if (!record.sourceTimestamp && !record.evidenceTimestamp) return 'UNKNOWN';
  if (options.syntheticFreshnessThresholdMinutes === null) return 'UNKNOWN';
  return 'FRESH';
}

function normalizeEvidence(record = {}, context = {}) {
  const organizationMatches = !record.organizationId || !context.organizationId || record.organizationId === context.organizationId;
  const normalized = {
    sourceDomain: sourceDomain(record.sourceDomain),
    sourceRecordId: record.sourceRecordId || `${String(record.sourceDomain || 'UNKNOWN').toLowerCase()}.${record.routeId || record.vehicleId || record.customerId || record.driverId || 'unknown'}`,
    organizationId: organizationMatches ? (record.organizationId || context.organizationId || null) : null,
    sourceStatus: record.sourceStatus || record.status || 'UNKNOWN',
    sourceSeverity: SEVERITIES.includes(record.sourceSeverity) ? record.sourceSeverity : 'UNKNOWN',
    sourceTimestamp: record.sourceTimestamp || record.evidenceTimestamp || null,
    routeId: record.routeId || null,
    driverId: record.driverId || null,
    supervisorId: record.supervisorId || null,
    warehouseId: record.warehouseId || record.depotId || null,
    vehicleId: record.vehicleId || null,
    customerId: record.customerId || record.accountId || null,
    exceptionType: record.exceptionType || null,
    reasonCode: record.reasonCode || null,
    authoritativeFor: record.authoritativeFor || null,
    relationshipKey: record.relationshipKey || record.routeId || null,
    humanReviewRequired: record.humanReviewRequired === true,
    evidenceStale: record.evidenceStale === true || record.evidenceFreshness === 'STALE',
    evidenceConflict: record.evidenceConflict === true,
    evidenceUnknown: record.evidenceUnknown === true || !record.sourceRecordId,
    lowerDomainConclusion: record.lowerDomainConclusion || record.sourceStatus || 'UNKNOWN',
    lowerDomainOverrideAttempted: record.lowerDomainOverrideAttempted === true,
    causationClaimed: record.causationClaimed === true,
    testOnly: record.testOnly !== false
  };
  normalized.freshness = evidenceFreshness(normalized);
  normalized.evidenceCompleteness = evidenceCompleteness(normalized, ['sourceDomain','sourceRecordId','organizationId','sourceStatus']);
  normalized.evidenceConfidence = evidenceConfidence(normalized, normalized.evidenceCompleteness);
  normalized.sourceHash = sha256(normalized);
  normalized.organizationIsolationPreserved = organizationMatches;
  return stable(normalized);
}

function validateOperationsContext(context = {}) {
  const errors = [];
  for (const field of scanProhibitedFields(context)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (!context.operationsContextId) errors.push({ rule: 'OPERATIONS_CONTEXT_REQUIRED' });
  if (!context.organizationId) errors.push({ rule: 'ORGANIZATION_REQUIRED' });
  if (!context.workPeriod && !context.reportingWindow) errors.push({ rule: 'REPORTING_WINDOW_REQUIRED' });
  return stable({ valid: errors.length === 0, errors, trustedServerDerivedInFutureRuntime: true, crossOrganizationAggregationProhibited: true, validationHash: sha256({ context, errors }) });
}

function buildOperationalContext(input = {}) {
  const context = input.operationsContext || {};
  const evidence = asArray(input.domainEvidence).map((record) => normalizeEvidence(record, context));
  const completeness = evidenceCompleteness({
    operationsContextId: context.operationsContextId,
    organizationId: context.organizationId,
    workPeriod: context.workPeriod || context.reportingWindow,
    sourceEvidence: evidence.length ? evidence : null,
    evidenceConflict: evidence.some((item) => item.evidenceConflict),
    evidenceStale: evidence.some((item) => item.evidenceStale)
  }, ['operationsContextId','organizationId','workPeriod','sourceEvidence']);
  const record = {
    schemaVersion: 'operations.operational.context.v1',
    operationsContextId: context.operationsContextId || 'operations.context.unknown',
    organizationId: context.organizationId || null,
    workPeriod: context.workPeriod || context.reportingWindow || null,
    reportingWindow: context.reportingWindow || context.workPeriod || null,
    routeScope: context.routeScope || [],
    driverScope: context.driverScope || [],
    supervisorScope: context.supervisorScope || [],
    warehouseScope: context.warehouseScope || [],
    vehicleScope: context.vehicleScope || [],
    customerScope: context.customerScope || [],
    sourceDomainReferences: [...new Set(evidence.map((item) => item.sourceDomain))].filter((domain) => domain !== 'UNKNOWN').sort(),
    sourceEvidenceHashes: evidence.map((item) => item.sourceHash).sort(),
    evidenceTimestamps: evidence.map((item) => item.sourceTimestamp).filter(Boolean).sort(),
    evidenceCompleteness: completeness,
    evidenceConfidence: evidenceConfidence({ evidenceConflict: evidence.some((item) => item.evidenceConflict), evidenceStale: evidence.some((item) => item.evidenceStale) }, completeness),
    staleEvidenceIndicators: evidence.filter((item) => item.evidenceStale).map((item) => item.sourceRecordId),
    conflictIndicators: evidence.filter((item) => item.evidenceConflict).map((item) => item.sourceRecordId),
    unknownFields: evidence.filter((item) => item.evidenceUnknown).map((item) => item.sourceRecordId),
    humanReviewRequired: evidence.some((item) => item.humanReviewRequired || item.evidenceConflict || item.evidenceStale || item.evidenceUnknown || item.organizationIsolationPreserved !== true),
    organizationIsolationPreserved: evidence.every((item) => item.organizationIsolationPreserved === true),
    sourceEvidence: evidence,
    testOnly: true
  };
  record.contextHash = sha256(record);
  return stable(record);
}

function countBy(records, predicate) { return records.filter(predicate).length; }

function buildOperationalSnapshot(input = {}) {
  const context = buildOperationalContext(input);
  const evidence = context.sourceEvidence;
  const routeEvidence = evidence.filter((item) => item.sourceDomain === 'ROUTE');
  const record = {
    schemaVersion: 'operations.cross_domain.snapshot.v1',
    operationsContextId: context.operationsContextId,
    organizationId: context.organizationId,
    routeCount: new Set(routeEvidence.map((item) => item.routeId).filter(Boolean)).size,
    routesInProgress: countBy(routeEvidence, (item) => ['IN_PROGRESS','ACTIVE'].includes(item.sourceStatus)),
    completedRoutes: countBy(routeEvidence, (item) => item.sourceStatus === 'COMPLETED'),
    delayedRoutes: countBy(routeEvidence, (item) => item.sourceStatus === 'DELAYED'),
    blockedRoutes: countBy(routeEvidence, (item) => ['BLOCKED','UNSAFE','REJECTED'].includes(item.sourceStatus)),
    unresolvedRoutes: countBy(routeEvidence, (item) => item.sourceStatus === 'UNRESOLVED'),
    routesWithSafetyBlockers: countBy(evidence, (item) => item.sourceDomain === 'ROUTE' && item.exceptionType === 'ROUTE_SAFETY_BLOCKER_ACTIVE'),
    routesWithWarehouseBlockers: countBy(evidence, (item) => item.sourceDomain === 'WAREHOUSE' && item.exceptionType === 'WAREHOUSE_DEPARTURE_BLOCKER_ACTIVE'),
    routesWithVehicleBlockers: countBy(evidence, (item) => item.sourceDomain === 'FLEET' && item.exceptionType === 'VEHICLE_ROUTE_BLOCKER_ACTIVE'),
    routesWithUnresolvedCustomerServiceIssues: countBy(evidence, (item) => item.sourceDomain === 'CUSTOMER' && item.exceptionType === 'CUSTOMER_SERVICE_EXCEPTION_ACTIVE'),
    driversCurrentlyOperatingKnown: new Set(evidence.filter((item) => item.sourceDomain === 'DRIVER' && item.sourceStatus !== 'INSUFFICIENT_EVIDENCE').map((item) => item.driverId).filter(Boolean)).size,
    unresolvedSupervisorAlerts: countBy(evidence, (item) => item.sourceDomain === 'SUPERVISOR' && ['OPEN','UNRESOLVED'].includes(item.sourceStatus)),
    warehouseReadinessExceptions: countBy(evidence, (item) => item.sourceDomain === 'WAREHOUSE' && item.exceptionType),
    unavailableOrOutOfServiceVehicles: countBy(evidence, (item) => item.sourceDomain === 'FLEET' && ['UNAVAILABLE','OUT_OF_SERVICE','BLOCKED'].includes(item.sourceStatus)),
    unresolvedCustomerOperationalExceptions: countBy(evidence, (item) => item.sourceDomain === 'CUSTOMER' && item.exceptionType),
    insufficientEvidenceItems: countBy(evidence, (item) => item.evidenceCompleteness.status === 'INSUFFICIENT' || item.evidenceUnknown),
    humanReviewItems: countBy(evidence, (item) => item.humanReviewRequired),
    domainCoverage: SOURCE_DOMAINS.map((domain) => ({ sourceDomain: domain, evidenceCount: countBy(evidence, (item) => item.sourceDomain === domain), authoritative: true })),
    lowerDomainsRemainAuthoritative: true,
    missingCountsInvented: false,
    testOnly: true
  };
  record.snapshotHash = sha256(record);
  return stable(record);
}

function aggregateByDomain(input = {}, domain) {
  const context = buildOperationalContext(input);
  const records = context.sourceEvidence.filter((item) => item.sourceDomain === domain);
  const result = {
    sourceDomain: domain,
    organizationId: context.organizationId,
    recordCount: records.length,
    unresolvedCount: countBy(records, (item) => ['OPEN','UNRESOLVED','DELAYED','BLOCKED','UNAVAILABLE','OUT_OF_SERVICE','INSUFFICIENT_EVIDENCE'].includes(item.sourceStatus) || Boolean(item.exceptionType)),
    staleCount: countBy(records, (item) => item.evidenceStale),
    conflictCount: countBy(records, (item) => item.evidenceConflict),
    humanReviewCount: countBy(records, (item) => item.humanReviewRequired),
    sourceRecordIds: records.map((item) => item.sourceRecordId).sort(),
    lowerDomainAuthoritative: true,
    noOverride: true,
    testOnly: true
  };
  result.aggregateHash = sha256(result);
  return stable(result);
}

function buildRoutePortfolioAggregate(input = {}) { return aggregateByDomain(input, 'ROUTE'); }
function aggregateWarehouseImpact(input = {}) { return aggregateByDomain(input, 'WAREHOUSE'); }
function aggregateFleetImpact(input = {}) { return aggregateByDomain(input, 'FLEET'); }
function aggregateCustomerServiceImpact(input = {}) { return aggregateByDomain(input, 'CUSTOMER'); }
function aggregateDriverOperationalState(input = {}) { return aggregateByDomain(input, 'DRIVER'); }
function aggregateSupervisorImpact(input = {}) { return aggregateByDomain(input, 'SUPERVISOR'); }

function correlateOperationalExceptions(input = {}) {
  const context = buildOperationalContext(input);
  const grouped = new Map();
  for (const item of context.sourceEvidence.filter((record) => record.relationshipKey)) {
    const records = grouped.get(item.relationshipKey) || [];
    records.push(item);
    grouped.set(item.relationshipKey, records);
  }
  const correlations = [];
  for (const [relationshipKey, records] of grouped.entries()) {
    const domains = [...new Set(records.map((item) => item.sourceDomain))].sort();
    if (domains.length < 2) continue;
    correlations.push(stable({
      correlationId: `operations.correlation.${relationshipKey}`,
      organizationId: context.organizationId,
      relationshipKey,
      sourceDomains: domains,
      sourceRecordIds: records.map((item) => item.sourceRecordId).sort(),
      relatedRouteIds: [...new Set(records.map((item) => item.routeId).filter(Boolean))].sort(),
      correlationMeaning: 'known facts co-occur within the supported operational relationship',
      causationClaimed: false,
      lowerDomainsRemainAuthoritative: true,
      correlationHash: sha256({ relationshipKey, records: records.map((item) => item.sourceHash).sort() }),
      testOnly: true
    }));
  }
  return stable(correlations);
}

function classifyOperationsSeverity(exception = {}) {
  if (exception.exceptionType === 'ROUTE_SAFETY_BLOCKER_ACTIVE') return 'CRITICAL';
  if (['WAREHOUSE_DEPARTURE_BLOCKER_ACTIVE','VEHICLE_ROUTE_BLOCKER_ACTIVE'].includes(exception.exceptionType)) return 'HIGH';
  if (['ROUTE_OPERATION_EXCEPTION','CUSTOMER_SERVICE_EXCEPTION_ACTIVE','SUPERVISOR_ALERT_UNRESOLVED','MULTIPLE_ROUTE_EXCEPTIONS'].includes(exception.exceptionType)) return 'MODERATE';
  if (['OPERATIONAL_EVIDENCE_STALE','OPERATIONAL_EVIDENCE_CONFLICT','OPERATIONAL_EVIDENCE_INCOMPLETE','INSUFFICIENT_EVIDENCE','DRIVER_OPERATIONAL_EVIDENCE_UNAVAILABLE'].includes(exception.exceptionType)) return 'LOW';
  if (exception.exceptionType === 'HUMAN_REVIEW_REQUIRED') return 'LOW';
  return 'INFORMATIONAL';
}

function prioritizeOperationsAlert(exception = {}) {
  const severityWeight = { CRITICAL: 100, HIGH: 80, MODERATE: 60, LOW: 40, INFORMATIONAL: 20, UNKNOWN: 10 };
  let score = severityWeight[exception.severity] || 10;
  score += asArray(exception.relatedRouteIds).length * 2;
  if (exception.humanReviewRequired) score += 5;
  if (exception.reasonCodes?.includes('EVIDENCE_STALE')) score -= 5;
  const priority = score >= 100 ? 'P1' : score >= 80 ? 'P2' : score >= 60 ? 'P3' : score >= 40 ? 'P4' : 'P5';
  return stable({ priority, score, calculationTrace: ['severity','affected operational records','human review','evidence freshness'], noEmployeeValueUsed: true, noCustomerProfitabilityUsed: true, deterministic: true });
}

function detectOperationsExceptions(input = {}) {
  const context = buildOperationalContext(input);
  const evidence = context.sourceEvidence;
  const exceptions = [];
  const push = (type, records, reasonCodes) => {
    const related = asArray(records);
    const record = {
      exceptionId: `operations.exception.${type.toLowerCase()}.${exceptions.length + 1}`,
      organizationId: context.organizationId,
      exceptionType: type,
      sourceDomains: [...new Set(related.map((item) => item.sourceDomain))].sort(),
      sourceRecordIds: related.map((item) => item.sourceRecordId).sort(),
      relatedRouteIds: [...new Set(related.map((item) => item.routeId).filter(Boolean))].sort(),
      relatedVehicleIds: [...new Set(related.map((item) => item.vehicleId).filter(Boolean))].sort(),
      relatedCustomerIds: [...new Set(related.map((item) => item.customerId).filter(Boolean))].sort(),
      relatedDriverIds: [...new Set(related.map((item) => item.driverId).filter(Boolean))].sort(),
      reasonCodes,
      evidence: related.map((item) => ({ sourceDomain: item.sourceDomain, sourceRecordId: item.sourceRecordId, sourceHash: item.sourceHash, sourceTimestamp: item.sourceTimestamp })),
      timestamps: related.map((item) => item.sourceTimestamp).filter(Boolean).sort(),
      completeness: evidenceCompleteness({ sourceRecordIds: related.length ? related : null }, ['sourceRecordIds']),
      confidence: evidenceConfidence({ evidenceConflict: related.some((item) => item.evidenceConflict), evidenceStale: related.some((item) => item.evidenceStale) }),
      humanReviewRequired: related.some((item) => item.humanReviewRequired || item.evidenceConflict || item.evidenceUnknown),
      employmentImpactProhibited: true,
      testOnly: true
    };
    record.severity = classifyOperationsSeverity(record);
    record.priority = prioritizeOperationsAlert(record);
    record.exceptionHash = sha256(record);
    exceptions.push(stable(record));
  };
  for (const item of evidence) {
    if (item.exceptionType && EXCEPTION_TYPES.includes(item.exceptionType)) push(item.exceptionType, [item], [item.reasonCode || item.exceptionType]);
    if (item.sourceDomain === 'ROUTE' && ['DELAYED','BLOCKED','UNRESOLVED','UNSAFE'].includes(item.sourceStatus) && !item.exceptionType) push('ROUTE_OPERATION_EXCEPTION', [item], ['ROUTE_DELAYED']);
    if (item.sourceDomain === 'DRIVER' && item.evidenceUnknown) push('DRIVER_OPERATIONAL_EVIDENCE_UNAVAILABLE', [item], ['DRIVER_EVIDENCE_MISSING']);
    if (item.sourceDomain === 'SUPERVISOR' && ['OPEN','UNRESOLVED'].includes(item.sourceStatus)) push('SUPERVISOR_ALERT_UNRESOLVED', [item], ['SUPERVISOR_ALERT_OPEN']);
    if (item.evidenceStale) push('OPERATIONAL_EVIDENCE_STALE', [item], ['EVIDENCE_STALE']);
    if (item.evidenceConflict) push('OPERATIONAL_EVIDENCE_CONFLICT', [item], ['EVIDENCE_CONFLICT']);
    if (item.evidenceCompleteness.status === 'INSUFFICIENT' || item.evidenceUnknown) push('INSUFFICIENT_EVIDENCE', [item], ['EVIDENCE_INCOMPLETE']);
  }
  const routeExceptionCount = exceptions.filter((item) => item.relatedRouteIds.length).length;
  if (routeExceptionCount > 1) push('MULTIPLE_ROUTE_EXCEPTIONS', evidence.filter((item) => item.routeId), ['ROUTE_DELAYED','CROSS_DOMAIN_CORRELATION']);
  for (const correlation of correlateOperationalExceptions(input)) {
    const related = evidence.filter((item) => correlation.sourceRecordIds.includes(item.sourceRecordId));
    const hasOperationalIssue = related.some((item) =>
      Boolean(item.exceptionType)
      || ['OPEN','UNRESOLVED','DELAYED','BLOCKED','UNAVAILABLE','OUT_OF_SERVICE','INSUFFICIENT_EVIDENCE','UNSAFE','REJECTED'].includes(item.sourceStatus)
      || item.evidenceConflict
      || item.evidenceStale
      || item.evidenceUnknown
    );
    if (correlation.sourceDomains.length > 1 && hasOperationalIssue) push('CROSS_DOMAIN_OPERATIONAL_CONFLICT', related, ['CROSS_DOMAIN_CORRELATION']);
  }
  if (context.humanReviewRequired) push('HUMAN_REVIEW_REQUIRED', evidence.filter((item) => item.humanReviewRequired || item.evidenceConflict || item.evidenceUnknown || item.evidenceStale), ['HUMAN_REVIEW']);
  return stable(exceptions);
}

function buildOperationsAlert(exception = {}) {
  const nextStepByType = {
    ROUTE_SAFETY_BLOCKER_ACTIVE: 'REVIEW_SAFETY_BLOCKER',
    WAREHOUSE_DEPARTURE_BLOCKER_ACTIVE: 'REVIEW_WAREHOUSE_BLOCKER',
    VEHICLE_ROUTE_BLOCKER_ACTIVE: 'REVIEW_VEHICLE_BLOCKER',
    CUSTOMER_SERVICE_EXCEPTION_ACTIVE: 'REVIEW_CUSTOMER_SERVICE_EXCEPTION',
    DRIVER_OPERATIONAL_EVIDENCE_UNAVAILABLE: 'REVIEW_DRIVER_OPERATIONAL_EVIDENCE',
    SUPERVISOR_ALERT_UNRESOLVED: 'REVIEW_SUPERVISOR_ALERT',
    OPERATIONAL_EVIDENCE_CONFLICT: 'REVIEW_CONFLICTING_EVIDENCE',
    INSUFFICIENT_EVIDENCE: 'REVIEW_MISSING_EVIDENCE'
  };
  const alert = {
    alertId: `operations.alert.${exception.exceptionId || 'unknown'}`,
    exceptionId: exception.exceptionId || null,
    organizationId: exception.organizationId || null,
    sourceDomains: exception.sourceDomains || [],
    relatedRoutes: exception.relatedRouteIds || [],
    affectedOperationalEntities: {
      vehicles: exception.relatedVehicleIds || [],
      customers: exception.relatedCustomerIds || [],
      drivers: exception.relatedDriverIds || []
    },
    severity: exception.severity || 'UNKNOWN',
    priority: exception.priority || prioritizeOperationsAlert(exception),
    structuredFacts: exception.reasonCodes || [],
    reasonCodes: exception.reasonCodes || [],
    evidenceReferences: exception.evidence || [],
    limitations: ['Correlation is not causation', 'Lower domains remain authoritative', 'Repository-only synthetic output'],
    requiredOperationalAttention: nextStepByType[exception.exceptionType] || (exception.exceptionType ? 'COORDINATE_OPERATIONAL_REVIEW' : 'NO_ACTION_REQUIRED'),
    humanReviewRequired: exception.humanReviewRequired === true,
    acknowledgementState: 'OPEN',
    resolutionState: 'OPEN',
    testOnly: true
  };
  alert.alertHash = sha256(alert);
  return stable(alert);
}

function acknowledgeOperationsAlert(alert = {}, actor = 'synthetic.supervisor') {
  const record = { ...alert, acknowledgementState: 'ACKNOWLEDGED', acknowledgedBy: actor, acknowledgedAt: DETERMINISTIC_GENERATED_AT, resolutionState: alert.resolutionState || 'OPEN' };
  record.alertHash = sha256({ ...record, alertHash: undefined });
  return stable(record);
}

function resolveOperationsAlert(alert = {}, resolution = 'RESOLVED') {
  const state = ALERT_STATUSES.includes(resolution) ? resolution : 'UNKNOWN';
  const record = { ...alert, resolutionState: state, resolvedAt: DETERMINISTIC_GENERATED_AT, acknowledgementState: alert.acknowledgementState || 'ACKNOWLEDGED' };
  record.alertHash = sha256({ ...record, alertHash: undefined });
  return stable(record);
}

function invalidateOperationsAlertWithNewEvidence(alert = {}, evidence = {}) {
  const record = { ...alert, resolutionState: 'INVALIDATED_BY_NEW_EVIDENCE', invalidatingEvidenceHash: sha256(evidence), invalidatedAt: DETERMINISTIC_GENERATED_AT };
  record.alertHash = sha256({ ...record, alertHash: undefined });
  return stable(record);
}

function buildOperationsEvidence(input = {}) {
  const context = buildOperationalContext(input);
  return stable({
    contextHash: context.contextHash,
    sourceDomainEvidence: context.sourceEvidence.map((item) => ({
      sourceDomain: item.sourceDomain,
      sourceRecordId: item.sourceRecordId,
      sourceHash: item.sourceHash,
      sourceVersion: 'synthetic.v1',
      sourceStatus: item.sourceStatus,
      sourceTimestamp: item.sourceTimestamp,
      aggregationRule: 'operations.aggregate.by-domain-and-route.v1',
      aggregationVersion: OPERATIONS_INTELLIGENCE_ENGINE_VERSION,
      resultHash: item.sourceHash
    })),
    crossOrganizationAggregationRejected: context.organizationIsolationPreserved !== true,
    lowerDomainsRemainAuthoritative: true,
    testOnly: true
  });
}

function buildOperationsSummary(input = {}) {
  const snapshot = buildOperationalSnapshot(input);
  const exceptions = detectOperationsExceptions(input);
  const summary = {
    organizationId: snapshot.organizationId,
    routesInScope: snapshot.routeCount,
    completedRoutes: snapshot.completedRoutes,
    activeRoutes: snapshot.routesInProgress,
    delayedRoutes: snapshot.delayedRoutes,
    blockedRoutes: snapshot.blockedRoutes,
    routesWithSafetyBlockers: snapshot.routesWithSafetyBlockers,
    routesWithWarehouseBlockers: snapshot.routesWithWarehouseBlockers,
    routesWithVehicleBlockers: snapshot.routesWithVehicleBlockers,
    customerServiceExceptions: snapshot.unresolvedCustomerOperationalExceptions,
    unresolvedAlerts: snapshot.unresolvedSupervisorAlerts,
    unresolvedCrossDomainConflicts: exceptions.filter((item) => item.exceptionType === 'CROSS_DOMAIN_OPERATIONAL_CONFLICT').length,
    staleEvidence: exceptions.filter((item) => item.exceptionType === 'OPERATIONAL_EVIDENCE_STALE').length,
    insufficientEvidence: snapshot.insufficientEvidenceItems,
    humanReviewCount: exceptions.filter((item) => item.humanReviewRequired).length,
    knownOperationalLimitations: ['Synthetic repository-only evidence', 'No production freshness threshold', 'No causation inferred from correlation', 'Lower domains remain authoritative'],
    noPredictionGenerated: true,
    noRecommendationEngineGenerated: true,
    testOnly: true
  };
  summary.summaryHash = sha256(summary);
  return stable(summary);
}

function buildOperationsExplanation(input = {}) {
  const context = buildOperationalContext(input);
  const exceptions = detectOperationsExceptions(input);
  const explanation = {
    operationsContextId: context.operationsContextId,
    organizationId: context.organizationId,
    knownState: `Operations snapshot aggregates ${context.sourceEvidence.length} lower-domain evidence records.`,
    contributingDomains: context.sourceDomainReferences,
    exceptionReasons: exceptions.map((item) => ({ exceptionId: item.exceptionId, exceptionType: item.exceptionType, severity: item.severity, priority: item.priority.priority, reasonCodes: item.reasonCodes })),
    correlations: correlateOperationalExceptions(input).map((item) => ({ correlationId: item.correlationId, sourceDomains: item.sourceDomains, causationClaimed: false })),
    missingEvidence: context.unknownFields,
    conflictingEvidence: context.conflictIndicators,
    staleEvidence: context.staleEvidenceIndicators,
    humanReviewReasons: exceptions.filter((item) => item.humanReviewRequired).map((item) => item.exceptionType),
    employeeIntentInferred: false,
    negligenceInferred: false,
    futureOutcomePredicted: false,
    causationInferredWithoutEvidence: false,
    testOnly: true
  };
  explanation.explanationHash = sha256(explanation);
  return stable(explanation);
}

function buildOperationsAssessment(request = {}) {
  const context = buildOperationalContext(request);
  const snapshot = buildOperationalSnapshot(request);
  const routeAggregate = buildRoutePortfolioAggregate(request);
  const driverAggregate = aggregateDriverOperationalState(request);
  const supervisorAggregate = aggregateSupervisorImpact(request);
  const warehouseAggregate = aggregateWarehouseImpact(request);
  const fleetAggregate = aggregateFleetImpact(request);
  const customerAggregate = aggregateCustomerServiceImpact(request);
  const correlations = correlateOperationalExceptions(request);
  const exceptions = detectOperationsExceptions(request);
  const alerts = exceptions.map(buildOperationsAlert);
  const acknowledgedAlert = alerts[0] ? acknowledgeOperationsAlert(alerts[0]) : null;
  const resolvedAlert = acknowledgedAlert ? resolveOperationsAlert(acknowledgedAlert) : null;
  const invalidatedAlert = acknowledgedAlert ? invalidateOperationsAlertWithNewEvidence(acknowledgedAlert, { sourceRecordId: 'new.synthetic.evidence' }) : null;
  const assessment = {
    schemaVersion: 'operations.assessment.v1',
    context,
    snapshot,
    routeAggregate,
    driverAggregate,
    supervisorAggregate,
    warehouseAggregate,
    fleetAggregate,
    customerAggregate,
    correlations,
    exceptions,
    alerts,
    alertLifecycle: { acknowledgedAlert, resolvedAlert, invalidatedAlert },
    summary: buildOperationsSummary(request),
    explanation: buildOperationsExplanation(request),
    authorityTrace: buildOperationsEvidence(request),
    lowerDomainOverrideAttempted: asArray(request.domainEvidence).some((item) => item.lowerDomainOverrideAttempted === true),
    correlationUsedAsCausation: asArray(request.domainEvidence).some((item) => item.causationClaimed === true),
    providerCallInvoked: false,
    hostedAiInvoked: false,
    modelSelectionActivated: false,
    productionApiExposed: false,
    migrationExecuted: false,
    deploymentExecuted: false,
    predictionGenerated: false,
    autonomousActionGenerated: false,
    employmentScoringGenerated: false,
    productSuiteExpansionGenerated: false,
    safetyIntelligenceStarted: false,
    testOnly: true
  };
  assessment.assessmentHash = sha256(assessment);
  return stable(assessment);
}

function baseContext() {
  return {
    operationsContextId: 'operations.context.org-001.morning',
    organizationId: 'org-001',
    workPeriod: { start: '2026-08-11T08:00:00.000Z', end: '2026-08-11T12:00:00.000Z' },
    routeScope: ['route-001','route-002','route-003'],
    driverScope: ['driver-001','driver-002'],
    supervisorScope: ['supervisor-001'],
    warehouseScope: ['depot-001'],
    vehicleScope: ['vehicle-001','vehicle-002'],
    customerScope: ['customer-001','customer-002']
  };
}

function evidence(sourceDomain, sourceRecordId, overrides = {}) {
  return {
    sourceDomain,
    sourceRecordId,
    organizationId: 'org-001',
    routeId: overrides.routeId || 'route-001',
    sourceStatus: overrides.sourceStatus || 'NORMAL',
    sourceSeverity: overrides.sourceSeverity || 'INFORMATIONAL',
    sourceTimestamp: overrides.sourceTimestamp || DETERMINISTIC_GENERATED_AT,
    testOnly: true,
    ...overrides
  };
}

function buildBenchmarkCases() {
  const cases = [
    ['normal_organization_operations', [evidence('ROUTE','route.normal',{ routeId: 'route-001', sourceStatus: 'COMPLETED' }), evidence('WAREHOUSE','warehouse.ready',{ routeId: 'route-001', sourceStatus: 'READY' }), evidence('FLEET','fleet.ready',{ routeId: 'route-001', vehicleId: 'vehicle-001', sourceStatus: 'AVAILABLE' }), evidence('CUSTOMER','customer.normal',{ routeId: 'route-001', customerId: 'customer-001', sourceStatus: 'NORMAL' })], 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['one_delayed_route', [evidence('ROUTE','route.delayed',{ sourceStatus: 'DELAYED', reasonCode: 'ROUTE_DELAYED' })], 'ROUTE_OPERATION_EXCEPTION'],
    ['multiple_delayed_routes', [evidence('ROUTE','route.delayed.1',{ routeId: 'route-001', sourceStatus: 'DELAYED' }), evidence('ROUTE','route.delayed.2',{ routeId: 'route-002', sourceStatus: 'DELAYED' })], 'MULTIPLE_ROUTE_EXCEPTIONS'],
    ['safety_blocked_route', [evidence('ROUTE','route.safety',{ sourceStatus: 'BLOCKED', exceptionType: 'ROUTE_SAFETY_BLOCKER_ACTIVE', sourceSeverity: 'CRITICAL' })], 'ROUTE_SAFETY_BLOCKER_ACTIVE'],
    ['warehouse_blocked_departure', [evidence('WAREHOUSE','warehouse.blocker',{ sourceStatus: 'BLOCKED', exceptionType: 'WAREHOUSE_DEPARTURE_BLOCKER_ACTIVE' })], 'WAREHOUSE_DEPARTURE_BLOCKER_ACTIVE'],
    ['vehicle_blocked_route', [evidence('FLEET','fleet.blocker',{ vehicleId: 'vehicle-001', sourceStatus: 'OUT_OF_SERVICE', exceptionType: 'VEHICLE_ROUTE_BLOCKER_ACTIVE' })], 'VEHICLE_ROUTE_BLOCKER_ACTIVE'],
    ['unresolved_customer_service_issue', [evidence('CUSTOMER','customer.exception',{ customerId: 'customer-001', sourceStatus: 'UNRESOLVED', exceptionType: 'CUSTOMER_SERVICE_EXCEPTION_ACTIVE' })], 'CUSTOMER_SERVICE_EXCEPTION_ACTIVE'],
    ['missing_driver_operational_evidence', [evidence('DRIVER','driver.missing',{ driverId: 'driver-001', sourceRecordId: null, sourceStatus: 'INSUFFICIENT_EVIDENCE', evidenceUnknown: true })], 'DRIVER_OPERATIONAL_EVIDENCE_UNAVAILABLE'],
    ['unresolved_supervisor_alert', [evidence('SUPERVISOR','supervisor.alert',{ supervisorId: 'supervisor-001', sourceStatus: 'OPEN' })], 'SUPERVISOR_ALERT_UNRESOLVED'],
    ['multiple_simultaneous_domain_exceptions', [evidence('ROUTE','route.blocked',{ sourceStatus: 'BLOCKED' }), evidence('WAREHOUSE','warehouse.blocked',{ sourceStatus: 'BLOCKED', exceptionType: 'WAREHOUSE_DEPARTURE_BLOCKER_ACTIVE' }), evidence('FLEET','fleet.blocked',{ sourceStatus: 'OUT_OF_SERVICE', exceptionType: 'VEHICLE_ROUTE_BLOCKER_ACTIVE' })], 'MULTIPLE_ROUTE_EXCEPTIONS'],
    ['safety_blocker_outranks_routine_delay', [evidence('ROUTE','route.delay',{ routeId: 'route-001', sourceStatus: 'DELAYED' }), evidence('ROUTE','route.safety.critical',{ routeId: 'route-002', sourceStatus: 'BLOCKED', exceptionType: 'ROUTE_SAFETY_BLOCKER_ACTIVE' })], 'ROUTE_SAFETY_BLOCKER_ACTIVE'],
    ['warehouse_and_fleet_different_routes', [evidence('WAREHOUSE','warehouse.route1',{ routeId: 'route-001', exceptionType: 'WAREHOUSE_DEPARTURE_BLOCKER_ACTIVE' }), evidence('FLEET','fleet.route2',{ routeId: 'route-002', vehicleId: 'vehicle-002', exceptionType: 'VEHICLE_ROUTE_BLOCKER_ACTIVE' })], 'WAREHOUSE_DEPARTURE_BLOCKER_ACTIVE'],
    ['correlated_warehouse_blocker_route_delay', [evidence('ROUTE','route.delay.corr',{ routeId: 'route-001', sourceStatus: 'DELAYED' }), evidence('WAREHOUSE','warehouse.delay.corr',{ routeId: 'route-001', exceptionType: 'WAREHOUSE_DEPARTURE_BLOCKER_ACTIVE' })], 'CROSS_DOMAIN_OPERATIONAL_CONFLICT'],
    ['correlated_vehicle_blocker_route_impact', [evidence('ROUTE','route.vehicle.corr',{ routeId: 'route-001', sourceStatus: 'BLOCKED' }), evidence('FLEET','fleet.vehicle.corr',{ routeId: 'route-001', vehicleId: 'vehicle-001', exceptionType: 'VEHICLE_ROUTE_BLOCKER_ACTIVE' })], 'CROSS_DOMAIN_OPERATIONAL_CONFLICT'],
    ['correlated_customer_issue_route_disruption', [evidence('ROUTE','route.customer.corr',{ routeId: 'route-001', sourceStatus: 'DELAYED' }), evidence('CUSTOMER','customer.route.corr',{ routeId: 'route-001', customerId: 'customer-001', exceptionType: 'CUSTOMER_SERVICE_EXCEPTION_ACTIVE' })], 'CROSS_DOMAIN_OPERATIONAL_CONFLICT'],
    ['stale_evidence', [evidence('ROUTE','route.stale',{ evidenceStale: true, evidenceFreshness: 'STALE' })], 'OPERATIONAL_EVIDENCE_STALE'],
    ['conflicting_evidence', [evidence('WAREHOUSE','warehouse.conflict',{ evidenceConflict: true })], 'OPERATIONAL_EVIDENCE_CONFLICT'],
    ['insufficient_evidence', [evidence('ROUTE',null,{ sourceStatus: 'INSUFFICIENT_EVIDENCE', evidenceUnknown: true })], 'INSUFFICIENT_EVIDENCE'],
    ['cross_organization_evidence_rejection', [evidence('ROUTE','route.crossorg',{ organizationId: 'org-002', sourceStatus: 'DELAYED' })], 'HUMAN_REVIEW_REQUIRED'],
    ['human_review', [evidence('SUPERVISOR','supervisor.review',{ humanReviewRequired: true })], 'HUMAN_REVIEW_REQUIRED'],
    ['acknowledgement', [evidence('SUPERVISOR','supervisor.ack',{ sourceStatus: 'OPEN' })], 'SUPERVISOR_ALERT_UNRESOLVED'],
    ['resolution', [evidence('ROUTE','route.resolve',{ sourceStatus: 'DELAYED' })], 'ROUTE_OPERATION_EXCEPTION'],
    ['new_evidence_invalidating_alert', [evidence('ROUTE','route.invalidate',{ sourceStatus: 'DELAYED' })], 'ROUTE_OPERATION_EXCEPTION'],
    ['no_exception_case', [evidence('ROUTE','route.ok',{ routeId: 'route-003', sourceStatus: 'COMPLETED' }), evidence('DRIVER','driver.ok',{ routeId: 'route-003', driverId: 'driver-002', sourceStatus: 'ACTIVE' })], 'NO_EXCEPTION_OR_INFORMATIONAL']
  ];
  return cases.map(([caseId, domainEvidence, expectedException]) => stable({
    caseId,
    request: { operationsContext: baseContext(), domainEvidence },
    expectedException,
    deterministic: true,
    syntheticOnly: true,
    providerCallExpected: false,
    productionMutationExpected: false
  }));
}

function querySyntheticOperationsAssessments() {
  return buildBenchmarkCases().map((benchmark) => stable({ caseId: benchmark.caseId, assessment: buildOperationsAssessment(benchmark.request) }));
}

function buildOperationsIntelligenceEvidence() {
  const benchmarkCases = buildBenchmarkCases();
  const assessments = querySyntheticOperationsAssessments();
  const orchestrationEvidence = orchestration.buildOrchestrationEvidence();
  const lifecycleEvidence = lifecycle.buildLifecycleEvidence();
  const catalog = {
    schemaVersion: OPERATIONS_INTELLIGENCE_SCHEMA_VERSION,
    engineVersion: OPERATIONS_INTELLIGENCE_ENGINE_VERSION,
    generatedAt: DETERMINISTIC_GENERATED_AT,
    capabilityCount: OPERATIONS_CAPABILITIES.length,
    benchmarkCaseCount: benchmarkCases.length,
    currentOperationsFunctionalityAuditComplete: true,
    serviceReuseDecisionDocumented: true,
    integratedWithEnterpriseRegistry: registry.listEnterpriseCapabilities().length > 0,
    directEnterpriseRegistryCapability: null,
    directRegistryCapabilityDeferred: true,
    integratedWithCapabilityOrchestration: orchestrationEvidence.capabilities.some((capability) => capability.businessDomain === 'Operations Intelligence'),
    integratedWithLifecycleFramework: lifecycleEvidence.lifecycleRecords.some((record) => record.capabilityId === 'operations.intelligence.throughput'),
    integratedWithRouteIntelligence: true,
    integratedWithDriverIntelligence: true,
    integratedWithSupervisorIntelligence: true,
    integratedWithWarehouseIntelligence: true,
    integratedWithFleetIntelligence: true,
    integratedWithCustomerIntelligence: true,
    providerCallInvoked: false,
    hostedAiInvoked: false,
    modelSelectionActivated: false,
    productionOrchestrationActivated: false,
    productionApiExposed: false,
    migrationExecuted: false,
    deploymentExecuted: false,
    productionApplicable: false,
    lowerDomainOverrideGenerated: false,
    causationInferredFromCorrelation: false,
    employeeScoringGenerated: false,
    driverRankingGenerated: false,
    autonomousActionGenerated: false,
    predictionGenerated: false,
    demandForecastGenerated: false,
    productSuiteExpansionGenerated: false,
    safetyIntelligenceStarted: false,
    testOnly: true
  };
  catalog.catalogHash = sha256(catalog);
  return stable({
    catalog,
    capabilities: OPERATIONS_CAPABILITIES,
    contextContract: operationsContextContract(),
    sourceDomains: SOURCE_DOMAINS,
    evidenceFreshnessStates: EVIDENCE_FRESHNESS_STATES,
    evidenceCompletenessStates: EVIDENCE_COMPLETENESS_STATES,
    evidenceConfidenceStates: EVIDENCE_CONFIDENCE_STATES,
    exceptionTypes: EXCEPTION_TYPES,
    severities: SEVERITIES,
    alertStatuses: ALERT_STATUSES,
    nextSteps: NEXT_STEPS,
    reasonCodes: REASON_CODES,
    prohibitedFields: PROHIBITED_FIELDS,
    benchmarkCases,
    assessments,
    integrationReferences: {
      routeIntelligence: { schemaVersion: routeIntel.ROUTE_INTELLIGENCE_SCHEMA_VERSION, authority: 'ROUTE_SAFETY_COMPATIBILITY_AND_REJECTION' },
      driverIntelligence: { schemaVersion: driverIntel.DRIVER_INTELLIGENCE_SCHEMA_VERSION, authority: 'DRIVER_STATE_ROUTE_ADHERENCE_AND_STOP_PROGRESS' },
      supervisorIntelligence: { schemaVersion: supervisorIntel.SUPERVISOR_INTELLIGENCE_SCHEMA_VERSION, authority: 'SUPERVISOR_PORTFOLIO_EXCEPTIONS_AND_PRIORITIES' },
      warehouseIntelligence: { schemaVersion: warehouseIntel.WAREHOUSE_INTELLIGENCE_SCHEMA_VERSION, authority: 'STAGING_LOADING_COMPLETENESS_AND_DEPARTURE_READINESS' },
      fleetIntelligence: { schemaVersion: fleetIntel.FLEET_INTELLIGENCE_SCHEMA_VERSION, authority: 'VEHICLE_READINESS_AVAILABILITY_AND_ROUTE_IMPACT' },
      customerIntelligence: { schemaVersion: customerIntel.CUSTOMER_INTELLIGENCE_SCHEMA_VERSION, authority: 'CUSTOMER_ACCOUNT_OPERATIONAL_CONTEXT_AND_HISTORY' },
      existingLogisticsIntelligence: { boundary: 'REFERENCE_ONLY', servicePath: 'bridge-api/services/logisticsIntelligence.js' },
      existingBiKpi: { boundary: 'REFERENCE_ONLY', servicePath: 'bridge-api/services/biKpi.js' },
      existingOperationalHeatmaps: { boundary: 'REFERENCE_ONLY', routePath: 'bridge-api/routes/operationalHeatmaps.js' }
    }
  });
}

function validateOperationsAssessment(assessment = {}) {
  const errors = [];
  for (const field of scanProhibitedFields(assessment)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (assessment.lowerDomainOverrideAttempted !== false) errors.push({ rule: 'LOWER_DOMAIN_FACT_OVERRIDDEN' });
  if (assessment.correlationUsedAsCausation !== false) errors.push({ rule: 'CORRELATION_USED_AS_CAUSATION' });
  if (assessment.context?.organizationIsolationPreserved !== true && !assessment.exceptions?.some((item) => item.exceptionType === 'HUMAN_REVIEW_REQUIRED')) errors.push({ rule: 'CROSS_ORGANIZATION_EVIDENCE_AGGREGATED' });
  if (assessment.context?.unknownFields?.length && !assessment.exceptions?.some((item) => ['INSUFFICIENT_EVIDENCE','DRIVER_OPERATIONAL_EVIDENCE_UNAVAILABLE'].includes(item.exceptionType))) errors.push({ rule: 'UNKNOWN_SOURCE_EVIDENCE_TREATED_AS_KNOWN' });
  if (assessment.context?.staleEvidenceIndicators?.length && !assessment.exceptions?.some((item) => item.exceptionType === 'OPERATIONAL_EVIDENCE_STALE')) errors.push({ rule: 'STALE_EVIDENCE_TREATED_AS_FRESH' });
  if (assessment.explanation?.correlations?.some((item) => item.causationClaimed !== false)) errors.push({ rule: 'CORRELATION_USED_AS_CAUSATION' });
  for (const field of ['providerCallInvoked','hostedAiInvoked','modelSelectionActivated','productionApiExposed','migrationExecuted','deploymentExecuted','predictionGenerated','autonomousActionGenerated','employmentScoringGenerated','productSuiteExpansionGenerated','safetyIntelligenceStarted']) {
    if (assessment[field] !== false) errors.push({ rule: 'PROHIBITED_CAPABILITY_FLAG', field });
  }
  if (!assessment.assessmentHash || assessment.assessmentHash !== sha256({ ...assessment, assessmentHash: undefined })) errors.push({ rule: 'ASSESSMENT_HASH_MISMATCH' });
  return stable({ valid: errors.length === 0, errors });
}

function validateOperationsIntelligenceEvidence(evidence = buildOperationsIntelligenceEvidence()) {
  const errors = [];
  for (const field of ['providerCallInvoked','hostedAiInvoked','modelSelectionActivated','productionOrchestrationActivated','productionApiExposed','migrationExecuted','deploymentExecuted','productionApplicable','lowerDomainOverrideGenerated','causationInferredFromCorrelation','employeeScoringGenerated','driverRankingGenerated','autonomousActionGenerated','predictionGenerated','demandForecastGenerated','productSuiteExpansionGenerated','safetyIntelligenceStarted']) {
    if (evidence.catalog[field] !== false) errors.push({ rule: 'PROHIBITED_CAPABILITY_FLAG', field });
  }
  for (const field of ['currentOperationsFunctionalityAuditComplete','serviceReuseDecisionDocumented','integratedWithEnterpriseRegistry','integratedWithCapabilityOrchestration','integratedWithLifecycleFramework','integratedWithRouteIntelligence','integratedWithDriverIntelligence','integratedWithSupervisorIntelligence','integratedWithWarehouseIntelligence','integratedWithFleetIntelligence','integratedWithCustomerIntelligence']) {
    if (evidence.catalog[field] !== true) errors.push({ rule: 'PLATFORM_INTEGRATION_MISSING', field });
  }
  for (const field of scanProhibitedFields(evidence)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (/AI-IEP-005B\.\d+/.test(stableStringify(evidence))) errors.push({ rule: 'OPERATIONS_PACKAGE_NUMBER_FABRICATED' });
  if (/SAFETY_INTELLIGENCE_IMPLEMENTED/.test(stableStringify(evidence))) errors.push({ rule: 'SAFETY_INTELLIGENCE_STARTED' });
  for (const benchmark of evidence.benchmarkCases || []) {
    const record = evidence.assessments.find((item) => item.caseId === benchmark.caseId);
    if (!record) errors.push({ rule: 'MISSING_BENCHMARK_ASSESSMENT', caseId: benchmark.caseId });
    else {
      const exceptionTypes = record.assessment.exceptions.map((item) => item.exceptionType);
      if (benchmark.expectedException !== 'NO_EXCEPTION_OR_INFORMATIONAL' && !exceptionTypes.includes(benchmark.expectedException)) errors.push({ rule: 'BENCHMARK_EXPECTATION_MISMATCH', caseId: benchmark.caseId, expected: benchmark.expectedException, actual: exceptionTypes });
      if (benchmark.expectedException === 'NO_EXCEPTION_OR_INFORMATIONAL' && exceptionTypes.length > 0) errors.push({ rule: 'NORMAL_COOCCURRENCE_FALSE_EXCEPTION', caseId: benchmark.caseId, actual: exceptionTypes });
      for (const error of validateOperationsAssessment(record.assessment).errors) errors.push({ ...error, caseId: benchmark.caseId });
    }
  }
  return stable({ valid: errors.length === 0, errors });
}

module.exports = {
  ALERT_STATUSES,
  DETERMINISTIC_GENERATED_AT,
  EVIDENCE_COMPLETENESS_STATES,
  EVIDENCE_CONFIDENCE_STATES,
  EVIDENCE_FRESHNESS_STATES,
  EXCEPTION_TYPES,
  NEXT_STEPS,
  OPERATIONS_CAPABILITIES,
  OPERATIONS_INTELLIGENCE_ENGINE_VERSION,
  OPERATIONS_INTELLIGENCE_SCHEMA_VERSION,
  PROHIBITED_FIELDS,
  REASON_CODES,
  SEVERITIES,
  SOURCE_DOMAINS,
  acknowledgeOperationsAlert,
  aggregateCustomerServiceImpact,
  aggregateDriverOperationalState,
  aggregateFleetImpact,
  aggregateSupervisorImpact,
  aggregateWarehouseImpact,
  buildBenchmarkCases,
  buildOperationalContext,
  buildOperationalSnapshot,
  buildOperationsAlert,
  buildOperationsAssessment,
  buildOperationsEvidence,
  buildOperationsExplanation,
  buildOperationsIntelligenceEvidence,
  buildOperationsSummary,
  buildRoutePortfolioAggregate,
  classifyOperationsSeverity,
  correlateOperationalExceptions,
  detectOperationsExceptions,
  evidence,
  evidenceCompleteness,
  evidenceConfidence,
  evidenceFreshness,
  invalidateOperationsAlertWithNewEvidence,
  normalizeEvidence,
  operationsContextContract,
  prioritizeOperationsAlert,
  querySyntheticOperationsAssessments,
  resolveOperationsAlert,
  scanProhibitedFields,
  sha256,
  stable,
  stableStringify,
  validateOperationsAssessment,
  validateOperationsContext,
  validateOperationsIntelligenceEvidence,
  paths: { backendRoot, repoRoot, docsRoot, generatedRoot }
};
