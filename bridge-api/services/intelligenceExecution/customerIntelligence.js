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

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'implementation');
const generatedRoot = path.join(docsRoot, 'customer-intelligence-foundation', 'generated');
const CUSTOMER_INTELLIGENCE_SCHEMA_VERSION = 'customer.intelligence.foundation.v1';
const CUSTOMER_INTELLIGENCE_ENGINE_VERSION = 'customer.intelligence.foundation.engine.v1';
const DETERMINISTIC_GENERATED_AT = '2026-08-10T00:00:00.000Z';

const EVIDENCE_STATES = Object.freeze(['COMPLETE','PARTIAL','INSUFFICIENT','CONFLICTING','STALE','UNKNOWN']);
const CONFIDENCE_STATES = Object.freeze(['KNOWN_SYNTHETIC_EVIDENCE','PARTIAL_SYNTHETIC_EVIDENCE','CONFLICTING_EVIDENCE','STALE_EVIDENCE','INSUFFICIENT_EVIDENCE']);
const DEDUCTION_STATES = Object.freeze(['NO_KNOWN_DEDUCTION','DEDUCTION_RECORDED','MULTIPLE_DEDUCTIONS_RECORDED','DEDUCTION_UNRESOLVED','DEDUCTION_EVIDENCE_CONFLICT','INSUFFICIENT_EVIDENCE','UNKNOWN']);
const EXCEPTION_TYPES = Object.freeze(['CUSTOMER_RECORD_MISSING','CUSTOMER_RECORD_CONFLICT','ACCOUNT_ROUTE_REFERENCE_MISSING','ACCOUNT_STOP_REFERENCE_MISSING','DELIVERY_HISTORY_MISSING','DELIVERY_HISTORY_STALE','DELIVERY_HISTORY_CONFLICT','PRODUCT_HISTORY_MISSING','PRODUCT_HISTORY_CONFLICT','INVOICE_HISTORY_MISSING','INVOICE_HISTORY_CONFLICT','SPEND_EVIDENCE_INCOMPLETE','DEDUCTION_RECORDED','DEDUCTION_UNRESOLVED','DEDUCTION_EVIDENCE_CONFLICT','CUSTOMER_STOP_UNRESOLVED','CUSTOMER_SERVICE_EVIDENCE_INCOMPLETE','HUMAN_REVIEW_REQUIRED','INSUFFICIENT_EVIDENCE']);
const SEVERITIES = Object.freeze(['INFORMATIONAL','LOW','MODERATE','HIGH','CRITICAL','UNKNOWN']);
const PROHIBITED_FIELDS = Object.freeze(['forecastSpend','predictedSpend','nextPurchasePrediction','productDemandPrediction','churnProbability','creditScore','paymentRiskScore','protectedClass','inferredReligion','inferredEthnicity','personalityProfile','emotionalState','customerValueScore','autonomousPrice','autonomousDiscount','autonomousSalesOutreach','employeeScore','driverScore','provider','providerId','model','modelId','modelSelection','productionActivation','implementationPackageNumber','operationsIntelligenceImplemented']);
const PREDICTION_TERMS = /\b(PREDICTED|EXPECTED_NEXT|LIKELY_TO_BUY|FORECAST|PROPENSITY)\b/;

const CUSTOMER_CAPABILITIES = Object.freeze([
  { capabilityId: 'customer.operational_context.validation', displayName: 'Customer Operational Context Validation', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'customer.delivery_history.summary', displayName: 'Customer Delivery History Summary', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'customer.product_invoice_history.summary', displayName: 'Customer Product and Invoice History Summary', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'customer.spend_trace.summary', displayName: 'Customer Historical Spend Trace Summary', executionStrategy: 'DETERMINISTIC_RULES' },
  { capabilityId: 'customer.exception.explanation', displayName: 'Customer Operational Exception Explanation', executionStrategy: 'DETERMINISTIC_RULES' }
]);

function stable(value) { return governance.stable(value); }
function stableStringify(value) { return governance.stableStringify(value); }
function sha256(value) { return governance.sha256(value); }
function hasOwn(object, key) { return Object.prototype.hasOwnProperty.call(object || {}, key); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function numeric(value) { return value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null); }
function round(value, precision = 2) {
  const number = numeric(value);
  if (number === null) return null;
  const factor = 10 ** precision;
  return Math.round(number * factor) / factor;
}
function dateOnly(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  const start = dateOnly(a);
  const end = dateOnly(b);
  if (!start || !end) return null;
  return Math.max(0, Math.round((new Date(`${end}T00:00:00.000Z`) - new Date(`${start}T00:00:00.000Z`)) / 86400000));
}
function scanProhibitedFields(value) {
  const text = stableStringify(value);
  return PROHIBITED_FIELDS.filter((field) => new RegExp(`"${field}"\\s*:`).test(text));
}

function customerContextContract() {
  return stable({
    schemaVersion: 'customer.context.contract.v1',
    requiredFields: ['customerContextId','organizationId','customerId','accountReference','historyWindow','sourceReferences','evidenceTimestamps','sourceHashes','evidenceCompleteness','evidenceConfidence','unknownFields','humanReviewRequired','testOnly'],
    identityFields: ['organizationId','customerId','accountNumber','accountReference'],
    referenceFields: ['routeReferences','stopReferences','deliveryReferences','invoiceReferences','productReferences','deductionReferences'],
    stableIdentityRequired: true,
    crossOrganizationAggregationProhibited: true,
    customerNameNotRelationalIdentifier: true,
    providerModelControlsRejected: true,
    productionRuntimeDeferred: true
  });
}

