const path = require('path');
const governance = require('./decisionGovernance');
const registry = require('./enterpriseCapabilityRegistry');
const orchestration = require('./intelligenceCapabilityOrchestration');
const lifecycle = require('./intelligenceLifecycleFramework');
const routeIntel = require('./routeIntelligence');
const driverIntel = require('./driverIntelligence');
const supervisorIntel = require('./supervisorOperationalIntelligence');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'implementation');
const generatedRoot = path.join(docsRoot, 'warehouse-intelligence-foundation', 'generated');
const WAREHOUSE_INTELLIGENCE_SCHEMA_VERSION = 'warehouse.intelligence.foundation.v1';
const WAREHOUSE_INTELLIGENCE_ENGINE_VERSION = 'warehouse.intelligence.foundation.engine.v1';
const DETERMINISTIC_GENERATED_AT = '2026-08-08T00:00:00.000Z';

const STAGING_STATES = Object.freeze(['NOT_STAGED','STAGING','STAGED','STAGING_BLOCKED','INSUFFICIENT_EVIDENCE','UNKNOWN']);
const LOADING_STATES = Object.freeze(['NOT_STARTED','LOADING','PARTIALLY_LOADED','LOADED','LOAD_BLOCKED','LOAD_DISCREPANCY','INSUFFICIENT_EVIDENCE','UNKNOWN']);
const ASSIGNMENT_OUTCOMES = Object.freeze(['MATCH','MISMATCH','PARTIAL_MATCH','INSUFFICIENT_EVIDENCE','UNKNOWN']);
const COMPLETENESS_OUTCOMES = Object.freeze(['COMPLETE','INCOMPLETE','DISCREPANCY','INSUFFICIENT_EVIDENCE','UNKNOWN']);
const READINESS_STATES = Object.freeze(['READY','READY_WITH_REVIEW','NOT_READY','BLOCKED','INSUFFICIENT_EVIDENCE','UNKNOWN']);
const SEVERITIES = Object.freeze(['INFORMATIONAL','LOW','MODERATE','HIGH','CRITICAL','UNKNOWN']);
const ALERT_STATUSES = Object.freeze(['OPEN','ACKNOWLEDGED','UNDER_REVIEW','RESOLVED','DISMISSED_AS_DUPLICATE','INVALIDATED_BY_NEW_EVIDENCE','UNKNOWN']);
const NEXT_STEPS = Object.freeze(['REVIEW_LOAD_ASSIGNMENT','REVIEW_STAGING_STATUS','REVIEW_LOAD_COMPLETENESS','REVIEW_PRODUCT_DISCREPANCY','REVIEW_QUANTITY_DISCREPANCY','REVIEW_MISSING_EVIDENCE','CONTACT_SUPERVISOR','HOLD_DEPARTURE_FOR_REVIEW','CLEAR_FOR_DEPARTURE','UNABLE_TO_DETERMINE']);
const DISCREPANCY_TYPES = Object.freeze(['LOAD_ASSIGNMENT_MISMATCH','ROUTE_LOAD_MISMATCH','PRODUCT_MISSING','PRODUCT_UNEXPECTED','QUANTITY_SHORT','QUANTITY_OVER','DUPLICATE_PRODUCT_EVIDENCE','MANIFEST_EVIDENCE_MISSING','LOAD_EVIDENCE_MISSING','LOAD_EVIDENCE_STALE','LOAD_EVIDENCE_CONFLICT','STAGING_EVIDENCE_MISSING','LOADING_NOT_COMPLETE','ROUTE_NOT_READY_FOR_DEPARTURE','HUMAN_REVIEW_REQUIRED','INSUFFICIENT_EVIDENCE']);
const EXCEPTION_TYPES = Object.freeze(['ROUTE_NOT_STAGED','ROUTE_STAGING_BLOCKED','LOAD_NOT_STARTED','LOAD_INCOMPLETE','LOAD_BLOCKED','LOAD_ASSIGNMENT_MISMATCH','PRODUCT_MISSING','PRODUCT_UNEXPECTED','QUANTITY_SHORT','QUANTITY_OVER','LOAD_EVIDENCE_MISSING','LOAD_EVIDENCE_STALE','LOAD_EVIDENCE_CONFLICT','ROUTE_DEPARTURE_NOT_READY','ROUTE_DEPARTURE_BLOCKED','SUPERVISOR_REVIEW_REQUIRED','WAREHOUSE_REVIEW_REQUIRED','INSUFFICIENT_EVIDENCE']);
const REASON_CODES = Object.freeze({
  ROUTE_LOAD_ASSIGNMENT_VERIFIED: 'ROUTE_LOAD_ASSIGNMENT_VERIFIED',
  ROUTE_LOAD_ASSIGNMENT_MISMATCH: 'ROUTE_LOAD_ASSIGNMENT_MISMATCH',
  STAGING_NOT_STARTED: 'STAGING_NOT_STARTED',
  STAGING_IN_PROGRESS: 'STAGING_IN_PROGRESS',
  STAGING_COMPLETE: 'STAGING_COMPLETE',
  STAGING_BLOCKED: 'STAGING_BLOCKED',
  LOADING_NOT_STARTED: 'LOADING_NOT_STARTED',
  LOADING_IN_PROGRESS: 'LOADING_IN_PROGRESS',
  LOADING_COMPLETE: 'LOADING_COMPLETE',
  LOADING_INCOMPLETE: 'LOADING_INCOMPLETE',
  PRODUCT_EXPECTED_NOT_OBSERVED: 'PRODUCT_EXPECTED_NOT_OBSERVED',
  PRODUCT_UNEXPECTED: 'PRODUCT_UNEXPECTED',
  QUANTITY_BELOW_EXPECTED: 'QUANTITY_BELOW_EXPECTED',
  QUANTITY_ABOVE_EXPECTED: 'QUANTITY_ABOVE_EXPECTED',
  MANIFEST_EVIDENCE_UNAVAILABLE: 'MANIFEST_EVIDENCE_UNAVAILABLE',
  LOAD_EVIDENCE_UNAVAILABLE: 'LOAD_EVIDENCE_UNAVAILABLE',
  LOAD_EVIDENCE_STALE: 'LOAD_EVIDENCE_STALE',
  LOAD_EVIDENCE_CONFLICT: 'LOAD_EVIDENCE_CONFLICT',
  DEPARTURE_READY: 'DEPARTURE_READY',
  DEPARTURE_READY_WITH_REVIEW: 'DEPARTURE_READY_WITH_REVIEW',
  DEPARTURE_NOT_READY: 'DEPARTURE_NOT_READY',
  DEPARTURE_BLOCKED: 'DEPARTURE_BLOCKED',
  SUPERVISOR_REVIEW_REQUIRED: 'SUPERVISOR_REVIEW_REQUIRED',
  WAREHOUSE_REVIEW_REQUIRED: 'WAREHOUSE_REVIEW_REQUIRED',
  HUMAN_REVIEW_REQUIRED: 'HUMAN_REVIEW_REQUIRED',
  EVIDENCE_INSUFFICIENT: 'EVIDENCE_INSUFFICIENT',
  ALERT_ACKNOWLEDGED: 'ALERT_ACKNOWLEDGED',
  ALERT_RESOLVED: 'ALERT_RESOLVED',
  ALERT_INVALIDATED_BY_NEW_EVIDENCE: 'ALERT_INVALIDATED_BY_NEW_EVIDENCE'
});
const PROHIBITED_FIELDS = Object.freeze(['employeeScore','warehouseEmployeeRank','employeeRank','productivityRating','pickingSpeedScore','loaderPerformanceRank','disciplinaryRecommendation','terminationRecommendation','compensationDecision','attendanceDiscipline','negligenceConclusion','autonomousWorkforceDecision','autonomousPurchaseRecommendation','roboticsAction','provider','providerId','model','modelId','modelSelection','productionActivation','implementationPackageNumber','fleetIntelligenceImplemented']);
const WAREHOUSE_CAPABILITIES = Object.freeze([
  { capabilityId: 'warehouse.operational_context.validation', displayName: 'Warehouse Operational Context Validation', executionStrategy: 'DETERMINISTIC_RULES', employeeScoring: false },
  { capabilityId: 'warehouse.route_load.assessment', displayName: 'Route Load Assessment', executionStrategy: 'DETERMINISTIC_RULES', employeeScoring: false },
  { capabilityId: 'warehouse.departure_readiness.assessment', displayName: 'Departure Readiness Assessment', executionStrategy: 'DETERMINISTIC_RULES', employeeScoring: false },
  { capabilityId: 'warehouse.exception.alerting', displayName: 'Warehouse Exception Alerting', executionStrategy: 'DETERMINISTIC_RULES', employeeScoring: false },
  { capabilityId: 'warehouse.evidence.explanation', displayName: 'Warehouse Evidence Explanation', executionStrategy: 'DETERMINISTIC_RULES', employeeScoring: false }
]);

