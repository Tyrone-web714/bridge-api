const { EXECUTION_PROFILES, EXECUTION_STRATEGIES, POLICY_VERSION } = require('./constants');

const LIFECYCLE_STATES = Object.freeze({
  DRAFT: 'DRAFT',
  EXPERIMENTAL: 'EXPERIMENTAL',
  BENCHMARKING: 'BENCHMARKING',
  PILOT: 'PILOT',
  PRODUCTION: 'PRODUCTION',
  DEPRECATED: 'DEPRECATED',
  RETIRED: 'RETIRED'
});

const IMPLEMENTATION_STATUSES = Object.freeze({
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  PLACEHOLDER: 'PLACEHOLDER',
  PARTIAL: 'PARTIAL',
  IMPLEMENTED: 'IMPLEMENTED',
  LEGACY: 'LEGACY',
  DEPRECATED: 'DEPRECATED',
  RETIRED: 'RETIRED'
});

const OPERATIONAL_STATUSES = Object.freeze({
  UNAVAILABLE: 'UNAVAILABLE',
  DISABLED: 'DISABLED',
  TEST_ONLY: 'TEST_ONLY',
  AVAILABLE: 'AVAILABLE',
  DEGRADED: 'DEGRADED',
  SUSPENDED: 'SUSPENDED',
  UNKNOWN: 'UNKNOWN'
});

const IMPACT_LEVELS = Object.freeze({
  NONE: 'NONE',
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
  UNKNOWN: 'UNKNOWN'
});

const RISK_TIERS = Object.freeze({
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
  UNKNOWN: 'UNKNOWN'
});

const FUNCTIONAL_CATEGORIES = Object.freeze({
  DATA_RETRIEVAL: 'DATA_RETRIEVAL',
  CALCULATION: 'CALCULATION',
  CLASSIFICATION: 'CLASSIFICATION',
  PREDICTION: 'PREDICTION',
  OPTIMIZATION: 'OPTIMIZATION',
  RANKING: 'RANKING',
  DETECTION: 'DETECTION',
  SUMMARIZATION: 'SUMMARIZATION',
  EXPLANATION: 'EXPLANATION',
  RECOMMENDATION: 'RECOMMENDATION',
  CONTENT_GENERATION: 'CONTENT_GENERATION',
  WORKFLOW_ASSISTANCE: 'WORKFLOW_ASSISTANCE',
  SAFETY_DECISION_SUPPORT: 'SAFETY_DECISION_SUPPORT',
  HUMAN_REVIEW_SUPPORT: 'HUMAN_REVIEW_SUPPORT'
});

const DECISION_NATURES = Object.freeze({
  CANONICAL: 'CANONICAL',
  DESCRIPTIVE: 'DESCRIPTIVE',
  ADVISORY: 'ADVISORY',
  PREDICTIVE: 'PREDICTIVE',
  PRESCRIPTIVE: 'PRESCRIPTIVE',
  AUTONOMOUS: 'AUTONOMOUS'
});

const LATENCY_CLASSES = Object.freeze({
  REAL_TIME: 'REAL_TIME',
  INTERACTIVE: 'INTERACTIVE',
  NEAR_REAL_TIME: 'NEAR_REAL_TIME',
  BATCH: 'BATCH',
  OFFLINE: 'OFFLINE',
  UNKNOWN: 'UNKNOWN'
});

const BENCHMARK_STATUSES = Object.freeze({
  NOT_REQUIRED: 'NOT_REQUIRED',
  NOT_READY: 'NOT_READY',
  DATASET_REQUIRED: 'DATASET_REQUIRED',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  STALE: 'STALE',
  UNKNOWN: 'UNKNOWN'
});

const PROVIDER_INDEPENDENCE_CLASSIFICATIONS = Object.freeze({
  PROVIDER_INDEPENDENT: 'PROVIDER_INDEPENDENT',
  LOW_DEPENDENCY: 'LOW_DEPENDENCY',
  MODERATE_DEPENDENCY: 'MODERATE_DEPENDENCY',
  HIGH_DEPENDENCY: 'HIGH_DEPENDENCY',
  PROVIDER_LOCKED: 'PROVIDER_LOCKED',
  UNKNOWN: 'UNKNOWN'
});

const COST_CLASSES = Object.freeze({
  VERIFIED_ZERO: 'VERIFIED_ZERO',
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  UNKNOWN: 'UNKNOWN'
});

const APPROVAL_STATUSES = Object.freeze({
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  UNKNOWN: 'UNKNOWN'
});

const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)*$/;
const VERSION_PATTERN = /^[a-z][a-z0-9_.-]*\.v\d+$/;
const PROVIDER_OR_MODEL_WORDS = /\b(openai|gpt|anthropic|claude|gemini|llama|mistral|cohere)\b/i;

const LIFECYCLE_RULES = Object.freeze({
  [LIFECYCLE_STATES.DRAFT]: Object.freeze({
    runtimeExecutionAllowed: false,
    benchmarkExecutionAllowed: false,
    productionDataAllowed: false,
    organizationEnablementAllowed: false,
    premiumExecutionAllowed: false,
    humanReviewRequired: false,
    replacementCapabilityRequired: false,
    newCallerAdoptionAllowed: false
  }),
  [LIFECYCLE_STATES.EXPERIMENTAL]: Object.freeze({
    runtimeExecutionAllowed: false,
    benchmarkExecutionAllowed: true,
    productionDataAllowed: false,
    organizationEnablementAllowed: false,
    premiumExecutionAllowed: false,
    humanReviewRequired: true,
    replacementCapabilityRequired: false,
    newCallerAdoptionAllowed: false
  }),
  [LIFECYCLE_STATES.BENCHMARKING]: Object.freeze({
    runtimeExecutionAllowed: false,
    benchmarkExecutionAllowed: true,
    productionDataAllowed: false,
    organizationEnablementAllowed: false,
    premiumExecutionAllowed: false,
    humanReviewRequired: true,
    replacementCapabilityRequired: false,
    newCallerAdoptionAllowed: false
  }),
  [LIFECYCLE_STATES.PILOT]: Object.freeze({
    runtimeExecutionAllowed: true,
    benchmarkExecutionAllowed: true,
    productionDataAllowed: false,
    organizationEnablementAllowed: true,
    premiumExecutionAllowed: false,
    humanReviewRequired: true,
    replacementCapabilityRequired: false,
    newCallerAdoptionAllowed: false
  }),
  [LIFECYCLE_STATES.PRODUCTION]: Object.freeze({
    runtimeExecutionAllowed: true,
    benchmarkExecutionAllowed: true,
    productionDataAllowed: true,
    organizationEnablementAllowed: true,
    premiumExecutionAllowed: false,
    humanReviewRequired: false,
    replacementCapabilityRequired: false,
    newCallerAdoptionAllowed: true
  }),
  [LIFECYCLE_STATES.DEPRECATED]: Object.freeze({
    runtimeExecutionAllowed: true,
    benchmarkExecutionAllowed: false,
    productionDataAllowed: true,
    organizationEnablementAllowed: false,
    premiumExecutionAllowed: false,
    humanReviewRequired: true,
    replacementCapabilityRequired: true,
    newCallerAdoptionAllowed: false
  }),
  [LIFECYCLE_STATES.RETIRED]: Object.freeze({
    runtimeExecutionAllowed: false,
    benchmarkExecutionAllowed: false,
    productionDataAllowed: false,
    organizationEnablementAllowed: false,
    premiumExecutionAllowed: false,
    humanReviewRequired: false,
    replacementCapabilityRequired: false,
    newCallerAdoptionAllowed: false
  })
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [LIFECYCLE_STATES.DRAFT]: Object.freeze([LIFECYCLE_STATES.EXPERIMENTAL, LIFECYCLE_STATES.RETIRED]),
  [LIFECYCLE_STATES.EXPERIMENTAL]: Object.freeze([LIFECYCLE_STATES.BENCHMARKING, LIFECYCLE_STATES.RETIRED]),
  [LIFECYCLE_STATES.BENCHMARKING]: Object.freeze([LIFECYCLE_STATES.EXPERIMENTAL, LIFECYCLE_STATES.PILOT, LIFECYCLE_STATES.RETIRED]),
  [LIFECYCLE_STATES.PILOT]: Object.freeze([LIFECYCLE_STATES.BENCHMARKING, LIFECYCLE_STATES.PRODUCTION, LIFECYCLE_STATES.DEPRECATED, LIFECYCLE_STATES.RETIRED]),
  [LIFECYCLE_STATES.PRODUCTION]: Object.freeze([LIFECYCLE_STATES.PILOT, LIFECYCLE_STATES.DEPRECATED]),
  [LIFECYCLE_STATES.DEPRECATED]: Object.freeze([LIFECYCLE_STATES.RETIRED]),
  [LIFECYCLE_STATES.RETIRED]: Object.freeze([])
});

