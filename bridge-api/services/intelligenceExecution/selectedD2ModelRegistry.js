const { createError } = require('./errors');

const SELECTED_D2_REGISTRY_SCHEMA_VERSION = 'tsr.selected.d2.model.registry.v1';
const SELECTED_D2_SELECTION_COMMIT = '7f4ef7538a894b9ae3fd3c654c22fcbc5e558904';
const SELECTED_D2_SELECTION_SOURCE = 'MS-004';
const SELECTED_D2_EXECUTION_MODE = 'NON_PRODUCTION_SELECTED_D2';

const OUTPUT_CONTRACTS = Object.freeze({
  grounded_summary_or_explanation: Object.freeze({
    outputContractRef: 'ms002.grounded_summary_or_explanation',
    requiredProperties: Object.freeze(['summary_or_explanation', 'source_evidence_references', 'limitations_or_unknowns', 'tenant_context']),
    prohibitedProperties: Object.freeze(['employment_action', 'discipline_recommendation', 'production_activation', 'deterministic_override'])
  }),
  grounded_advisory_response: Object.freeze({
    outputContractRef: 'ms002.grounded_advisory_response',
    requiredProperties: Object.freeze(['answer', 'source_evidence_references', 'uncertainty_or_refusal_when_needed', 'tenant_context']),
    prohibitedProperties: Object.freeze(['employment_action', 'discipline_recommendation', 'production_activation', 'deterministic_override'])
  })
});

const SAFETY_BOUNDARY = 'AI explains authoritative TSR evidence only; deterministic TSR systems remain authoritative.';
const STANDARD_BOUNDARY = 'AI presentation is advisory and grounded in supplied TSR evidence only.';
const FAIL_CLOSED_FALLBACK = Object.freeze({
  mode: 'FAIL_CLOSED_DETERMINISTIC_FALLBACK',
  providerFailure: 'RETURN_NON_PRODUCTION_UNAVAILABLE_WITH_AUTHORITATIVE_EVIDENCE',
  hardGateFailure: 'REJECT_MODEL_OUTPUT',
  unselectedProviderOrModel: 'REJECT_REQUEST',
  productionAttempt: 'REJECT_REQUEST'
});