function validateCustomerContext(context = {}) {
  const errors = [];
  for (const field of scanProhibitedFields(context)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (!context.organizationId) errors.push({ rule: 'ORGANIZATION_REQUIRED' });
  if (!context.customerContextId) errors.push({ rule: 'CUSTOMER_CONTEXT_REQUIRED' });
  if (!context.customerId && !context.accountNumber) errors.push({ rule: 'CUSTOMER_ID_REQUIRED' });
  if (context.accountName && !context.customerId && !context.accountNumber) errors.push({ rule: 'CUSTOMER_NAME_NOT_IDENTIFIER' });
  return stable({ valid: errors.length === 0, errors, stableCustomerIdentityRequired: true, crossOrganizationAggregationProhibited: true, validationHash: sha256({ context, errors }) });
}

function evidenceCompleteness(record = {}, requiredFields = []) {
  const items = requiredFields.map((field) => ({ field, present: hasOwn(record, field) && record[field] !== null && record[field] !== '' }));
  const score = requiredFields.length ? items.filter((item) => item.present).length / requiredFields.length : 1;
  const status = score === 1 ? 'COMPLETE' : score >= 0.5 ? 'PARTIAL' : 'INSUFFICIENT';
  return stable({ status, score: Number(score.toFixed(3)), items });
}

function evidenceConfidence(record = {}, completeness = { status: 'UNKNOWN' }) {
  if (record.evidenceConflict === true) return { status: 'CONFLICTING_EVIDENCE', score: 0.2 };
  if (record.evidenceStale === true) return { status: 'STALE_EVIDENCE', score: 0.4 };
  if (completeness.status === 'COMPLETE') return { status: 'KNOWN_SYNTHETIC_EVIDENCE', score: 1 };
  if (completeness.status === 'PARTIAL') return { status: 'PARTIAL_SYNTHETIC_EVIDENCE', score: 0.6 };
  return { status: 'INSUFFICIENT_EVIDENCE', score: null };
}

function sourceHashes(sources = [], identity = {}) {
  return stable(asArray(sources).map((source) => ({ source, hash: sha256({ source, identity }) })));
}

function buildCustomerEvidence(record = {}, requiredFields = []) {
  const completeness = evidenceCompleteness(record, requiredFields);
  return stable({
    evidenceSources: record.evidenceSources || ['synthetic.customer_account','synthetic.account_order','synthetic.route_stop'],
    evidenceTimestamps: record.evidenceTimestamps || [DETERMINISTIC_GENERATED_AT],
    sourceHashes: sourceHashes(record.evidenceSources || [], { organizationId: record.organizationId || null, customerId: record.customerId || record.accountNumber || null }),
    completeness,
    confidence: evidenceConfidence(record, completeness),
    stale: record.evidenceStale === true,
    conflict: record.evidenceConflict === true,
    unknownFields: record.unknownFields || [],
    syntheticOnly: true
  });
}

function buildCustomerOperationalContext(input = {}) {
  const customer = input.customer || {};
  const ctx = input.customerContext || {};
  const organizationMatches = !customer.organizationId || !ctx.organizationId || customer.organizationId === ctx.organizationId;
  const stableIdentityPresent = Boolean(customer.customerId || customer.accountNumber || ctx.customerId || ctx.accountNumber);
  const evidenceConflict = input.evidenceConflict === true || customer.evidenceConflict === true || ctx.evidenceConflict === true;
  const evidenceStale = input.evidenceStale === true || customer.evidenceStale === true || ctx.evidenceStale === true;
  const record = {
    schemaVersion: 'customer.operational.context.v1',
    customerContextId: ctx.customerContextId || `customer.context.${customer.accountNumber || customer.customerId || 'unknown'}`,
    organizationId: organizationMatches ? (customer.organizationId || ctx.organizationId || null) : null,
    customerId: customer.customerId || ctx.customerId || customer.accountNumber || ctx.accountNumber || null,
    accountNumber: customer.accountNumber || ctx.accountNumber || null,
    accountName: customer.accountName || ctx.accountName || null,
    accountReference: stableIdentityPresent ? { customerId: customer.customerId || null, accountNumber: customer.accountNumber || ctx.accountNumber || null, source: 'synthetic.customer_accounts' } : null,
    routeReferences: asArray(input.routeReferences || customer.routeReferences),
    stopReferences: asArray(input.stopReferences || customer.stopReferences),
    deliveryReferences: asArray(input.deliveryReferences || customer.deliveryReferences),
    invoiceReferences: asArray(input.invoiceReferences || customer.invoiceReferences),
    productReferences: asArray(input.productReferences || customer.productReferences),
    deductionReferences: asArray(input.deductionReferences || customer.deductionReferences),
    historyWindow: input.historyWindow || { startDate: '2026-01-01', endDate: '2026-03-31' },
    sourceReferences: ['customer_accounts','account_orders','account_order_items','delivery_deductions','daily_route_stops','daily_route_manifests'],
    identityResolution: {
      stableIdUsed: stableIdentityPresent,
      customerNameUsedAsIdentifier: false,
      crossOrganizationMerged: false,
      similarlyNamedCustomerLinked: input.similarlyNamedCustomerLinked === true
    },
    testOnly: true
  };
  record.evidence = buildCustomerEvidence({ ...record, evidenceConflict, evidenceStale }, ['organizationId','customerId','accountReference','historyWindow']);
  record.evidenceCompleteness = record.evidence.completeness;
  record.evidenceConfidence = record.evidence.confidence;
  record.unknownFields = record.evidence.unknownFields;
  record.humanReviewRequired = !organizationMatches || !stableIdentityPresent || evidenceConflict || evidenceStale || record.evidenceCompleteness.status !== 'COMPLETE';
  record.organizationIsolationPreserved = organizationMatches;
  record.contextHash = sha256(record);
  return stable(record);
}

function buildDeliveryHistory(context = {}, deliveries = []) {
  const sorted = stable(asArray(deliveries)).sort((a, b) => String(a.serviceDate || '').localeCompare(String(b.serviceDate || '')));
  const serviceDates = sorted.map((delivery) => dateOnly(delivery.serviceDate || delivery.deliveryDate)).filter(Boolean);
  const intervals = serviceDates.slice(1).map((date, index) => daysBetween(serviceDates[index], date)).filter((value) => value !== null);
  const completed = sorted.filter((delivery) => ['completed','departed'].includes(delivery.status));
  const unresolved = sorted.filter((delivery) => ['pending','undelivered','skipped','failed'].includes(delivery.status));
  const record = {
    customerId: context.customerId || null,
    organizationId: context.organizationId || null,
    deliveryCount: sorted.length,
    completedDeliveryCount: completed.length,
    unresolvedDeliveryCount: unresolved.length,
    knownServiceDates: serviceDates,
    routeReferences: sorted.map((delivery) => delivery.routeId || delivery.routeManifestId).filter(Boolean),
    stopReferences: sorted.map((delivery) => delivery.stopId || delivery.routeStopId).filter(Boolean),
    deliveryReferences: sorted.map((delivery) => delivery.deliveryId || delivery.id).filter(Boolean),
    observedIntervalsDays: intervals,
    mostRecentKnownServiceDate: serviceDates[serviceDates.length - 1] || null,
    stale: sorted.some((delivery) => delivery.evidenceStale === true),
    conflict: sorted.some((delivery) => delivery.evidenceConflict === true),
    noCustomerFaultInferred: true,
    noDriverFaultInferred: true,
    nextDeliveryPredicted: false,
    testOnly: true
  };
  record.evidenceCompleteness = evidenceCompleteness(record, ['customerId','organizationId','deliveryCount']);
  record.historyHash = sha256(record);
  return stable(record);
}

function buildProductHistory(context = {}, orders = []) {
  const products = new Map();
  for (const order of asArray(orders)) {
    for (const item of asArray(order.items)) {
      const key = item.sku || item.productId || item.productName || 'UNKNOWN_PRODUCT';
      const current = products.get(key) || {
        productId: key,
        sku: item.sku || null,
        productName: item.productName || null,
        deliveryOrInvoiceReferences: [],
        transactionDates: [],
        historicalQuantity: null,
        frequencyCount: 0,
        conflictingRecords: []
      };
      current.deliveryOrInvoiceReferences.push(order.invoiceNumber || order.id || null);
      if (dateOnly(order.deliveryDate || order.orderDate)) current.transactionDates.push(dateOnly(order.deliveryDate || order.orderDate));
      current.frequencyCount += 1;
      const quantity = numeric(item.quantity);
      current.historicalQuantity = quantity === null || current.historicalQuantity === null && current.frequencyCount > 1
        ? (current.historicalQuantity === null ? null : current.historicalQuantity)
        : round((current.historicalQuantity || 0) + quantity);
      if (item.evidenceConflict) current.conflictingRecords.push(item.id || key);
      products.set(key, current);
    }
  }
  const records = [...products.values()].map((record) => {
    const dates = record.transactionDates.sort();
    const intervals = dates.slice(1).map((date, index) => daysBetween(dates[index], date)).filter((value) => value !== null);
    return stable({
      ...record,
      deliveryOrInvoiceReferences: record.deliveryOrInvoiceReferences.filter(Boolean),
      firstKnownOccurrence: dates[0] || null,
      mostRecentKnownOccurrence: dates[dates.length - 1] || null,
      observedHistoricalCadenceDays: intervals.length ? round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length, 1) : null,
      evidenceCompleteness: record.frequencyCount ? 'COMPLETE' : 'INSUFFICIENT',
      recommendationGenerated: false,
      demandPredicted: false
    });
  });
  return stable({ customerId: context.customerId || null, organizationId: context.organizationId || null, productCount: records.length, products: records, unknownQuantityPreserved: records.some((record) => record.historicalQuantity === null), testOnly: true, historyHash: sha256(records) });
}