const TRANSITION_REQUIREMENTS = Object.freeze({
  [LIFECYCLE_STATES.PILOT]: Object.freeze({
    ownerApprovalRequired: true,
    benchmarkEvidenceRequired: true,
    rollbackPlanRequired: true,
    securityReviewRequired: true,
    costGovernanceRequired: true,
    policyApprovalRequired: true,
    dataReadinessRequired: true,
    executorAvailabilityRequired: true
  }),
  [LIFECYCLE_STATES.PRODUCTION]: Object.freeze({
    ownerApprovalRequired: true,
    benchmarkEvidenceRequired: true,
    rollbackPlanRequired: true,
    securityReviewRequired: true,
    costGovernanceRequired: true,
    policyApprovalRequired: true,
    dataReadinessRequired: true,
    executorAvailabilityRequired: true
  })
});

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

function commonGovernance(overrides = {}) {
  return {
    decisionRecordRequired: true,
    currentDecisionId: null,
    approvalStatus: APPROVAL_STATUSES.PENDING,
    decisionVersion: null,
    approvedBy: null,
    approvedAt: null,
    evidenceReferences: [],
    supersededDecisionId: null,
    auditRequired: true,
    auditEventProfile: 'INTELLIGENCE_EXECUTION_METADATA',
    traceRequired: true,
    reviewCadence: 'OWNER_DEFINED',
    notes: [],
    ...overrides
  };
}

function baseCapability(overrides) {
  const capabilityId = overrides.capabilityId;
  return {
    capabilityId,
    displayName: overrides.displayName,
    description: overrides.description,
    domain: overrides.domain,
    subdomain: overrides.subdomain || null,
    capabilityType: overrides.capabilityType,
    capabilityVersion: overrides.capabilityVersion,
    aliases: overrides.aliases || [],
    tags: overrides.tags || [],
    businessOwner: overrides.businessOwner || 'OWNER_DEFINED',
    technicalOwner: overrides.technicalOwner || 'backend',
    governanceOwner: overrides.governanceOwner || 'platform-governance',
    owningService: overrides.owningService || 'bridge-api',
    owningTeam: overrides.owningTeam || 'platform',
    supportContact: overrides.supportContact || 'OWNER_DEFINED',
    lifecycleState: overrides.lifecycleState,
    enabled: overrides.enabled,
    implementationStatus: overrides.implementationStatus,
    operationalStatus: overrides.operationalStatus,
    deprecationDate: overrides.deprecationDate || null,
    retirementDate: overrides.retirementDate || null,
    replacementCapabilityId: overrides.replacementCapabilityId || null,
    functionalCategory: overrides.functionalCategory,
    decisionNature: overrides.decisionNature,
    canonicalOrAdvisory: overrides.canonicalOrAdvisory,
    realTimeOrBatch: overrides.realTimeOrBatch,
    userFacingOrInternal: overrides.userFacingOrInternal,
    deterministicOrProbabilistic: overrides.deterministicOrProbabilistic,
    safetyImpact: overrides.safetyImpact,
    employmentImpact: overrides.employmentImpact,
    financialImpact: overrides.financialImpact,
    customerImpact: overrides.customerImpact,
    regulatoryImpact: overrides.regulatoryImpact,
    privacyImpact: overrides.privacyImpact,
    securityImpact: overrides.securityImpact,
    riskTier: overrides.riskTier,
    authoritativeSources: overrides.authoritativeSources || [],
    canonicalFacts: overrides.canonicalFacts || [],
    advisoryOutputs: overrides.advisoryOutputs || [],
    prohibitedClaims: overrides.prohibitedClaims || [],
    dataClassification: overrides.dataClassification,
    organizationScoped: overrides.organizationScoped !== false,
    crossOrganizationUseAllowed: overrides.crossOrganizationUseAllowed === true,
    crossOrganizationUseEvidence: overrides.crossOrganizationUseEvidence || null,
    retentionClassification: overrides.retentionClassification || 'METADATA_ONLY',
    sourceOfTruthService: overrides.sourceOfTruthService || null,
    deterministicVerificationRequired: overrides.deterministicVerificationRequired === true,
    allowedExecutionStrategies: overrides.allowedExecutionStrategies,
    prohibitedExecutionStrategies: overrides.prohibitedExecutionStrategies || [],
    defaultExecutionStrategy: overrides.defaultExecutionStrategy,
    fallbackStrategies: overrides.fallbackStrategies || [],
    maximumExecutionTier: overrides.maximumExecutionTier,
    hostedInferenceAllowed: overrides.hostedInferenceAllowed === true,
    premiumAllowed: overrides.premiumAllowed === true,
    humanReviewAllowed: overrides.humanReviewAllowed !== false,
    humanReviewRequired: overrides.humanReviewRequired === true,
    cacheEligible: overrides.cacheEligible === true,
    batchEligible: overrides.batchEligible === true,
    offlineEligible: overrides.offlineEligible === true,
    defaultExecutionProfile: overrides.defaultExecutionProfile,
    latencyClass: overrides.latencyClass,
    targetLatencyMs: overrides.targetLatencyMs,
    maximumLatencyMs: overrides.maximumLatencyMs,
    expectedFrequency: overrides.expectedFrequency || 'UNKNOWN',
    expectedInputSize: overrides.expectedInputSize || 'UNKNOWN',
    expectedOutputSize: overrides.expectedOutputSize || 'UNKNOWN',
    availabilityClass: overrides.availabilityClass || 'UNKNOWN',
    inputSchemaId: overrides.inputSchemaId,
    outputSchemaId: overrides.outputSchemaId,
    validationProfile: overrides.validationProfile || 'SCHEMA_VALIDATED',
    citationRequired: overrides.citationRequired === true,
    confidenceRequired: overrides.confidenceRequired === true,
    insufficientEvidenceAllowed: overrides.insufficientEvidenceAllowed === true,
    allowedRoles: overrides.allowedRoles || [],
    deniedRoles: overrides.deniedRoles || [],
    requiredPermissions: overrides.requiredPermissions || ['intelligence.view'],
    organizationPolicyRequired: overrides.organizationPolicyRequired !== false,
    ownerApprovalRequired: overrides.ownerApprovalRequired !== false,
    employmentAdvisoryOnly: overrides.employmentAdvisoryOnly === true,
    safetyRulesAuthoritative: overrides.safetyRulesAuthoritative === true,
    autonomousActionAllowed: overrides.autonomousActionAllowed === true,
    autonomousActionApproval: overrides.autonomousActionApproval || null,
    benchmarkRequired: overrides.benchmarkRequired === true,
    benchmarkStatus: overrides.benchmarkStatus,
    benchmarkDatasetAvailable: overrides.benchmarkDatasetAvailable === true,
    syntheticBenchmarkAllowed: overrides.syntheticBenchmarkAllowed === true,
    realDataApprovalRequired: overrides.realDataApprovalRequired === true,
    minimumBenchmarkCoverage: overrides.minimumBenchmarkCoverage || null,
    latestBenchmarkVersion: overrides.latestBenchmarkVersion || null,
    latestBenchmarkDate: overrides.latestBenchmarkDate || null,
    costClass: overrides.costClass,
    costCeilingStatus: overrides.costCeilingStatus || 'PROVISIONAL',
    provisionalCostCeilingMicroUsd: overrides.provisionalCostCeilingMicroUsd,
    costTrackingRequired: overrides.costTrackingRequired === true,
    unknownCostAllowed: overrides.unknownCostAllowed === true,
    humanReviewCostRelevant: overrides.humanReviewCostRelevant === true,
    infrastructureCostRelevant: overrides.infrastructureCostRelevant === true,
    maintenanceCostRelevant: overrides.maintenanceCostRelevant !== false,
    retryCostRelevant: overrides.retryCostRelevant === true,
    validationFailureCostRelevant: overrides.validationFailureCostRelevant === true,
    storageCostRelevant: overrides.storageCostRelevant === true,
    monitoringCostRelevant: overrides.monitoringCostRelevant !== false,
    supportCostRelevant: overrides.supportCostRelevant !== false,
    failureImpactCostRelevant: overrides.failureImpactCostRelevant === true,
    providerSpecific: overrides.providerSpecific === true,
    portabilityClassification: overrides.portabilityClassification,
    providerIndependenceStatus: overrides.providerIndependenceStatus || 'PROVISIONAL',
    replacementComplexity: overrides.replacementComplexity || 'UNKNOWN',
    lockInAssessmentStatus: overrides.lockInAssessmentStatus || 'NOT_ASSESSED',
    upstreamCapabilityIds: overrides.upstreamCapabilityIds || [],
    downstreamCapabilityIds: overrides.downstreamCapabilityIds || [],
    requiredServices: overrides.requiredServices || [],
    requiredDataSources: overrides.requiredDataSources || [],
    requiredPolicies: overrides.requiredPolicies || [],
    requiredExecutors: overrides.requiredExecutors || [],
    optionalDependencies: overrides.optionalDependencies || [],
    promptId: overrides.promptId || null,
    promptVersion: overrides.promptVersion || null,
    benchmarkVersion: overrides.benchmarkVersion || null,
    policyVersion: overrides.policyVersion || POLICY_VERSION,
    executorVersion: overrides.executorVersion || null,
    sourceFiles: overrides.sourceFiles || [],
    sourceDocuments: overrides.sourceDocuments || [],
    sourceDecisionIds: overrides.sourceDecisionIds || [],
    evidenceStatus: overrides.evidenceStatus || 'REPOSITORY_EVIDENCE',
    auditRequired: overrides.auditRequired !== false,
    auditEventProfile: overrides.auditEventProfile || 'INTELLIGENCE_EXECUTION_METADATA',
    traceRequired: overrides.traceRequired !== false,
    decisionRecordRequired: overrides.decisionRecordRequired !== false,
    currentDecisionId: overrides.currentDecisionId || null,
    approvalStatus: overrides.approvalStatus || APPROVAL_STATUSES.PENDING,
    decisionVersion: overrides.decisionVersion || null,
    approvedBy: overrides.approvedBy || null,
    approvedAt: overrides.approvedAt || null,
    lastReviewedAt: overrides.lastReviewedAt || null,
    reviewCadence: overrides.reviewCadence || 'OWNER_DEFINED',
    evidenceReferences: overrides.evidenceReferences || [],
    supersededDecisionId: overrides.supersededDecisionId || null,
    notes: overrides.notes || [],
    legacyRuntime: overrides.legacyRuntime || {}
  };
}