function stable(value) { return governance.stable(value); }
function stableStringify(value) { return governance.stableStringify(value); }
function sha256(value) { return governance.sha256(value); }
function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function nowMs(value) { const t = Date.parse(value || ''); return Number.isFinite(t) ? t : null; }
function minutesBetween(later, earlier) {
  const l = nowMs(later);
  const e = nowMs(earlier);
  return Number.isFinite(l) && Number.isFinite(e) ? Math.max(0, (l - e) / 60000) : null;
}
function productKey(line = {}) {
  return String(line.sku || line.productId || line.productName || '').trim().toLowerCase() || null;
}
function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}
function scanProhibitedFields(value) {
  const text = stableStringify(value);
  return PROHIBITED_FIELDS.filter((field) => new RegExp(`"${field}"\\s*:`).test(text));
}

function validateWarehouseContext(context = {}) {
  const errors = [];
  for (const field of PROHIBITED_FIELDS) {
    if (hasOwn(context, field)) errors.push({ rule: 'PROHIBITED_FIELD', field, reasonCode: REASON_CODES.EVIDENCE_INSUFFICIENT });
  }
  if (!context.organizationId) errors.push({ rule: 'ORGANIZATION_REQUIRED', reasonCode: REASON_CODES.EVIDENCE_INSUFFICIENT });
  if (!context.warehouseContextId) errors.push({ rule: 'WAREHOUSE_CONTEXT_REQUIRED', reasonCode: REASON_CODES.EVIDENCE_INSUFFICIENT });
  if (!context.warehouseReference) errors.push({ rule: 'WAREHOUSE_REFERENCE_REQUIRED', reasonCode: REASON_CODES.EVIDENCE_INSUFFICIENT });
  if (!context.authorizedActorRef) errors.push({ rule: 'AUTHORIZED_ACTOR_REQUIRED', reasonCode: REASON_CODES.EVIDENCE_INSUFFICIENT });
  if (!context.workPeriodRef) errors.push({ rule: 'WORK_PERIOD_REQUIRED', reasonCode: REASON_CODES.EVIDENCE_INSUFFICIENT });
  return stable({
    valid: errors.length === 0,
    errors,
    trustedServerDerivedInFutureRuntime: ['organizationId','authorizedActorRef','warehouseReference'],
    warehouseMfaRequiredInFutureRuntime: true,
    providerModelControlsRejected: true,
    validationHash: sha256({ context, errors })
  });
}

function evidenceCompleteness(routeLoad = {}) {
  const required = ['routeId','organizationId','expectedLines','observedLines','loadAssignmentEvidence'];
  const items = required.map((field) => ({ field, present: hasOwn(routeLoad, field) && routeLoad[field] !== null && routeLoad[field] !== '' }));
  const score = items.filter((item) => item.present).length / items.length;
  return stable({ status: score === 1 ? 'COMPLETE' : score >= 0.6 ? 'PARTIAL' : 'INSUFFICIENT', score: Number(score.toFixed(3)), items });
}

function evidenceConfidence(routeLoad = {}, completeness = evidenceCompleteness(routeLoad)) {
  if (routeLoad.evidenceConflict === true) return { status: 'CONFLICTING_EVIDENCE', score: 0.2 };
  if (routeLoad.evidenceStale === true) return { status: 'STALE_EVIDENCE', score: 0.4 };
  if (completeness.status === 'COMPLETE') return { status: 'KNOWN_SYNTHETIC_EVIDENCE', score: 1 };
  if (completeness.status === 'PARTIAL') return { status: 'PARTIAL_SYNTHETIC_EVIDENCE', score: 0.6 };
  return { status: 'INSUFFICIENT_EVIDENCE', score: null };
}

function validateWarehouseEvidence(input = {}) {
  const errors = [];
  const text = stableStringify(input);
  for (const field of scanProhibitedFields(input)) errors.push({ rule: 'PROHIBITED_FIELD', field });
  if (/"quantity"\s*:\s*null/.test(text) && /"observedQuantity"\s*:\s*0/.test(text)) errors.push({ rule: 'UNKNOWN_QUANTITY_CONVERTED_TO_ZERO' });
  return stable({ valid: errors.length === 0, errors, validationHash: sha256({ input, errors }) });
}

function buildWarehouseEvidence(routeLoad = {}) {
  const completeness = evidenceCompleteness(routeLoad);
  const confidence = evidenceConfidence(routeLoad, completeness);
  return stable({
    evidenceSources: routeLoad.evidenceSources || ['synthetic.route_manifest', 'synthetic.load_evidence'],
    evidenceTimestamps: routeLoad.evidenceTimestamps || [],
    sourceHashes: stable((routeLoad.evidenceSources || []).map((source) => ({ source, hash: sha256({ source, routeId: routeLoad.routeId, loadId: routeLoad.loadId || routeLoad.manifestRef || null }) }))),
    completeness,
    confidence,
    stale: routeLoad.evidenceStale === true,
    conflict: routeLoad.evidenceConflict === true,
    unknownFields: routeLoad.unknownFields || [],
    syntheticOnly: true
  });
}

function buildRouteLoadContext(input = {}) {
  const context = input.warehouseContext || {};
  const routeLoad = input.routeLoad || {};
  const contextValidation = validateWarehouseContext(context);
  const organizationMatches = !routeLoad.organizationId || !context.organizationId || routeLoad.organizationId === context.organizationId;
  const evidence = buildWarehouseEvidence(routeLoad);
  const record = {
    schemaVersion: 'warehouse.route.load.context.v1',
    warehouseContextId: context.warehouseContextId || null,
    organizationId: organizationMatches ? (routeLoad.organizationId || context.organizationId || null) : null,
    routeId: routeLoad.routeId || null,
    loadId: routeLoad.loadId || null,
    manifestRef: routeLoad.manifestRef || routeLoad.manifestId || null,
    assignedDriverRef: routeLoad.assignedDriverRef || routeLoad.assignedDriverId || null,
    assignedVehicleRef: routeLoad.assignedVehicleRef || routeLoad.assignedVehicleId || null,
    stagingAreaRef: routeLoad.stagingAreaRef || null,
    expectedLines: Array.isArray(routeLoad.expectedLines) ? stable(routeLoad.expectedLines) : null,
    observedLines: Array.isArray(routeLoad.observedLines) ? stable(routeLoad.observedLines) : null,
    expectedRouteId: routeLoad.expectedRouteId || routeLoad.routeId || null,
    observedRouteId: routeLoad.observedRouteId || routeLoad.routeId || null,
    expectedLoadId: routeLoad.expectedLoadId || routeLoad.loadId || routeLoad.manifestRef || null,
    observedLoadId: routeLoad.observedLoadId || routeLoad.loadId || routeLoad.manifestRef || null,
    loadAssignmentEvidence: routeLoad.loadAssignmentEvidence || null,
    stagingEvidence: routeLoad.stagingEvidence || null,
    loadingEvidence: routeLoad.loadingEvidence || null,
    loadCompletionEvidence: routeLoad.loadCompletionEvidence || null,
    routeSafetyAssessment: routeLoad.routeSafetyAssessment || null,
    driverOperationalAssessment: routeLoad.driverOperationalAssessment || null,
    supervisorReference: routeLoad.supervisorReference || null,
    evidence,
    evidenceCompleteness: evidence.completeness,
    evidenceConfidence: evidence.confidence,
    humanReviewRequired: routeLoad.humanReviewRequired === true || !contextValidation.valid || !organizationMatches || evidence.completeness.status !== 'COMPLETE' || evidence.conflict,
    discrepancyState: 'UNKNOWN',
    organizationIsolationPreserved: organizationMatches,
    testOnly: true
  };
  record.routeLoadContextHash = sha256(record);
  return stable(record);
}