function buildInvoiceHistory(context = {}, orders = []) {
  const invoices = asArray(orders).map((order) => stable({
    invoiceId: order.invoiceNumber || order.id || null,
    orderId: order.id || null,
    customerId: context.customerId || null,
    accountNumber: order.accountNumber || context.accountNumber || null,
    invoiceDate: dateOnly(order.orderDate),
    deliveryDate: dateOnly(order.deliveryDate),
    invoiceStatus: order.status || 'UNKNOWN',
    lineReferences: asArray(order.items).map((item) => item.id || item.sku || item.productName).filter(Boolean),
    subtotal: hasOwn(order, 'subtotalAmount') ? numeric(order.subtotalAmount) : null,
    total: hasOwn(order, 'netAmount') ? numeric(order.netAmount) : null,
    deductionReferences: asArray(order.deductions).map((deduction) => deduction.id).filter(Boolean),
    source: 'synthetic.account_orders',
    evidenceState: order.evidenceConflict ? 'CONFLICTING' : 'COMPLETE',
    accountingConclusionGenerated: false
  }));
  return stable({ customerId: context.customerId || null, organizationId: context.organizationId || null, invoiceCount: invoices.length, invoices, missingInvoiceDataIsZero: false, testOnly: true, historyHash: sha256(invoices) });
}

function calculateHistoricalSpend(context = {}, orders = [], options = {}) {
  const window = options.historyWindow || context.historyWindow || { startDate: null, endDate: null };
  const known = asArray(orders).filter((order) => numeric(order.netAmount) !== null);
  const unknown = asArray(orders).filter((order) => numeric(order.netAmount) === null);
  const total = known.reduce((sum, order) => sum + numeric(order.netAmount), 0);
  const byProduct = new Map();
  for (const order of known) {
    for (const item of asArray(order.items)) {
      const key = item.sku || item.productName || 'UNKNOWN_PRODUCT';
      const current = byProduct.get(key) || { productId: key, knownSpend: 0, contributingRecordIds: [] };
      const value = numeric(item.netAmount);
      if (value !== null) {
        current.knownSpend = round(current.knownSpend + value);
        current.contributingRecordIds.push(item.id || order.id);
      }
      byProduct.set(key, current);
    }
  }
  const metric = {
    metricId: `customer.spend.${context.customerId || 'unknown'}`,
    customerId: context.customerId || null,
    organizationId: context.organizationId || null,
    metricType: 'KNOWN_HISTORICAL_SPEND',
    calculationVersion: CUSTOMER_INTELLIGENCE_ENGINE_VERSION,
    timeWindow: window,
    contributingRecordIds: known.map((order) => order.id).filter(Boolean),
    knownRecordCount: known.length,
    unknownOrMissingCount: unknown.length,
    result: known.length ? round(total) : null,
    unit: options.currency || null,
    currency: options.currency || null,
    missingCoverage: unknown.map((order) => order.id || order.invoiceNumber || 'unknown'),
    unknownSpendPreserved: unknown.length > 0,
    forecastGenerated: false,
    testOnly: true
  };
  metric.calculationHash = sha256(metric);
  return stable({ metric, byProduct: [...byProduct.values()].map(stable), traceable: true, unknownSpendConvertedToZero: false });
}

function buildDeductionHistory(context = {}, deductions = []) {
  let state = 'NO_KNOWN_DEDUCTION';
  if (!Array.isArray(deductions)) state = 'UNKNOWN';
  else if (deductions.some((deduction) => deduction.evidenceConflict)) state = 'DEDUCTION_EVIDENCE_CONFLICT';
  else if (deductions.some((deduction) => deduction.status === 'unresolved')) state = 'DEDUCTION_UNRESOLVED';
  else if (deductions.length > 1) state = 'MULTIPLE_DEDUCTIONS_RECORDED';
  else if (deductions.length === 1) state = 'DEDUCTION_RECORDED';
  const records = asArray(deductions).map((deduction) => stable({
    deductionReference: deduction.id || null,
    invoiceReference: deduction.invoiceNumber || deduction.orderId || null,
    deliveryReference: deduction.routeStopId || deduction.deliveryId || null,
    recordedAmount: hasOwn(deduction, 'amount') ? numeric(deduction.amount) : null,
    recordedQuantity: hasOwn(deduction, 'quantity') ? numeric(deduction.quantity) : null,
    recordedReason: deduction.reason || 'UNKNOWN',
    timestamp: deduction.createdAt || DETERMINISTIC_GENERATED_AT,
    source: 'synthetic.delivery_deductions',
    resolutionStatus: deduction.status || 'UNKNOWN',
    fraudInferred: false,
    customerIntentInferred: false,
    employeeFaultInferred: false
  }));
  return stable({ customerId: context.customerId || null, organizationId: context.organizationId || null, state, deductionCount: records.length, records, testOnly: true, historyHash: sha256(records) });
}

function buildServicePatternEvidence(context = {}, deliveryHistory = {}, productHistory = {}, invoiceHistory = {}) {
  const dates = asArray(deliveryHistory.knownServiceDates).filter(Boolean);
  const daysOfWeek = dates.map((date) => new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }));
  const pattern = {
    customerId: context.customerId || null,
    organizationId: context.organizationId || null,
    evidenceLanguage: 'OBSERVED_HISTORICAL_RECORDED_KNOWN',
    observedDeliveryCount: deliveryHistory.deliveryCount || 0,
    observedDaysOfWeek: [...new Set(daysOfWeek)].sort(),
    observedIntervalsBetweenDeliveriesDays: deliveryHistory.observedIntervalsDays || [],
    historicalProductFrequency: asArray(productHistory.products).map((item) => ({ productId: item.productId, frequencyCount: item.frequencyCount })),
    historicalInvoiceFrequency: invoiceHistory.invoiceCount || 0,
    repeatAccountRouteRelationship: asArray(deliveryHistory.routeReferences).length > 1,
    historyCoverage: deliveryHistory.deliveryCount ? 'PARTIAL_OR_COMPLETE' : 'INSUFFICIENT',
    predictionGenerated: false,
    testOnly: true
  };
  pattern.patternHash = sha256(pattern);
  return stable(pattern);
}

