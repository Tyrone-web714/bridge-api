const { createError } = require('./errors');

function validateTextCleanupOutput(output) {
  const errors = [];
  if (!output || typeof output !== 'object') errors.push('Output must be an object.');
  if (typeof output?.normalizedText !== 'string' || !output.normalizedText) errors.push('normalizedText is required.');
  if (typeof output?.changed !== 'boolean') errors.push('changed must be boolean.');
  if (!Number.isInteger(output?.originalLength) || output.originalLength < 0) errors.push('originalLength must be a non-negative integer.');
  if (!Number.isInteger(output?.normalizedLength) || output.normalizedLength < 0) errors.push('normalizedLength must be a non-negative integer.');
  return errors;
}

function validateOutput(capability, result) {
  let errors = [];
  if (capability.id === 'text.cleanup') {
    errors = validateTextCleanupOutput(result.output);
  } else if (capability.id === 'legacy.ai.structured_response') {
    if (!result.output || typeof result.output !== 'object' || Array.isArray(result.output)) {
      errors.push('Legacy AI structured output must be an object.');
    }
  }
  if (errors.length) {
    throw createError('Intelligence output failed schema validation.', 502, 'INTELLIGENCE_OUTPUT_INVALID', errors);
  }
  return [{
    validator: capability.outputSchemaRef,
    status: 'PASS',
    checkedAt: new Date().toISOString()
  }];
}

module.exports = {
  validateOutput,
  validateTextCleanupOutput
};
