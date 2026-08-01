const fs = require('fs');
const path = require('path');
const registry = require('./enterpriseCapabilityRegistry');
const governance = require('./decisionGovernance');
const { EXECUTION_STRATEGIES, EXECUTION_PROFILES } = require('./constants');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'implementation');
const generatedRoot = path.join(docsRoot, 'intelligence-capability-orchestration', 'generated');
const ORCHESTRATION_SCHEMA_VERSION = 'intelligence.capability.orchestration.v1';
const ORCHESTRATION_ENGINE_VERSION = 'intelligence.capability.orchestration.engine.v1';
const DETERMINISTIC_GENERATED_AT = '2026-07-25T00:00:00.000Z';
const LIFECYCLE_STATES = Object.freeze(['PROPOSED', 'DEFINED', 'READY_FOR_IMPLEMENTATION', 'DEFERRED', 'RETIRED']);
const DATA_SOURCES = Object.freeze(['GPS','Routing','Bridge Database','Customer Accounts','Invoices','Products','Sales History','Inventory','Warehouse','Driver Activity','Safety Events','Traffic','Weather','Vehicle Telemetry','Supervisor Notes','User Notes','Media','Documents','Future Connectors']);
const DOMAINS = Object.freeze(['Route Intelligence','Driver Intelligence','Supervisor Intelligence','Warehouse Intelligence','Customer Intelligence','Fleet Intelligence','Safety Intelligence','Operations Intelligence','Maintenance Intelligence','Inventory Intelligence','Financial Intelligence','Enterprise Intelligence']);

function stable(value) { return governance.stable(value); }
function stableStringify(value) { return governance.stableStringify(value); }
function sha256(value) { return governance.sha256(value); }
function rel(p) { return path.relative(repoRoot, p).replace(/\\/g, '/'); }
function exists(p) { return fs.existsSync(p); }
function walk(dir, predicate = () => true) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, predicate);
    return entry.isFile() && predicate(full) ? [full] : [];
  });
}

const domainTemplates = Object.freeze([
  ['route.intelligence.optimization', 'Route Intelligence', 'Route Intelligence Optimization', ['GPS','Routing','Bridge Database','Traffic','Weather'], ['routePlan','routeRiskSummary']],
  ['driver.intelligence.performance', 'Driver Intelligence', 'Driver Intelligence Performance', ['Driver Activity','Safety Events','Supervisor Notes'], ['driverPerformanceSummary','coachingSignals']],
  ['supervisor.intelligence.operations', 'Supervisor Intelligence', 'Supervisor Intelligence Operations', ['Supervisor Notes','Driver Activity','User Notes'], ['supervisorBrief','operationalExceptions']],
  ['warehouse.intelligence.flow', 'Warehouse Intelligence', 'Warehouse Intelligence Flow', ['Warehouse','Inventory','Products'], ['warehouseFlowSummary','bottleneckSignals']],
  ['customer.intelligence.account', 'Customer Intelligence', 'Customer Intelligence Account', ['Customer Accounts','Invoices','Sales History','Documents'], ['customerHealthSummary','serviceSignals']],
  ['fleet.intelligence.utilization', 'Fleet Intelligence', 'Fleet Intelligence Utilization', ['Vehicle Telemetry','GPS','Driver Activity'], ['fleetUtilizationSummary','capacitySignals']],
  ['safety.intelligence.risk', 'Safety Intelligence', 'Safety Intelligence Risk', ['Safety Events','Routing','Bridge Database','Weather'], ['safetyRiskSummary','mitigationSignals']],
  ['operations.intelligence.throughput', 'Operations Intelligence', 'Operations Intelligence Throughput', ['Routing','Warehouse','Driver Activity','Customer Accounts'], ['throughputSummary','delaySignals']],
  ['maintenance.intelligence.health', 'Maintenance Intelligence', 'Maintenance Intelligence Health', ['Vehicle Telemetry','Maintenance Records','Driver Activity'], ['maintenanceHealthSummary','serviceRiskSignals']],
  ['inventory.intelligence.availability', 'Inventory Intelligence', 'Inventory Intelligence Availability', ['Inventory','Products','Warehouse','Sales History'], ['inventoryAvailabilitySummary','stockoutSignals']],
  ['financial.intelligence.margin', 'Financial Intelligence', 'Financial Intelligence Margin', ['Invoices','Sales History','Products','Customer Accounts'], ['marginSummary','costSignals']],
  ['enterprise.intelligence.overview', 'Enterprise Intelligence', 'Enterprise Intelligence Overview', ['Future Connectors','Documents','User Notes'], ['enterpriseSummary','crossDomainSignals']]
]);