function evaluateStagingState(routeLoadContext = {}) {
  const evidence = routeLoadContext.stagingEvidence;
  let state = 'UNKNOWN';
  let reasonCode = REASON_CODES.EVIDENCE_INSUFFICIENT;
  if (!evidence) {
    state = 'INSUFFICIENT_EVIDENCE';
    reasonCode = REASON_CODES.STAGING_EVIDENCE_MISSING;
  } else if (evidence.blocked === true) {
    state = 'STAGING_BLOCKED';
    reasonCode = REASON_CODES.STAGING_BLOCKED;
  } else if (evidence.staged === true || evidence.status === 'STAGED') {
    state = 'STAGED';
    reasonCode = REASON_CODES.STAGING_COMPLETE;
  } else if (evidence.status === 'STAGING' || evidence.inProgress === true) {
    state = 'STAGING';
    reasonCode = REASON_CODES.STAGING_IN_PROGRESS;
  } else if (evidence.status === 'NOT_STAGED' || evidence.notStarted === true) {
    state = 'NOT_STAGED';
    reasonCode = REASON_CODES.STAGING_NOT_STARTED;
  }
  const result = { state, reasonCode, evidenceRef: evidence?.evidenceId || null, deterministic: true, testOnly: true };
  result.stagingStateHash = sha256(result);
  return stable(result);
}

function evaluateLoadingState(routeLoadContext = {}) {
  const evidence = routeLoadContext.loadingEvidence || routeLoadContext.loadCompletionEvidence;
  let state = 'UNKNOWN';
  let reasonCode = REASON_CODES.EVIDENCE_INSUFFICIENT;
  if (!evidence) {
    state = 'INSUFFICIENT_EVIDENCE';
    reasonCode = REASON_CODES.LOAD_EVIDENCE_UNAVAILABLE;
  } else if (evidence.blocked === true) {
    state = 'LOAD_BLOCKED';
    reasonCode = REASON_CODES.LOADING_INCOMPLETE;
  } else if (evidence.discrepancy === true) {
    state = 'LOAD_DISCREPANCY';
    reasonCode = REASON_CODES.LOADING_INCOMPLETE;
  } else if (evidence.complete === true || evidence.status === 'LOADED') {
    state = 'LOADED';
    reasonCode = REASON_CODES.LOADING_COMPLETE;
  } else if (evidence.status === 'PARTIALLY_LOADED' || evidence.partial === true) {
    state = 'PARTIALLY_LOADED';
    reasonCode = REASON_CODES.LOADING_INCOMPLETE;
  } else if (evidence.status === 'LOADING' || evidence.inProgress === true) {
    state = 'LOADING';
    reasonCode = REASON_CODES.LOADING_IN_PROGRESS;
  } else if (evidence.status === 'NOT_STARTED' || evidence.notStarted === true) {
    state = 'NOT_STARTED';
    reasonCode = REASON_CODES.LOADING_NOT_STARTED;
  }
  const result = { state, reasonCode, evidenceRef: evidence?.evidenceId || null, deterministic: true, testOnly: true };
  result.loadingStateHash = sha256(result);
  return stable(result);
}

function verifyLoadAssignment(routeLoadContext = {}) {
  const facts = {
    expectedRouteId: routeLoadContext.expectedRouteId || null,
    observedRouteId: routeLoadContext.observedRouteId || null,
    expectedLoadId: routeLoadContext.expectedLoadId || null,
    observedLoadId: routeLoadContext.observedLoadId || null,
    assignedDriverRef: routeLoadContext.assignedDriverRef || null,
    assignedVehicleRef: routeLoadContext.assignedVehicleRef || null,
    organizationId: routeLoadContext.organizationId || null
  };
  let outcome = 'UNKNOWN';
  let reasonCode = REASON_CODES.EVIDENCE_INSUFFICIENT;
  if (!routeLoadContext.loadAssignmentEvidence || !facts.expectedRouteId || !facts.expectedLoadId || !facts.observedRouteId || !facts.observedLoadId) {
    outcome = 'INSUFFICIENT_EVIDENCE';
  } else {
    const routeMatch = facts.expectedRouteId === facts.observedRouteId;
    const loadMatch = facts.expectedLoadId === facts.observedLoadId;
    outcome = routeMatch && loadMatch ? 'MATCH' : routeMatch || loadMatch ? 'PARTIAL_MATCH' : 'MISMATCH';
    reasonCode = outcome === 'MATCH' ? REASON_CODES.ROUTE_LOAD_ASSIGNMENT_VERIFIED : REASON_CODES.ROUTE_LOAD_ASSIGNMENT_MISMATCH;
  }
  const result = { outcome, reasonCode, facts, deterministic: true, employmentImpactProhibited: true, testOnly: true };
  result.assignmentHash = sha256(result);
  return stable(result);
}

function lineMaps(lines = []) {
  const map = new Map();
  const duplicates = [];
  for (const line of lines || []) {
    const key = productKey(line);
    if (!key) continue;
    if (map.has(key)) duplicates.push(key);
    const existing = map.get(key) || { sourceLines: [], ...line, quantity: undefined };
    const q = hasOwn(line, 'quantity') ? numberOrNull(line.quantity) : null;
    const existingQuantity = existing.quantity === undefined ? undefined : numberOrNull(existing.quantity);
    const quantity = q === null || existingQuantity === null ? null : existingQuantity === undefined ? q : existingQuantity + q;
    map.set(key, { ...existing, ...line, quantity, sourceLines: existing.sourceLines.concat([line]) });
  }
  return { map, duplicates: [...new Set(duplicates)].sort() };
}

function assessLoadCompleteness(routeLoadContext = {}) {
  if (!Array.isArray(routeLoadContext.expectedLines)) {
    const result = { outcome: 'INSUFFICIENT_EVIDENCE', reasonCodes: [REASON_CODES.MANIFEST_EVIDENCE_UNAVAILABLE], missingLines: [], unexpectedLines: [], quantityDiscrepancies: [], duplicateProductEvidence: [], unknownQuantities: [], testOnly: true };
    result.completenessHash = sha256(result);
    return stable(result);
  }
  if (!Array.isArray(routeLoadContext.observedLines)) {
    const result = { outcome: 'INSUFFICIENT_EVIDENCE', reasonCodes: [REASON_CODES.LOAD_EVIDENCE_UNAVAILABLE], missingLines: [], unexpectedLines: [], quantityDiscrepancies: [], duplicateProductEvidence: [], unknownQuantities: [], testOnly: true };
    result.completenessHash = sha256(result);
    return stable(result);
  }
  const expected = lineMaps(routeLoadContext.expectedLines);
  const observed = lineMaps(routeLoadContext.observedLines);
  const missingLines = [];
  const unexpectedLines = [];
  const quantityDiscrepancies = [];
  const unknownQuantities = [];
  for (const [key, expectedLine] of expected.map.entries()) {
    const observedLine = observed.map.get(key);
    if (!observedLine) {
      missingLines.push({ productKey: key, expected: expectedLine, observed: null });
      continue;
    }
    if (expectedLine.quantity === null || observedLine.quantity === null) {
      unknownQuantities.push({ productKey: key, expectedQuantity: expectedLine.quantity, observedQuantity: observedLine.quantity });
    } else if (observedLine.quantity < expectedLine.quantity) {
      quantityDiscrepancies.push({ productKey: key, type: 'QUANTITY_SHORT', expectedQuantity: expectedLine.quantity, observedQuantity: observedLine.quantity });
    } else if (observedLine.quantity > expectedLine.quantity) {
      quantityDiscrepancies.push({ productKey: key, type: 'QUANTITY_OVER', expectedQuantity: expectedLine.quantity, observedQuantity: observedLine.quantity });
    }
  }
  for (const [key, observedLine] of observed.map.entries()) {
    if (!expected.map.has(key)) unexpectedLines.push({ productKey: key, expected: null, observed: observedLine });
  }
  const duplicateProductEvidence = [...new Set(expected.duplicates.concat(observed.duplicates))].sort();
  const reasonCodes = [];
  if (missingLines.length) reasonCodes.push(REASON_CODES.PRODUCT_EXPECTED_NOT_OBSERVED);
  if (unexpectedLines.length) reasonCodes.push(REASON_CODES.PRODUCT_UNEXPECTED);
  if (quantityDiscrepancies.some((item) => item.type === 'QUANTITY_SHORT')) reasonCodes.push(REASON_CODES.QUANTITY_BELOW_EXPECTED);
  if (quantityDiscrepancies.some((item) => item.type === 'QUANTITY_OVER')) reasonCodes.push(REASON_CODES.QUANTITY_ABOVE_EXPECTED);
  if (unknownQuantities.length) reasonCodes.push(REASON_CODES.EVIDENCE_INSUFFICIENT);
  if (duplicateProductEvidence.length) reasonCodes.push(REASON_CODES.LOAD_EVIDENCE_CONFLICT);
  const hasDiscrepancy = missingLines.length || unexpectedLines.length || quantityDiscrepancies.length || duplicateProductEvidence.length;
  const outcome = unknownQuantities.length ? 'INSUFFICIENT_EVIDENCE' : hasDiscrepancy ? 'DISCREPANCY' : 'COMPLETE';
  const result = { outcome, reasonCodes: reasonCodes.length ? reasonCodes : [REASON_CODES.LOADING_COMPLETE], expectedLineCount: expected.map.size, observedLineCount: observed.map.size, missingLines, unexpectedLines, quantityDiscrepancies, duplicateProductEvidence, unknownQuantities, testOnly: true };
  result.completenessHash = sha256(result);
  return stable(result);
}

