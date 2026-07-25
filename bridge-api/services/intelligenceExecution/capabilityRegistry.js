const { EXECUTION_PROFILES, EXECUTION_STRATEGIES } = require('./constants');

const CAPABILITIES = Object.freeze({
  'text.cleanup': Object.freeze({
    id: 'text.cleanup',
    displayName: 'Text Cleanup',
    description: 'Deterministically trims text, normalizes line breaks, collapses repeated spaces, and rejects empty input.',
    ownerDomain: 'platform',
    inputSchemaRef: 'schemas/intelligence/text-cleanup-input.v1',
    outputSchemaRef: 'schemas/intelligence/text-cleanup-output.v1',
    allowedExecutionStrategies: Object.freeze([EXECUTION_STRATEGIES.DETERMINISTIC_RULES]),
    defaultExecutionProfile: EXECUTION_PROFILES.DETERMINISTIC_ONLY,
    safetyClassification: 'LOW',
    defaultConfidenceThreshold: null,
    defaultAccuracyThreshold: 1,
    defaultLatencyTargetMs: 500,
    defaultCostCeilingUsd: '0.000000',
    cacheEligible: false,
    batchEligible: true,
    humanReviewRule: 'NOT_REQUIRED',
    organizationPolicyCompatibility: 'TENANT_SCOPED',
    approvedFallbackSequence: Object.freeze([]),
    active: true,
    version: 'text.cleanup.v1'
  }),
  'legacy.ai.structured_response': Object.freeze({
    id: 'legacy.ai.structured_response',
    displayName: 'Legacy AI Structured Response',
    description: 'Compatibility capability for existing /api/ai structured logistics intelligence responses.',
    ownerDomain: 'logistics_intelligence',
    inputSchemaRef: 'schemas/intelligence/legacy-ai-structured-response-input.v1',
    outputSchemaRef: 'schemas/intelligence/legacy-ai-structured-response-output.v1',
    allowedExecutionStrategies: Object.freeze([EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL]),
    defaultExecutionProfile: EXECUTION_PROFILES.BALANCED,
    safetyClassification: 'MEDIUM',
    defaultConfidenceThreshold: null,
    defaultAccuracyThreshold: null,
    defaultLatencyTargetMs: 30000,
    defaultCostCeilingUsd: null,
    cacheEligible: false,
    batchEligible: false,
    humanReviewRule: 'NOT_REQUIRED_FOR_COMPATIBILITY_RESPONSE',
    organizationPolicyCompatibility: 'TENANT_SCOPED',
    approvedFallbackSequence: Object.freeze([]),
    active: true,
    version: 'legacy.ai.structured_response.v1'
  }),
  'delivery_note.summarize': Object.freeze({
    id: 'delivery_note.summarize',
    displayName: 'Delivery Note Summary',
    description: 'Future delivery-note summary capability. Hosted inference path is intentionally deferred in AI-IEP-001.',
    ownerDomain: 'delivery_operations',
    inputSchemaRef: 'schemas/intelligence/delivery-note-summary-input.v1',
    outputSchemaRef: 'schemas/intelligence/delivery-note-summary-output.v1',
    allowedExecutionStrategies: Object.freeze([EXECUTION_STRATEGIES.DETERMINISTIC_RULES, EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL]),
    defaultExecutionProfile: EXECUTION_PROFILES.ULTRA_LOW_COST,
    safetyClassification: 'MEDIUM',
    defaultConfidenceThreshold: 0.8,
    defaultAccuracyThreshold: 0.85,
    defaultLatencyTargetMs: 10000,
    defaultCostCeilingUsd: '0.005000',
    cacheEligible: false,
    batchEligible: true,
    humanReviewRule: 'WHEN_SAFETY_OR_CUSTOMER_COMMITMENT_IMPACT',
    organizationPolicyCompatibility: 'TENANT_SCOPED',
    approvedFallbackSequence: Object.freeze([EXECUTION_STRATEGIES.HUMAN_REVIEW]),
    active: false,
    disabledReason: 'Hosted summarization requires owner approval and provider adapter activation.',
    version: 'delivery_note.summarize.v1'
  }),
  'policy.answer': Object.freeze({
    id: 'policy.answer',
    displayName: 'Policy Answer',
    description: 'Future policy answer capability. Retrieval and source governance are deferred.',
    ownerDomain: 'governance',
    inputSchemaRef: 'schemas/intelligence/policy-answer-input.v1',
    outputSchemaRef: 'schemas/intelligence/policy-answer-output.v1',
    allowedExecutionStrategies: Object.freeze([EXECUTION_STRATEGIES.SQL_ANALYTICS, EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL]),
    defaultExecutionProfile: EXECUTION_PROFILES.PRIVACY_RESTRICTED,
    safetyClassification: 'COMPLIANCE_CRITICAL',
    defaultConfidenceThreshold: 0.9,
    defaultAccuracyThreshold: 0.95,
    defaultLatencyTargetMs: 15000,
    defaultCostCeilingUsd: '0.010000',
    cacheEligible: true,
    batchEligible: false,
    humanReviewRule: 'REQUIRED_FOR_COMPLIANCE_ACTION',
    organizationPolicyCompatibility: 'TENANT_SCOPED_OR_PLATFORM_GLOBAL',
    approvedFallbackSequence: Object.freeze([EXECUTION_STRATEGIES.HUMAN_REVIEW]),
    active: false,
    disabledReason: 'Authoritative retrieval corpus and compliance review rules are not implemented.',
    version: 'policy.answer.v1'
  }),
  'route.risk_explanation': Object.freeze({
    id: 'route.risk_explanation',
    displayName: 'Route Risk Explanation',
    description: 'Future explanation layer for route risk. Canonical route safety must remain deterministic/GIS-driven.',
    ownerDomain: 'routing',
    inputSchemaRef: 'schemas/intelligence/route-risk-explanation-input.v1',
    outputSchemaRef: 'schemas/intelligence/route-risk-explanation-output.v1',
    allowedExecutionStrategies: Object.freeze([EXECUTION_STRATEGIES.GEOSPATIAL_ENGINE, EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL]),
    defaultExecutionProfile: EXECUTION_PROFILES.SAFETY_CRITICAL,
    safetyClassification: 'SAFETY_CRITICAL',
    defaultConfidenceThreshold: null,
    defaultAccuracyThreshold: 1,
    defaultLatencyTargetMs: 5000,
    defaultCostCeilingUsd: '0.000000',
    cacheEligible: false,
    batchEligible: false,
    humanReviewRule: 'REQUIRED_FOR_MATERIAL_SAFETY_RECOMMENDATION',
    organizationPolicyCompatibility: 'TENANT_SCOPED',
    approvedFallbackSequence: Object.freeze([EXECUTION_STRATEGIES.HUMAN_REVIEW]),
    active: false,
    disabledReason: 'Route risk explanation must not become the authoritative safety engine.',
    version: 'route.risk_explanation.v1'
  })
});

function getCapability(id) {
  return CAPABILITIES[id] || null;
}

function listCapabilities() {
  return Object.values(CAPABILITIES);
}

module.exports = {
  getCapability,
  listCapabilities
};
