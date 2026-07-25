const PROMPTS = Object.freeze({
  'legacy.ai.structured_response': Object.freeze({
    id: 'legacy.ai.structured_response.prompt',
    version: 'legacy-ai-structured-response.v1',
    owningCapability: 'legacy.ai.structured_response',
    requiredVariables: Object.freeze(['instructions', 'input', 'schemaName', 'schema']),
    maxInputBytes: 24 * 1024,
    outputSchemaRef: 'caller_supplied_json_schema',
    safetyInstructions: Object.freeze([
      'Use only supplied backend data.',
      'Do not fabricate missing facts.',
      'Return only the requested structured JSON.'
    ]),
    status: 'active',
    deprecatedAt: null,
    replacementPromptId: null
  }),
  'supervisor.daily_operations_report': Object.freeze({
    id: 'supervisor.daily_operations_report.prompt',
    version: 'supervisor-daily-operations-report.v1',
    owningCapability: 'supervisor.daily_operations_report',
    requiredVariables: Object.freeze(['sourceContext']),
    maxInputBytes: 24 * 1024,
    outputSchemaRef: 'schemas/intelligence/supervisor-daily-operations-report-output.v1',
    safetyInstructions: Object.freeze([
      'Use only the source-of-truth predictions and exceptions supplied.',
      'Distinguish supplied facts from interpretation.',
      'Do not invent traffic, weather, inventory, customer behavior, or driver behavior.',
      'Treat deterministic predictions as calculated facts and preserve uncertainty.',
      'Do not make disciplinary, compensation, termination, or employment decisions.',
      'Do not override verified safety, routing, warehouse, customer, or backend rules.',
      'AI recommends only. Supervisors and backend records remain the source of truth.'
    ]),
    status: 'active',
    deprecatedAt: null,
    replacementPromptId: null
  })
});

function getPrompt(id) {
  return PROMPTS[id] || null;
}

function requirePrompt(id) {
  const prompt = getPrompt(id);
  if (!prompt) {
    const error = new Error(`Prompt ${id} is not registered.`);
    error.status = 500;
    error.code = 'PROMPT_NOT_REGISTERED';
    throw error;
  }
  return prompt;
}

function renderPrompt(id) {
  const prompt = requirePrompt(id);
  return prompt.safetyInstructions.join('\n');
}

function listPrompts() {
  return Object.values(PROMPTS);
}

module.exports = {
  getPrompt,
  listPrompts,
  renderPrompt,
  requirePrompt
};