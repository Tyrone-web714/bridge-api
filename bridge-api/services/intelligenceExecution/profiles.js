const { EXECUTION_PROFILES, EXECUTION_STRATEGIES } = require('./constants');

const PROFILE_DEFINITIONS = Object.freeze({
  [EXECUTION_PROFILES.DETERMINISTIC_ONLY]: Object.freeze({
    id: EXECUTION_PROFILES.DETERMINISTIC_ONLY,
    allowedStrategies: Object.freeze([EXECUTION_STRATEGIES.CACHE, EXECUTION_STRATEGIES.DETERMINISTIC_RULES]),
    forbiddenStrategies: Object.freeze([
      EXECUTION_STRATEGIES.LOCAL_MODEL,
      EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL,
      EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL,
      EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL,
      EXECUTION_STRATEGIES.MULTI_MODEL_WORKFLOW
    ]),
    maximumCostUsd: '0.000000',
    latencyTargetMs: 500,
    retryPolicy: Object.freeze({ maxAttempts: 1 }),
    cachePolicy: Object.freeze({ allowRead: true, allowWrite: false, ttlSeconds: 0 }),
    escalationPolicy: Object.freeze({ allowEscalation: false, maxEscalations: 0 }),
    fallbackPolicy: Object.freeze({ allowFallback: false, maxFallbacks: 0 }),
    humanReviewPolicy: Object.freeze({ required: false }),
    allowHostedInference: false,
    preferLocalInference: false,
    loggingLevel: 'metadata'
  }),
  [EXECUTION_PROFILES.ULTRA_LOW_COST]: Object.freeze({
    id: EXECUTION_PROFILES.ULTRA_LOW_COST,
    allowedStrategies: Object.freeze([
      EXECUTION_STRATEGIES.CACHE,
      EXECUTION_STRATEGIES.DETERMINISTIC_RULES,
      EXECUTION_STRATEGIES.SQL_ANALYTICS,
      EXECUTION_STRATEGIES.STATISTICAL_MODEL,
      EXECUTION_STRATEGIES.GEOSPATIAL_ENGINE,
      EXECUTION_STRATEGIES.OPTIMIZATION_ENGINE,
      EXECUTION_STRATEGIES.CONVENTIONAL_ML,
      EXECUTION_STRATEGIES.LOCAL_MODEL,
      EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL
    ]),
    forbiddenStrategies: Object.freeze([EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL, EXECUTION_STRATEGIES.MULTI_MODEL_WORKFLOW]),
    maximumCostUsd: '0.002000',
    latencyTargetMs: 3000,
    retryPolicy: Object.freeze({ maxAttempts: 1 }),
    cachePolicy: Object.freeze({ allowRead: true, allowWrite: true, ttlSeconds: 300 }),
    escalationPolicy: Object.freeze({ allowEscalation: true, maxEscalations: 1 }),
    fallbackPolicy: Object.freeze({ allowFallback: true, maxFallbacks: 1 }),
    humanReviewPolicy: Object.freeze({ required: false }),
    allowHostedInference: true,
    preferLocalInference: true,
    loggingLevel: 'metadata'
  }),
  [EXECUTION_PROFILES.BALANCED]: Object.freeze({
    id: EXECUTION_PROFILES.BALANCED,
    allowedStrategies: Object.freeze(Object.values(EXECUTION_STRATEGIES).filter((strategy) => strategy !== EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL)),
    forbiddenStrategies: Object.freeze([EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL]),
    maximumCostUsd: '0.020000',
    latencyTargetMs: 10000,
    retryPolicy: Object.freeze({ maxAttempts: 2 }),
    cachePolicy: Object.freeze({ allowRead: true, allowWrite: true, ttlSeconds: 600 }),
    escalationPolicy: Object.freeze({ allowEscalation: true, maxEscalations: 2 }),
    fallbackPolicy: Object.freeze({ allowFallback: true, maxFallbacks: 2 }),
    humanReviewPolicy: Object.freeze({ required: false }),
    allowHostedInference: true,
    preferLocalInference: false,
    loggingLevel: 'metadata'
  }),
  [EXECUTION_PROFILES.REAL_TIME_OPERATIONAL]: Object.freeze({
    id: EXECUTION_PROFILES.REAL_TIME_OPERATIONAL,
    allowedStrategies: Object.freeze([
      EXECUTION_STRATEGIES.CACHE,
      EXECUTION_STRATEGIES.DETERMINISTIC_RULES,
      EXECUTION_STRATEGIES.SQL_ANALYTICS,
      EXECUTION_STRATEGIES.GEOSPATIAL_ENGINE,
      EXECUTION_STRATEGIES.LOCAL_MODEL,
      EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL
    ]),
    forbiddenStrategies: Object.freeze([EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL, EXECUTION_STRATEGIES.MULTI_MODEL_WORKFLOW]),
    maximumCostUsd: '0.005000',
    latencyTargetMs: 1500,
    retryPolicy: Object.freeze({ maxAttempts: 1 }),
    cachePolicy: Object.freeze({ allowRead: true, allowWrite: false, ttlSeconds: 60 }),
    escalationPolicy: Object.freeze({ allowEscalation: false, maxEscalations: 0 }),
    fallbackPolicy: Object.freeze({ allowFallback: true, maxFallbacks: 1 }),
    humanReviewPolicy: Object.freeze({ required: false }),
    allowHostedInference: true,
    preferLocalInference: true,
    loggingLevel: 'metadata'
  }),
  [EXECUTION_PROFILES.BACKGROUND_BATCH]: Object.freeze({
    id: EXECUTION_PROFILES.BACKGROUND_BATCH,
    allowedStrategies: Object.freeze(Object.values(EXECUTION_STRATEGIES)),
    forbiddenStrategies: Object.freeze([]),
    maximumCostUsd: '0.050000',
    latencyTargetMs: 120000,
    retryPolicy: Object.freeze({ maxAttempts: 2 }),
    cachePolicy: Object.freeze({ allowRead: true, allowWrite: true, ttlSeconds: 3600 }),
    escalationPolicy: Object.freeze({ allowEscalation: true, maxEscalations: 2 }),
    fallbackPolicy: Object.freeze({ allowFallback: true, maxFallbacks: 2 }),
    humanReviewPolicy: Object.freeze({ required: false }),
    allowHostedInference: true,
    preferLocalInference: false,
    loggingLevel: 'metadata'
  }),
  [EXECUTION_PROFILES.SAFETY_CRITICAL]: Object.freeze({
    id: EXECUTION_PROFILES.SAFETY_CRITICAL,
    allowedStrategies: Object.freeze([
      EXECUTION_STRATEGIES.CACHE,
      EXECUTION_STRATEGIES.DETERMINISTIC_RULES,
      EXECUTION_STRATEGIES.SQL_ANALYTICS,
      EXECUTION_STRATEGIES.GEOSPATIAL_ENGINE,
      EXECUTION_STRATEGIES.OPTIMIZATION_ENGINE,
      EXECUTION_STRATEGIES.HUMAN_REVIEW
    ]),
    forbiddenStrategies: Object.freeze([
      EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL,
      EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL,
      EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL,
      EXECUTION_STRATEGIES.MULTI_MODEL_WORKFLOW
    ]),
    maximumCostUsd: '0.000000',
    latencyTargetMs: 5000,
    retryPolicy: Object.freeze({ maxAttempts: 1 }),
    cachePolicy: Object.freeze({ allowRead: false, allowWrite: false, ttlSeconds: 0 }),
    escalationPolicy: Object.freeze({ allowEscalation: false, maxEscalations: 0 }),
    fallbackPolicy: Object.freeze({ allowFallback: true, maxFallbacks: 1 }),
    humanReviewPolicy: Object.freeze({ required: true }),
    allowHostedInference: false,
    preferLocalInference: false,
    loggingLevel: 'restricted'
  }),
  [EXECUTION_PROFILES.PRIVACY_RESTRICTED]: Object.freeze({
    id: EXECUTION_PROFILES.PRIVACY_RESTRICTED,
    allowedStrategies: Object.freeze([
      EXECUTION_STRATEGIES.CACHE,
      EXECUTION_STRATEGIES.DETERMINISTIC_RULES,
      EXECUTION_STRATEGIES.SQL_ANALYTICS,
      EXECUTION_STRATEGIES.STATISTICAL_MODEL,
      EXECUTION_STRATEGIES.GEOSPATIAL_ENGINE,
      EXECUTION_STRATEGIES.OPTIMIZATION_ENGINE,
      EXECUTION_STRATEGIES.CONVENTIONAL_ML,
      EXECUTION_STRATEGIES.LOCAL_MODEL,
      EXECUTION_STRATEGIES.HUMAN_REVIEW
    ]),
    forbiddenStrategies: Object.freeze([
      EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL,
      EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL,
      EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL,
      EXECUTION_STRATEGIES.MULTI_MODEL_WORKFLOW
    ]),
    maximumCostUsd: '0.000000',
    latencyTargetMs: 10000,
    retryPolicy: Object.freeze({ maxAttempts: 1 }),
    cachePolicy: Object.freeze({ allowRead: false, allowWrite: false, ttlSeconds: 0 }),
    escalationPolicy: Object.freeze({ allowEscalation: false, maxEscalations: 0 }),
    fallbackPolicy: Object.freeze({ allowFallback: true, maxFallbacks: 1 }),
    humanReviewPolicy: Object.freeze({ required: false }),
    allowHostedInference: false,
    preferLocalInference: true,
    loggingLevel: 'restricted'
  }),
  [EXECUTION_PROFILES.PREMIUM_APPROVAL_REQUIRED]: Object.freeze({
    id: EXECUTION_PROFILES.PREMIUM_APPROVAL_REQUIRED,
    allowedStrategies: Object.freeze(Object.values(EXECUTION_STRATEGIES)),
    forbiddenStrategies: Object.freeze([]),
    maximumCostUsd: '0.100000',
    latencyTargetMs: 30000,
    retryPolicy: Object.freeze({ maxAttempts: 2 }),
    cachePolicy: Object.freeze({ allowRead: true, allowWrite: true, ttlSeconds: 600 }),
    escalationPolicy: Object.freeze({ allowEscalation: true, maxEscalations: 3, premiumRequiresApproval: true }),
    fallbackPolicy: Object.freeze({ allowFallback: true, maxFallbacks: 2 }),
    humanReviewPolicy: Object.freeze({ required: true }),
    allowHostedInference: true,
    preferLocalInference: false,
    loggingLevel: 'metadata'
  })
});

function getProfile(id) {
  return PROFILE_DEFINITIONS[id] || PROFILE_DEFINITIONS[EXECUTION_PROFILES.BALANCED];
}

module.exports = {
  PROFILE_DEFINITIONS,
  getProfile
};