function canonicalDataSources(sources) {
  return sources.map((source) => DATA_SOURCES.includes(source) ? source : 'Future Connectors');
}

function buildCapabilities() {
  return domainTemplates.map(([capabilityId, businessDomain, displayName, sources, outputs], index) => {
    const dependencies = index === 0 ? [] : ['route.intelligence.optimization'];
    const capability = {
      schemaVersion: ORCHESTRATION_SCHEMA_VERSION,
      capabilityId,
      displayName,
      description: `${displayName} capability metadata definition for future enterprise intelligence orchestration.`,
      businessDomain,
      inputs: canonicalDataSources(sources).map((source) => ({ inputId: source.toLowerCase().replace(/[^a-z0-9]+/g, '.'), source, required: source !== 'Future Connectors' })),
      outputs: outputs.map((outputId) => ({ outputId, schema: `${outputId}.v1`, testOnly: true })),
      requiredDataSources: canonicalDataSources(sources),
      executionProfile: 'STANDARD',
      executionStrategyPreferences: ['DETERMINISTIC_RULES', 'HOSTED_BALANCED_MODEL'].filter((strategy) => Object.values(EXECUTION_STRATEGIES).includes(strategy)),
      minimumConfidence: 0.7,
      fallbackBehavior: { mode: 'ABSTAIN_WITH_EXPLANATION', preservesPriorDecision: true },
      humanReviewPolicy: { requiredForProduction: true, requiredForLowConfidence: true, threshold: 0.7 },
      costConstraints: { maxEstimatedCostMicroUsd: 100000, unknownCostPolicy: 'FAIL_CLOSED' },
      securityClassification: 'INTERNAL',
      privacyClassification: sources.some((source) => ['Driver Activity','Customer Accounts','Invoices','Media','User Notes'].includes(source)) ? 'SENSITIVE' : 'INTERNAL',
      complianceTags: ['TEST_ONLY', 'PROVIDER_NEUTRAL', 'NO_PRODUCTION_ACTIVATION'],
      version: '0.1.0',
      lifecycleState: 'DEFINED',
      documentationReferences: ['docs/implementation/intelligence-capability-orchestration/README.md'],
      owner: 'Truck-Safe Routing Architecture',
      dependencies,
      registeredWithEnterpriseCapabilityRegistry: registry.listEnterpriseCapabilities().length > 0,
      testOnly: true,
      productionApplicable: false
    };
    capability.capabilityHash = sha256(capability);
    return stable(capability);
  });
}

function buildExecutionContracts(capabilities = buildCapabilities()) {
  return capabilities.map((capability) => {
    const contract = {
      schemaVersion: 'intelligence.execution.contract.v1',
      capabilityId: capability.capabilityId,
      capabilityVersion: capability.version,
      inputSchema: { requiredInputs: capability.inputs.filter((input) => input.required).map((input) => input.inputId), optionalInputs: capability.inputs.filter((input) => !input.required).map((input) => input.inputId) },
      outputSchema: { outputs: capability.outputs.map((output) => output.outputId) },
      confidenceMetadata: { minimumConfidence: capability.minimumConfidence, confidenceRequired: true },
      qualityMetadata: { qualityGates: ['SCHEMA_VALID', 'SOURCE_REFERENCES_PRESENT', 'CONFIDENCE_RECORDED'] },
      explainabilityMetadata: { required: true, reasonCodesRequired: true, evidenceReferencesRequired: true },
      costMetadata: capability.costConstraints,
      reasonCodes: ['CAPABILITY_DEFINED', 'DEPENDENCIES_RESOLVED', 'TEST_ONLY_EXECUTION_PLAN', 'NO_PROVIDER_CALL'],
      validationRules: ['VALID_CAPABILITY_ID', 'KNOWN_DATA_SOURCES', 'VALID_LIFECYCLE', 'DOCUMENTATION_PRESENT', 'NO_RUNTIME_EXECUTION'],
      errorHandling: { invalidInput: 'REJECT_REQUEST', dependencyFailure: 'ABSTAIN_WITH_EXPLANATION', unknownCost: capability.costConstraints.unknownCostPolicy },
      testOnly: true,
      productionApplicable: false
    };
    contract.contractHash = sha256(contract);
    return stable(contract);
  });
}

