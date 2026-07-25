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

function validateSupervisorDailyReportOutput(output) {
  const errors = [];
  const stringFields = ['title', 'summary'];
  const arrayFields = ['priorities', 'routeRisks', 'deliveryRisks', 'productSignals', 'recommendedActions', 'missingData'];
  if (!output || typeof output !== 'object' || Array.isArray(output)) return ['Supervisor report output must be an object.'];
  for (const field of stringFields) {
    if (typeof output[field] !== 'string' || !output[field].trim()) errors.push(`${field} is required.`);
    if (typeof output[field] === 'string' && output[field].length > 2000) errors.push(`${field} exceeds the maximum length.`);
  }
  for (const field of arrayFields) {
    if (!Array.isArray(output[field])) {
      errors.push(`${field} must be an array.`);
      continue;
    }
    if (output[field].length > 8) errors.push(`${field} exceeds the 8 item limit.`);
    for (const item of output[field]) {
      if (typeof item !== 'string' || !item.trim()) errors.push(`${field} must contain non-empty strings.`);
      if (typeof item === 'string' && item.length > 1000) errors.push(`${field} item exceeds the maximum length.`);
    }
  }
  const prohibited = /\b(terminate|fire|fired|discipline|demote|withhold pay|dock pay|compensation decision|safety restriction is optional)\b/i;
  for (const field of ['summary', ...arrayFields]) {
    const values = Array.isArray(output[field]) ? output[field] : [output[field]];
    for (const value of values) {
      if (typeof value === 'string' && prohibited.test(value)) {
        errors.push('Supervisor report contains prohibited autonomous employment or safety action language.');
      }
    }
  }
  return [...new Set(errors)];
}
function validateOutput(capability, result) {
  let errors = [];
  if (capability.id === 'text.cleanup') {
    errors = validateTextCleanupOutput(result.output);
  } else if (capability.id === 'legacy.ai.structured_response') {
    if (!result.output || typeof result.output !== 'object' || Array.isArray(result.output)) {
      errors.push('Legacy AI structured output must be an object.');
    }
  } else if (capability.id === 'supervisor.daily_operations_report') {
    errors = validateSupervisorDailyReportOutput(result.output);
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
  validateSupervisorDailyReportOutput,
  validateTextCleanupOutput
};