function discrepancyRecord(type, routeLoadContext, reasonCode, details = {}) {
  const record = {
    discrepancyId: `warehouse.discrepancy.${routeLoadContext.routeId || 'unknown'}.${type.toLowerCase()}.${sha256(details).slice(0, 12)}`,
    discrepancyType: type,
    organizationId: routeLoadContext.organizationId || null,
    routeId: routeLoadContext.routeId || null,
    loadRef: routeLoadContext.loadId || routeLoadContext.manifestRef || null,
    productRef: details.productKey || null,
    expectedValue: hasOwn(details, 'expectedValue') ? details.expectedValue : null,
    observedValue: hasOwn(details, 'observedValue') ? details.observedValue : null,
    evidenceReferences: details.evidenceReferences || routeLoadContext.evidence.evidenceSources || [],
    evidenceTimestamps: routeLoadContext.evidence.evidenceTimestamps || [],
    completeness: routeLoadContext.evidenceCompleteness,
    confidence: routeLoadContext.evidenceConfidence,
    reasonCodes: [reasonCode],
    operationalImpact: details.operationalImpact || 'WAREHOUSE_REVIEW_REQUIRED',
    humanReviewRequired: details.humanReviewRequired !== false,
    employmentImpactProhibited: true,
    testOnly: true
  };
  record.discrepancyHash = sha256(record);
  return stable(record);
}

function detectLoadDiscrepancies(routeLoadContext, assignment, completeness, staging, loading) {
  const records = [];
  if (assignment.outcome === 'MISMATCH' || assignment.outcome === 'PARTIAL_MATCH') records.push(discrepancyRecord('LOAD_ASSIGNMENT_MISMATCH', routeLoadContext, REASON_CODES.ROUTE_LOAD_ASSIGNMENT_MISMATCH, { expectedValue: assignment.facts.expectedLoadId, observedValue: assignment.facts.observedLoadId, operationalImpact: 'HOLD_DEPARTURE_FOR_REVIEW' }));
  if (assignment.outcome === 'INSUFFICIENT_EVIDENCE') records.push(discrepancyRecord('INSUFFICIENT_EVIDENCE', routeLoadContext, REASON_CODES.EVIDENCE_INSUFFICIENT, { operationalImpact: 'UNABLE_TO_DETERMINE' }));
  if (completeness.outcome === 'INSUFFICIENT_EVIDENCE') records.push(discrepancyRecord(completeness.reasonCodes.includes(REASON_CODES.MANIFEST_EVIDENCE_UNAVAILABLE) ? 'MANIFEST_EVIDENCE_MISSING' : 'LOAD_EVIDENCE_MISSING', routeLoadContext, completeness.reasonCodes[0], { operationalImpact: 'UNABLE_TO_DETERMINE' }));
  for (const item of completeness.missingLines || []) records.push(discrepancyRecord('PRODUCT_MISSING', routeLoadContext, REASON_CODES.PRODUCT_EXPECTED_NOT_OBSERVED, { productKey: item.productKey, expectedValue: item.expected?.quantity ?? null, observedValue: null }));
  for (const item of completeness.unexpectedLines || []) records.push(discrepancyRecord('PRODUCT_UNEXPECTED', routeLoadContext, REASON_CODES.PRODUCT_UNEXPECTED, { productKey: item.productKey, expectedValue: null, observedValue: item.observed?.quantity ?? null }));
  for (const item of completeness.quantityDiscrepancies || []) records.push(discrepancyRecord(item.type, routeLoadContext, item.type === 'QUANTITY_SHORT' ? REASON_CODES.QUANTITY_BELOW_EXPECTED : REASON_CODES.QUANTITY_ABOVE_EXPECTED, { productKey: item.productKey, expectedValue: item.expectedQuantity, observedValue: item.observedQuantity }));
  for (const product of completeness.duplicateProductEvidence || []) records.push(discrepancyRecord('DUPLICATE_PRODUCT_EVIDENCE', routeLoadContext, REASON_CODES.LOAD_EVIDENCE_CONFLICT, { productKey: product, operationalImpact: 'WAREHOUSE_REVIEW_REQUIRED' }));
  if (routeLoadContext.evidence.stale) records.push(discrepancyRecord('LOAD_EVIDENCE_STALE', routeLoadContext, REASON_CODES.LOAD_EVIDENCE_STALE, { operationalImpact: 'WAREHOUSE_REVIEW_REQUIRED' }));
  if (routeLoadContext.evidence.conflict) records.push(discrepancyRecord('LOAD_EVIDENCE_CONFLICT', routeLoadContext, REASON_CODES.LOAD_EVIDENCE_CONFLICT, { operationalImpact: 'WAREHOUSE_REVIEW_REQUIRED' }));
  if (staging.state === 'INSUFFICIENT_EVIDENCE') records.push(discrepancyRecord('STAGING_EVIDENCE_MISSING', routeLoadContext, REASON_CODES.STAGING_EVIDENCE_MISSING, { operationalImpact: 'WAREHOUSE_REVIEW_REQUIRED' }));
  if (!['LOADED'].includes(loading.state)) records.push(discrepancyRecord('LOADING_NOT_COMPLETE', routeLoadContext, REASON_CODES.LOADING_INCOMPLETE, { operationalImpact: 'HOLD_DEPARTURE_FOR_REVIEW' }));
  return stable(records.sort((a, b) => a.discrepancyId.localeCompare(b.discrepancyId)));
}

function routeSafetyBlocked(routeLoadContext = {}) {
  const assessment = routeLoadContext.routeSafetyAssessment;
  return assessment?.status === routeIntel.ROUTE_SAFETY_STATUSES.UNSAFE || assessment?.eligible === false || assessment?.status === 'UNSAFE';
}

function assessDepartureReadiness(routeLoadContext, assignment, completeness, staging, loading, discrepancies = []) {
  let state = 'READY';
  let reasonCode = REASON_CODES.DEPARTURE_READY;
  if (routeSafetyBlocked(routeLoadContext)) {
    state = 'BLOCKED';
    reasonCode = REASON_CODES.DEPARTURE_BLOCKED;
  } else if (assignment.outcome === 'MISMATCH' || assignment.outcome === 'PARTIAL_MATCH') {
    state = 'BLOCKED';
    reasonCode = REASON_CODES.ROUTE_LOAD_ASSIGNMENT_MISMATCH;
  } else if (completeness.outcome === 'INSUFFICIENT_EVIDENCE' || assignment.outcome === 'INSUFFICIENT_EVIDENCE' || routeLoadContext.organizationIsolationPreserved !== true) {
    state = 'INSUFFICIENT_EVIDENCE';
    reasonCode = REASON_CODES.EVIDENCE_INSUFFICIENT;
  } else if (discrepancies.some((item) => ['PRODUCT_MISSING','QUANTITY_SHORT','LOAD_EVIDENCE_CONFLICT'].includes(item.discrepancyType))) {
    state = 'BLOCKED';
    reasonCode = REASON_CODES.DEPARTURE_BLOCKED;
  } else if (loading.state === 'LOAD_BLOCKED') {
    state = 'BLOCKED';
    reasonCode = REASON_CODES.DEPARTURE_BLOCKED;
  } else if (loading.state !== 'LOADED') {
    state = 'NOT_READY';
    reasonCode = REASON_CODES.LOADING_INCOMPLETE;
  } else if (staging.state !== 'STAGED') {
    state = staging.state === 'STAGING_BLOCKED' ? 'BLOCKED' : 'NOT_READY';
    reasonCode = staging.reasonCode;
  } else if (routeLoadContext.humanReviewRequired || discrepancies.length || completeness.outcome === 'DISCREPANCY') {
    state = 'READY_WITH_REVIEW';
    reasonCode = REASON_CODES.DEPARTURE_READY_WITH_REVIEW;
  }
  const result = {
    state,
    reasonCode,
    ruleTrace: ['safety/legal route blocker', 'wrong route/load assignment', 'required load missing', 'unresolved critical discrepancy', 'loading incomplete', 'staging incomplete', 'evidence conflict/staleness', 'human-review condition', 'ready'],
    routeSafetyAuthoritative: true,
    driverStateAuthoritativeElsewhere: true,
    costOrScheduleOverrideAllowed: false,
    humanReviewRequired: ['READY_WITH_REVIEW','BLOCKED','INSUFFICIENT_EVIDENCE','UNKNOWN'].includes(state),
    testOnly: true
  };
  result.readinessHash = sha256(result);
  return stable(result);
}

