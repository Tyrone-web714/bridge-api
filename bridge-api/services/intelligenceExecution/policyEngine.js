const rbac = require('../rbac');
const { EXECUTION_STRATEGIES, POLICY_VERSION } = require('./constants');
const { parseUsdToMicros } = require('./money');

const LEGACY_HOSTED_CAPABILITIES = Object.freeze(new Set([
  'legacy.ai.structured_response',
  'supervisor.daily_operations_report'
]));

function resolveOrganizationPolicy(organizationId, request = {}, capability = null) {
  if (organizationId && LEGACY_HOSTED_CAPABILITIES.has(capability?.id)) {
    return Object.freeze({
      policyVersion: POLICY_VERSION,
      allowHostedInference: true,
      allowLocalInference: false,
      allowPremiumModels: false,
      approvedProviders: Object.freeze(['openai']),
      advisoryOnly: capability?.id === 'supervisor.daily_operations_report',
      humanInterpretationRequired: capability?.id === 'supervisor.daily_operations_report',
      prohibitedProviders: Object.freeze([]),
      retentionMode: 'PROVIDER_STORE_DISABLED',
      regionalRestrictions: Object.freeze([]),
      maxRequestCostUsd: null
    });
  }
  return Object.freeze({
    policyVersion: POLICY_VERSION,
    allowHostedInference: false,
    allowLocalInference: false,
    allowPremiumModels: false,
    approvedProviders: Object.freeze([]),
    prohibitedProviders: Object.freeze([]),
    retentionMode: 'METADATA_ONLY',
    regionalRestrictions: Object.freeze([]),
    maxRequestCostUsd: '0.000000'
  });
}

function evaluatePolicy(request, capability, profile, authContext = {}) {
  const organizationPolicy = resolveOrganizationPolicy(request.organizationId, request, capability);
  const denials = [];
  const constraints = [];
  const approvedStrategies = [];

  if (!request.organizationId && request.executionMode !== 'PLATFORM_ADMIN') {
    denials.push({ code: 'ORGANIZATION_CONTEXT_REQUIRED', reason: 'Tenant-scoped intelligence requires trusted Organization context.' });
  }
  if (!rbac.hasPermission(authContext, rbac.PERMISSIONS.INTELLIGENCE_VIEW)) {
    denials.push({ code: 'PERMISSION_DENIED', reason: 'Caller lacks intelligence.view permission.' });
  }
  if (capability?.id === 'supervisor.daily_operations_report') {
    const role = rbac.normalizeRole(authContext.approvedRole || authContext.role);
    const allowedRoles = [rbac.ROLES.SUPERVISOR, rbac.ROLES.ORGANIZATION_ADMIN, rbac.ROLES.PLATFORM_ADMIN];
    if (!allowedRoles.includes(role)) {
      denials.push({ code: 'SUPERVISOR_CAPABILITY_ROLE_DENIED', reason: 'Caller role is not allowed to invoke supervisor intelligence capabilities.' });
    }
  }
  if (!capability) {
    denials.push({ code: 'CAPABILITY_NOT_FOUND', reason: 'Requested capability is not registered.' });
  } else if (!capability.active) {
    denials.push({ code: 'CAPABILITY_DISABLED', reason: capability.disabledReason || 'Capability is disabled.' });
  }

  const critical = ['SAFETY_CRITICAL', 'COMPLIANCE_CRITICAL', 'EMPLOYMENT_CRITICAL', 'FINANCIAL_CRITICAL'].includes(request.safetyClassification);
  if (critical || request.requireHumanReview) {
    constraints.push({ code: 'HUMAN_REVIEW_REQUIRED', reason: 'Safety, compliance, employment, financial, or caller policy requires human review.' });
  }

  const hostedStrategies = [
    EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL,
    EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL,
    EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL,
    EXECUTION_STRATEGIES.MULTI_MODEL_WORKFLOW
  ];

  for (const strategy of capability?.allowedExecutionStrategies || []) {
    if (!profile.allowedStrategies.includes(strategy)) {
      constraints.push({ code: 'STRATEGY_BLOCKED_BY_PROFILE', strategy });
      continue;
    }
    if (profile.forbiddenStrategies.includes(strategy)) {
      constraints.push({ code: 'STRATEGY_FORBIDDEN_BY_PROFILE', strategy });
      continue;
    }
    if (hostedStrategies.includes(strategy) && (!request.allowHostedInference || !organizationPolicy.allowHostedInference || !profile.allowHostedInference)) {
      constraints.push({ code: 'HOSTED_INFERENCE_DENIED', strategy });
      continue;
    }
    if (strategy === EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL && (!request.allowPremiumEscalation || !organizationPolicy.allowPremiumModels)) {
      constraints.push({ code: 'PREMIUM_MODEL_DENIED', strategy });
      continue;
    }
    approvedStrategies.push(strategy);
  }

  const requestCostCeilingMicros = parseUsdToMicros(request.maximumCostUsd);
  const policyCostCeilingMicros = parseUsdToMicros(organizationPolicy.maxRequestCostUsd);
  const profileCostCeilingMicros = parseUsdToMicros(profile.maximumCostUsd);
  const costCeilings = [requestCostCeilingMicros, policyCostCeilingMicros, profileCostCeilingMicros]
    .filter((value) => value !== null && value !== undefined);
  const effectiveCostCeilingMicros = costCeilings.reduce((lowest, value) => (lowest === null || value < lowest ? value : lowest), null);

  return Object.freeze({
    allowed: denials.length === 0,
    denials,
    constraints,
    approvedStrategies,
    humanReviewRequired: critical || request.requireHumanReview || profile.humanReviewPolicy.required === true,
    organizationPolicy,
    policyVersion: organizationPolicy.policyVersion,
    effectiveCostCeilingMicros
  });
}

module.exports = {
  evaluatePolicy,
  resolveOrganizationPolicy
};