const ENTERPRISE_CAPABILITIES = freezeDeep([
  baseCapability({
    capabilityId: 'text.cleanup',
    displayName: 'Text Cleanup',
    description: 'Deterministically trims text, normalizes line breaks, collapses repeated spaces, and rejects empty input.',
    domain: 'platform',
    subdomain: 'text',
    capabilityType: 'DETERMINISTIC_UTILITY',
    capabilityVersion: 'text.cleanup.v1',
    lifecycleState: LIFECYCLE_STATES.PILOT,
    enabled: true,
    implementationStatus: IMPLEMENTATION_STATUSES.IMPLEMENTED,
    operationalStatus: OPERATIONAL_STATUSES.AVAILABLE,
    functionalCategory: FUNCTIONAL_CATEGORIES.CALCULATION,
    decisionNature: DECISION_NATURES.CANONICAL,
    canonicalOrAdvisory: 'CANONICAL',
    realTimeOrBatch: 'INTERACTIVE',
    userFacingOrInternal: 'INTERNAL',
    deterministicOrProbabilistic: 'DETERMINISTIC',
    safetyImpact: IMPACT_LEVELS.NONE,
    employmentImpact: IMPACT_LEVELS.NONE,
    financialImpact: IMPACT_LEVELS.NONE,
    customerImpact: IMPACT_LEVELS.LOW,
    regulatoryImpact: IMPACT_LEVELS.NONE,
    privacyImpact: IMPACT_LEVELS.LOW,
    securityImpact: IMPACT_LEVELS.LOW,
    riskTier: RISK_TIERS.LOW,
    authoritativeSources: ['request.input.text'],
    canonicalFacts: ['normalizedText', 'changed', 'originalLength', 'normalizedLength'],
    prohibitedClaims: ['semantic interpretation', 'business recommendation'],
    dataClassification: 'INTERNAL',
    sourceOfTruthService: 'services/intelligenceExecution/deterministicExecutor.js',
    deterministicVerificationRequired: true,
    allowedExecutionStrategies: [EXECUTION_STRATEGIES.DETERMINISTIC_RULES],
    prohibitedExecutionStrategies: [
      EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL,
      EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL,
      EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL,
      EXECUTION_STRATEGIES.MULTI_MODEL_WORKFLOW
    ],
    defaultExecutionStrategy: EXECUTION_STRATEGIES.DETERMINISTIC_RULES,
    maximumExecutionTier: EXECUTION_STRATEGIES.DETERMINISTIC_RULES,
    defaultExecutionProfile: EXECUTION_PROFILES.DETERMINISTIC_ONLY,
    batchEligible: true,
    latencyClass: LATENCY_CLASSES.INTERACTIVE,
    targetLatencyMs: 500,
    maximumLatencyMs: 500,
    inputSchemaId: 'schemas/intelligence/text-cleanup-input.v1',
    outputSchemaId: 'schemas/intelligence/text-cleanup-output.v1',
    benchmarkRequired: false,
    benchmarkStatus: BENCHMARK_STATUSES.NOT_REQUIRED,
    costClass: COST_CLASSES.VERIFIED_ZERO,
    costCeilingStatus: 'VERIFIED',
    provisionalCostCeilingMicroUsd: 0,
    portabilityClassification: PROVIDER_INDEPENDENCE_CLASSIFICATIONS.PROVIDER_INDEPENDENT,
    requiredServices: ['services/intelligenceExecution/deterministicExecutor.js'],
    requiredExecutors: [EXECUTION_STRATEGIES.DETERMINISTIC_RULES],
    sourceFiles: [
      'bridge-api/services/intelligenceExecution/capabilityRegistry.js',
      'bridge-api/services/intelligenceExecution/deterministicExecutor.js',
      'bridge-api/scripts/check-intelligence-execution-platform.cjs'
    ],
    sourceDocuments: ['docs/implementation/intelligence-execution-platform-foundation/README.md'],
    legacyRuntime: {
      ownerDomain: 'platform',
      defaultConfidenceThreshold: null,
      defaultAccuracyThreshold: 1,
      defaultCostCeilingUsd: '0.000000',
      humanReviewRule: 'NOT_REQUIRED',
      organizationPolicyCompatibility: 'TENANT_SCOPED',
      approvedFallbackSequence: []
    },
    ...commonGovernance({ approvalStatus: APPROVAL_STATUSES.NOT_REQUIRED, decisionRecordRequired: false })
  }),
  baseCapability({
    capabilityId: 'legacy.ai.structured_response',
    displayName: 'Legacy AI Structured Response',
    description: 'Compatibility capability for existing /api/ai structured logistics intelligence responses.',
    domain: 'logistics_intelligence',
    subdomain: 'legacy_ai',
    capabilityType: 'HOSTED_COMPATIBILITY_ADAPTER',
    capabilityVersion: 'legacy.ai.structured_response.v1',
    lifecycleState: LIFECYCLE_STATES.PILOT,
    enabled: true,
    implementationStatus: IMPLEMENTATION_STATUSES.LEGACY,
    operationalStatus: OPERATIONAL_STATUSES.AVAILABLE,
    functionalCategory: FUNCTIONAL_CATEGORIES.CONTENT_GENERATION,
    decisionNature: DECISION_NATURES.ADVISORY,
    canonicalOrAdvisory: 'ADVISORY',
    realTimeOrBatch: 'INTERACTIVE',
    userFacingOrInternal: 'USER_FACING',
    deterministicOrProbabilistic: 'PROBABILISTIC',
    safetyImpact: IMPACT_LEVELS.MODERATE,
    employmentImpact: IMPACT_LEVELS.LOW,
    financialImpact: IMPACT_LEVELS.MODERATE,
    customerImpact: IMPACT_LEVELS.MODERATE,
    regulatoryImpact: IMPACT_LEVELS.LOW,
    privacyImpact: IMPACT_LEVELS.MODERATE,
    securityImpact: IMPACT_LEVELS.MODERATE,
    riskTier: RISK_TIERS.MODERATE,
    authoritativeSources: ['trusted auth context', 'route request payload', 'existing TSR operational records supplied by callers'],
    advisoryOutputs: ['structured logistics narrative or recommendation payloads returned by existing /api/ai routes'],
    prohibitedClaims: ['canonical database facts', 'safety-rule override', 'provider-specific entitlement', 'premium model approval'],
    dataClassification: 'ORGANIZATION_PRIVATE',
    sourceOfTruthService: 'services/intelligenceExecution/legacyAiAdapter.js',
    allowedExecutionStrategies: [EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL],
    prohibitedExecutionStrategies: [EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL, EXECUTION_STRATEGIES.MULTI_MODEL_WORKFLOW],
    defaultExecutionStrategy: EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL,
    maximumExecutionTier: EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL,
    hostedInferenceAllowed: true,
    unknownCostAllowed: true,
    costTrackingRequired: true,
    retryCostRelevant: true,
    validationFailureCostRelevant: true,
    failureImpactCostRelevant: true,
    defaultExecutionProfile: EXECUTION_PROFILES.BALANCED,
    latencyClass: LATENCY_CLASSES.INTERACTIVE,
    targetLatencyMs: 30000,
    maximumLatencyMs: 30000,
    inputSchemaId: 'schemas/intelligence/legacy-ai-structured-response-input.v1',
    outputSchemaId: 'schemas/intelligence/legacy-ai-structured-response-output.v1',
    benchmarkRequired: true,
    benchmarkStatus: BENCHMARK_STATUSES.DATASET_REQUIRED,
    syntheticBenchmarkAllowed: true,
    realDataApprovalRequired: true,
    costClass: COST_CLASSES.UNKNOWN,
    costCeilingStatus: 'UNKNOWN',
    provisionalCostCeilingMicroUsd: null,
    portabilityClassification: PROVIDER_INDEPENDENCE_CLASSIFICATIONS.MODERATE_DEPENDENCY,
    requiredServices: ['services/intelligenceExecution/legacyAiAdapter.js', 'services/intelligenceExecution/providerAdapters.js'],
    requiredPolicies: ['capability-specific hosted inference policy'],
    requiredExecutors: [EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL],
    sourceFiles: [
      'bridge-api/routes/ai.js',
      'bridge-api/services/intelligenceExecution/legacyAiAdapter.js',
      'bridge-api/services/intelligenceExecution/providerAdapters.js',
      'bridge-api/scripts/check-ai-contracts.cjs'
    ],
    sourceDocuments: ['docs/implementation/intelligence-execution-platform-legacy-ai-migration/README.md'],
    legacyRuntime: {
      ownerDomain: 'logistics_intelligence',
      defaultConfidenceThreshold: null,
      defaultAccuracyThreshold: null,
      defaultCostCeilingUsd: null,
      humanReviewRule: 'NOT_REQUIRED_FOR_COMPATIBILITY_RESPONSE',
      organizationPolicyCompatibility: 'TENANT_SCOPED',
      approvedFallbackSequence: []
    },
    ...commonGovernance()
  }),
  baseCapability({
    capabilityId: 'supervisor.daily_operations_report',
    displayName: 'Supervisor Daily Operations Report Narrative',
    description: 'Advisory narrative summary for the existing scheduled supervisor daily brief using verified deterministic source context.',
    domain: 'supervisor_operations',
    subdomain: 'daily_operations',
    capabilityType: 'HOSTED_ADVISORY_NARRATIVE',
    capabilityVersion: 'supervisor.daily_operations_report.v1',
    lifecycleState: LIFECYCLE_STATES.PILOT,
    enabled: true,
    implementationStatus: IMPLEMENTATION_STATUSES.IMPLEMENTED,
    operationalStatus: OPERATIONAL_STATUSES.AVAILABLE,
    functionalCategory: FUNCTIONAL_CATEGORIES.HUMAN_REVIEW_SUPPORT,
    decisionNature: DECISION_NATURES.ADVISORY,
    canonicalOrAdvisory: 'ADVISORY',
    realTimeOrBatch: 'BATCH',
    userFacingOrInternal: 'INTERNAL',
    deterministicOrProbabilistic: 'PROBABILISTIC',
    safetyImpact: IMPACT_LEVELS.HIGH,
    employmentImpact: IMPACT_LEVELS.MODERATE,
    financialImpact: IMPACT_LEVELS.MODERATE,
    customerImpact: IMPACT_LEVELS.MODERATE,
    regulatoryImpact: IMPACT_LEVELS.MODERATE,
    privacyImpact: IMPACT_LEVELS.MODERATE,
    securityImpact: IMPACT_LEVELS.MODERATE,
    riskTier: RISK_TIERS.HIGH,
    authoritativeSources: ['database route metrics', 'delivery note metrics', 'alert metrics', 'trusted supervisor auth context'],
    canonicalFacts: ['source metrics remain authoritative in database and repository services'],
    advisoryOutputs: ['narrative summary', 'priorities', 'risk explanations', 'recommended supervisor review actions'],
    prohibitedClaims: ['autonomous employment action', 'disciplinary recommendation', 'safety-rule override', 'compensation decision'],
    dataClassification: 'ORGANIZATION_PRIVATE',
    sourceOfTruthService: 'services/supervisorIntelligence.js',
    deterministicVerificationRequired: true,
    allowedExecutionStrategies: [EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL],
    prohibitedExecutionStrategies: [EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL, EXECUTION_STRATEGIES.MULTI_MODEL_WORKFLOW],
    defaultExecutionStrategy: EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL,
    maximumExecutionTier: EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL,
    hostedInferenceAllowed: true,
    humanReviewRequired: true,
    employmentAdvisoryOnly: true,
    unknownCostAllowed: true,
    costTrackingRequired: true,
    humanReviewCostRelevant: true,
    retryCostRelevant: true,
    validationFailureCostRelevant: true,
    failureImpactCostRelevant: true,
    defaultExecutionProfile: EXECUTION_PROFILES.BALANCED,
    latencyClass: LATENCY_CLASSES.BATCH,
    targetLatencyMs: 30000,
    maximumLatencyMs: 30000,
    inputSchemaId: 'schemas/intelligence/supervisor-daily-operations-report-input.v1',
    outputSchemaId: 'schemas/intelligence/supervisor-daily-operations-report-output.v1',
    benchmarkRequired: true,
    benchmarkStatus: BENCHMARK_STATUSES.DATASET_REQUIRED,
    syntheticBenchmarkAllowed: true,
    realDataApprovalRequired: true,
    costClass: COST_CLASSES.UNKNOWN,
    costCeilingStatus: 'UNKNOWN',
    provisionalCostCeilingMicroUsd: null,
    portabilityClassification: PROVIDER_INDEPENDENCE_CLASSIFICATIONS.MODERATE_DEPENDENCY,
    allowedRoles: ['SUPERVISOR', 'ORGANIZATION_ADMIN', 'PLATFORM_ADMIN'],
    requiredServices: ['services/supervisorIntelligence.js', 'services/intelligenceExecution/supervisorAiAdapter.js'],
    requiredDataSources: ['supervisor operational repositories'],
    requiredPolicies: ['supervisor role gate', 'capability-specific hosted inference policy'],
    requiredExecutors: [EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL],
    promptId: 'supervisor.daily_operations_report.prompt',
    promptVersion: 'supervisor-daily-operations-report.v1',
    sourceFiles: [
      'bridge-api/services/supervisorIntelligence.js',
      'bridge-api/services/intelligenceExecution/supervisorAiAdapter.js',
      'bridge-api/services/intelligenceExecution/promptRegistry.js',
      'bridge-api/scripts/check-supervisor-intelligence-contracts.cjs',
      'bridge-api/scripts/check-ai-provider-boundaries.cjs'
    ],
    sourceDocuments: ['docs/implementation/intelligence-execution-platform-supervisor-migration/README.md'],
    legacyRuntime: {
      ownerDomain: 'supervisor_operations',
      defaultConfidenceThreshold: null,
      defaultAccuracyThreshold: null,
      defaultCostCeilingUsd: null,
      employmentImpactClassification: 'ADVISORY_ONLY_EMPLOYEE_RELATED',
      financialImpactClassification: 'ADVISORY_ONLY_OPERATIONAL',
      hostedModelPermission: 'CAPABILITY_SPECIFIC_ONLY',
      modelClass: 'HOSTED_BALANCED',
      premiumEscalationPermission: 'PROHIBITED',
      humanReviewRule: 'ADVISORY_OUTPUT_REQUIRES_SUPERVISOR_INTERPRETATION',
      organizationPolicyCompatibility: 'TENANT_SCOPED',
      approvedFallbackSequence: []
    },
    ...commonGovernance()
  }),
  baseCapability({
    capabilityId: 'delivery_note.summarize',
    displayName: 'Delivery Note Summary',
    description: 'Future delivery-note summary capability. Hosted inference path is intentionally deferred.',
    domain: 'delivery_operations',
    subdomain: 'delivery_notes',
    capabilityType: 'PLACEHOLDER',
    capabilityVersion: 'delivery_note.summarize.v1',
    lifecycleState: LIFECYCLE_STATES.DRAFT,
    enabled: false,
    implementationStatus: IMPLEMENTATION_STATUSES.PLACEHOLDER,
    operationalStatus: OPERATIONAL_STATUSES.DISABLED,
    functionalCategory: FUNCTIONAL_CATEGORIES.SUMMARIZATION,
    decisionNature: DECISION_NATURES.ADVISORY,
    canonicalOrAdvisory: 'ADVISORY',
    realTimeOrBatch: 'BATCH',
    userFacingOrInternal: 'INTERNAL',
    deterministicOrProbabilistic: 'PROBABILISTIC',
    safetyImpact: IMPACT_LEVELS.MODERATE,
    employmentImpact: IMPACT_LEVELS.NONE,
    financialImpact: IMPACT_LEVELS.LOW,
    customerImpact: IMPACT_LEVELS.MODERATE,
    regulatoryImpact: IMPACT_LEVELS.LOW,
    privacyImpact: IMPACT_LEVELS.MODERATE,
    securityImpact: IMPACT_LEVELS.MODERATE,
    riskTier: RISK_TIERS.MODERATE,
    authoritativeSources: ['delivery note records after tenant authorization'],
    advisoryOutputs: ['delivery note summary'],
    prohibitedClaims: ['delivery completion proof', 'customer commitment change'],
    dataClassification: 'ORGANIZATION_PRIVATE',
    allowedExecutionStrategies: [EXECUTION_STRATEGIES.DETERMINISTIC_RULES, EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL],
    prohibitedExecutionStrategies: [EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL, EXECUTION_STRATEGIES.MULTI_MODEL_WORKFLOW],
    defaultExecutionStrategy: EXECUTION_STRATEGIES.DETERMINISTIC_RULES,
    fallbackStrategies: [EXECUTION_STRATEGIES.HUMAN_REVIEW],
    maximumExecutionTier: EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL,
    hostedInferenceAllowed: false,
    humanReviewRequired: false,
    cacheEligible: false,
    batchEligible: true,
    defaultExecutionProfile: EXECUTION_PROFILES.ULTRA_LOW_COST,
    latencyClass: LATENCY_CLASSES.BATCH,
    targetLatencyMs: 10000,
    maximumLatencyMs: 10000,
    inputSchemaId: 'schemas/intelligence/delivery-note-summary-input.v1',
    outputSchemaId: 'schemas/intelligence/delivery-note-summary-output.v1',
    benchmarkRequired: true,
    benchmarkStatus: BENCHMARK_STATUSES.NOT_READY,
    syntheticBenchmarkAllowed: true,
    realDataApprovalRequired: true,
    costClass: COST_CLASSES.LOW,
    costCeilingStatus: 'PROVISIONAL',
    provisionalCostCeilingMicroUsd: 5000,
    portabilityClassification: PROVIDER_INDEPENDENCE_CLASSIFICATIONS.LOW_DEPENDENCY,
    requiredServices: [],
    requiredDataSources: ['delivery note records'],
    requiredExecutors: [],
    sourceFiles: ['bridge-api/services/intelligenceExecution/capabilityRegistry.js'],
    sourceDocuments: ['docs/implementation/intelligence-execution-platform-foundation/CAPABILITY_REGISTRY.md'],
    legacyRuntime: {
      ownerDomain: 'delivery_operations',
      defaultConfidenceThreshold: 0.8,
      defaultAccuracyThreshold: 0.85,
      defaultCostCeilingUsd: '0.005000',
      humanReviewRule: 'WHEN_SAFETY_OR_CUSTOMER_COMMITMENT_IMPACT',
      organizationPolicyCompatibility: 'TENANT_SCOPED',
      approvedFallbackSequence: [EXECUTION_STRATEGIES.HUMAN_REVIEW],
      disabledReason: 'Hosted summarization requires owner approval and provider adapter activation.'
    },
    ...commonGovernance()
  }),
  baseCapability({
    capabilityId: 'policy.answer',
    displayName: 'Policy Answer',
    description: 'Future policy answer capability. Retrieval and source governance are deferred.',
    domain: 'governance',
    subdomain: 'policy',
    capabilityType: 'PLACEHOLDER',
    capabilityVersion: 'policy.answer.v1',
    lifecycleState: LIFECYCLE_STATES.DRAFT,
    enabled: false,
    implementationStatus: IMPLEMENTATION_STATUSES.PLACEHOLDER,
    operationalStatus: OPERATIONAL_STATUSES.DISABLED,
    functionalCategory: FUNCTIONAL_CATEGORIES.DATA_RETRIEVAL,
    decisionNature: DECISION_NATURES.DESCRIPTIVE,
    canonicalOrAdvisory: 'CANONICAL_WITH_SOURCES',
    realTimeOrBatch: 'INTERACTIVE',
    userFacingOrInternal: 'INTERNAL',
    deterministicOrProbabilistic: 'MIXED',
    safetyImpact: IMPACT_LEVELS.HIGH,
    employmentImpact: IMPACT_LEVELS.MODERATE,
    financialImpact: IMPACT_LEVELS.MODERATE,
    customerImpact: IMPACT_LEVELS.MODERATE,
    regulatoryImpact: IMPACT_LEVELS.CRITICAL,
    privacyImpact: IMPACT_LEVELS.HIGH,
    securityImpact: IMPACT_LEVELS.HIGH,
    riskTier: RISK_TIERS.CRITICAL,
    authoritativeSources: ['approved policy corpus'],
    canonicalFacts: ['quoted policy passages from approved corpus only'],
    advisoryOutputs: ['plain-language policy explanation'],
    prohibitedClaims: ['policy not present in approved corpus', 'compliance action without human review'],
    dataClassification: 'CONFIDENTIAL',
    allowedExecutionStrategies: [EXECUTION_STRATEGIES.SQL_ANALYTICS, EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL],
    prohibitedExecutionStrategies: [EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL, EXECUTION_STRATEGIES.MULTI_MODEL_WORKFLOW],
    defaultExecutionStrategy: EXECUTION_STRATEGIES.SQL_ANALYTICS,
    fallbackStrategies: [EXECUTION_STRATEGIES.HUMAN_REVIEW],
    maximumExecutionTier: EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL,
    hostedInferenceAllowed: false,
    humanReviewRequired: true,
    cacheEligible: true,
    defaultExecutionProfile: EXECUTION_PROFILES.PRIVACY_RESTRICTED,
    latencyClass: LATENCY_CLASSES.INTERACTIVE,
    targetLatencyMs: 15000,
    maximumLatencyMs: 15000,
    inputSchemaId: 'schemas/intelligence/policy-answer-input.v1',
    outputSchemaId: 'schemas/intelligence/policy-answer-output.v1',
    citationRequired: true,
    benchmarkRequired: true,
    benchmarkStatus: BENCHMARK_STATUSES.NOT_READY,
    syntheticBenchmarkAllowed: true,
    realDataApprovalRequired: true,
    costClass: COST_CLASSES.LOW,
    costCeilingStatus: 'PROVISIONAL',
    provisionalCostCeilingMicroUsd: 10000,
    portabilityClassification: PROVIDER_INDEPENDENCE_CLASSIFICATIONS.LOW_DEPENDENCY,
    requiredDataSources: ['approved policy corpus'],
    requiredPolicies: ['compliance source governance'],
    sourceFiles: ['bridge-api/services/intelligenceExecution/capabilityRegistry.js'],
    sourceDocuments: ['docs/implementation/intelligence-execution-platform-foundation/CAPABILITY_REGISTRY.md'],
    legacyRuntime: {
      ownerDomain: 'governance',
      defaultConfidenceThreshold: 0.9,
      defaultAccuracyThreshold: 0.95,
      defaultCostCeilingUsd: '0.010000',
      humanReviewRule: 'REQUIRED_FOR_COMPLIANCE_ACTION',
      organizationPolicyCompatibility: 'TENANT_SCOPED_OR_PLATFORM_GLOBAL',
      approvedFallbackSequence: [EXECUTION_STRATEGIES.HUMAN_REVIEW],
      disabledReason: 'Authoritative retrieval corpus and compliance review rules are not implemented.'
    },
    ...commonGovernance()
  }),
  baseCapability({
    capabilityId: 'route.risk_explanation',
    displayName: 'Route Risk Explanation',
    description: 'Future explanation layer for route risk. Canonical route safety must remain deterministic/GIS-driven.',
    domain: 'routing',
    subdomain: 'risk',
    capabilityType: 'PLACEHOLDER',
    capabilityVersion: 'route.risk_explanation.v1',
    lifecycleState: LIFECYCLE_STATES.DRAFT,
    enabled: false,
    implementationStatus: IMPLEMENTATION_STATUSES.PLACEHOLDER,
    operationalStatus: OPERATIONAL_STATUSES.DISABLED,
    functionalCategory: FUNCTIONAL_CATEGORIES.SAFETY_DECISION_SUPPORT,
    decisionNature: DECISION_NATURES.ADVISORY,
    canonicalOrAdvisory: 'ADVISORY',
    realTimeOrBatch: 'INTERACTIVE',
    userFacingOrInternal: 'USER_FACING',
    deterministicOrProbabilistic: 'MIXED',
    safetyImpact: IMPACT_LEVELS.CRITICAL,
    employmentImpact: IMPACT_LEVELS.NONE,
    financialImpact: IMPACT_LEVELS.MODERATE,
    customerImpact: IMPACT_LEVELS.HIGH,
    regulatoryImpact: IMPACT_LEVELS.HIGH,
    privacyImpact: IMPACT_LEVELS.MODERATE,
    securityImpact: IMPACT_LEVELS.HIGH,
    riskTier: RISK_TIERS.CRITICAL,
    authoritativeSources: ['routing engine', 'truck restriction data', 'low-clearance bridge data', 'hazard rules'],
    canonicalFacts: ['route safety facts remain deterministic/GIS-derived'],
    advisoryOutputs: ['plain-language explanation of deterministic route risk'],
    prohibitedClaims: ['override of truck restriction rules', 'new safety rule', 'safe-route determination without routing engine'],
    dataClassification: 'ORGANIZATION_PRIVATE',
    sourceOfTruthService: 'routing engine and hazard services',
    deterministicVerificationRequired: true,
    allowedExecutionStrategies: [EXECUTION_STRATEGIES.GEOSPATIAL_ENGINE, EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL],
    prohibitedExecutionStrategies: [EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL, EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL, EXECUTION_STRATEGIES.MULTI_MODEL_WORKFLOW],
    defaultExecutionStrategy: EXECUTION_STRATEGIES.GEOSPATIAL_ENGINE,
    fallbackStrategies: [EXECUTION_STRATEGIES.HUMAN_REVIEW],
    maximumExecutionTier: EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL,
    hostedInferenceAllowed: false,
    humanReviewRequired: true,
    safetyRulesAuthoritative: true,
    defaultExecutionProfile: EXECUTION_PROFILES.SAFETY_CRITICAL,
    latencyClass: LATENCY_CLASSES.INTERACTIVE,
    targetLatencyMs: 5000,
    maximumLatencyMs: 5000,
    inputSchemaId: 'schemas/intelligence/route-risk-explanation-input.v1',
    outputSchemaId: 'schemas/intelligence/route-risk-explanation-output.v1',
    benchmarkRequired: true,
    benchmarkStatus: BENCHMARK_STATUSES.NOT_READY,
    syntheticBenchmarkAllowed: true,
    realDataApprovalRequired: true,
    costClass: COST_CLASSES.VERIFIED_ZERO,
    costCeilingStatus: 'PROVISIONAL',
    provisionalCostCeilingMicroUsd: 0,
    portabilityClassification: PROVIDER_INDEPENDENCE_CLASSIFICATIONS.PROVIDER_INDEPENDENT,
    requiredServices: ['routing engine', 'hazard services'],
    requiredDataSources: ['truck restriction data', 'low-clearance bridge data', 'hazard rules'],
    requiredPolicies: ['safety-critical human review policy'],
    sourceFiles: ['bridge-api/services/intelligenceExecution/capabilityRegistry.js'],
    sourceDocuments: ['docs/implementation/intelligence-execution-platform-foundation/CAPABILITY_REGISTRY.md'],
    legacyRuntime: {
      ownerDomain: 'routing',
      defaultConfidenceThreshold: null,
      defaultAccuracyThreshold: 1,
      defaultCostCeilingUsd: '0.000000',
      humanReviewRule: 'REQUIRED_FOR_MATERIAL_SAFETY_RECOMMENDATION',
      organizationPolicyCompatibility: 'TENANT_SCOPED',
      approvedFallbackSequence: [EXECUTION_STRATEGIES.HUMAN_REVIEW],
      disabledReason: 'Route risk explanation must not become the authoritative safety engine.'
    },
    ...commonGovernance()
  })
]);