function classifyWarehouseSeverity(type, readinessState, reasonCode) {
  if (readinessState === 'BLOCKED' || ['LOAD_ASSIGNMENT_MISMATCH','ROUTE_DEPARTURE_BLOCKED'].includes(type)) return 'CRITICAL';
  if (['PRODUCT_MISSING','QUANTITY_SHORT','LOAD_EVIDENCE_CONFLICT','LOAD_BLOCKED'].includes(type)) return 'HIGH';
  if (['LOAD_INCOMPLETE','PRODUCT_UNEXPECTED','QUANTITY_OVER','ROUTE_DEPARTURE_NOT_READY'].includes(type)) return 'MODERATE';
  if (['LOAD_EVIDENCE_MISSING','LOAD_EVIDENCE_STALE','INSUFFICIENT_EVIDENCE'].includes(type) || reasonCode === REASON_CODES.EVIDENCE_INSUFFICIENT) return 'UNKNOWN';
  if (['ROUTE_NOT_STAGED','LOAD_NOT_STARTED'].includes(type)) return 'LOW';
  return 'INFORMATIONAL';
}

function classifyWarehouseException(discrepancy, routeLoadContext, readiness) {
  const map = {
    LOAD_ASSIGNMENT_MISMATCH: 'LOAD_ASSIGNMENT_MISMATCH',
    PRODUCT_MISSING: 'PRODUCT_MISSING',
    PRODUCT_UNEXPECTED: 'PRODUCT_UNEXPECTED',
    QUANTITY_SHORT: 'QUANTITY_SHORT',
    QUANTITY_OVER: 'QUANTITY_OVER',
    LOAD_EVIDENCE_MISSING: 'LOAD_EVIDENCE_MISSING',
    MANIFEST_EVIDENCE_MISSING: 'LOAD_EVIDENCE_MISSING',
    LOAD_EVIDENCE_STALE: 'LOAD_EVIDENCE_STALE',
    LOAD_EVIDENCE_CONFLICT: 'LOAD_EVIDENCE_CONFLICT',
    LOADING_NOT_COMPLETE: 'LOAD_INCOMPLETE',
    STAGING_EVIDENCE_MISSING: 'INSUFFICIENT_EVIDENCE',
    INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
  };
  const type = map[discrepancy.discrepancyType] || (readiness.state === 'BLOCKED' ? 'ROUTE_DEPARTURE_BLOCKED' : 'ROUTE_DEPARTURE_NOT_READY');
  const severity = classifyWarehouseSeverity(type, readiness.state, discrepancy.reasonCodes[0]);
  const record = {
    exceptionId: `warehouse.exception.${routeLoadContext.routeId || 'unknown'}.${type.toLowerCase()}.${sha256(discrepancy.discrepancyId).slice(0, 12)}`,
    exceptionType: type,
    organizationId: routeLoadContext.organizationId,
    routeId: routeLoadContext.routeId,
    loadRef: routeLoadContext.loadId || routeLoadContext.manifestRef || null,
    productRef: discrepancy.productRef || null,
    severity,
    operationalImpact: discrepancy.operationalImpact,
    evidenceReferences: discrepancy.evidenceReferences,
    reasonCodes: discrepancy.reasonCodes,
    humanReviewRequired: discrepancy.humanReviewRequired || ['CRITICAL','HIGH','UNKNOWN'].includes(severity),
    employmentImpactProhibited: true,
    testOnly: true
  };
  record.exceptionHash = sha256(record);
  return stable(record);
}

function nextStepForException(exception, readiness) {
  if (exception.exceptionType === 'LOAD_ASSIGNMENT_MISMATCH') return 'REVIEW_LOAD_ASSIGNMENT';
  if (exception.exceptionType === 'ROUTE_NOT_STAGED') return 'REVIEW_STAGING_STATUS';
  if (['LOAD_INCOMPLETE','LOAD_NOT_STARTED'].includes(exception.exceptionType)) return 'REVIEW_LOAD_COMPLETENESS';
  if (['PRODUCT_MISSING','PRODUCT_UNEXPECTED'].includes(exception.exceptionType)) return 'REVIEW_PRODUCT_DISCREPANCY';
  if (['QUANTITY_SHORT','QUANTITY_OVER'].includes(exception.exceptionType)) return 'REVIEW_QUANTITY_DISCREPANCY';
  if (/EVIDENCE|INSUFFICIENT/.test(exception.exceptionType)) return 'REVIEW_MISSING_EVIDENCE';
  if (readiness.state === 'BLOCKED') return 'HOLD_DEPARTURE_FOR_REVIEW';
  if (readiness.state === 'READY') return 'CLEAR_FOR_DEPARTURE';
  return 'UNABLE_TO_DETERMINE';
}

function buildWarehouseAlert(exception, readiness, lifecycleStatus = 'OPEN') {
  const priorityRank = { CRITICAL: 100, HIGH: 80, MODERATE: 60, UNKNOWN: 55, LOW: 40, INFORMATIONAL: 20 };
  const alert = {
    alertId: `warehouse.alert.${sha256(exception.exceptionId).slice(0, 16)}`,
    exceptionId: exception.exceptionId,
    routeId: exception.routeId,
    loadRef: exception.loadRef,
    productRef: exception.productRef,
    severity: exception.severity,
    priority: priorityRank[exception.severity] || 50,
    structuredFacts: { readinessState: readiness.state, reasonCodes: exception.reasonCodes },
    evidence: exception.evidenceReferences,
    reasonCodes: exception.reasonCodes,
    operationalNextStep: nextStepForException(exception, readiness),
    acknowledgementState: lifecycleStatus === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'NOT_ACKNOWLEDGED',
    resolutionState: ['RESOLVED','DISMISSED_AS_DUPLICATE','INVALIDATED_BY_NEW_EVIDENCE'].includes(lifecycleStatus) ? lifecycleStatus : 'UNRESOLVED',
    limitations: exception.severity === 'UNKNOWN' ? ['Evidence is insufficient or conflicting.'] : [],
    humanReviewRequired: exception.humanReviewRequired,
    employmentImpactProhibited: true,
    testOnly: true
  };
  alert.alertHash = sha256(alert);
  return stable(alert);
}

function acknowledgeWarehouseAlert(alert, actor = 'synthetic-warehouse-actor') {
  const updated = { ...alert, acknowledgementState: 'ACKNOWLEDGED', resolutionState: 'UNRESOLVED', lifecycleStatus: 'ACKNOWLEDGED', lifecycleReasonCode: REASON_CODES.ALERT_ACKNOWLEDGED, acknowledgedBy: actor };
  updated.alertHash = sha256({ ...updated, alertHash: undefined });
  return stable(updated);
}

function resolveWarehouseAlert(alert, actor = 'synthetic-warehouse-actor') {
  const updated = { ...alert, resolutionState: 'RESOLVED', lifecycleStatus: 'RESOLVED', lifecycleReasonCode: REASON_CODES.ALERT_RESOLVED, resolvedBy: actor };
  updated.alertHash = sha256({ ...updated, alertHash: undefined });
  return stable(updated);
}

function invalidateWarehouseAlert(alert) {
  const updated = { ...alert, resolutionState: 'INVALIDATED_BY_NEW_EVIDENCE', lifecycleStatus: 'INVALIDATED_BY_NEW_EVIDENCE', lifecycleReasonCode: REASON_CODES.ALERT_INVALIDATED_BY_NEW_EVIDENCE };
  updated.alertHash = sha256({ ...updated, alertHash: undefined });
  return stable(updated);
}

function buildWarehouseExplanation(record) {
  const reasonCodes = record.reasonCodes || record.readiness?.reasonCode ? [record.readiness.reasonCode] : [];
  const explanation = {
    explanationId: `warehouse.explanation.${sha256(record.alertId || record.exceptionId || record.readiness?.readinessHash || 'unknown').slice(0, 16)}`,
    derivedFromFacts: true,
    reasonCodes,
    text: `Warehouse readiness is ${record.readiness?.state || record.structuredFacts?.readinessState || 'UNKNOWN'} based only on supplied route/load, staging, loading, manifest, safety, and evidence records.`,
    limitations: record.limitations || [],
    employeeIntentInferred: false,
    negligenceInferred: false,
    productivityInferred: false,
    providerGenerated: false,
    employmentImpactProhibited: true,
    testOnly: true
  };
  explanation.explanationHash = sha256(explanation);
  return stable(explanation);
}