function buildCustomerRouteContext(context = {}, routeEvidence = {}) {
  return stable({
    customerId: context.customerId || null,
    organizationId: context.organizationId || null,
    assignedRoute: routeEvidence.routeId || null,
    customerStop: routeEvidence.stopId || null,
    stopSequence: routeEvidence.stopSequence ?? null,
    routeSafetyStatus: routeEvidence.routeSafetyStatus || 'UNKNOWN',
    routeIntelligenceAuthoritative: true,
    routeSafetyOverridden: false,
    routeExceptionAffectingService: routeEvidence.routeExceptionAffectingService || null,
    historicalRouteAccountRelationship: routeEvidence.historicalRouteAccountRelationship || [],
    testOnly: true
  });
}

function buildCustomerStopContext(context = {}, stopEvidence = {}) {
  return stable({
    stopId: stopEvidence.stopId || null,
    customerId: context.customerId || null,
    accountNumber: context.accountNumber || null,
    routeId: stopEvidence.routeId || null,
    knownDeliveryStatus: stopEvidence.status || 'UNKNOWN',
    arrivalEvidence: stopEvidence.actualArrivalAt || null,
    departureEvidence: stopEvidence.actualDepartureAt || null,
    stopInstructionReferences: asArray(stopEvidence.stopInstructionReferences),
    authorizedDriverNoteReferences: asArray(stopEvidence.authorizedDriverNoteReferences),
    operationalInstructionReferences: asArray(stopEvidence.operationalInstructionReferences),
    driverStopAuthorityPreserved: true,
    crossOrganizationNotesExposed: false,
    testOnly: true
  });
}

function classifySeverity(type) {
  if (['CUSTOMER_RECORD_CONFLICT','DELIVERY_HISTORY_CONFLICT','INVOICE_HISTORY_CONFLICT','DEDUCTION_EVIDENCE_CONFLICT'].includes(type)) return 'HIGH';
  if (['CUSTOMER_RECORD_MISSING','ACCOUNT_ROUTE_REFERENCE_MISSING','ACCOUNT_STOP_REFERENCE_MISSING','CUSTOMER_STOP_UNRESOLVED'].includes(type)) return 'MODERATE';
  if (['DEDUCTION_RECORDED','DEDUCTION_UNRESOLVED','SPEND_EVIDENCE_INCOMPLETE','CUSTOMER_SERVICE_EVIDENCE_INCOMPLETE'].includes(type)) return 'LOW';
  if (type === 'INSUFFICIENT_EVIDENCE') return 'UNKNOWN';
  return 'INFORMATIONAL';
}

function exceptionRecord(type, context = {}, evidenceReferences = [], options = {}) {
  const record = {
    exceptionId: `customer.exception.${context.customerId || 'unknown'}.${type.toLowerCase()}`,
    exceptionType: type,
    organizationId: context.organizationId || null,
    customerId: context.customerId || null,
    accountNumber: context.accountNumber || null,
    severity: options.severity || classifySeverity(type),
    evidenceReferences,
    operationalImpactOnly: true,
    customerFaultInferred: false,
    employeeFaultInferred: false,
    humanReviewRequired: options.humanReviewRequired === true || ['HIGH','CRITICAL','UNKNOWN'].includes(options.severity || classifySeverity(type)),
    testOnly: true
  };
  record.exceptionHash = sha256(record);
  return stable(record);
}

function detectCustomerOperationalExceptions(context, deliveryHistory, productHistory, invoiceHistory, spend, deductionHistory, routeContext, stopContext) {
  const exceptions = [];
  if (!context.customerId) exceptions.push(exceptionRecord('CUSTOMER_RECORD_MISSING', context, ['customer_accounts'], { humanReviewRequired: true }));
  if (context.evidence?.conflict || context.organizationIsolationPreserved !== true) exceptions.push(exceptionRecord('CUSTOMER_RECORD_CONFLICT', context, ['customer_accounts'], { humanReviewRequired: true }));
  if (!routeContext.assignedRoute) exceptions.push(exceptionRecord('ACCOUNT_ROUTE_REFERENCE_MISSING', context, ['daily_route_manifests']));
  if (!stopContext.stopId) exceptions.push(exceptionRecord('ACCOUNT_STOP_REFERENCE_MISSING', context, ['daily_route_stops']));
  if (!deliveryHistory.deliveryCount) exceptions.push(exceptionRecord('DELIVERY_HISTORY_MISSING', context, ['daily_route_stops']));
  if (deliveryHistory.stale) exceptions.push(exceptionRecord('DELIVERY_HISTORY_STALE', context, ['daily_route_stops']));
  if (deliveryHistory.conflict) exceptions.push(exceptionRecord('DELIVERY_HISTORY_CONFLICT', context, ['daily_route_stops'], { humanReviewRequired: true }));
  if (!productHistory.productCount) exceptions.push(exceptionRecord('PRODUCT_HISTORY_MISSING', context, ['account_order_items']));
  if (asArray(productHistory.products).some((item) => item.conflictingRecords?.length)) exceptions.push(exceptionRecord('PRODUCT_HISTORY_CONFLICT', context, ['account_order_items'], { humanReviewRequired: true }));
  if (!invoiceHistory.invoiceCount) exceptions.push(exceptionRecord('INVOICE_HISTORY_MISSING', context, ['account_orders']));
  if (asArray(invoiceHistory.invoices).some((invoice) => invoice.evidenceState === 'CONFLICTING')) exceptions.push(exceptionRecord('INVOICE_HISTORY_CONFLICT', context, ['account_orders'], { humanReviewRequired: true }));
  if (spend.metric.unknownOrMissingCount > 0 || spend.metric.result === null) exceptions.push(exceptionRecord('SPEND_EVIDENCE_INCOMPLETE', context, ['account_orders']));
  if (deductionHistory.state === 'DEDUCTION_RECORDED' || deductionHistory.state === 'MULTIPLE_DEDUCTIONS_RECORDED') exceptions.push(exceptionRecord('DEDUCTION_RECORDED', context, ['delivery_deductions']));
  if (deductionHistory.state === 'DEDUCTION_UNRESOLVED') exceptions.push(exceptionRecord('DEDUCTION_UNRESOLVED', context, ['delivery_deductions'], { humanReviewRequired: true }));
  if (deductionHistory.state === 'DEDUCTION_EVIDENCE_CONFLICT') exceptions.push(exceptionRecord('DEDUCTION_EVIDENCE_CONFLICT', context, ['delivery_deductions'], { humanReviewRequired: true }));
  if (stopContext.knownDeliveryStatus === 'UNKNOWN') exceptions.push(exceptionRecord('CUSTOMER_STOP_UNRESOLVED', context, ['daily_route_stops']));
  if (context.evidenceCompleteness.status !== 'COMPLETE') exceptions.push(exceptionRecord('CUSTOMER_SERVICE_EVIDENCE_INCOMPLETE', context, ['customer.context']));
  if (
    context.evidenceCompleteness.status === 'INSUFFICIENT'
    || (!deliveryHistory.deliveryCount && !productHistory.productCount && !invoiceHistory.invoiceCount && !routeContext.assignedRoute && !stopContext.stopId)
  ) exceptions.push(exceptionRecord('INSUFFICIENT_EVIDENCE', context, ['customer.context'], { severity: 'UNKNOWN', humanReviewRequired: true }));
  if (exceptions.some((item) => item.humanReviewRequired)) exceptions.push(exceptionRecord('HUMAN_REVIEW_REQUIRED', context, ['customer.exceptions'], { humanReviewRequired: true }));
  if (!exceptions.length) exceptions.push(exceptionRecord('INSUFFICIENT_EVIDENCE', context, [], { severity: 'INFORMATIONAL' }));
  return stable(exceptions);
}