function resolveDependencies(capability, capabilities) {
  const byId = new Map(capabilities.map((item) => [item.capabilityId, item]));
  return (capability.dependencies || []).map((dependencyId) => ({ dependencyId, resolved: byId.has(dependencyId), lifecycleState: byId.get(dependencyId)?.lifecycleState || 'UNKNOWN' }));
}

function buildExecutionPlan(capabilityId, inputs = {}, evidence = buildOrchestrationEvidence()) {
  const capability = evidence.capabilities.find((item) => item.capabilityId === capabilityId);
  if (!capability) return null;
  const contract = evidence.contracts.find((item) => item.capabilityId === capabilityId);
  const plan = {
    schemaVersion: 'intelligence.execution.plan.template.v1',
    requestedCapability: capability.capabilityId,
    inputs: stable(inputs),
    resolvedDependencies: resolveDependencies(capability, evidence.capabilities),
    candidateStrategies: capability.executionStrategyPreferences,
    policyChecks: ['TEST_ONLY', 'HUMAN_REVIEW_REQUIRED_FOR_PRODUCTION', 'NO_PROVIDER_CALL'],
    budgetChecks: [{ maxEstimatedCostMicroUsd: capability.costConstraints.maxEstimatedCostMicroUsd, unknownCostPolicy: capability.costConstraints.unknownCostPolicy }],
    confidenceGates: [{ minimumConfidence: capability.minimumConfidence, actionBelowThreshold: 'ABSTAIN_WITH_EXPLANATION' }],
    fallbackPlan: [capability.fallbackBehavior],
    humanReviewRequirements: capability.humanReviewPolicy,
    expectedOutputs: contract.outputSchema.outputs,
    validationRequirements: contract.validationRules,
    advisoryOnly: true,
    handsToIntelligenceExecutionPlatform: true,
    runtimeExecutionInvoked: false,
    providerCallInvoked: false,
    testOnly: true,
    productionApplicable: false
  };
  plan.planHash = sha256(plan);
  return stable(plan);
}

function buildOrchestrationEvidence() {
  const capabilities = buildCapabilities();
  const contracts = buildExecutionContracts(capabilities);
  const plans = capabilities.map((capability) => buildExecutionPlan(capability.capabilityId, {}, { capabilities, contracts }));
  const docs = walk(path.join(docsRoot, 'intelligence-capability-orchestration'), (p) => p.endsWith('.md')).map(rel);
  const catalog = {
    schemaVersion: ORCHESTRATION_SCHEMA_VERSION,
    engineVersion: ORCHESTRATION_ENGINE_VERSION,
    generatedAt: DETERMINISTIC_GENERATED_AT,
    domains: DOMAINS.map((domain) => ({ domain, capabilityCount: capabilities.filter((capability) => capability.businessDomain === domain).length })),
    capabilityCount: capabilities.length,
    contractCount: contracts.length,
    planTemplateCount: plans.length,
    documentationReferences: docs,
    testOnly: true,
    productionApplicable: false
  };
  catalog.catalogHash = sha256(catalog);
  return stable({ catalog, capabilities, contracts, plans, dataSources: DATA_SOURCES, domains: DOMAINS });
}