function assessWarehouseRouteLoad(input = {}) {
  const routeLoadContext = buildRouteLoadContext(input);
  const assignment = verifyLoadAssignment(routeLoadContext);
  const staging = evaluateStagingState(routeLoadContext);
  const loading = evaluateLoadingState(routeLoadContext);
  const completeness = assessLoadCompleteness(routeLoadContext);
  const discrepancies = detectLoadDiscrepancies(routeLoadContext, assignment, completeness, staging, loading);
  const readiness = assessDepartureReadiness(routeLoadContext, assignment, completeness, staging, loading, discrepancies);
  const exceptions = discrepancies.map((item) => classifyWarehouseException(item, routeLoadContext, readiness));
  if (readiness.state !== 'READY' && !exceptions.some((item) => item.exceptionType === 'ROUTE_DEPARTURE_NOT_READY' || item.exceptionType === 'ROUTE_DEPARTURE_BLOCKED')) {
    const synthetic = discrepancyRecord(readiness.state === 'BLOCKED' ? 'ROUTE_NOT_READY_FOR_DEPARTURE' : 'HUMAN_REVIEW_REQUIRED', routeLoadContext, readiness.reasonCode, { operationalImpact: readiness.state === 'BLOCKED' ? 'HOLD_DEPARTURE_FOR_REVIEW' : 'WAREHOUSE_REVIEW_REQUIRED' });
    exceptions.push(classifyWarehouseException(synthetic, routeLoadContext, readiness));
  }
  const alerts = exceptions.map((exception) => buildWarehouseAlert(exception, readiness)).sort((a, b) => b.priority - a.priority || a.alertId.localeCompare(b.alertId));
  const assessment = {
    schemaVersion: WAREHOUSE_INTELLIGENCE_SCHEMA_VERSION,
    engineVersion: WAREHOUSE_INTELLIGENCE_ENGINE_VERSION,
    routeLoadContext,
    assignment,
    staging,
    loading,
    completeness,
    discrepancies,
    readiness,
    exceptions: stable(exceptions),
    alerts,
    explanations: alerts.length ? alerts.map((alert) => buildWarehouseExplanation({ ...alert, readiness })) : [buildWarehouseExplanation({ readiness })],
    supervisorCoordination: stable(alerts.filter((alert) => alert.humanReviewRequired).map((alert) => ({ routeId: alert.routeId, loadRef: alert.loadRef, reasonCodes: alert.reasonCodes, supervisorVisibilityRequired: true, notificationDeliveryCreated: false }))),
    routeSafetyOverrideAttempted: false,
    providerCallInvoked: false,
    hostedAiInvoked: false,
    productionApiExposed: false,
    migrationExecuted: false,
    deploymentExecuted: false,
    employeeScoring: false,
    autonomousPurchasingProhibited: true,
    roboticsScopeProhibited: true,
    testOnly: true,
    generatedAt: DETERMINISTIC_GENERATED_AT
  };
  assessment.assessmentHash = sha256(assessment);
  return stable(assessment);
}

function warehouseContextContract() {
  return stable({
    schemaVersion: 'warehouse.context.contract.v1',
    required: ['warehouseContextId','organizationId','warehouseReference','authorizedActorRef','workPeriodRef','routeScope','loadScope','evidenceSources','evidenceTimestamps','sourceHashes','testOnly'],
    optional: ['unknownFields','systemActorRef'],
    serverDerivedInFutureRuntime: ['organizationId','authorizedActorRef','warehouseReference'],
    warehouseMfaRequiredInFutureRuntime: true,
    callerProviderControlsAllowed: false,
    testOnly: true
  });
}

function buildSyntheticWarehouseContext() {
  return stable({
    warehouseContextId: 'warehouse.context.synthetic.001',
    organizationId: 'org_synthetic_warehouse_intelligence',
    warehouseReference: 'depot.synthetic.birmingham',
    authorizedActorRef: 'warehouse.employee.synthetic.001',
    workPeriodRef: 'warehouse.shift.synthetic.day',
    routeScope: ['route-ready','route-missing-product','route-safety-blocked'],
    loadScope: ['load-ready','load-short','load-safety-blocked'],
    evidenceSources: ['synthetic.route_manifest','synthetic.route_inventory','synthetic.warehouse_confirmation'],
    evidenceTimestamps: [DETERMINISTIC_GENERATED_AT],
    sourceHashes: [{ source: 'synthetic.route_manifest', hash: sha256('synthetic.route_manifest') }],
    unknownFields: [],
    testOnly: true
  });
}

function expectedLines() {
  return stable([
    { sku: 'SKU-COLA-12PK', productName: 'Cola 12pk', quantity: 10 },
    { sku: 'SKU-WATER-24PK', productName: 'Water 24pk', quantity: 8 }
  ]);
}

function baseRouteLoad(overrides = {}) {
  const lines = expectedLines();
  return stable({
    routeId: overrides.routeId || 'route-ready',
    organizationId: overrides.organizationId || 'org_synthetic_warehouse_intelligence',
    loadId: overrides.loadId || 'load-ready',
    manifestRef: overrides.manifestRef || 'manifest-ready',
    assignedDriverRef: overrides.assignedDriverRef || 'driver-synthetic-001',
    assignedVehicleRef: overrides.assignedVehicleRef || 'vehicle-box-12ft-6in',
    stagingAreaRef: overrides.stagingAreaRef || 'dock-a',
    expectedRouteId: hasOwn(overrides, 'expectedRouteId') ? overrides.expectedRouteId : 'route-ready',
    observedRouteId: hasOwn(overrides, 'observedRouteId') ? overrides.observedRouteId : 'route-ready',
    expectedLoadId: hasOwn(overrides, 'expectedLoadId') ? overrides.expectedLoadId : 'load-ready',
    observedLoadId: hasOwn(overrides, 'observedLoadId') ? overrides.observedLoadId : 'load-ready',
    expectedLines: hasOwn(overrides, 'expectedLines') ? overrides.expectedLines : lines,
    observedLines: hasOwn(overrides, 'observedLines') ? overrides.observedLines : lines,
    loadAssignmentEvidence: hasOwn(overrides, 'loadAssignmentEvidence') ? overrides.loadAssignmentEvidence : { evidenceId: 'assignment-ready', source: 'synthetic.route_manifest' },
    stagingEvidence: hasOwn(overrides, 'stagingEvidence') ? overrides.stagingEvidence : { evidenceId: 'staged-ready', status: 'STAGED', staged: true },
    loadingEvidence: hasOwn(overrides, 'loadingEvidence') ? overrides.loadingEvidence : { evidenceId: 'loaded-ready', status: 'LOADED', complete: true },
    loadCompletionEvidence: hasOwn(overrides, 'loadCompletionEvidence') ? overrides.loadCompletionEvidence : { evidenceId: 'complete-ready', complete: true },
    routeSafetyAssessment: overrides.routeSafetyAssessment || null,
    driverOperationalAssessment: overrides.driverOperationalAssessment || null,
    supervisorReference: overrides.supervisorReference || { supervisorContextId: 'supervisor.context.synthetic.001' },
    evidenceSources: overrides.evidenceSources || ['synthetic.route_manifest','synthetic.load_scan'],
    evidenceTimestamps: overrides.evidenceTimestamps || [DETERMINISTIC_GENERATED_AT],
    evidenceStale: overrides.evidenceStale === true,
    evidenceConflict: overrides.evidenceConflict === true,
    humanReviewRequired: overrides.humanReviewRequired === true,
    unknownFields: overrides.unknownFields || [],
    testOnly: true
  });
}

function safetyBlockedAssessment() {
  return routeIntel.assessRouteCandidateSafety(routeIntel.buildBenchmarkCases().find((item) => item.caseId === 'low_clearance_fail_closed').request, routeIntel.buildBenchmarkCases().find((item) => item.caseId === 'low_clearance_fail_closed').request.routeCandidates[0]);
}

