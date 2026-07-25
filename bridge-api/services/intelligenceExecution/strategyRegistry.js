const { EXECUTION_STRATEGIES } = require('./constants');
const { executeDeterministic } = require('./deterministicExecutor');
const { executeHostedModel } = require('./providerAdapters');
const { createError } = require('./errors');

const EXECUTORS = new Map([
  [EXECUTION_STRATEGIES.DETERMINISTIC_RULES, executeDeterministic],
  [EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL, executeHostedModel],
  [EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL, executeHostedModel],
  [EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL, executeHostedModel]
]);

function listRegisteredStrategies() {
  return Array.from(EXECUTORS.keys());
}

function isStrategyRegistered(strategy) {
  return EXECUTORS.has(strategy);
}

function getExecutor(strategy) {
  const executor = EXECUTORS.get(strategy);
  if (!executor) {
    return async () => {
      throw createError(`Execution strategy ${strategy} is not implemented.`, 422, 'EXECUTION_STRATEGY_UNSUPPORTED', { strategy });
    };
  }
  return executor;
}

module.exports = {
  getExecutor,
  isStrategyRegistered,
  listRegisteredStrategies
};