function buildCustomerSummary(context, deliveryHistory, productHistory, invoiceHistory, spend, deductionHistory, servicePattern, routeContext, stopContext, exceptions) {
  const summary = {
    customerId: context.customerId || null,
    accountNumber: context.accountNumber || null,
    accountIdentityEvidence: context.accountReference,
    knownDeliveryCount: deliveryHistory.deliveryCount || 0,
    historyCoverage: servicePattern.historyCoverage,
    productHistoryRecordCount: productHistory.productCount || 0,
    knownHistoricalQuantities: asArray(productHistory.products).map((item) => ({ productId: item.productId, quantity: item.historicalQuantity })),
    knownInvoiceCount: invoiceHistory.invoiceCount || 0,
    knownHistoricalSpend: spend.metric.result,
    spendCurrency: spend.metric.currency,
    deductionCount: deductionHistory.deductionCount || 0,
    unresolvedDeductions: deductionHistory.state === 'DEDUCTION_UNRESOLVED' ? deductionHistory.deductionCount : 0,
    routeReferences: routeContext.assignedRoute ? [routeContext.assignedRoute] : [],
    stopReferences: stopContext.stopId ? [stopContext.stopId] : [],
    servicePatternEvidence: servicePattern,
    evidenceGaps: [context, deliveryHistory, productHistory, invoiceHistory, spend.metric].flatMap((item) => item.unknownFields || item.missingCoverage || []),
    conflictingEvidence: exceptions.filter((item) => item.exceptionType.includes('CONFLICT')).map((item) => item.exceptionType),
    humanReviewItems: exceptions.filter((item) => item.humanReviewRequired).map((item) => item.exceptionType),
    limitations: ['Repository-only synthetic evidence.', 'Historical/descriptive only.', 'No prediction, credit scoring, protected-class inference, autonomous pricing, sales automation, provider execution, deployment, or migration.'],
    testOnly: true
  };
  summary.summaryHash = sha256(summary);
  return stable(summary);
}

function buildCustomerExplanation(assessment) {
  const explanation = {
    explanationId: `customer.explanation.${sha256(assessment.assessmentId).slice(0, 16)}`,
    customerId: assessment.context.customerId,
    accountNumber: assessment.context.accountNumber,
    accountLinking: assessment.context.identityResolution.stableIdUsed ? 'Linked by stable account/customer identifier within the same Organization.' : 'Stable account/customer identifier is missing; human review is required.',
    completenessReason: `Customer context evidence is ${assessment.context.evidenceCompleteness.status}.`,
    deliveryHistoryReason: `${assessment.deliveryHistory.deliveryCount} historical delivery record(s) are known.`,
    productHistoryReason: `${assessment.productHistory.productCount} product history record(s) are known.`,
    invoiceHistoryReason: `${assessment.invoiceHistory.invoiceCount} invoice/order record(s) are known.`,
    spendCalculationReason: `Known historical spend uses ${assessment.historicalSpend.metric.knownRecordCount} contributing order record(s); unknown/missing count is ${assessment.historicalSpend.metric.unknownOrMissingCount}.`,
    deductionReason: `Deduction evidence state is ${assessment.deductionHistory.state}.`,
    servicePatternReason: 'Service pattern evidence is descriptive and historical only.',
    missingEvidence: assessment.summary.evidenceGaps,
    conflictingEvidence: assessment.summary.conflictingEvidence,
    humanReviewRequired: assessment.summary.humanReviewItems.length > 0,
    customerIntentInferred: false,
    financialHealthInferred: false,
    futurePurchasePredicted: false,
    personalityInferred: false,
    protectedClassInferred: false,
    testOnly: true
  };
  explanation.explanationHash = sha256(explanation);
  return stable(explanation);
}

function assessCustomerAccount(input = {}) {
  const context = buildCustomerOperationalContext(input);
  const deliveryHistory = buildDeliveryHistory(context, input.deliveries || []);
  const productHistory = buildProductHistory(context, input.orders || []);
  const invoiceHistory = buildInvoiceHistory(context, input.orders || []);
  const historicalSpend = calculateHistoricalSpend(context, input.orders || [], { historyWindow: context.historyWindow, currency: input.currency || null });
  const deductionHistory = buildDeductionHistory(context, input.deductions || []);
  const servicePattern = buildServicePatternEvidence(context, deliveryHistory, productHistory, invoiceHistory);
  const routeContext = buildCustomerRouteContext(context, input.routeEvidence || {});
  const stopContext = buildCustomerStopContext(context, input.stopEvidence || {});
  const exceptions = detectCustomerOperationalExceptions(context, deliveryHistory, productHistory, invoiceHistory, historicalSpend, deductionHistory, routeContext, stopContext);
  const summary = buildCustomerSummary(context, deliveryHistory, productHistory, invoiceHistory, historicalSpend, deductionHistory, servicePattern, routeContext, stopContext, exceptions);
  const assessment = {
    schemaVersion: CUSTOMER_INTELLIGENCE_SCHEMA_VERSION,
    engineVersion: CUSTOMER_INTELLIGENCE_ENGINE_VERSION,
    assessmentId: `customer.assessment.${context.customerId || 'unknown'}.${sha256(input.caseId || context.contextHash).slice(0, 12)}`,
    context,
    deliveryHistory,
    productHistory,
    invoiceHistory,
    historicalSpend,
    deductionHistory,
    servicePattern,
    routeContext,
    stopContext,
    exceptions,
    summary,
    providerCallInvoked: false,
    hostedAiInvoked: false,
    modelSelectionActivated: false,
    productionApiExposed: false,
    migrationExecuted: false,
    deploymentExecuted: false,
    predictionGenerated: false,
    creditScoringGenerated: false,
    sensitiveInferenceGenerated: false,
    autonomousPricingGenerated: false,
    salesAutomationGenerated: false,
    crmExpansionGenerated: false,
    testOnly: true
  };
  assessment.explanations = [buildCustomerExplanation(assessment)];
  assessment.assessmentHash = sha256(assessment);
  return stable(assessment);
}

function buildSyntheticCustomerContext() {
  return stable({
    customerContextId: 'customer.context.synthetic.001',
    organizationId: 'org_synthetic_customer_intelligence',
    customerId: 'cust-synthetic-001',
    accountNumber: 'ACCT-SYN-001',
    accountName: 'Synthetic Market One',
    historyWindow: { startDate: '2026-01-01', endDate: '2026-03-31' },
    testOnly: true
  });
}