function buildBenchmarkCases() {
  const ctx = buildSyntheticWarehouseContext();
  const lines = expectedLines();
  return stable([
    ['correct_assignment', baseRouteLoad(), 'READY'],
    ['wrong_route_load_assignment', baseRouteLoad({ routeId: 'route-wrong-load', expectedRouteId: 'route-wrong-load', observedRouteId: 'route-other', expectedLoadId: 'load-a', observedLoadId: 'load-b' }), 'BLOCKED'],
    ['route_not_staged', baseRouteLoad({ routeId: 'route-not-staged', stagingEvidence: { evidenceId: 'stage-not-started', status: 'NOT_STAGED' } }), 'NOT_READY'],
    ['staging_in_progress', baseRouteLoad({ routeId: 'route-staging', stagingEvidence: { evidenceId: 'stage-progress', status: 'STAGING' } }), 'NOT_READY'],
    ['route_fully_staged', baseRouteLoad({ routeId: 'route-staged' }), 'READY'],
    ['staging_blocked', baseRouteLoad({ routeId: 'route-stage-blocked', stagingEvidence: { evidenceId: 'stage-blocked', blocked: true } }), 'BLOCKED'],
    ['loading_not_started', baseRouteLoad({ routeId: 'route-load-not-started', loadingEvidence: { evidenceId: 'load-not-started', status: 'NOT_STARTED' } }), 'NOT_READY'],
    ['loading_partial', baseRouteLoad({ routeId: 'route-load-partial', loadingEvidence: { evidenceId: 'load-partial', status: 'PARTIALLY_LOADED' } }), 'NOT_READY'],
    ['loading_complete', baseRouteLoad({ routeId: 'route-loaded' }), 'READY'],
    ['missing_product', baseRouteLoad({ routeId: 'route-missing-product', observedLines: [lines[0]] }), 'BLOCKED'],
    ['unexpected_product', baseRouteLoad({ routeId: 'route-unexpected-product', observedLines: lines.concat([{ sku: 'SKU-TEA-6PK', productName: 'Tea 6pk', quantity: 1 }]) }), 'READY_WITH_REVIEW'],
    ['quantity_short', baseRouteLoad({ routeId: 'route-short', observedLines: [{ ...lines[0], quantity: 9 }, lines[1]] }), 'BLOCKED'],
    ['quantity_over', baseRouteLoad({ routeId: 'route-over', observedLines: [{ ...lines[0], quantity: 11 }, lines[1]] }), 'READY_WITH_REVIEW'],
    ['duplicate_evidence', baseRouteLoad({ routeId: 'route-duplicate', observedLines: [lines[0], lines[0], lines[1]] }), 'READY_WITH_REVIEW'],
    ['manifest_unavailable', baseRouteLoad({ routeId: 'route-manifest-missing', expectedLines: null }), 'INSUFFICIENT_EVIDENCE'],
    ['load_evidence_unavailable', baseRouteLoad({ routeId: 'route-load-missing', observedLines: null, loadingEvidence: null }), 'INSUFFICIENT_EVIDENCE'],
    ['stale_evidence', baseRouteLoad({ routeId: 'route-stale', evidenceStale: true }), 'READY_WITH_REVIEW'],
    ['conflicting_evidence', baseRouteLoad({ routeId: 'route-conflict', evidenceConflict: true }), 'BLOCKED'],
    ['all_evidence_ready', baseRouteLoad({ routeId: 'route-all-ready' }), 'READY'],
    ['load_complete_route_safety_blocked', baseRouteLoad({ routeId: 'route-safety-blocked', routeSafetyAssessment: safetyBlockedAssessment() }), 'BLOCKED'],
    ['route_ready_with_human_review', baseRouteLoad({ routeId: 'route-review', humanReviewRequired: true }), 'READY_WITH_REVIEW'],
    ['departure_blocked', baseRouteLoad({ routeId: 'route-departure-blocked', stagingEvidence: { blocked: true }, loadingEvidence: { blocked: true } }), 'BLOCKED'],
    ['insufficient_evidence', baseRouteLoad({ routeId: 'route-insufficient', loadAssignmentEvidence: null, expectedLoadId: null }), 'INSUFFICIENT_EVIDENCE'],
    ['unknown_state', baseRouteLoad({ routeId: 'route-unknown', stagingEvidence: { evidenceId: 'stage-unknown' }, loadingEvidence: { evidenceId: 'load-unknown' } }), 'NOT_READY'],
    ['supervisor_review', baseRouteLoad({ routeId: 'route-supervisor-review', humanReviewRequired: true, supervisorReference: { supervisorContextId: 'supervisor.context.synthetic.001', visibilityRequired: true } }), 'READY_WITH_REVIEW'],
    ['warehouse_review', baseRouteLoad({ routeId: 'route-warehouse-review', evidenceStale: true }), 'READY_WITH_REVIEW'],
    ['alert_acknowledgement', baseRouteLoad({ routeId: 'route-alert-ack', observedLines: [lines[0]] }), 'BLOCKED'],
    ['alert_resolution', baseRouteLoad({ routeId: 'route-alert-resolve', observedLines: [lines[0]] }), 'BLOCKED'],
    ['new_evidence_invalidates_discrepancy', baseRouteLoad({ routeId: 'route-alert-invalidated', observedLines: [lines[0]] }), 'BLOCKED'],
    ['no_exception_case', baseRouteLoad({ routeId: 'route-no-exception' }), 'READY'],
    ['unknown_quantity', baseRouteLoad({ routeId: 'route-unknown-quantity', observedLines: [{ ...lines[0], quantity: null }, lines[1]] }), 'INSUFFICIENT_EVIDENCE'],
    ['cross_organization_evidence', baseRouteLoad({ routeId: 'route-cross-org', organizationId: 'org_other' }), 'INSUFFICIENT_EVIDENCE']
  ].map(([caseId, routeLoad, expectedReadiness]) => ({ caseId, request: { warehouseContext: ctx, routeLoad }, expectedReadiness, syntheticOnly: true, providerCallExpected: false, productionActivationExpected: false, employeeScoringExpected: false })));
}

function querySyntheticWarehouseAssessments() {
  return buildBenchmarkCases().map((benchmark) => {
    const assessment = assessWarehouseRouteLoad(benchmark.request);
    const firstAlert = assessment.alerts[0] || buildWarehouseAlert({ exceptionId: 'warehouse.exception.none', exceptionType: 'NO_EXCEPTION', routeId: assessment.routeLoadContext.routeId, loadRef: assessment.routeLoadContext.loadId, productRef: null, severity: 'INFORMATIONAL', evidenceReferences: [], reasonCodes: [assessment.readiness.reasonCode], humanReviewRequired: false, employmentImpactProhibited: true, testOnly: true }, assessment.readiness);
    return stable({
      caseId: benchmark.caseId,
      assessment,
      lifecycleSamples: {
        acknowledged: acknowledgeWarehouseAlert(firstAlert),
        resolved: resolveWarehouseAlert(firstAlert),
        invalidated: invalidateWarehouseAlert(firstAlert)
      }
    });
  });
}

function buildWarehouseIntelligenceEvidence() {
  const benchmarkCases = buildBenchmarkCases();
  const assessments = querySyntheticWarehouseAssessments();
  const orchestrationEvidence = orchestration.buildOrchestrationEvidence();
  const lifecycleEvidence = lifecycle.buildLifecycleEvidence();
  const catalog = {
    schemaVersion: WAREHOUSE_INTELLIGENCE_SCHEMA_VERSION,
    engineVersion: WAREHOUSE_INTELLIGENCE_ENGINE_VERSION,
    generatedAt: DETERMINISTIC_GENERATED_AT,
    capabilityCount: WAREHOUSE_CAPABILITIES.length,
    benchmarkCaseCount: benchmarkCases.length,
    integratedWithEnterpriseRegistry: registry.listEnterpriseCapabilities().length > 0,
    directEnterpriseRegistryCapability: null,
    directRegistryCapabilityDeferred: true,
    integratedWithCapabilityOrchestration: orchestrationEvidence.capabilities.length > 0,
    integratedWithLifecycleFramework: lifecycleEvidence.lifecycleRecords.length > 0,
    integratedWithRouteIntelligence: true,
    integratedWithDriverIntelligence: true,
    integratedWithSupervisorIntelligence: true,
    warehouseMfaBoundaryPreserved: true,
    providerCallInvoked: false,
    hostedAiInvoked: false,
    modelSelectionActivated: false,
    productionApiExposed: false,
    productionWarehouseAutomation: false,
    employeeScoring: false,
    disciplineAdviceGenerated: false,
    autonomousPurchasingProhibited: true,
    roboticsScopeProhibited: true,
    migrationExecuted: false,
    deploymentExecuted: false,
    productionApplicable: false,
    testOnly: true
  };
  catalog.catalogHash = sha256(catalog);
  return stable({
    catalog,
    capabilities: WAREHOUSE_CAPABILITIES,
    contextContract: warehouseContextContract(),
    stagingStates: STAGING_STATES,
    loadingStates: LOADING_STATES,
    assignmentOutcomes: ASSIGNMENT_OUTCOMES,
    completenessOutcomes: COMPLETENESS_OUTCOMES,
    readinessStates: READINESS_STATES,
    discrepancyTypes: DISCREPANCY_TYPES,
    exceptionTypes: EXCEPTION_TYPES,
    severities: SEVERITIES,
    alertStatuses: ALERT_STATUSES,
    nextSteps: NEXT_STEPS,
    reasonCodes: REASON_CODES,
    benchmarkCases,
    assessments,
    integrationReferences: {
      enterpriseCapabilityRegistry: { available: registry.listEnterpriseCapabilities().length > 0, directWarehouseCapabilityDeferred: true },
      capabilityOrchestration: { available: orchestrationEvidence.capabilities.length > 0 },
      lifecycleFramework: { available: lifecycleEvidence.lifecycleRecords.length > 0 },
      routeIntelligence: { schemaVersion: routeIntel.ROUTE_INTELLIGENCE_SCHEMA_VERSION },
      driverIntelligence: { schemaVersion: driverIntel.DRIVER_INTELLIGENCE_SCHEMA_VERSION },
      supervisorIntelligence: { schemaVersion: supervisorIntel.SUPERVISOR_INTELLIGENCE_SCHEMA_VERSION }
    }
  });
}