function validateOrchestration(evidence = buildOrchestrationEvidence()) {
  const errors = [];
  const ids = new Set();
  const names = new Set();
  const capabilityIds = new Set(evidence.capabilities.map((capability) => capability.capabilityId));
  for (const capability of evidence.capabilities) {
    if (ids.has(capability.capabilityId)) errors.push({ rule: 'DUPLICATE_CAPABILITY_ID', capabilityId: capability.capabilityId });
    ids.add(capability.capabilityId);
    if (names.has(capability.displayName)) errors.push({ rule: 'DUPLICATE_CAPABILITY_NAME', capabilityId: capability.capabilityId });
    names.add(capability.displayName);
    if (!LIFECYCLE_STATES.includes(capability.lifecycleState)) errors.push({ rule: 'UNKNOWN_LIFECYCLE_STATE', capabilityId: capability.capabilityId });
    for (const source of capability.requiredDataSources) if (!DATA_SOURCES.includes(source)) errors.push({ rule: 'UNKNOWN_DATA_SOURCE', capabilityId: capability.capabilityId, source });
    for (const dependency of capability.dependencies || []) if (!capabilityIds.has(dependency)) errors.push({ rule: 'INVALID_DEPENDENCY_CHAIN', capabilityId: capability.capabilityId, dependency });
    if (!evidence.contracts.some((contract) => contract.capabilityId === capability.capabilityId)) errors.push({ rule: 'MISSING_EXECUTION_CONTRACT', capabilityId: capability.capabilityId });
    if (!capability.documentationReferences?.length) errors.push({ rule: 'MISSING_DOCUMENTATION', capabilityId: capability.capabilityId });
    if (capability.productionApplicable === true) errors.push({ rule: 'PRODUCTION_CAPABILITY_PROHIBITED', capabilityId: capability.capabilityId });
  }
  for (const contract of evidence.contracts) {
    if (!capabilityIds.has(contract.capabilityId)) errors.push({ rule: 'UNKNOWN_CONTRACT_CAPABILITY', capabilityId: contract.capabilityId });
    if (!contract.contractHash) errors.push({ rule: 'MISSING_CONTRACT_HASH', capabilityId: contract.capabilityId });
  }
  for (const plan of evidence.plans) {
    if (!capabilityIds.has(plan.requestedCapability)) errors.push({ rule: 'UNKNOWN_PLAN_CAPABILITY', capabilityId: plan.requestedCapability });
    if (plan.runtimeExecutionInvoked || plan.providerCallInvoked) errors.push({ rule: 'RUNTIME_EXECUTION_PROHIBITED', capabilityId: plan.requestedCapability });
    if (!plan.planHash) errors.push({ rule: 'MISSING_PLAN_HASH', capabilityId: plan.requestedCapability });
  }
  return { valid: errors.length === 0, errors };
}

function capabilityReadiness(evidence = buildOrchestrationEvidence()) {
  return evidence.capabilities.map((capability) => {
    const contract = evidence.contracts.find((item) => item.capabilityId === capability.capabilityId);
    const plan = evidence.plans.find((item) => item.requestedCapability === capability.capabilityId);
    const dependencies = resolveDependencies(capability, evidence.capabilities);
    const complete = Boolean(contract && plan && dependencies.every((dependency) => dependency.resolved));
    return stable({ capabilityId: capability.capabilityId, businessDomain: capability.businessDomain, lifecycleState: capability.lifecycleState, dependencyComplete: dependencies.every((dependency) => dependency.resolved), executionContractPresent: Boolean(contract), executionPlanTemplatePresent: Boolean(plan), readiness: complete ? 'READY_FOR_IMPLEMENTATION' : 'PARTIAL', implementationStatus: 'METADATA_ONLY', hash: sha256({ capabilityId: capability.capabilityId, complete }) });
  });
}

module.exports = { ORCHESTRATION_SCHEMA_VERSION, ORCHESTRATION_ENGINE_VERSION, DETERMINISTIC_GENERATED_AT, LIFECYCLE_STATES, DATA_SOURCES, DOMAINS, buildCapabilities, buildExecutionContracts, buildExecutionPlan, buildOrchestrationEvidence, validateOrchestration, capabilityReadiness, stable, stableStringify, sha256, paths: { backendRoot, repoRoot, docsRoot, generatedRoot } };