const SELECTED_D2_MODELS = Object.freeze([
  Object.freeze({
    capabilityId: 'customer.account_guidance.presentation',
    executionClass: 'D2',
    provider: 'mistral',
    modelId: 'mistral-small-latest',
    selectionSource: SELECTED_D2_SELECTION_SOURCE,
    selectionCommit: SELECTED_D2_SELECTION_COMMIT,
    selectionStatus: 'FINAL_MODEL_SELECTION_READY',
    productionEnabled: false,
    nonProductionEnabled: true,
    fallbackPolicy: FAIL_CLOSED_FALLBACK,
    authorityBoundary: STANDARD_BOUNDARY,
    outputContract: OUTPUT_CONTRACTS.grounded_summary_or_explanation
  }),
  Object.freeze({
    capabilityId: 'driver.copilot.contextual_response',
    executionClass: 'D2',
    provider: 'mistral',
    modelId: 'mistral-small-2603',
    selectionSource: SELECTED_D2_SELECTION_SOURCE,
    selectionCommit: SELECTED_D2_SELECTION_COMMIT,
    selectionStatus: 'FINAL_MODEL_SELECTION_READY',
    productionEnabled: false,
    nonProductionEnabled: true,
    fallbackPolicy: FAIL_CLOSED_FALLBACK,
    authorityBoundary: SAFETY_BOUNDARY,
    outputContract: OUTPUT_CONTRACTS.grounded_advisory_response
  }),
  Object.freeze({
    capabilityId: 'operations.executive_dashboard_synthesis',
    executionClass: 'D2',
    provider: 'google',
    modelId: 'gemini-3.5-flash',
    selectionSource: SELECTED_D2_SELECTION_SOURCE,
    selectionCommit: SELECTED_D2_SELECTION_COMMIT,
    selectionStatus: 'FINAL_MODEL_SELECTION_READY',
    productionEnabled: false,
    nonProductionEnabled: true,
    fallbackPolicy: FAIL_CLOSED_FALLBACK,
    authorityBoundary: STANDARD_BOUNDARY,
    outputContract: OUTPUT_CONTRACTS.grounded_summary_or_explanation
  }),
  Object.freeze({
    capabilityId: 'platform.legacy_structured_ai_response',
    executionClass: 'D2',
    provider: 'google',
    modelId: 'gemini-3.5-flash-lite',
    selectionSource: SELECTED_D2_SELECTION_SOURCE,
    selectionCommit: SELECTED_D2_SELECTION_COMMIT,
    selectionStatus: 'FINAL_MODEL_SELECTION_READY',
    productionEnabled: false,
    nonProductionEnabled: true,
    fallbackPolicy: FAIL_CLOSED_FALLBACK,
    authorityBoundary: STANDARD_BOUNDARY,
    outputContract: OUTPUT_CONTRACTS.grounded_advisory_response
  }),
  Object.freeze({
    capabilityId: 'route.risk_explanation.presentation',
    executionClass: 'D2',
    provider: 'mistral',
    modelId: 'mistral-medium-3-5',
    selectionSource: SELECTED_D2_SELECTION_SOURCE,
    selectionCommit: SELECTED_D2_SELECTION_COMMIT,
    selectionStatus: 'FINAL_MODEL_SELECTION_READY',
    productionEnabled: false,
    nonProductionEnabled: true,
    fallbackPolicy: FAIL_CLOSED_FALLBACK,
    authorityBoundary: SAFETY_BOUNDARY,
    outputContract: OUTPUT_CONTRACTS.grounded_summary_or_explanation
  }),
  Object.freeze({
    capabilityId: 'safety.narrative_summary.presentation',
    executionClass: 'D2',
    provider: 'google',
    modelId: 'gemini-3.7-flash',
    selectionSource: SELECTED_D2_SELECTION_SOURCE,
    selectionCommit: SELECTED_D2_SELECTION_COMMIT,
    selectionStatus: 'FINAL_MODEL_SELECTION_READY',
    productionEnabled: false,
    nonProductionEnabled: true,
    fallbackPolicy: FAIL_CLOSED_FALLBACK,
    authorityBoundary: SAFETY_BOUNDARY,
    outputContract: OUTPUT_CONTRACTS.grounded_summary_or_explanation
  }),
  Object.freeze({
    capabilityId: 'supervisor.daily_operations_report.narrative',
    executionClass: 'D2',
    provider: 'mistral',
    modelId: 'mistral-small-latest',
    selectionSource: SELECTED_D2_SELECTION_SOURCE,
    selectionCommit: SELECTED_D2_SELECTION_COMMIT,
    selectionStatus: 'FINAL_MODEL_SELECTION_READY',
    productionEnabled: false,
    nonProductionEnabled: true,
    fallbackPolicy: FAIL_CLOSED_FALLBACK,
    authorityBoundary: STANDARD_BOUNDARY,
    outputContract: OUTPUT_CONTRACTS.grounded_summary_or_explanation
  }),
  Object.freeze({
    capabilityId: 'supervisor.freeform_question_answer',
    executionClass: 'D2',
    provider: 'google',
    modelId: 'gemini-3.5-flash',
    selectionSource: SELECTED_D2_SELECTION_SOURCE,
    selectionCommit: SELECTED_D2_SELECTION_COMMIT,
    selectionStatus: 'FINAL_MODEL_SELECTION_READY',
    productionEnabled: false,
    nonProductionEnabled: true,
    fallbackPolicy: FAIL_CLOSED_FALLBACK,
    authorityBoundary: STANDARD_BOUNDARY,
    outputContract: OUTPUT_CONTRACTS.grounded_advisory_response
  }),
  Object.freeze({
    capabilityId: 'warehouse.exception_summary.presentation',
    executionClass: 'D2',
    provider: 'mistral',
    modelId: 'mistral-small-latest',
    selectionSource: SELECTED_D2_SELECTION_SOURCE,
    selectionCommit: SELECTED_D2_SELECTION_COMMIT,
    selectionStatus: 'FINAL_MODEL_SELECTION_READY',
    productionEnabled: false,
    nonProductionEnabled: true,
    fallbackPolicy: FAIL_CLOSED_FALLBACK,
    authorityBoundary: STANDARD_BOUNDARY,
    outputContract: OUTPUT_CONTRACTS.grounded_summary_or_explanation
  })
]);