function toRuntimeCapability(capability) {
  return freezeDeep({
    id: capability.capabilityId,
    displayName: capability.displayName,
    description: capability.description,
    ownerDomain: capability.legacyRuntime.ownerDomain || capability.domain,
    inputSchemaRef: capability.inputSchemaId,
    outputSchemaRef: capability.outputSchemaId,
    allowedExecutionStrategies: Object.freeze([...capability.allowedExecutionStrategies]),
    defaultExecutionProfile: capability.defaultExecutionProfile,
    safetyClassification: capability.safetyImpact,
    employmentImpactClassification: capability.legacyRuntime.employmentImpactClassification,
    financialImpactClassification: capability.legacyRuntime.financialImpactClassification,
    defaultConfidenceThreshold: capability.legacyRuntime.defaultConfidenceThreshold ?? null,
    defaultAccuracyThreshold: capability.legacyRuntime.defaultAccuracyThreshold ?? null,
    defaultLatencyTargetMs: capability.targetLatencyMs,
    defaultCostCeilingUsd: capability.legacyRuntime.defaultCostCeilingUsd ?? null,
    cacheEligible: capability.cacheEligible,
    batchEligible: capability.batchEligible,
    hostedModelPermission: capability.legacyRuntime.hostedModelPermission,
    modelClass: capability.legacyRuntime.modelClass,
    premiumEscalationPermission: capability.legacyRuntime.premiumEscalationPermission,
    promptId: capability.promptId,
    promptVersion: capability.promptVersion,
    humanReviewRule: capability.legacyRuntime.humanReviewRule,
    organizationPolicyCompatibility: capability.legacyRuntime.organizationPolicyCompatibility,
    approvedFallbackSequence: Object.freeze([...(capability.legacyRuntime.approvedFallbackSequence || [])]),
    active: capability.enabled,
    disabledReason: capability.legacyRuntime.disabledReason,
    lifecycleState: capability.lifecycleState,
    implementationStatus: capability.implementationStatus,
    operationalStatus: capability.operationalStatus,
    version: capability.capabilityVersion
  });
}

