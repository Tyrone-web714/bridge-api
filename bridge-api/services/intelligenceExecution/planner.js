const { EXECUTION_STRATEGIES } = require('./constants');
const { createError } = require('./errors');
const { isStrategyRegistered } = require('./strategyRegistry');
const { microsToUsdString } = require('./money');

const COST_ORDER = Object.freeze([
  EXECUTION_STRATEGIES.CACHE,
  EXECUTION_STRATEGIES.DETERMINISTIC_RULES,
  EXECUTION_STRATEGIES.SQL_ANALYTICS,
  EXECUTION_STRATEGIES.STATISTICAL_MODEL,
  EXECUTION_STRATEGIES.GEOSPATIAL_ENGINE,
  EXECUTION_STRATEGIES.OPTIMIZATION_ENGINE,
  EXECUTION_STRATEGIES.CONVENTIONAL_ML,
  EXECUTION_STRATEGIES.LOCAL_MODEL,
  EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL,
  EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL,
  EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL,
  EXECUTION_STRATEGIES.MULTI_MODEL_WORKFLOW,
  EXECUTION_STRATEGIES.HUMAN_REVIEW
]);

function createExecutionPlan(request, capability, profile, policy) {
  if (!policy.allowed) {
    throw createError('Intelligence policy denied the request.', 403, 'INTELLIGENCE_POLICY_DENIED', policy.denials);
  }

  const consideredStrategies = [];
  const rejectedStrategies = [];
  const approved = new Set(policy.approvedStrategies);

  for (const strategy of COST_ORDER) {
    if (!capability.allowedExecutionStrategies.includes(strategy)) {
      rejectedStrategies.push({ strategy, reason: 'Capability does not allow this strategy.' });
      continue;
    }
    if (!approved.has(strategy)) {
      rejectedStrategies.push({ strategy, reason: 'Policy or execution profile rejected this strategy.' });
      continue;
    }
    if (strategy === EXECUTION_STRATEGIES.CACHE) {
      consideredStrategies.push({ strategy, result: 'MISS', reason: 'No approved exact cache implementation is active for this foundation.' });
      rejectedStrategies.push({ strategy, reason: 'Cache interface exists, but no approved exact cache is registered.' });
      continue;
    }
    if (!isStrategyRegistered(strategy)) {
      consideredStrategies.push({ strategy, result: 'UNSUPPORTED' });
      rejectedStrategies.push({ strategy, reason: 'No executor is registered for this strategy.' });
      continue;
    }
    consideredStrategies.push({ strategy, result: 'SELECTED', reason: 'Lowest-cost registered strategy satisfying capability, profile, and policy.' });
    return Object.freeze({
      requestId: request.requestId,
      traceId: request.traceId,
      capability: capability.id,
      capabilityVersion: capability.version,
      selectedStrategy: strategy,
      selectedProviderAdapter: null,
      selectedModelClass: null,
      selectionReason: 'Selected the lowest-cost registered strategy allowed by capability metadata, execution profile, and effective policy.',
      consideredStrategies,
      rejectedStrategies,
      costCeilingUsd: microsToUsdString(policy.effectiveCostCeilingMicros),
      latencyCeilingMs: request.latencyTargetMs || capability.defaultLatencyTargetMs || profile.latencyTargetMs,
      validationRequirements: Object.freeze([capability.outputSchemaRef]),
      escalationSequence: Object.freeze(profile.escalationPolicy.allowEscalation ? capability.approvedFallbackSequence.slice(0, profile.escalationPolicy.maxEscalations) : []),
      fallbackSequence: Object.freeze(profile.fallbackPolicy.allowFallback ? capability.approvedFallbackSequence.slice(0, profile.fallbackPolicy.maxFallbacks) : []),
      humanReviewRequired: policy.humanReviewRequired,
      cacheDecision: Object.freeze({ status: 'MISS', reason: 'No approved exact cache implementation is active.' }),
      policyVersion: policy.policyVersion
    });
  }

  throw createError('No approved execution strategy is available for this request.', 422, 'NO_EXECUTION_STRATEGY_AVAILABLE', {
    consideredStrategies,
    rejectedStrategies
  });
}

module.exports = {
  COST_ORDER,
  createExecutionPlan
};