function validateWarehouseAlert(alert) {
  const errors = [];
  if (!SEVERITIES.includes(alert?.severity)) errors.push({ rule: 'UNKNOWN_SEVERITY' });
  if (!NEXT_STEPS.includes(alert?.operationalNextStep)) errors.push({ rule: 'UNKNOWN_NEXT_STEP' });
  if (alert?.employmentImpactProhibited !== true) errors.push({ rule: 'EMPLOYMENT_IMPACT_GUARDRAIL_MISSING' });
  for (const field of scanProhibitedFields(alert)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (!alert?.alertHash || alert.alertHash !== sha256({ ...alert, alertHash: undefined })) errors.push({ rule: 'ALERT_HASH_MISMATCH' });
  return stable({ valid: errors.length === 0, errors });
}

function validateWarehouseAssessment(assessment) {
  const errors = [];
  if (!READINESS_STATES.includes(assessment?.readiness?.state)) errors.push({ rule: 'UNKNOWN_READINESS_STATE' });
  if (assessment?.readiness?.state === 'READY' && (assessment.discrepancies || []).some((item) => ['LOAD_ASSIGNMENT_MISMATCH','PRODUCT_MISSING','QUANTITY_SHORT','LOAD_EVIDENCE_CONFLICT'].includes(item.discrepancyType))) errors.push({ rule: 'CRITICAL_DISCREPANCY_MARKED_READY' });
  if (routeSafetyBlocked(assessment?.routeLoadContext) && assessment?.readiness?.state === 'READY') errors.push({ rule: 'SAFETY_BLOCKED_ROUTE_MARKED_READY' });
  if (assessment?.assignment?.outcome === 'MATCH' && assessment.assignment.facts.expectedLoadId !== assessment.assignment.facts.observedLoadId) errors.push({ rule: 'ROUTE_LOAD_MISMATCH_MARKED_MATCH' });
  if (assessment?.completeness?.outcome === 'COMPLETE' && ((assessment.completeness.missingLines || []).length || (assessment.completeness.unknownQuantities || []).length)) errors.push({ rule: 'INCOMPLETE_LOAD_MARKED_COMPLETE' });
  if (assessment?.completeness?.outcome === 'COMPLETE' && (!Array.isArray(assessment?.routeLoadContext?.expectedLines) || !Array.isArray(assessment?.routeLoadContext?.observedLines))) errors.push({ rule: 'INCOMPLETE_LOAD_MARKED_COMPLETE' });
  if (assessment?.providerCallInvoked !== false || assessment?.hostedAiInvoked !== false) errors.push({ rule: 'PROVIDER_OR_MODEL_SELECTION_PROHIBITED' });
  if (assessment?.productionApiExposed !== false || assessment?.productionActivation === true) errors.push({ rule: 'PRODUCTION_ACTIVATION_PROHIBITED' });
  for (const field of scanProhibitedFields(assessment)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (!assessment?.assessmentHash || assessment.assessmentHash !== sha256({ ...assessment, assessmentHash: undefined })) errors.push({ rule: 'ASSESSMENT_HASH_MISMATCH' });
  for (const alert of assessment.alerts || []) for (const error of validateWarehouseAlert(alert).errors) errors.push(error);
  return stable({ valid: errors.length === 0, errors });
}

function validateWarehouseIntelligenceEvidence(evidence = buildWarehouseIntelligenceEvidence()) {
  const errors = [];
  const text = stableStringify(evidence);
  for (const field of ['providerCallInvoked','hostedAiInvoked','modelSelectionActivated','productionApiExposed','productionWarehouseAutomation','employeeScoring','disciplineAdviceGenerated','migrationExecuted','deploymentExecuted','productionApplicable']) {
    if (evidence.catalog[field] !== false) errors.push({ rule: 'PROHIBITED_CAPABILITY_FLAG', field });
  }
  if (!evidence.catalog.integratedWithEnterpriseRegistry) errors.push({ rule: 'ENTERPRISE_REGISTRY_INTEGRATION_MISSING' });
  if (!evidence.catalog.integratedWithCapabilityOrchestration) errors.push({ rule: 'ORCHESTRATION_INTEGRATION_MISSING' });
  if (!evidence.catalog.integratedWithLifecycleFramework) errors.push({ rule: 'LIFECYCLE_INTEGRATION_MISSING' });
  if (!evidence.catalog.integratedWithRouteIntelligence) errors.push({ rule: 'ROUTE_INTELLIGENCE_INTEGRATION_MISSING' });
  if (!evidence.catalog.integratedWithDriverIntelligence) errors.push({ rule: 'DRIVER_INTELLIGENCE_INTEGRATION_MISSING' });
  if (!evidence.catalog.integratedWithSupervisorIntelligence) errors.push({ rule: 'SUPERVISOR_INTELLIGENCE_INTEGRATION_MISSING' });
  if (!evidence.catalog.warehouseMfaBoundaryPreserved) errors.push({ rule: 'WAREHOUSE_MFA_BOUNDARY_MISSING' });
  for (const field of scanProhibitedFields(evidence)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (/AI-IEP-005B\.3|FLEET_INTELLIGENCE_IMPLEMENTED/.test(text)) errors.push({ rule: 'FABRICATED_PACKAGE_OR_FLEET_SCOPE' });
  for (const benchmark of evidence.benchmarkCases || []) {
    const record = evidence.assessments.find((item) => item.caseId === benchmark.caseId);
    if (!record) errors.push({ rule: 'MISSING_BENCHMARK_ASSESSMENT', caseId: benchmark.caseId });
    else {
      if (record.assessment.readiness.state !== benchmark.expectedReadiness) errors.push({ rule: 'BENCHMARK_EXPECTATION_MISMATCH', caseId: benchmark.caseId, expected: benchmark.expectedReadiness, actual: record.assessment.readiness.state });
      for (const error of validateWarehouseAssessment(record.assessment).errors) errors.push({ ...error, caseId: benchmark.caseId });
    }
  }
  return stable({ valid: errors.length === 0, errors });
}

module.exports = {
  ALERT_STATUSES,
  ASSIGNMENT_OUTCOMES,
  COMPLETENESS_OUTCOMES,
  DETERMINISTIC_GENERATED_AT,
  DISCREPANCY_TYPES,
  EXCEPTION_TYPES,
  LOADING_STATES,
  NEXT_STEPS,
  PROHIBITED_FIELDS,
  READINESS_STATES,
  REASON_CODES,
  SEVERITIES,
  STAGING_STATES,
  WAREHOUSE_CAPABILITIES,
  WAREHOUSE_INTELLIGENCE_ENGINE_VERSION,
  WAREHOUSE_INTELLIGENCE_SCHEMA_VERSION,
  acknowledgeWarehouseAlert,
  assessDepartureReadiness,
  assessLoadCompleteness,
  assessWarehouseRouteLoad,
  baseRouteLoad,
  buildBenchmarkCases,
  buildRouteLoadContext,
  buildSyntheticWarehouseContext,
  buildWarehouseAlert,
  buildWarehouseEvidence,
  buildWarehouseExplanation,
  buildWarehouseIntelligenceEvidence,
  classifyWarehouseException,
  classifyWarehouseSeverity,
  detectLoadDiscrepancies,
  evaluateLoadingState,
  evaluateStagingState,
  invalidateWarehouseAlert,
  querySyntheticWarehouseAssessments,
  resolveWarehouseAlert,
  scanProhibitedFields,
  sha256,
  stable,
  stableStringify,
  validateWarehouseAlert,
  validateWarehouseAssessment,
  validateWarehouseContext,
  validateWarehouseEvidence,
  validateWarehouseIntelligenceEvidence,
  verifyLoadAssignment,
  warehouseContextContract,
  paths: { backendRoot, repoRoot, docsRoot, generatedRoot }
};