function listEnterpriseCapabilities() {
  return ENTERPRISE_CAPABILITIES.slice();
}

function getEnterpriseCapability(capabilityId) {
  return ENTERPRISE_CAPABILITIES.find((capability) => capability.capabilityId === capabilityId) || null;
}

function resolveAlias(aliasOrCapabilityId) {
  if (getEnterpriseCapability(aliasOrCapabilityId)) return aliasOrCapabilityId;
  const match = ENTERPRISE_CAPABILITIES.find((capability) => capability.aliases.includes(aliasOrCapabilityId));
  return match ? match.capabilityId : null;
}

function listCapabilitiesBy(field, value) {
  return ENTERPRISE_CAPABILITIES.filter((capability) => capability[field] === value);
}

function listByLifecycleState(state) {
  return listCapabilitiesBy('lifecycleState', state);
}

function listByImplementationStatus(status) {
  return listCapabilitiesBy('implementationStatus', status);
}

function listByOperationalStatus(status) {
  return listCapabilitiesBy('operationalStatus', status);
}

function listByDomain(domain) {
  return listCapabilitiesBy('domain', domain);
}

function listByAllowedExecutionStrategy(strategy) {
  return ENTERPRISE_CAPABILITIES.filter((capability) => capability.allowedExecutionStrategies.includes(strategy));
}

