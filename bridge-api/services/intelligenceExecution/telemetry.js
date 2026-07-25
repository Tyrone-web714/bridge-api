const counters = new Map();

function increment(name, labels = {}) {
  const key = `${name}:${JSON.stringify(labels)}`;
  counters.set(key, (counters.get(key) || 0) + 1);
}

function recordExecution(event) {
  increment('intelligence.execution.count', {
    capability: event.capability,
    strategy: event.strategy,
    status: event.status
  });
  if (event.humanReviewRequired) {
    increment('intelligence.human_review.required', { capability: event.capability });
  }
}

function snapshot() {
  return Array.from(counters.entries()).map(([key, value]) => ({ key, value }));
}

module.exports = {
  increment,
  recordExecution,
  snapshot
};