function listSelectedD2Models() {
  return SELECTED_D2_MODELS.map((item) => Object.freeze({ ...item }));
}

function getSelectedD2Model(capabilityId) {
  return SELECTED_D2_MODELS.find((item) => item.capabilityId === capabilityId) || null;
}

function assertSelectedD2Capability(capabilityId) {
  const selection = getSelectedD2Model(capabilityId);
  if (!selection) {
    throw createError('Capability is not an approved D2 selected-model capability.', 400, 'D2_SELECTED_CAPABILITY_NOT_FOUND', { capabilityId });
  }
  return selection;
}

function assertSelectedProviderModel(capabilityId, provider, modelId) {
  const selection = assertSelectedD2Capability(capabilityId);
  if (String(provider || '').toLowerCase() !== selection.provider || String(modelId || '') !== selection.modelId) {
    throw createError('Requested provider/model is not the locked MS-004 D2 selection.', 400, 'D2_SELECTED_PROVIDER_MODEL_MISMATCH', {
      capabilityId,
      requestedProvider: provider || null,
      requestedModel: modelId || null
    });
  }
  return selection;
}

function validateSelectedD2Registry(registry = SELECTED_D2_MODELS) {
  const errors = [];
  const ids = new Set();
  const expectedDistribution = { google: 4, mistral: 5, openai: 0, anthropic: 0 };
  const distribution = { google: 0, mistral: 0, openai: 0, anthropic: 0 };
  for (const item of registry) {
    if (ids.has(item.capabilityId)) errors.push({ rule: 'DUPLICATE_CAPABILITY', capabilityId: item.capabilityId });
    ids.add(item.capabilityId);
    if (item.executionClass !== 'D2') errors.push({ rule: 'NON_D2_SELECTION', capabilityId: item.capabilityId });
    if (item.selectionSource !== SELECTED_D2_SELECTION_SOURCE || item.selectionCommit !== SELECTED_D2_SELECTION_COMMIT) errors.push({ rule: 'INVALID_SELECTION_SOURCE', capabilityId: item.capabilityId });
    const expectedStatus = 'FINAL_MODEL_SELECTION_READY';
    if (item.selectionStatus !== expectedStatus) errors.push({ rule: 'INVALID_SELECTION_STATUS', capabilityId: item.capabilityId, expected: expectedStatus, actual: item.selectionStatus });
    if (item.productionEnabled !== false || item.nonProductionEnabled !== true) errors.push({ rule: 'INVALID_ACTIVATION_BOUNDARY', capabilityId: item.capabilityId });
    if (item.provider === 'openai' || item.provider === 'anthropic') errors.push({ rule: 'UNSELECTED_PROVIDER_ENABLED', capabilityId: item.capabilityId, provider: item.provider });
    if (!item.outputContract?.requiredProperties?.length) errors.push({ rule: 'MISSING_OUTPUT_CONTRACT', capabilityId: item.capabilityId });
    distribution[item.provider] = (distribution[item.provider] || 0) + 1;
  }
  if (registry.length !== 9) errors.push({ rule: 'D2_SELECTION_COUNT', expected: 9, actual: registry.length });
  for (const [provider, expected] of Object.entries(expectedDistribution)) {
    if ((distribution[provider] || 0) !== expected) errors.push({ rule: 'PROVIDER_DISTRIBUTION', provider, expected, actual: distribution[provider] || 0 });
  }
  return Object.freeze({ valid: errors.length === 0, errors, distribution });
}

module.exports = {
  FAIL_CLOSED_FALLBACK,
  OUTPUT_CONTRACTS,
  SELECTED_D2_EXECUTION_MODE,
  SELECTED_D2_MODELS,
  SELECTED_D2_REGISTRY_SCHEMA_VERSION,
  SELECTED_D2_SELECTION_COMMIT,
  SELECTED_D2_SELECTION_SOURCE,
  assertSelectedD2Capability,
  assertSelectedProviderModel,
  getSelectedD2Model,
  listSelectedD2Models,
  validateSelectedD2Registry
};