function listActiveRuntimeCapabilities() {
  return ENTERPRISE_CAPABILITIES.filter((capability) => capability.enabled);
}

function listBenchmarkRequiredCapabilities() {
  return ENTERPRISE_CAPABILITIES.filter((capability) => capability.benchmarkRequired);
}

function listHumanReviewRequiredCapabilities() {
  return ENTERPRISE_CAPABILITIES.filter((capability) => capability.humanReviewRequired);
}

function listSafetyImpactingCapabilities() {
  return ENTERPRISE_CAPABILITIES.filter((capability) => ['MODERATE', 'HIGH', 'CRITICAL'].includes(capability.safetyImpact));
}

function listEmploymentImpactingCapabilities() {
  return ENTERPRISE_CAPABILITIES.filter((capability) => ['MODERATE', 'HIGH', 'CRITICAL'].includes(capability.employmentImpact));
}

function listRuntimeCapabilities() {
  return ENTERPRISE_CAPABILITIES.map(toRuntimeCapability);
}

function getRuntimeCapability(capabilityId) {
  const canonical = resolveAlias(capabilityId);
  const capability = canonical ? getEnterpriseCapability(canonical) : null;
  return capability ? toRuntimeCapability(capability) : null;
}

function validateLifecycleTransition(fromState, toState, evidence = {}) {
  const errors = [];
  const warnings = [];
  if (!Object.values(LIFECYCLE_STATES).includes(fromState)) {
    errors.push({ field: 'fromState', rule: 'INVALID_LIFECYCLE_STATE', guidance: 'Use a registered lifecycle state.' });
  }
  if (!Object.values(LIFECYCLE_STATES).includes(toState)) {
    errors.push({ field: 'toState', rule: 'INVALID_LIFECYCLE_STATE', guidance: 'Use a registered lifecycle state.' });
  }
  if (errors.length) return { allowed: false, conditionallyAllowed: false, ownerApprovalRequired: false, errors, warnings };
  const transitionAllowed = ALLOWED_TRANSITIONS[fromState].includes(toState);
  if (!transitionAllowed) {
    errors.push({
      field: 'lifecycleState',
      rule: 'LIFECYCLE_TRANSITION_PROHIBITED',
      guidance: `Transition ${fromState} -> ${toState} is not allowed by the registry lifecycle model.`
    });
  }
  const requirements = TRANSITION_REQUIREMENTS[toState] || {};
  for (const [requirement, required] of Object.entries(requirements)) {
    if (required && evidence[requirement] !== true) {
      warnings.push({
        field: requirement,
        rule: 'TRANSITION_EVIDENCE_REQUIRED',
        guidance: `${requirement} must be true before promotion to ${toState}.`
      });
    }
  }
  return {
    allowed: errors.length === 0 && warnings.length === 0,
    conditionallyAllowed: errors.length === 0 && warnings.length > 0,
    ownerApprovalRequired: requirements.ownerApprovalRequired === true,
    benchmarkEvidenceRequired: requirements.benchmarkEvidenceRequired === true,
    rollbackPlanRequired: requirements.rollbackPlanRequired === true,
    errors,
    warnings
  };
}