function baseOrder(overrides = {}) {
  const items = hasOwn(overrides, 'items') ? overrides.items : [
    { id: `${overrides.id || 'order-syn-001'}-item-cola`, sku: 'SKU-COLA', productName: 'Synthetic Cola Case', quantity: 12, unitPrice: 10, grossAmount: 120, netAmount: 120 },
    { id: `${overrides.id || 'order-syn-001'}-item-water`, sku: 'SKU-WATER', productName: 'Synthetic Water Case', quantity: 8, unitPrice: 5, grossAmount: 40, netAmount: 40 }
  ];
  const subtotal = hasOwn(overrides, 'subtotalAmount') ? overrides.subtotalAmount : items.reduce((sum, item) => sum + (numeric(item.grossAmount) || 0), 0);
  const net = hasOwn(overrides, 'netAmount') ? overrides.netAmount : items.reduce((sum, item) => sum + (numeric(item.netAmount) || 0), 0);
  return stable({
    id: overrides.id || 'order-syn-001',
    accountNumber: overrides.accountNumber || 'ACCT-SYN-001',
    accountName: overrides.accountName || 'Synthetic Market One',
    orderDate: overrides.orderDate || '2026-01-08',
    deliveryDate: overrides.deliveryDate || '2026-01-09',
    invoiceNumber: overrides.invoiceNumber || 'INV-SYN-001',
    routeManifestId: overrides.routeManifestId || 'route-syn-001',
    routeStopId: overrides.routeStopId || 'stop-syn-001',
    subtotalAmount: subtotal,
    deductionAmount: hasOwn(overrides, 'deductionAmount') ? overrides.deductionAmount : 0,
    netAmount: net,
    status: overrides.status || 'completed',
    evidenceConflict: overrides.evidenceConflict === true,
    items,
    deductions: overrides.deductions || [],
    testOnly: true
  });
}

function baseDelivery(overrides = {}) {
  return stable({
    id: overrides.id || 'delivery-syn-001',
    deliveryId: overrides.deliveryId || overrides.id || 'delivery-syn-001',
    routeId: overrides.routeId || 'route-syn-001',
    stopId: overrides.stopId || 'stop-syn-001',
    routeManifestId: overrides.routeManifestId || 'route-syn-001',
    routeStopId: overrides.routeStopId || 'stop-syn-001',
    serviceDate: overrides.serviceDate || '2026-01-09',
    status: overrides.status || 'completed',
    evidenceStale: overrides.evidenceStale === true,
    evidenceConflict: overrides.evidenceConflict === true,
    testOnly: true
  });
}

function baseDeduction(overrides = {}) {
  return stable({
    id: overrides.id || 'deduction-syn-001',
    orderId: overrides.orderId || 'order-syn-001',
    orderItemId: overrides.orderItemId || 'order-syn-001-item-cola',
    accountNumber: overrides.accountNumber || 'ACCT-SYN-001',
    routeStopId: overrides.routeStopId || 'stop-syn-001',
    sku: overrides.sku || 'SKU-COLA',
    productName: overrides.productName || 'Synthetic Cola Case',
    reason: overrides.reason || 'damaged_product',
    quantity: hasOwn(overrides, 'quantity') ? overrides.quantity : 1,
    amount: hasOwn(overrides, 'amount') ? overrides.amount : 10,
    status: overrides.status || 'recorded',
    createdAt: overrides.createdAt || '2026-01-10T00:00:00.000Z',
    evidenceConflict: overrides.evidenceConflict === true,
    testOnly: true
  });
}

function benchmarkRequest(overrides = {}) {
  const ctx = buildSyntheticCustomerContext();
  const customer = { organizationId: ctx.organizationId, customerId: ctx.customerId, accountNumber: ctx.accountNumber, accountName: ctx.accountName, ...(overrides.customer || {}) };
  return stable({
    caseId: overrides.caseId || 'customer_record_present',
    customerContext: { ...ctx, ...(overrides.customerContext || {}) },
    customer,
    orders: hasOwn(overrides, 'orders') ? overrides.orders : [baseOrder(), baseOrder({ id: 'order-syn-002', invoiceNumber: 'INV-SYN-002', orderDate: '2026-01-22', deliveryDate: '2026-01-23', routeStopId: 'stop-syn-002' })],
    deliveries: hasOwn(overrides, 'deliveries') ? overrides.deliveries : [baseDelivery(), baseDelivery({ id: 'delivery-syn-002', serviceDate: '2026-01-23', stopId: 'stop-syn-002' })],
    deductions: hasOwn(overrides, 'deductions') ? overrides.deductions : [],
    routeEvidence: hasOwn(overrides, 'routeEvidence') ? overrides.routeEvidence : { routeId: 'route-syn-001', stopId: 'stop-syn-001', stopSequence: 1, routeSafetyStatus: 'ELIGIBLE', historicalRouteAccountRelationship: ['route-syn-001'] },
    stopEvidence: hasOwn(overrides, 'stopEvidence') ? overrides.stopEvidence : { stopId: 'stop-syn-001', routeId: 'route-syn-001', status: 'completed', actualArrivalAt: '2026-01-09T10:00:00.000Z', actualDepartureAt: '2026-01-09T10:15:00.000Z', authorizedDriverNoteReferences: ['note-syn-001'] },
    evidenceConflict: overrides.evidenceConflict === true,
    evidenceStale: overrides.evidenceStale === true,
    currency: hasOwn(overrides, 'currency') ? overrides.currency : 'USD'
  });
}

