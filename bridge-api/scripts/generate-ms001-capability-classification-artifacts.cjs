#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'ai-development', 'model-selection', 'ms-001-ai-capability-execution-classification');
const generatedRoot = path.join(docsRoot, 'generated');

const DOMAINS = Object.freeze([
  'Route Intelligence',
  'Driver Intelligence',
  'Supervisor Intelligence',
  'Warehouse Intelligence',
  'Fleet Intelligence',
  'Customer Intelligence',
  'Operations Intelligence',
  'Safety Intelligence'
]);
const EXECUTION_CLASSES = Object.freeze(['D0', 'D1', 'D2', 'D3']);
const FUTURE_AI_ROLES = Object.freeze(['NONE','EXPLANATION','SUMMARIZATION','CONVERSATION','EXTRACTION','CLASSIFICATION','RANKING','ANOMALY_DETECTION','PREDICTION','REASONING','OTHER_EXISTING_APPROVED_ROLE']);
const BENCHMARK_REQUIREMENTS = Object.freeze(['NOT_REQUIRED_D0','REQUIRED_D1','REQUIRED_D2','REQUIRED_D3','REQUIRES_OWNER_REVIEW']);

function sha(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function json(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function R(id, domain, name, executionClass, evidence, options = {}) {
  const modelBenchmarkRequired = executionClass !== 'D0' && options.benchmarkRequirement !== 'REQUIRES_OWNER_REVIEW';
  return {
    capabilityId: id,
    domain,
    capabilityName: name,
    capabilityDescription: options.description || name,
    repositoryEvidence: evidence,
    authoritativeSourceService: options.sourceService || evidence[0],
    currentImplementationType: options.currentType || 'repository-only deterministic foundation',
    deterministicLogicPresent: options.deterministic !== false,
    existingModelProviderDependency: options.provider || null,
    existingFallbackBehavior: options.fallback || 'deterministic result or human review; no model fallback required',
    currentProductionStatus: options.productionStatus || 'not production-certified by MS-001',
    authoritativeDecisionOwner: options.owner || 'deterministic TSR records and services',
    modelOutputMayInfluence: Boolean(options.modelInfluence),
    modelOutputMayOverrideDeterministicResults: false,
    safetyRelevant: Boolean(options.safety),
    legalPhysicalConstraintRelevant: Boolean(options.legalPhysical),
    executionClass,
    classificationConfidence: options.confidence || 'HIGH',
    classificationRationale: options.rationale || `${executionClass} is the least complex class supported by repository evidence for this capability.`,
    futureAiRoles: options.roles || ['NONE'],
    dataCharacteristics: {
      dataShape: options.dataShape || 'structured',
      tenantSensitive: options.tenantSensitive !== false,
      driverEmployeeRelated: Boolean(options.employee),
      customerRelated: Boolean(options.customer),
      operational: options.operational !== false,
      safetyRelated: Boolean(options.safety),
      historical: Boolean(options.historical),
      realTime: Boolean(options.realTime),
      expectedEvidenceRequirements: options.evidenceRequirements || 'repository evidence, source records, tenant context, and generated validation artifacts'
    },
    runtimeCharacteristics: {
      latencySensitivity: options.latency || 'UNKNOWN_REQUIRES_BENCHMARK_DEFINITION',
      expectedInvocationFrequency: options.frequency || 'UNKNOWN_REQUIRES_BENCHMARK_DEFINITION',
      onlineRelevance: options.online || 'UNKNOWN_REQUIRES_BENCHMARK_DEFINITION',
      offlineRelevance: options.offline || 'UNKNOWN_REQUIRES_BENCHMARK_DEFINITION',
      mobileRelevance: options.mobile || 'UNKNOWN_REQUIRES_BENCHMARK_DEFINITION',
      batchRelevance: options.batch || 'UNKNOWN_REQUIRES_BENCHMARK_DEFINITION',
      realTimeRelevance: options.realTime ? 'REAL_TIME_RELEVANT' : 'UNKNOWN_REQUIRES_BENCHMARK_DEFINITION'
    },
    costCharacteristics: {
      expectedCostSensitivity: options.cost || (executionClass === 'D0' ? 'EXTREME' : 'HIGH'),
      rationale: options.costRationale || (executionClass === 'D0' ? 'D0 eliminates unnecessary inference cost.' : 'Future benchmarking must find the cheapest adequate execution strategy.')
    },
    benchmarkRequirement: options.benchmarkRequirement || (executionClass === 'D0' ? 'NOT_REQUIRED_D0' : `REQUIRED_${executionClass}`),
    modelBenchmarkRequired,
    hybridBoundary: options.hybridBoundary || null,
    safetyAuthority: options.safetyAuthority || (options.safety ? 'Deterministic safety, legal, physical, route, tenant, and authorization controls remain authoritative.' : 'Not safety-authoritative.'),
    unsupportedPredictionAdded: false,
    unapprovedVoiceCapabilityAdded: false,
    fabricatedBenchmarkThreshold: null,
    providerSelected: null,
    modelSelected: null,
    providerRanking: null,
    modelRanking: null,
    pricingBenchmarkPerformed: false,
    productionOrchestrationActive: false,
    deploymentClaimed: false,
    migrationClaimed: false,
    premiumModelDesignated: false,
    costMayOverrideSafety: false
  };
}

const CAPABILITIES = Object.freeze([
  R('route.clearance_eligibility', 'Route Intelligence', 'Clearance eligibility', 'D0', ['bridge-api/services/intelligenceExecution/routeIntelligence.js','docs/implementation/route-intelligence-foundation/generated/route_safety_gate_report.json'], { safety: true, legalPhysical: true, realTime: true, mobile: 'MOBILE_RELEVANT', rationale: 'Vehicle height and low-clearance facts are deterministic comparisons; AI may not decide legality.' }),
  R('route.truck_restriction_compliance', 'Route Intelligence', 'Truck restriction compliance', 'D0', ['bridge-api/services/intelligenceExecution/routeIntelligence.js','docs/implementation/route-intelligence-foundation/generated/route_restriction_catalog.json'], { safety: true, legalPhysical: true, realTime: true }),
  R('route.hazard_and_closure_assessment', 'Route Intelligence', 'Hazard and closure assessment', 'D0', ['bridge-api/services/intelligenceExecution/routeIntelligence.js','docs/implementation/route-intelligence-foundation/generated/route_hazard_catalog.json'], { safety: true, legalPhysical: true, realTime: true }),
  R('route.alternative_comparison', 'Route Intelligence', 'Alternative route comparison', 'D0', ['bridge-api/services/intelligenceExecution/routeIntelligence.js','docs/implementation/route-intelligence-foundation/generated/route_alternative_comparison_report.json'], { safety: true, legalPhysical: true }),
  R('route.risk_explanation.presentation', 'Route Intelligence', 'Route risk explanation presentation', 'D2', ['docs/implementation/enterprise-intelligence-capability-registry/generated/capability_registry.json','bridge-api/routes/ai.js'], { safety: true, legalPhysical: true, modelInfluence: true, roles: ['EXPLANATION','SUMMARIZATION'], hybridBoundary: 'Deterministic route safety decision remains D0; AI may only explain supplied route facts.', currentType: 'disabled/future registry placeholder plus legacy route-risk prompt', provider: 'legacy.ai.structured_response path when invoked through /api/ai', latency: 'INTERACTIVE', cost: 'HIGH' }),

  R('driver.profile_state_contract', 'Driver Intelligence', 'Driver profile and state contract', 'D0', ['bridge-api/services/intelligenceExecution/driverIntelligence.js','docs/implementation/driver-intelligence-foundation/generated/driver_profile_contract.json'], { employee: true, mobile: 'MOBILE_RELEVANT' }),
  R('driver.route_adherence_deviation', 'Driver Intelligence', 'Route adherence and deviation', 'D0', ['bridge-api/services/intelligenceExecution/driverIntelligence.js','docs/implementation/driver-intelligence-foundation/DRIVER_ROUTE_ADHERENCE.md'], { safety: true, employee: true, realTime: true, mobile: 'MOBILE_RELEVANT' }),
  R('driver.stop_progress', 'Driver Intelligence', 'Stop progress awareness', 'D0', ['bridge-api/services/intelligenceExecution/driverIntelligence.js','docs/implementation/driver-intelligence-foundation/DRIVER_STOP_PROGRESS.md'], { employee: true, realTime: true, mobile: 'MOBILE_RELEVANT' }),
  R('driver.speed_compliance', 'Driver Intelligence', 'Speed compliance warning', 'D0', ['bridge-api/services/intelligenceExecution/driverIntelligence.js','docs/implementation/driver-intelligence-foundation/DRIVER_SPEED_COMPLIANCE.md'], { safety: true, legalPhysical: true, employee: true, realTime: true, mobile: 'MOBILE_RELEVANT' }),
  R('driver.copilot.contextual_response', 'Driver Intelligence', 'Driver copilot contextual response', 'D2', ['bridge-api/routes/ai.js','bridge-api/scripts/check-driver-copilot-auth.cjs'], { safety: true, employee: true, modelInfluence: true, roles: ['CONVERSATION','EXPLANATION','SUMMARIZATION'], hybridBoundary: 'Backend route, hazard, delivery, and authorization facts remain authoritative; AI may answer only from supplied context.', currentType: 'legacy /api/ai hosted structured response surface', provider: 'legacy.ai.structured_response', latency: 'INTERACTIVE', frequency: 'HIGH', cost: 'HIGH' }),

  R('supervisor.route_portfolio_snapshot', 'Supervisor Intelligence', 'Route portfolio snapshot', 'D0', ['bridge-api/services/intelligenceExecution/supervisorOperationalIntelligence.js','docs/implementation/supervisor-intelligence-foundation/generated/supervisor_route_portfolio_catalog.json'], { safety: true, employee: true, batch: 'BATCH_RELEVANT' }),
  R('supervisor.exception_detection', 'Supervisor Intelligence', 'Supervisor exception detection', 'D0', ['bridge-api/services/intelligenceExecution/supervisorOperationalIntelligence.js','docs/implementation/supervisor-intelligence-foundation/generated/supervisor_exception_catalog.json'], { safety: true, employee: true }),
  R('supervisor.alert_priority', 'Supervisor Intelligence', 'Supervisor alert priority', 'D0', ['bridge-api/services/intelligenceExecution/supervisorOperationalIntelligence.js','docs/implementation/supervisor-intelligence-foundation/generated/supervisor_alert_priority_report.json'], { safety: true, employee: true }),
  R('supervisor.daily_operations_report.narrative', 'Supervisor Intelligence', 'Supervisor daily operations report narrative', 'D2', ['bridge-api/services/intelligenceExecution/supervisorAiAdapter.js','bridge-api/services/supervisorIntelligence.js'], { safety: true, employee: true, modelInfluence: true, roles: ['SUMMARIZATION','EXPLANATION'], hybridBoundary: 'Deterministic supervisor context remains source of truth; hosted narrative is advisory only.', currentType: 'implemented hosted advisory narrative through IEP', provider: 'OpenAI through providerAdapters for supervisor.daily_operations_report', latency: 'BATCH', frequency: 'MEDIUM', cost: 'HIGH' }),
  R('supervisor.freeform_question_answer', 'Supervisor Intelligence', 'Supervisor operational question answer', 'D2', ['bridge-api/routes/ai.js','docs/implementation/intelligence-execution-platform-legacy-ai-migration/CURRENT_LEGACY_AI_AUDIT.md'], { safety: true, employee: true, modelInfluence: true, roles: ['CONVERSATION','REASONING','SUMMARIZATION'], currentType: 'legacy /api/ai structured response surface', provider: 'legacy.ai.structured_response', cost: 'HIGH' }),

  R('warehouse.route_load_context', 'Warehouse Intelligence', 'Route load context', 'D0', ['bridge-api/services/intelligenceExecution/warehouseIntelligence.js','docs/implementation/warehouse-intelligence-foundation/generated/warehouse_route_load_catalog.json']),
  R('warehouse.load_assignment_verification', 'Warehouse Intelligence', 'Load assignment verification', 'D0', ['bridge-api/services/intelligenceExecution/warehouseIntelligence.js','docs/implementation/warehouse-intelligence-foundation/LOAD_ASSIGNMENT_VERIFICATION.md']),
  R('warehouse.load_completeness', 'Warehouse Intelligence', 'Load completeness assessment', 'D0', ['bridge-api/services/intelligenceExecution/warehouseIntelligence.js','docs/implementation/warehouse-intelligence-foundation/LOAD_COMPLETENESS_MODEL.md']),
  R('warehouse.departure_readiness', 'Warehouse Intelligence', 'Departure readiness', 'D0', ['bridge-api/services/intelligenceExecution/warehouseIntelligence.js','docs/implementation/warehouse-intelligence-foundation/generated/warehouse_departure_readiness_catalog.json'], { safety: true }),
  R('warehouse.exception_summary.presentation', 'Warehouse Intelligence', 'Warehouse exception summary presentation', 'D2', ['docs/implementation/warehouse-intelligence-foundation/DETERMINISTIC_EXPLANATIONS.md','docs/implementation/warehouse-intelligence-foundation/generated/WAREHOUSE_INTELLIGENCE_SUMMARY.md'], { roles: ['SUMMARIZATION','EXPLANATION'], modelInfluence: true, hybridBoundary: 'D0 warehouse readiness and discrepancy records remain authoritative; AI would only summarize supplied evidence.', currentType: 'deterministic summary today; future AI requires benchmark', cost: 'MEDIUM' }),

  R('fleet.vehicle_availability', 'Fleet Intelligence', 'Vehicle availability', 'D0', ['bridge-api/services/intelligenceExecution/fleetIntelligence.js','docs/implementation/fleet-intelligence-foundation/generated/fleet_availability_catalog.json']),
  R('fleet.vehicle_readiness', 'Fleet Intelligence', 'Vehicle readiness', 'D0', ['bridge-api/services/intelligenceExecution/fleetIntelligence.js','docs/implementation/fleet-intelligence-foundation/generated/fleet_readiness_catalog.json'], { safety: true, legalPhysical: true }),
  R('fleet.route_vehicle_compatibility', 'Fleet Intelligence', 'Route vehicle compatibility', 'D0', ['bridge-api/services/intelligenceExecution/fleetIntelligence.js','docs/implementation/fleet-intelligence-foundation/generated/fleet_route_compatibility_catalog.json'], { safety: true, legalPhysical: true }),
  R('fleet.maintenance_status_awareness', 'Fleet Intelligence', 'Maintenance status awareness', 'D0', ['bridge-api/services/intelligenceExecution/fleetIntelligence.js','docs/implementation/fleet-intelligence-foundation/MAINTENANCE_STATUS_AWARENESS.md'], { safety: true }),
  R('fleet.issue_anomaly_candidate', 'Fleet Intelligence', 'Vehicle issue anomaly candidate', 'D1', ['docs/implementation/fleet-intelligence-foundation/PREDICTIVE_MAINTENANCE_BOUNDARY.md','docs/implementation/fleet-intelligence-foundation/generated/fleet_issue_catalog.json'], { safety: true, roles: ['ANOMALY_DETECTION','CLASSIFICATION'], deterministic: true, currentType: 'deterministic issue awareness only; predictive maintenance prohibited without approval', benchmarkRequirement: 'REQUIRES_OWNER_REVIEW', modelInfluence: false, cost: 'MEDIUM', rationale: 'Repository has issue evidence but prohibits predictive maintenance; anomaly classification would require owner review before any benchmark.' }),

  R('customer.account_identity_context', 'Customer Intelligence', 'Customer account identity context', 'D0', ['bridge-api/services/intelligenceExecution/customerIntelligence.js','docs/implementation/customer-intelligence-foundation/generated/customer_context_contract.json'], { customer: true }),
  R('customer.delivery_product_invoice_history', 'Customer Intelligence', 'Delivery, product, and invoice history', 'D0', ['bridge-api/services/intelligenceExecution/customerIntelligence.js','docs/implementation/customer-intelligence-foundation/AUTHORITATIVE_DATA_BOUNDARIES.md'], { customer: true, historical: true }),
  R('customer.service_pattern_evidence', 'Customer Intelligence', 'Service pattern evidence', 'D0', ['docs/implementation/customer-intelligence-foundation/SERVICE_PATTERN_EVIDENCE.md','docs/implementation/customer-intelligence-foundation/generated/customer_service_pattern_catalog.json'], { customer: true, historical: true }),
  R('customer.operational_exception_detection', 'Customer Intelligence', 'Customer operational exception detection', 'D0', ['bridge-api/services/intelligenceExecution/customerIntelligence.js','docs/implementation/customer-intelligence-foundation/generated/customer_exception_catalog.json'], { customer: true }),
  R('customer.account_guidance.presentation', 'Customer Intelligence', 'Account guidance presentation', 'D2', ['bridge-api/routes/ai.js','docs/implementation/customer-intelligence-foundation/DETERMINISTIC_EXPLANATIONS.md'], { customer: true, modelInfluence: true, roles: ['SUMMARIZATION','EXPLANATION'], hybridBoundary: 'Customer facts, spend, invoices, and service patterns remain D0; AI may only present supplied context.', currentType: 'legacy /api/ai prompt surface plus deterministic summaries', provider: 'legacy.ai.structured_response when used through /api/ai', frequency: 'HIGH', cost: 'HIGH' }),

  R('operations.cross_domain_snapshot', 'Operations Intelligence', 'Cross-domain operational snapshot', 'D0', ['bridge-api/services/intelligenceExecution/operationsIntelligence.js','docs/implementation/operations-intelligence-foundation/generated/operations_snapshot_catalog.json'], { safety: true }),
  R('operations.cross_domain_correlation', 'Operations Intelligence', 'Cross-domain correlation without causation', 'D0', ['docs/implementation/operations-intelligence-foundation/CROSS_DOMAIN_CORRELATION.md','bridge-api/services/intelligenceExecution/operationsIntelligence.js'], { safety: true }),
  R('operations.exception_severity_priority', 'Operations Intelligence', 'Operations exception severity and priority', 'D0', ['docs/implementation/operations-intelligence-foundation/OPERATIONS_SEVERITY_MODEL.md','docs/implementation/operations-intelligence-foundation/OPERATIONS_PRIORITY_MODEL.md'], { safety: true }),
  R('operations.executive_dashboard_synthesis', 'Operations Intelligence', 'Executive dashboard synthesis', 'D2', ['bridge-api/routes/ai.js','docs/implementation/operations-intelligence-foundation/generated/operations_summary_report.json'], { safety: true, modelInfluence: true, roles: ['SUMMARIZATION','REASONING'], hybridBoundary: 'D0 domain records remain authoritative; AI may synthesize and present priorities only.', currentType: 'legacy /api/ai unified dashboard prompt surface', provider: 'legacy.ai.structured_response when used through /api/ai', frequency: 'MEDIUM', cost: 'HIGH' }),
  R('operations.logistics_signal_findings', 'Operations Intelligence', 'Logistics signal findings and recommendations', 'D0', ['bridge-api/services/logisticsIntelligence.js','docs/implementation/logistics-intelligence-foundation/README.md'], { safety: true, currentType: 'database-backed deterministic service', productionStatus: 'implemented foundation; production use governed separately' }),

  R('safety.route_safety_portfolio', 'Safety Intelligence', 'Route safety portfolio', 'D0', ['bridge-api/services/intelligenceExecution/safetyIntelligence.js','docs/implementation/safety-intelligence-foundation/generated/safety_route_portfolio.json'], { safety: true, legalPhysical: true }),
  R('safety.hazard_restriction_shared_safety', 'Safety Intelligence', 'Hazard, restriction, and shared safety evidence', 'D0', ['bridge-api/services/intelligenceExecution/safetyIntelligence.js','docs/implementation/safety-intelligence-foundation/generated/safety_hazard_catalog.json'], { safety: true, legalPhysical: true }),
  R('safety.driver_advisory_aggregation', 'Safety Intelligence', 'Driver safety advisory aggregation', 'D0', ['bridge-api/services/intelligenceExecution/safetyIntelligence.js','docs/implementation/safety-intelligence-foundation/generated/safety_driver_advisory_catalog.json'], { safety: true, employee: true, mobile: 'MOBILE_RELEVANT' }),
  R('safety.authority_trace_summary', 'Safety Intelligence', 'Safety authority trace summary', 'D0', ['bridge-api/services/intelligenceExecution/safetyIntelligence.js','docs/implementation/safety-intelligence-foundation/generated/safety_summary_report.json'], { safety: true, legalPhysical: true }),
  R('safety.narrative_summary.presentation', 'Safety Intelligence', 'Safety narrative summary presentation', 'D2', ['docs/implementation/safety-intelligence-foundation/generated/SAFETY_INTELLIGENCE_SUMMARY.md','bridge-api/routes/ai.js'], { safety: true, legalPhysical: true, modelInfluence: true, roles: ['SUMMARIZATION','EXPLANATION'], hybridBoundary: 'D0 safety blockers and authority traces remain authoritative; AI may only summarize supplied evidence.', currentType: 'deterministic summary today; future hosted explanation requires benchmark', cost: 'HIGH' }),

  R('prediction.route_completion_forecast', 'Operations Intelligence', 'Route completion forecast', 'D1', ['bridge-api/services/predictionEngine.js','bridge-api/scripts/check-prediction-engine.cjs'], { roles: ['PREDICTION'], deterministic: true, historical: true, currentType: 'deterministic prediction engine', benchmarkRequirement: 'REQUIRED_D1', rationale: 'Existing prediction is deterministic/statistical; future benchmarking should compare lightweight methods before generative AI.', cost: 'MEDIUM' }),
  R('prediction.delivery_failure_risk', 'Operations Intelligence', 'Delivery failure risk forecast', 'D1', ['bridge-api/services/predictionEngine.js','bridge-api/routes/ai.js'], { customer: true, roles: ['PREDICTION','CLASSIFICATION'], historical: true, currentType: 'deterministic prediction plus legacy AI explanation prompt', benchmarkRequirement: 'REQUIRED_D1', cost: 'HIGH', hybridBoundary: 'Backend failure-rate calculations remain facts; AI may explain only after lightweight predictive benchmark.' }),
  R('prediction.product_demand_forecast', 'Customer Intelligence', 'Product demand forecast', 'D1', ['bridge-api/services/predictionEngine.js','bridge-api/routes/ai.js'], { customer: true, roles: ['PREDICTION','RANKING'], historical: true, currentType: 'deterministic prediction plus legacy AI explanation prompt', benchmarkRequirement: 'REQUIRED_D1', cost: 'HIGH' }),
  R('prediction.account_reorder_forecast', 'Customer Intelligence', 'Account reorder forecast', 'D1', ['bridge-api/services/predictionEngine.js','bridge-api/routes/ai.js'], { customer: true, roles: ['PREDICTION'], historical: true, currentType: 'deterministic prediction plus legacy AI explanation prompt', benchmarkRequirement: 'REQUIRED_D1', cost: 'HIGH' }),

  R('platform.legacy_structured_ai_response', 'Operations Intelligence', 'Legacy structured AI response compatibility', 'D2', ['bridge-api/services/intelligenceExecution/legacyAiAdapter.js','bridge-api/services/intelligenceExecution/providerAdapters.js','bridge-api/routes/ai.js'], { modelInfluence: true, roles: ['SUMMARIZATION','EXPLANATION','CONVERSATION','EXTRACTION','REASONING'], currentType: 'implemented hosted compatibility adapter through IEP', provider: 'OpenAI through providerAdapters for legacy.ai.structured_response', latency: 'INTERACTIVE', frequency: 'HIGH', cost: 'HIGH' }),
  R('platform.text_cleanup', 'Operations Intelligence', 'Text cleanup utility', 'D0', ['bridge-api/services/intelligenceExecution/deterministicExecutor.js','docs/implementation/enterprise-intelligence-capability-registry/generated/capability_registry.json'], { tenantSensitive: false, currentType: 'implemented deterministic IEP utility', latency: 'INTERACTIVE', cost: 'EXTREME' }),
  R('bi_kpi.formula_calculation', 'Operations Intelligence', 'BI/KPI formula calculation', 'D0', ['bridge-api/services/biKpi.js','docs/implementation/bi-kpi-foundation/FORMULA_ENGINE.md'], { customer: true, historical: true, currentType: 'database-backed deterministic service', productionStatus: 'foundation merged; production use governed separately' }),
  R('fleet_scoring.score_calculation', 'Fleet Intelligence', 'Fleet intelligence score calculation', 'D0', ['bridge-api/services/fleetIntelligenceScoring.js','docs/implementation/fleet-intelligence-scoring-foundation/SCORE_MODEL.md'], { safety: true, historical: true, currentType: 'deterministic scoring foundation', productionStatus: 'foundation merged; production migration governed separately' }),
  R('shared_safety.moderation_workflow', 'Safety Intelligence', 'Shared safety moderation workflow', 'D0', ['bridge-api/services/sharedSafety.js','docs/implementation/shared-safety-foundation/MODERATION_WORKFLOW.md'], { safety: true, legalPhysical: true, customer: false, currentType: 'database-backed deterministic workflow' })
]);

const UNAPPROVED_IDEAS = Object.freeze([
  {
    idea: 'Formal voice pipeline for driver copilot',
    potentialBenefit: 'Hands-free driver interaction could reduce screen interaction while driving.',
    reasonItMightMatter: 'Repository evidence contains driver copilot text endpoints and mobile speech dependency/assets, but no approved backend voice pipeline.',
    scopeImplications: 'Would introduce speech recognition and text-to-speech architecture outside MS-001 classification.',
    costImplications: 'Could add provider or device-service costs and new latency constraints.',
    architectureImplications: 'Requires mobile/backend boundary, safety review, distraction policy, offline behavior, and privacy controls.',
    recommendation: 'OWNER_APPROVAL_REQUIRED before any voice capability is added to the capability registry.',
    status: 'OWNER_APPROVAL_REQUIRED'
  }
]);

function buildRegistry() {
  const capabilities = CAPABILITIES.map((capability) => stable(capability)).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
  const counts = {
    totalCapabilityCount: capabilities.length,
    d0Count: capabilities.filter((c) => c.executionClass === 'D0').length,
    d1Count: capabilities.filter((c) => c.executionClass === 'D1').length,
    d2Count: capabilities.filter((c) => c.executionClass === 'D2').length,
    d3Count: capabilities.filter((c) => c.executionClass === 'D3').length,
    hybridCapabilityCount: capabilities.filter((c) => c.hybridBoundary).length,
    safetyRelevantCapabilityCount: capabilities.filter((c) => c.safetyRelevant).length,
    predictionRelatedCapabilityCount: capabilities.filter((c) => c.futureAiRoles.includes('PREDICTION')).length,
    voiceRelatedCapabilityCount: 0,
    modelBenchmarkRequiredCount: capabilities.filter((c) => c.modelBenchmarkRequired).length,
    modelBenchmarkExcludedCount: capabilities.filter((c) => !c.modelBenchmarkRequired).length,
    ownerReviewRequiredCount: capabilities.filter((c) => c.benchmarkRequirement === 'REQUIRES_OWNER_REVIEW').length,
    unknownBenchmarkRequirementCount: capabilities.filter((c) => c.runtimeCharacteristics.latencySensitivity === 'UNKNOWN_REQUIRES_BENCHMARK_DEFINITION').length,
    currentProviderDependentCapabilityCount: capabilities.filter((c) => c.existingModelProviderDependency).length,
    dormantProviderModelPathCount: capabilities.filter((c) => c.currentImplementationType.includes('disabled') || c.currentImplementationType.includes('future')).length,
    sourceDomainCount: DOMAINS.length
  };
  return stable({
    packageId: 'MS-001',
    title: 'TSR AI Capability & Execution Classification',
    generatedFrom: 'bridge-api/scripts/generate-ms001-capability-classification-artifacts.cjs',
    generatedArtifact: true,
    scope: {
      exactlyEightSourceIntelligenceDomains: DOMAINS,
      noNinthDomain: true,
      modelSelectionPerformed: false,
      providerSelectionPerformed: false,
      pricingResearchPerformed: false,
      productionOrchestrationActivated: false,
      deploymentPerformed: false,
      migrationPerformed: false,
      productionChangePerformed: false
    },
    executionClasses: {
      D0: 'Deterministic / no AI',
      D1: 'Lightweight computational intelligence',
      D2: 'Standard AI / generative intelligence',
      D3: 'Advanced AI / high-complexity reasoning'
    },
    counts,
    capabilities,
    unapprovedIdeasForOwnerReview: UNAPPROVED_IDEAS,
    registryHash: sha(capabilities)
  });
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((value) => String(value ?? '').replace(/\|/g, '/')).join(' | ')} |`)
  ].join('\n');
}

function capabilityTable(capabilities) {
  return table(
    ['Capability ID','Domain','Name','Class','Benchmark','Safety','Hybrid'],
    capabilities.map((c) => [c.capabilityId, c.domain, c.capabilityName, c.executionClass, c.benchmarkRequirement, c.safetyRelevant, Boolean(c.hybridBoundary)])
  );
}

function mdList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function renderDocs(registry) {
  const c = registry.capabilities;
  const d0 = c.filter((x) => x.executionClass === 'D0');
  const ai = c.filter((x) => x.executionClass !== 'D0');
  const hybrid = c.filter((x) => x.hybridBoundary);
  const safety = c.filter((x) => x.safetyRelevant);
  const predictive = c.filter((x) => x.futureAiRoles.includes('PREDICTION'));
  const provider = c.filter((x) => x.existingModelProviderDependency);
  const ownerReview = c.filter((x) => x.benchmarkRequirement === 'REQUIRES_OWNER_REVIEW');
  const lines = {
    'README.md': [
      '# MS-001 - TSR AI Capability & Execution Classification',
      '',
      'MS-001 classifies existing TSR intelligence capabilities by the least complex execution class supported by repository evidence. It does not select models, select providers, benchmark commercial models, activate hosted AI, deploy, run migrations, or change production behavior.',
      '',
      '## Scope',
      '',
      mdList(registry.scope.exactlyEightSourceIntelligenceDomains),
      '',
      'No ninth intelligence domain is authorized. Model Selection and Production Orchestration remain deferred/incomplete/inactive.',
      '',
      '## Summary',
      '',
      table(['Metric','Value'], Object.entries(registry.counts).map(([k, v]) => [k, v]))
    ].join('\n'),
    'TSR_AI_CAPABILITY_REGISTRY.md': ['# TSR AI Capability Registry', '', capabilityTable(c)].join('\n'),
    'EXECUTION_CLASSIFICATION_MATRIX.md': ['# Execution Classification Matrix', '', capabilityTable(c)].join('\n'),
    'DETERMINISTIC_NO_AI_REGISTER.md': ['# Deterministic No-AI Register', '', capabilityTable(d0)].join('\n'),
    'AI_REQUIRED_CAPABILITY_REGISTER.md': ['# AI / Computational Candidate Register', '', capabilityTable(ai)].join('\n'),
    'HYBRID_EXECUTION_BOUNDARIES.md': [
      '# Hybrid Execution Boundaries',
      '',
      table(['Capability ID','Deterministic Authority / AI Boundary'], hybrid.map((x) => [x.capabilityId, x.hybridBoundary]))
    ].join('\n'),
    'SAFETY_AUTHORITY_MATRIX.md': [
      '# Safety Authority Matrix',
      '',
      table(['Capability ID','Class','AI May Influence','AI May Override','Authority'], safety.map((x) => [x.capabilityId, x.executionClass, x.modelOutputMayInfluence, x.modelOutputMayOverrideDeterministicResults, x.safetyAuthority]))
    ].join('\n'),
    'EXISTING_AI_PROVIDER_USAGE_AUDIT.md': [
      '# Existing AI Provider Usage Audit',
      '',
      table(['Capability ID','Provider Dependency','Current Type','Evidence'], provider.map((x) => [x.capabilityId, x.existingModelProviderDependency, x.currentImplementationType, x.repositoryEvidence.join('; ')])),
      '',
      'Potential unnecessary model dependency candidates are the legacy prompt surfaces whose deterministic facts already exist and whose future benchmark may show D0/D1 presentation is adequate.'
    ].join('\n'),
    'PREDICTIVE_EXECUTION_CLASSIFICATION.md': [
      '# Predictive Execution Classification',
      '',
      table(['Capability ID','Class','Roles','Benchmark'], predictive.map((x) => [x.capabilityId, x.executionClass, x.futureAiRoles.join(', '), x.benchmarkRequirement])),
      '',
      'Prediction is treated separately from generative AI. Existing predictive paths are deterministic/statistical today and should benchmark lightweight execution before any general-purpose model.'
    ].join('\n'),
    'VOICE_EXECUTION_DECOMPOSITION.md': [
      '# Voice Execution Decomposition',
      '',
      'No active approved backend voice intelligence pipeline was found in the repository. Existing evidence is limited to driver copilot text routes and mobile speech dependency/assets captured in repository documentation.',
      '',
      table(['Component','MS-001 Classification','Status'], [
        ['Speech recognition','REQUIRES_OWNER_REVIEW','No approved backend capability found'],
        ['Language understanding','D2 candidate only for existing driver copilot text response','No voice-specific implementation authorized'],
        ['Deterministic operational action','D0','Backend route/safety/delivery rules remain authoritative'],
        ['Response generation','D2 candidate for existing text copilot only','Model/provider not selected'],
        ['Text-to-speech','REQUIRES_OWNER_REVIEW','Mobile dependency evidence only; no backend intelligence capability']
      ])
    ].join('\n'),
    'FUTURE_BENCHMARK_REQUIREMENTS.md': [
      '# Future Benchmark Requirements',
      '',
      table(['Requirement','Count'], [
        ['NOT_REQUIRED_D0', d0.length],
        ['REQUIRED_D1', c.filter((x) => x.benchmarkRequirement === 'REQUIRED_D1').length],
        ['REQUIRED_D2', c.filter((x) => x.benchmarkRequirement === 'REQUIRED_D2').length],
        ['REQUIRED_D3', c.filter((x) => x.benchmarkRequirement === 'REQUIRED_D3').length],
        ['REQUIRES_OWNER_REVIEW', ownerReview.length]
      ]),
      '',
      'No arbitrary benchmark thresholds are defined in MS-001.'
    ].join('\n'),
    'COST_SENSITIVITY_CLASSIFICATION.md': [
      '# Cost Sensitivity Classification',
      '',
      table(['Capability ID','Cost Sensitivity','Rationale'], c.map((x) => [x.capabilityId, x.costCharacteristics.expectedCostSensitivity, x.costCharacteristics.rationale]))
    ].join('\n'),
    'UNAPPROVED_IDEAS_FOR_OWNER_REVIEW.md': [
      '# Unapproved Ideas For Owner Review',
      '',
      table(['Idea','Potential Benefit','Scope Implications','Cost Implications','Recommendation'], registry.unapprovedIdeasForOwnerReview.map((x) => [x.idea, x.potentialBenefit, x.scopeImplications, x.costImplications, x.recommendation]))
    ].join('\n'),
    'MS001_COMPLETION_REPORT.md': [
      '# MS-001 Completion Report',
      '',
      `Total capabilities: ${registry.counts.totalCapabilityCount}`,
      `D0: ${registry.counts.d0Count}`,
      `D1: ${registry.counts.d1Count}`,
      `D2: ${registry.counts.d2Count}`,
      `D3: ${registry.counts.d3Count}`,
      `D0 percentage: ${Math.round((registry.counts.d0Count / registry.counts.totalCapabilityCount) * 1000) / 10}%`,
      '',
      'MS-001 classified the existing TSR capability set by minimum appropriate execution class without selecting models or providers. D0 capabilities are excluded from unnecessary model benchmarking. D1/D2/D3 capabilities form the candidate set for the next Model Selection Gate package. No new TSR intelligence domain or product capability was authorized or implemented. The recommended next step is owner review of the capability classification followed, if approved, by MS-002 Benchmark & Acceptance Framework.'
    ].join('\n')
  };
  return lines;
}

function writeIfChanged(file, content, options = {}) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
  }
  return changed;
}

function generate(options = {}) {
  fs.mkdirSync(docsRoot, { recursive: true });
  fs.mkdirSync(generatedRoot, { recursive: true });
  const registry = buildRegistry();
  const docs = renderDocs(registry);
  const outputs = {
    ...Object.fromEntries(Object.entries(docs).map(([name, content]) => [path.join(docsRoot, name), `${content}\n`])),
    [path.join(docsRoot, 'TSR_AI_CAPABILITY_REGISTRY.json')]: json(registry),
    [path.join(generatedRoot, 'ms001_summary.json')]: json(registry.counts),
    [path.join(generatedRoot, 'ms001_capability_index.json')]: json(registry.capabilities.map((capability) => ({
      capabilityId: capability.capabilityId,
      domain: capability.domain,
      executionClass: capability.executionClass,
      modelBenchmarkRequired: capability.modelBenchmarkRequired,
      safetyRelevant: capability.safetyRelevant,
      futureAiRoles: capability.futureAiRoles
    }))),
    [path.join(generatedRoot, 'ms001_domain_counts.json')]: json(DOMAINS.map((domain) => ({
      domain,
      capabilityCount: registry.capabilities.filter((capability) => capability.domain === domain).length
    }))),
    [path.join(generatedRoot, 'ms001_benchmark_candidates.json')]: json(registry.capabilities.filter((capability) => capability.modelBenchmarkRequired).map((capability) => capability.capabilityId)),
    [path.join(generatedRoot, 'ms001_no_model_exclusions.json')]: json(registry.capabilities.filter((capability) => !capability.modelBenchmarkRequired).map((capability) => capability.capabilityId)),
    [path.join(generatedRoot, 'ms001_provider_usage_audit.json')]: json(registry.capabilities.filter((capability) => capability.existingModelProviderDependency).map((capability) => ({
      capabilityId: capability.capabilityId,
      provider: capability.existingModelProviderDependency,
      currentImplementationType: capability.currentImplementationType
    }))),
    [path.join(generatedRoot, 'ms001_registry_hash.json')]: json({ registryHash: registry.registryHash, capabilityCount: registry.counts.totalCapabilityCount })
  };
  const changed = Object.entries(outputs).filter(([file, content]) => writeIfChanged(file, content, options)).map(([file]) => path.relative(repoRoot, file).replace(/\\/g, '/'));
  if (options.check && changed.length) {
    console.error(`[ms001] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[ms001] generated ${Object.keys(outputs).length} artifacts in ${path.relative(repoRoot, docsRoot).replace(/\\/g, '/')}`);
  }
  return { changed, registry };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { buildRegistry, generate, stable, paths: { backendRoot, repoRoot, docsRoot, generatedRoot }, DOMAINS, EXECUTION_CLASSES, FUTURE_AI_ROLES, BENCHMARK_REQUIREMENTS };