function validationError(capabilityId, field, rule, guidance) {
  return { capabilityId: capabilityId || null, field, rule, guidance };
}

function validateCapabilityId(capabilityId) {
  if (!CAPABILITY_ID_PATTERN.test(capabilityId)) {
    return validationError(capabilityId, 'capabilityId', 'INVALID_CAPABILITY_ID', 'Use lowercase dot-separated or underscore-separated machine-readable words.');
  }
  if (PROVIDER_OR_MODEL_WORDS.test(capabilityId)) {
    return validationError(capabilityId, 'capabilityId', 'PROVIDER_OR_MODEL_IN_CAPABILITY_ID', 'Capability IDs must be provider-neutral and model-neutral.');
  }
  if (capabilityId.length > 120) {
    return validationError(capabilityId, 'capabilityId', 'CAPABILITY_ID_TOO_LONG', 'Keep capability IDs at or below 120 characters.');
  }
  return null;
}

function validateMicroUsd(value, capabilityId, field) {
  if (value === null) return null;
  if (!Number.isInteger(value)) return validationError(capabilityId, field, 'INVALID_MICRO_USD', 'Represent monetary values as integer micro-USD or null when unknown.');
  if (value < 0) return validationError(capabilityId, field, 'NEGATIVE_COST', 'Cost ceilings cannot be negative.');
  return null;
}