function buildBenchmarkCases() {
  const unknownQuantityOrder = baseOrder({ id: 'order-unknown-qty', items: [{ id: 'item-unknown-qty', sku: 'SKU-UNKNOWN', productName: 'Synthetic Unknown Quantity', quantity: null, unitPrice: 9, grossAmount: null, netAmount: null }] });
  return stable([
    ['customer_record_present', benchmarkRequest(), 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['customer_record_missing', benchmarkRequest({ customer: { customerId: null, accountNumber: null }, customerContext: { customerId: null, accountNumber: null } }), 'CUSTOMER_RECORD_MISSING'],
    ['conflicting_customer_evidence', benchmarkRequest({ evidenceConflict: true, customer: { evidenceConflict: true } }), 'CUSTOMER_RECORD_CONFLICT'],
    ['route_account_relationship_present', benchmarkRequest({ routeEvidence: { routeId: 'route-syn-002', stopId: 'stop-syn-002', stopSequence: 2, routeSafetyStatus: 'ELIGIBLE', historicalRouteAccountRelationship: ['route-syn-002'] } }), 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['route_account_relationship_missing', benchmarkRequest({ routeEvidence: {} }), 'ACCOUNT_ROUTE_REFERENCE_MISSING'],
    ['stop_account_relationship_present', benchmarkRequest({ stopEvidence: { stopId: 'stop-syn-003', routeId: 'route-syn-003', status: 'completed' } }), 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['delivery_history_present', benchmarkRequest(), 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['delivery_history_missing', benchmarkRequest({ deliveries: [] }), 'DELIVERY_HISTORY_MISSING'],
    ['stale_delivery_evidence', benchmarkRequest({ deliveries: [baseDelivery({ evidenceStale: true })] }), 'DELIVERY_HISTORY_STALE'],
    ['conflicting_delivery_evidence', benchmarkRequest({ deliveries: [baseDelivery({ evidenceConflict: true })] }), 'DELIVERY_HISTORY_CONFLICT'],
    ['repeated_delivery_history', benchmarkRequest({ deliveries: [baseDelivery(), baseDelivery({ id: 'delivery-repeat-002', serviceDate: '2026-01-16' }), baseDelivery({ id: 'delivery-repeat-003', serviceDate: '2026-01-23' })] }), 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['product_history_present', benchmarkRequest(), 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['product_history_missing', benchmarkRequest({ orders: [] }), 'PRODUCT_HISTORY_MISSING'],
    ['historical_quantity_aggregation', benchmarkRequest({ orders: [baseOrder(), baseOrder({ id: 'order-qty-002', invoiceNumber: 'INV-QTY-002' })] }), 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['unknown_quantity', benchmarkRequest({ orders: [unknownQuantityOrder] }), 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['invoice_history_present', benchmarkRequest(), 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['invoice_history_missing', benchmarkRequest({ orders: [] }), 'INVOICE_HISTORY_MISSING'],
    ['invoice_conflict', benchmarkRequest({ orders: [baseOrder({ evidenceConflict: true })] }), 'INVOICE_HISTORY_CONFLICT'],
    ['historical_spend_aggregation', benchmarkRequest(), 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['unknown_spend', benchmarkRequest({ orders: [baseOrder({ id: 'order-unknown-spend', netAmount: null, subtotalAmount: null })] }), 'SPEND_EVIDENCE_INCOMPLETE'],
    ['multi_period_historical_spend', benchmarkRequest({ orders: [baseOrder({ orderDate: '2026-01-05', deliveryDate: '2026-01-06' }), baseOrder({ id: 'order-period-002', invoiceNumber: 'INV-PER-002', orderDate: '2026-02-05', deliveryDate: '2026-02-06' })] }), 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['deduction_absent', benchmarkRequest({ deductions: [] }), 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['deduction_recorded', benchmarkRequest({ deductions: [baseDeduction()] }), 'DEDUCTION_RECORDED'],
    ['unresolved_deduction', benchmarkRequest({ deductions: [baseDeduction({ status: 'unresolved' })] }), 'DEDUCTION_UNRESOLVED'],
    ['conflicting_deduction_evidence', benchmarkRequest({ deductions: [baseDeduction({ evidenceConflict: true })] }), 'DEDUCTION_EVIDENCE_CONFLICT'],
    ['observed_historical_service_cadence', benchmarkRequest({ deliveries: [baseDelivery({ serviceDate: '2026-01-03' }), baseDelivery({ id: 'delivery-cadence-002', serviceDate: '2026-01-10' }), baseDelivery({ id: 'delivery-cadence-003', serviceDate: '2026-01-17' })] }), 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['sparse_history', benchmarkRequest({ orders: [baseOrder()], deliveries: [baseDelivery()] }), 'NO_EXCEPTION_OR_INFORMATIONAL'],
    ['insufficient_evidence', benchmarkRequest({ customer: { customerId: null, accountNumber: null }, orders: [], deliveries: [], routeEvidence: {}, stopEvidence: {} }), 'INSUFFICIENT_EVIDENCE'],
    ['cross_organization_customer_mismatch', benchmarkRequest({ customer: { organizationId: 'org_other_customer' } }), 'CUSTOMER_RECORD_CONFLICT'],
    ['human_review', benchmarkRequest({ deliveries: [baseDelivery({ evidenceConflict: true })] }), 'HUMAN_REVIEW_REQUIRED'],
    ['no_exception_case', benchmarkRequest(), 'NO_EXCEPTION_OR_INFORMATIONAL']
  ].map(([caseId, request, expectedException]) => ({ caseId, request: { ...request, caseId }, expectedException, syntheticOnly: true, providerCallExpected: false, productionActivationExpected: false, predictionExpected: false })));
}

function querySyntheticCustomerAssessments() {
  return buildBenchmarkCases().map((benchmark) => stable({ caseId: benchmark.caseId, assessment: assessCustomerAccount(benchmark.request) }));
}

function buildCustomerIntelligenceEvidence() {
  const benchmarkCases = buildBenchmarkCases();
  const assessments = querySyntheticCustomerAssessments();
  const orchestrationEvidence = orchestration.buildOrchestrationEvidence();
  const lifecycleEvidence = lifecycle.buildLifecycleEvidence();
  const catalog = {
    schemaVersion: CUSTOMER_INTELLIGENCE_SCHEMA_VERSION,
    engineVersion: CUSTOMER_INTELLIGENCE_ENGINE_VERSION,
    generatedAt: DETERMINISTIC_GENERATED_AT,
    capabilityCount: CUSTOMER_CAPABILITIES.length,
    benchmarkCaseCount: benchmarkCases.length,
    currentFunctionalityAuditComplete: true,
    existingPredictionLogisticsBoundaryDocumented: true,
    integratedWithEnterpriseRegistry: registry.listEnterpriseCapabilities().length > 0,
    directEnterpriseRegistryCapability: null,
    directRegistryCapabilityDeferred: true,
    integratedWithCapabilityOrchestration: orchestrationEvidence.capabilities.some((capability) => capability.businessDomain === 'Customer Intelligence'),
    integratedWithLifecycleFramework: lifecycleEvidence.lifecycleRecords.some((record) => record.capabilityId === 'customer.intelligence.account'),
    integratedWithRouteIntelligence: true,
    integratedWithDriverIntelligence: true,
    integratedWithSupervisorIntelligence: true,
    integratedWithWarehouseIntelligence: true,
    integratedWithFleetIntelligence: true,
    providerCallInvoked: false,
    hostedAiInvoked: false,
    modelSelectionActivated: false,
    predictionGenerated: false,
    creditScoringGenerated: false,
    paymentRiskDecisioningGenerated: false,
    protectedClassInferenceGenerated: false,
    personalityEmotionInferenceGenerated: false,
    customerValueScoringGenerated: false,
    autonomousPricingGenerated: false,
    autonomousDiscountingGenerated: false,
    customerPrioritizationGenerated: false,
    salesAutomationGenerated: false,
    crmExpansionGenerated: false,
    productionApiExposed: false,
    migrationExecuted: false,
    deploymentExecuted: false,
    productionApplicable: false,
    operationsIntelligenceStarted: false,
    safetyIntelligenceStarted: false,
    testOnly: true
  };
  catalog.catalogHash = sha256(catalog);
  return stable({
    catalog,
    capabilities: CUSTOMER_CAPABILITIES,
    contextContract: customerContextContract(),
    evidenceStates: EVIDENCE_STATES,
    confidenceStates: CONFIDENCE_STATES,
    deductionStates: DEDUCTION_STATES,
    exceptionTypes: EXCEPTION_TYPES,
    severities: SEVERITIES,
    prohibitedFields: PROHIBITED_FIELDS,
    benchmarkCases,
    assessments,
    integrationReferences: {
      routeIntelligence: { schemaVersion: routeIntel.ROUTE_INTELLIGENCE_SCHEMA_VERSION, authority: 'ROUTE_SAFETY_AND_COMPATIBILITY' },
      driverIntelligence: { schemaVersion: driverIntel.DRIVER_INTELLIGENCE_SCHEMA_VERSION, authority: 'DRIVER_OPERATIONAL_STATE_AND_STOP_PROGRESS' },
      supervisorIntelligence: { schemaVersion: supervisorIntel.SUPERVISOR_INTELLIGENCE_SCHEMA_VERSION, authority: 'SUPERVISOR_PORTFOLIO_AND_PRIORITIZATION' },
      warehouseIntelligence: { schemaVersion: warehouseIntel.WAREHOUSE_INTELLIGENCE_SCHEMA_VERSION, authority: 'LOAD_STAGING_READINESS_AND_DISCREPANCIES' },
      fleetIntelligence: { schemaVersion: fleetIntel.FLEET_INTELLIGENCE_SCHEMA_VERSION, authority: 'VEHICLE_READINESS_AND_AVAILABILITY' },
      existingAccountIntelligence: { boundary: 'REFERENCE_ONLY', routePath: 'bridge-api/routes/accountIntelligence.js' },
      existingPredictionEngine: { boundary: 'DEFER', servicePath: 'bridge-api/services/predictionEngine.js' },
      existingLogisticsIntelligence: { boundary: 'REFERENCE_ONLY', servicePath: 'bridge-api/services/logisticsIntelligence.js' }
    }
  });
}

function validateCustomerAssessment(assessment) {
  const errors = [];
  for (const field of scanProhibitedFields(assessment)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (PREDICTION_TERMS.test(stableStringify(assessment.summary || {}))) errors.push({ rule: 'PREDICTION_LANGUAGE_IN_OPERATIONAL_OUTPUT' });
  if (
    assessment.context.organizationIsolationPreserved !== true
    && !asArray(assessment.exceptions).some((item) => item.exceptionType === 'CUSTOMER_RECORD_CONFLICT' && item.humanReviewRequired === true)
  ) errors.push({ rule: 'CROSS_ORGANIZATION_CUSTOMER_MERGED' });
  if (assessment.context.identityResolution?.customerNameUsedAsIdentifier === true) errors.push({ rule: 'CUSTOMER_NAME_USED_AS_IDENTIFIER' });
  if (assessment.context.identityResolution?.similarlyNamedCustomerLinked === true) errors.push({ rule: 'SIMILAR_CUSTOMER_CROSSLINKED' });
  if (assessment.historicalSpend.unknownSpendConvertedToZero !== false) errors.push({ rule: 'UNKNOWN_SPEND_CONVERTED_TO_ZERO' });
  if (asArray(assessment.productHistory.products).some((item) => item.historicalQuantity === null) && assessment.productHistory.unknownQuantityPreserved !== true) errors.push({ rule: 'UNKNOWN_QUANTITY_CONVERTED_TO_ZERO' });
  for (const field of ['providerCallInvoked','hostedAiInvoked','modelSelectionActivated','productionApiExposed','migrationExecuted','deploymentExecuted','predictionGenerated','creditScoringGenerated','sensitiveInferenceGenerated','autonomousPricingGenerated','salesAutomationGenerated','crmExpansionGenerated']) {
    if (assessment[field] !== false) errors.push({ rule: 'PROHIBITED_CAPABILITY_FLAG', field });
  }
  if (!assessment.assessmentHash || assessment.assessmentHash !== sha256({ ...assessment, assessmentHash: undefined })) errors.push({ rule: 'ASSESSMENT_HASH_MISMATCH' });
  return stable({ valid: errors.length === 0, errors });
}

function validateCustomerIntelligenceEvidence(evidence = buildCustomerIntelligenceEvidence()) {
  const errors = [];
  for (const field of ['providerCallInvoked','hostedAiInvoked','modelSelectionActivated','predictionGenerated','creditScoringGenerated','paymentRiskDecisioningGenerated','protectedClassInferenceGenerated','personalityEmotionInferenceGenerated','customerValueScoringGenerated','autonomousPricingGenerated','autonomousDiscountingGenerated','customerPrioritizationGenerated','salesAutomationGenerated','crmExpansionGenerated','productionApiExposed','migrationExecuted','deploymentExecuted','productionApplicable','operationsIntelligenceStarted','safetyIntelligenceStarted']) {
    if (evidence.catalog[field] !== false) errors.push({ rule: 'PROHIBITED_CAPABILITY_FLAG', field });
  }
  for (const field of ['currentFunctionalityAuditComplete','existingPredictionLogisticsBoundaryDocumented','integratedWithEnterpriseRegistry','integratedWithCapabilityOrchestration','integratedWithLifecycleFramework','integratedWithRouteIntelligence','integratedWithDriverIntelligence','integratedWithSupervisorIntelligence','integratedWithWarehouseIntelligence','integratedWithFleetIntelligence']) {
    if (evidence.catalog[field] !== true) errors.push({ rule: 'PLATFORM_INTEGRATION_MISSING', field });
  }
  for (const field of scanProhibitedFields(evidence)) errors.push({ rule: 'PROHIBITED_SCOPE_FIELD', field });
  if (/AI-IEP-005B\.\d+/.test(stableStringify(evidence))) errors.push({ rule: 'CUSTOMER_PACKAGE_NUMBER_FABRICATED' });
  if (/OPERATIONS_INTELLIGENCE_IMPLEMENTED/.test(stableStringify(evidence))) errors.push({ rule: 'OPERATIONS_INTELLIGENCE_STARTED' });
  for (const benchmark of evidence.benchmarkCases || []) {
    const record = evidence.assessments.find((item) => item.caseId === benchmark.caseId);
    if (!record) errors.push({ rule: 'MISSING_BENCHMARK_ASSESSMENT', caseId: benchmark.caseId });
    else {
      const exceptionTypes = record.assessment.exceptions.map((item) => item.exceptionType);
      if (benchmark.expectedException !== 'NO_EXCEPTION_OR_INFORMATIONAL' && !exceptionTypes.includes(benchmark.expectedException)) errors.push({ rule: 'BENCHMARK_EXPECTATION_MISMATCH', caseId: benchmark.caseId, expected: benchmark.expectedException, actual: exceptionTypes });
      for (const error of validateCustomerAssessment(record.assessment).errors) errors.push({ ...error, caseId: benchmark.caseId });
    }
  }
  return stable({ valid: errors.length === 0, errors });
}

module.exports = {
  CONFIDENCE_STATES,
  CUSTOMER_CAPABILITIES,
  CUSTOMER_INTELLIGENCE_ENGINE_VERSION,
  CUSTOMER_INTELLIGENCE_SCHEMA_VERSION,
  DEDUCTION_STATES,
  DETERMINISTIC_GENERATED_AT,
  EVIDENCE_STATES,
  EXCEPTION_TYPES,
  PROHIBITED_FIELDS,
  SEVERITIES,
  assessCustomerAccount,
  baseDeduction,
  baseDelivery,
  baseOrder,
  buildBenchmarkCases,
  buildCustomerEvidence,
  buildCustomerExplanation,
  buildCustomerIntelligenceEvidence,
  buildCustomerOperationalContext,
  buildCustomerRouteContext,
  buildCustomerStopContext,
  buildCustomerSummary,
  buildDeductionHistory,
  buildDeliveryHistory,
  buildInvoiceHistory,
  buildProductHistory,
  buildServicePatternEvidence,
  buildSyntheticCustomerContext,
  calculateHistoricalSpend,
  customerContextContract,
  detectCustomerOperationalExceptions,
  querySyntheticCustomerAssessments,
  scanProhibitedFields,
  sha256,
  stable,
  stableStringify,
  validateCustomerAssessment,
  validateCustomerContext,
  validateCustomerIntelligenceEvidence,
  paths: { backendRoot, repoRoot, docsRoot, generatedRoot }
};
