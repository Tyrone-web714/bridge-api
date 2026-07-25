const { createError } = require('./errors');

function cleanupText(input) {
  const raw = typeof input === 'string' ? input : input?.text;
  if (typeof raw !== 'string') {
    throw createError('text.cleanup input must include a text string.', 400, 'INVALID_TEXT_CLEANUP_INPUT');
  }
  if (raw.length > 12000) {
    throw createError('text.cleanup input exceeds the 12000 character limit.', 400, 'TEXT_CLEANUP_INPUT_TOO_LONG');
  }
  const normalized = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!normalized) {
    throw createError('text.cleanup input cannot be empty after normalization.', 400, 'TEXT_CLEANUP_EMPTY');
  }
  return {
    normalizedText: normalized,
    changed: normalized !== raw,
    originalLength: raw.length,
    normalizedLength: normalized.length
  };
}

async function executeDeterministic(capability, request) {
  if (capability.id === 'text.cleanup') {
    return {
      status: 'SUCCEEDED',
      output: cleanupText(request.input),
      confidence: 'unavailable',
      evidence: [{ type: 'deterministic_rule', rule: 'text-cleanup-v1' }],
      estimatedCostUsd: '0.000000',
      actualCostUsd: '0.000000'
    };
  }
  throw createError(`No deterministic executor is registered for capability ${capability.id}.`, 422, 'DETERMINISTIC_EXECUTOR_NOT_FOUND');
}

module.exports = {
  cleanupText,
  executeDeterministic
};