function validateDependencyReferences(capabilities = ENTERPRISE_CAPABILITIES) {
  const errors = [];
  const ids = new Set(capabilities.map((capability) => capability.capabilityId));
  const graph = new Map();
  for (const capability of capabilities) {
    const dependencies = [...capability.upstreamCapabilityIds, ...capability.downstreamCapabilityIds];
    graph.set(capability.capabilityId, dependencies);
    for (const dependencyId of dependencies) {
      if (dependencyId === capability.capabilityId) {
        errors.push(validationError(capability.capabilityId, 'dependencies', 'SELF_DEPENDENCY', 'A capability cannot depend on itself.'));
      }
      if (!ids.has(dependencyId)) {
        errors.push(validationError(capability.capabilityId, 'dependencies', 'UNKNOWN_DEPENDENCY', `Register dependency capability ${dependencyId} or remove the reference.`));
      }
      const dependency = capabilities.find((entry) => entry.capabilityId === dependencyId);
      if (dependency?.lifecycleState === LIFECYCLE_STATES.RETIRED && !capability.retiredDependencyException) {
        errors.push(validationError(capability.capabilityId, 'dependencies', 'RETIRED_DEPENDENCY', 'Do not depend on retired capabilities without an explicit approved exception.'));
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(id, path = []) {
    if (visiting.has(id)) {
      errors.push(validationError(id, 'dependencies', 'DEPENDENCY_CYCLE', `Dependency cycle detected: ${[...path, id].join(' -> ')}`));
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of graph.get(id) || []) {
      if (ids.has(next)) visit(next, [...path, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids) visit(id);
  return errors;
}

function validateEnterpriseRegistry(capabilities = ENTERPRISE_CAPABILITIES) {
  const errors = [];
  const ids = new Set();
  const aliases = new Map();
  const enumSets = {
    lifecycleState: Object.values(LIFECYCLE_STATES),
    implementationStatus: Object.values(IMPLEMENTATION_STATUSES),
    operationalStatus: Object.values(OPERATIONAL_STATUSES),
    functionalCategory: Object.values(FUNCTIONAL_CATEGORIES),
    decisionNature: Object.values(DECISION_NATURES),
    safetyImpact: Object.values(IMPACT_LEVELS),
    employmentImpact: Object.values(IMPACT_LEVELS),
    financialImpact: Object.values(IMPACT_LEVELS),
    customerImpact: Object.values(IMPACT_LEVELS),
    regulatoryImpact: Object.values(IMPACT_LEVELS),
    privacyImpact: Object.values(IMPACT_LEVELS),
    securityImpact: Object.values(IMPACT_LEVELS),
    riskTier: Object.values(RISK_TIERS),
    latencyClass: Object.values(LATENCY_CLASSES),
    benchmarkStatus: Object.values(BENCHMARK_STATUSES),
    costClass: Object.values(COST_CLASSES),
    portabilityClassification: Object.values(PROVIDER_INDEPENDENCE_CLASSIFICATIONS),
    approvalStatus: Object.values(APPROVAL_STATUSES)
  };

  for (const capability of capabilities) {
    const id = capability.capabilityId;
    if (!id) errors.push(validationError(null, 'capabilityId', 'MISSING_CAPABILITY_ID', 'Every capability requires a stable capabilityId.'));
    const idError = validateCapabilityId(id || '');
    if (idError) errors.push(idError);
    if (ids.has(id)) errors.push(validationError(id, 'capabilityId', 'DUPLICATE_CAPABILITY_ID', 'Capability IDs must be unique.'));
    ids.add(id);

    for (const field of ['displayName', 'description', 'domain', 'capabilityType', 'capabilityVersion']) {
      if (!capability[field]) errors.push(validationError(id, field, 'MISSING_REQUIRED_FIELD', `${field} is required.`));
    }
    if (!VERSION_PATTERN.test(capability.capabilityVersion || '')) {
      errors.push(validationError(id, 'capabilityVersion', 'INVALID_VERSION', 'Use a stable format ending in .vN.'));
    }
    for (const [field, allowed] of Object.entries(enumSets)) {
      if (!allowed.includes(capability[field])) {
        errors.push(validationError(id, field, 'INVALID_ENUM_VALUE', `${field} must use a controlled value.`));
      }
    }
    for (const strategy of [...capability.allowedExecutionStrategies, ...capability.prohibitedExecutionStrategies]) {
      if (!Object.values(EXECUTION_STRATEGIES).includes(strategy)) {
        errors.push(validationError(id, 'executionStrategies', 'INVALID_EXECUTION_STRATEGY', 'Use repository execution strategy constants.'));
      }
    }
    if (!capability.allowedExecutionStrategies.includes(capability.defaultExecutionStrategy)) {
      errors.push(validationError(id, 'defaultExecutionStrategy', 'DEFAULT_STRATEGY_NOT_ALLOWED', 'Default strategy must be listed in allowedExecutionStrategies.'));
    }
    for (const strategy of capability.allowedExecutionStrategies) {
      if (capability.prohibitedExecutionStrategies.includes(strategy)) {
        errors.push(validationError(id, 'executionStrategies', 'STRATEGY_OVERLAP', 'A strategy cannot be both allowed and prohibited.'));
      }
    }
    if (capability.lifecycleState === LIFECYCLE_STATES.RETIRED && capability.enabled) {
      errors.push(validationError(id, 'enabled', 'RETIRED_CAPABILITY_ENABLED', 'Retired capabilities cannot be enabled.'));
    }
    if (capability.lifecycleState === LIFECYCLE_STATES.PRODUCTION && capability.implementationStatus === IMPLEMENTATION_STATUSES.NOT_IMPLEMENTED) {
      errors.push(validationError(id, 'implementationStatus', 'PRODUCTION_NOT_IMPLEMENTED', 'Production capabilities must be implemented.'));
    }
    if (capability.premiumAllowed && capability.maximumExecutionTier !== EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL) {
      errors.push(validationError(id, 'premiumAllowed', 'PREMIUM_TIER_CONFLICT', 'premiumAllowed requires maximumExecutionTier HOSTED_PREMIUM_MODEL.'));
    }
    if (capability.humanReviewRequired && !capability.humanReviewAllowed) {
      errors.push(validationError(id, 'humanReviewRequired', 'HUMAN_REVIEW_NOT_ALLOWED', 'humanReviewRequired cannot be true when humanReviewAllowed is false.'));
    }
    if (capability.autonomousActionAllowed && capability.autonomousActionApproval !== APPROVAL_STATUSES.APPROVED) {
      errors.push(validationError(id, 'autonomousActionAllowed', 'AUTONOMOUS_ACTION_UNAPPROVED', 'Autonomous action requires explicit owner approval metadata.'));
    }
    if (capability.decisionNature === DECISION_NATURES.AUTONOMOUS && capability.autonomousActionApproval !== APPROVAL_STATUSES.APPROVED) {
      errors.push(validationError(id, 'decisionNature', 'AUTONOMOUS_DECISION_UNAPPROVED', 'AUTONOMOUS decision nature requires explicit owner approval.'));
    }
    if (capability.crossOrganizationUseAllowed && !capability.crossOrganizationUseEvidence) {
      errors.push(validationError(id, 'crossOrganizationUseAllowed', 'CROSS_ORG_EVIDENCE_REQUIRED', 'Cross-Organization use requires approved evidence.'));
    }
    const latencyFields = ['targetLatencyMs', 'maximumLatencyMs'];
    for (const field of latencyFields) {
      if (capability[field] !== null && capability[field] !== undefined && capability[field] < 0) {
        errors.push(validationError(id, field, 'NEGATIVE_LATENCY', 'Latency values cannot be negative.'));
      }
    }
    const costError = validateMicroUsd(capability.provisionalCostCeilingMicroUsd, id, 'provisionalCostCeilingMicroUsd');
    if (costError) errors.push(costError);
    if (capability.costClass === COST_CLASSES.UNKNOWN && capability.provisionalCostCeilingMicroUsd === 0) {
      errors.push(validationError(id, 'provisionalCostCeilingMicroUsd', 'UNKNOWN_COST_AS_ZERO', 'Unknown cost must remain null or explicit UNKNOWN, not zero.'));
    }
    if (capability.enabled && (!capability.sourceFiles.length || !capability.sourceDocuments.length)) {
      errors.push(validationError(id, 'sourceEvidence', 'ACTIVE_CAPABILITY_WITHOUT_EVIDENCE', 'Active capabilities require source files and source documents.'));
    }
    if (capability.canonicalFacts.length && !capability.authoritativeSources.length) {
      errors.push(validationError(id, 'authoritativeSources', 'AUTHORITATIVE_OUTPUT_WITHOUT_SOURCE', 'Canonical outputs require authoritative source metadata.'));
    }

  }

  for (const capability of capabilities) {
    for (const alias of capability.aliases) {
      if (ids.has(alias) || aliases.has(alias)) {
        errors.push(validationError(capability.capabilityId, 'aliases', 'ALIAS_COLLISION', 'Aliases must not collide with capability IDs or other aliases.'));
      }
      aliases.set(alias, capability.capabilityId);
    }
  }

  for (const capability of capabilities) {
    if (capability.replacementCapabilityId) {
      if (capability.replacementCapabilityId === capability.capabilityId) {
        errors.push(validationError(capability.capabilityId, 'replacementCapabilityId', 'SELF_REPLACEMENT', 'Replacement capability cannot reference itself.'));
      }
      if (!ids.has(capability.replacementCapabilityId)) {
        errors.push(validationError(capability.capabilityId, 'replacementCapabilityId', 'UNKNOWN_REPLACEMENT', 'Replacement capability must exist in the registry.'));
      }
    }
  }
  errors.push(...validateDependencyReferences(capabilities));
  return { valid: errors.length === 0, errors };
}

module.exports = {
  APPROVAL_STATUSES,
  BENCHMARK_STATUSES,
  COST_CLASSES,
  DECISION_NATURES,
  ENTERPRISE_CAPABILITIES,
  FUNCTIONAL_CATEGORIES,
  IMPLEMENTATION_STATUSES,
  IMPACT_LEVELS,
  LATENCY_CLASSES,
  LIFECYCLE_RULES,
  LIFECYCLE_STATES,
  OPERATIONAL_STATUSES,
  PROVIDER_INDEPENDENCE_CLASSIFICATIONS,
  RISK_TIERS,
  getEnterpriseCapability,
  getRuntimeCapability,
  listActiveRuntimeCapabilities,
  listBenchmarkRequiredCapabilities,
  listByAllowedExecutionStrategy,
  listByDomain,
  listByImplementationStatus,
  listByLifecycleState,
  listByOperationalStatus,
  listEmploymentImpactingCapabilities,
  listEnterpriseCapabilities,
  listHumanReviewRequiredCapabilities,
  listRuntimeCapabilities,
  listSafetyImpactingCapabilities,
  resolveAlias,
  toRuntimeCapability,
  validateCapabilityId,
  validateDependencyReferences,
  validateEnterpriseRegistry,
  validateLifecycleTransition
};
