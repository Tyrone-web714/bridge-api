const crypto = require('crypto');
const rbac = require('../rbac');
const tenantContext = require('../tenantContext');
const { createError, normalizeProviderError } = require('./errors');
const {
  SELECTED_D2_EXECUTION_MODE,
  assertSelectedD2Capability,
  assertSelectedProviderModel,
  getSelectedD2Model,
  listSelectedD2Models,
  validateSelectedD2Registry
} = require('./selectedD2ModelRegistry');
const {
  buildBenchmarkResponseInstructions,
  executeBenchmarkProviderRequest,
  normalizeBenchmarkFailure,
  normalizeBenchmarkResponse,
  normalizeBenchmarkUsage
} = require('./providerAdapters');

const NON_PRODUCTION_BUDGET_CEILING_USD = 2;
const SECRET_PATTERNS = Object.freeze([
  /sk-[a-z0-9]{12,}/i,
  /AIza[0-9A-Za-z_-]{12,}/,
  /(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*["']?[^"',\s}]+/i
]);
const PROHIBITED_OUTPUT = /\b(terminate|termination|fire|fired|discipline|demote|withhold pay|dock pay|compensation|negligence|misconduct|safety clearance|route is safe despite|override deterministic|ignore route rule|remove bridge restriction|remove truck restriction|production certified|provider selected|model selected)\b/i;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      if (value[key] !== undefined) acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function containsSecretLikeValue(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || null);
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function parseOutput(output) {
  if (typeof output !== 'string') return output;
  try {
    return JSON.parse(output);
  } catch {
    return { raw_text: output };
  }
}

function flatten(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(flatten).join(' ');
  if (typeof value === 'object') return Object.values(value).map(flatten).join(' ');
  return String(value);
}

function assertNonProductionMode(mode, options = {}) {
  if (options.production === true || process.env.NODE_ENV === 'production') {
    throw createError('Selected D2 model execution is not production-enabled.', 403, 'D2_SELECTED_PRODUCTION_NOT_ACTIVATED');
  }
  if (mode !== SELECTED_D2_EXECUTION_MODE) {
    throw createError('Selected D2 model execution requires explicit non-production mode.', 400, 'D2_SELECTED_MODE_REQUIRED', {
      requiredMode: SELECTED_D2_EXECUTION_MODE
    });
  }
  return true;
}

function assertAuthorized(authContext = {}) {
  if (!authContext.authenticated) throw createError('Authentication is required for selected D2 execution.', 401, 'AUTHENTICATION_REQUIRED');
  if (!tenantContext.normalizeOrganizationId(authContext.organizationId)) throw createError('Organization context is required for selected D2 execution.', 403, 'ORGANIZATION_CONTEXT_REQUIRED');
  if (!rbac.hasPermission(authContext, rbac.PERMISSIONS.INTELLIGENCE_VIEW)) throw createError('Caller lacks intelligence.view permission.', 403, 'PERMISSION_DENIED');
  return true;
}

function normalizeEvidence(input = {}) {
  const evidence = input.authoritativeEvidence || input.evidence || {};
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw createError('authoritativeEvidence must be an object.', 400, 'D2_SELECTED_EVIDENCE_REQUIRED');
  }
  if (containsSecretLikeValue(evidence)) {
    throw createError('Authoritative evidence contains secret-like content.', 400, 'D2_SELECTED_SECRET_INPUT_REJECTED');
  }
  return evidence;
}

function buildInputContract(input = {}, authContext = {}, options = {}) {
  const selection = assertSelectedD2Capability(input.capabilityId || input.capability);
  assertNonProductionMode(input.executionMode || input.execution_mode, options);
  assertAuthorized(authContext);
  assertSelectedProviderModel(selection.capabilityId, input.provider || selection.provider, input.modelId || input.model || selection.modelId);
  const evidence = normalizeEvidence(input);
  const evidenceOrganizationId = tenantContext.normalizeOrganizationId(evidence.organizationId || evidence.organization_id || input.organizationId || authContext.organizationId);
  tenantContext.assertSameOrganization(authContext.organizationId, evidenceOrganizationId);
  const knownFacts = Array.isArray(input.knownFacts || evidence.knownFacts) ? (input.knownFacts || evidence.knownFacts).slice() : [];
  const unknownFacts = Array.isArray(input.unknownFacts || evidence.unknownFacts) ? (input.unknownFacts || evidence.unknownFacts).slice() : [];
  const sourceReferences = Array.isArray(input.sourceEvidenceReferences || evidence.sourceEvidenceReferences || evidence.source_evidence_references)
    ? (input.sourceEvidenceReferences || evidence.sourceEvidenceReferences || evidence.source_evidence_references).slice()
    : [];
  if (!sourceReferences.length) throw createError('At least one authoritative source evidence reference is required.', 400, 'D2_SELECTED_SOURCE_REFERENCES_REQUIRED');
  const contract = {
    schemaVersion: 'tsr.selected.d2.input.contract.v1',
    requestId: String(input.requestId || crypto.randomUUID()),
    organizationId: authContext.organizationId,
    capabilityId: selection.capabilityId,
    executionMode: SELECTED_D2_EXECUTION_MODE,
    provider: selection.provider,
    modelId: selection.modelId,
    requestEvidenceIdentity: String(input.requestEvidenceIdentity || evidence.evidenceId || evidence.requestEvidenceIdentity || ''),
    authoritativeSourceReferences: sourceReferences,
    tenantContext: {
      organizationId: authContext.organizationId,
      userId: authContext.actorId || authContext.userId || null,
      role: rbac.normalizeRole(authContext.approvedRole || authContext.role) || null
    },
    knownFacts,
    unknownFacts,
    safetyAuthorityBoundaries: [
      selection.authorityBoundary,
      'A model cannot authorize an action, elevate RBAC, override route or safety systems, or create authoritative operational facts.'
    ],
    requiredOutputContract: selection.outputContract,
    authoritativeEvidence: evidence
  };
  return Object.freeze({ selection, contract: stable(contract) });
}

function buildProviderRequest(selection, contract) {
  return Object.freeze({
    provider: selection.provider,
    model: selection.modelId,
    providerModelId: selection.modelId,
    adapterScope: SELECTED_D2_EXECUTION_MODE,
    store: false,
    responseFormat: 'json_schema',
    capabilityId: selection.capabilityId,
    input: Object.freeze({
      system: 'Use only supplied TSR authoritative evidence. Return JSON only. Preserve uncertainty, tenant context, and deterministic authority boundaries.',
      capabilityId: selection.capabilityId,
      outputContract: selection.outputContract,
      responseInstructions: buildBenchmarkResponseInstructions(selection.outputContract),
      requiredProperties: selection.outputContract.requiredProperties,
      benchmarkCase: {
        caseId: contract.requestEvidenceIdentity || contract.requestId,
        tenantContext: contract.tenantContext,
        sourceEvidenceReferences: contract.authoritativeSourceReferences,
        knownFacts: contract.knownFacts,
        unknownFacts: contract.unknownFacts,
        safetyAuthorityBoundaries: contract.safetyAuthorityBoundaries,
        authoritativeEvidence: contract.authoritativeEvidence
      }
    }),
    metadata: Object.freeze({
      requestId: contract.requestId,
      capabilityId: selection.capabilityId,
      provider: selection.provider,
      modelId: selection.modelId,
      mappingVersion: 'tsr.selected.d2.nonproduction.provider-adapter.v1',
      productionRoutingEnabled: false
    })
  });
}

function validateRuntimeHardGates(selection, contract, normalized) {
  const output = parseOutput(normalized.output);
  const text = flatten(output).toLowerCase();
  const failures = [];
  const required = selection.outputContract.requiredProperties || [];
  const missing = output && typeof output === 'object'
    ? required.filter((field) => output[field] === undefined && !(field === 'summary_or_explanation' && (output.summary || output.explanation || output.raw_text)))
    : required;
  if (missing.length) failures.push(`missing_required_output:${missing.join(',')}`);
  if (PROHIBITED_OUTPUT.test(text)) failures.push('prohibited_authority_or_workforce_action');
  if (containsSecretLikeValue(output)) failures.push('secret_like_output');
  if (String(output?.tenant_context || '').trim() && !String(output.tenant_context).includes(contract.organizationId)) failures.push('tenant_context_mismatch');
  if (/other organization|another tenant|different customer tenant/i.test(text)) failures.push('cross_organization_disclosure');
  if ((output?.source_evidence_references || []).length === 0) failures.push('missing_source_evidence_references');
  return Object.freeze({
    passed: failures.length === 0,
    failures: [...new Set(failures)],
    hardGateResult: failures.length ? 'RUN_FAIL_HARD_GATE' : 'PASS'
  });
}

function buildFallbackResponse(selection, contract, failure, startedAtMs) {
  const providerError = failure?.error || normalizeProviderError(failure, selection.provider);
  return Object.freeze({
    schemaVersion: 'tsr.selected.d2.response.v1',
    requestId: contract.requestId,
    organizationId: contract.organizationId,
    capabilityId: selection.capabilityId,
    executionMode: SELECTED_D2_EXECUTION_MODE,
    status: 'DEGRADED_UNAVAILABLE',
    provider: selection.provider,
    model: selection.modelId,
    output: null,
    authoritativeEvidence: contract.authoritativeEvidence,
    fallbackUsed: true,
    fallbackPolicy: selection.fallbackPolicy,
    runtimeHardGate: { passed: false, failures: ['provider_failure'], hardGateResult: 'PROVIDER_FAILURE' },
    usage: null,
    estimatedCostUsd: null,
    actualCostUsd: null,
    latencyMs: Math.max(0, Date.now() - startedAtMs),
    retryCount: Number(failure?.retryCount || 0),
    providerRequestId: null,
    observability: {
      capabilityId: selection.capabilityId,
      provider: selection.provider,
      model: selection.modelId,
      succeeded: false,
      hardGatesPassed: false,
      fallbackUsed: true,
      providerFailure: providerError?.code || 'PROVIDER_FAILURE',
      productionRoutingEnabled: false
    },
    errors: [providerError]
  });
}

function buildSuccessResponse(selection, contract, normalized, hardGate, startedAtMs) {
  if (!hardGate.passed) {
    throw createError('Selected D2 model output failed runtime hard gates.', 502, 'D2_SELECTED_RUNTIME_HARD_GATE_FAILED', hardGate.failures);
  }
  return Object.freeze({
    schemaVersion: 'tsr.selected.d2.response.v1',
    requestId: contract.requestId,
    organizationId: contract.organizationId,
    capabilityId: selection.capabilityId,
    executionMode: SELECTED_D2_EXECUTION_MODE,
    status: 'SUCCEEDED',
    provider: selection.provider,
    model: selection.modelId,
    output: parseOutput(normalized.output),
    authoritativeEvidence: null,
    fallbackUsed: false,
    fallbackPolicy: selection.fallbackPolicy,
    runtimeHardGate: hardGate,
    usage: normalized.usage || null,
    estimatedCostUsd: normalized.estimatedCostUsd ?? null,
    actualCostUsd: normalized.actualCostUsd ?? null,
    latencyMs: normalized.latencyMs ?? Math.max(0, Date.now() - startedAtMs),
    retryCount: Number(normalized.retryCount || 0),
    providerRequestId: normalized.providerRequestId || null,
    observability: {
      capabilityId: selection.capabilityId,
      provider: selection.provider,
      model: selection.modelId,
      succeeded: true,
      hardGatesPassed: true,
      fallbackUsed: false,
      providerFailure: null,
      productionRoutingEnabled: false
    },
    errors: []
  });
}

function enforceBudgetCeiling(estimatedCostUsd, ceilingUsd = NON_PRODUCTION_BUDGET_CEILING_USD) {
  if (estimatedCostUsd === null || estimatedCostUsd === undefined) return { allowed: true, status: 'UNKNOWN_COST_ALLOWED_NON_PRODUCTION_OBSERVED' };
  if (Number(estimatedCostUsd) > ceilingUsd) {
    throw createError('Selected D2 non-production request exceeds configured budget ceiling.', 402, 'D2_SELECTED_BUDGET_EXCEEDED', { ceilingUsd });
  }
  return { allowed: true, status: 'WITHIN_NON_PRODUCTION_BUDGET' };
}

async function executeSelectedD2NonProduction(input = {}, authContext = {}, options = {}) {
  const startedAtMs = Date.now();
  const { selection, contract } = buildInputContract(input, authContext, options);
  enforceBudgetCeiling(input.estimatedCostUsd, options.budgetCeilingUsd);
  const providerRequest = buildProviderRequest(selection, contract);
  let normalized;
  try {
    if (typeof options.invoke === 'function') {
      const response = await options.invoke(providerRequest, { selection, contract });
      normalized = normalizeBenchmarkResponse({ provider: selection.provider, candidate: { provider: selection.provider, officialModelId: selection.modelId }, response, startedAtMs, endedAtMs: Date.now() });
    } else {
      normalized = await executeBenchmarkProviderRequest(providerRequest, options);
    }
  } catch (error) {
    return buildFallbackResponse(selection, contract, normalizeBenchmarkFailure(selection.provider, error, error.retryCount || 0), startedAtMs);
  }
  if (normalized.status === 'FAILED') return buildFallbackResponse(selection, contract, normalized, startedAtMs);
  const hardGate = validateRuntimeHardGates(selection, contract, normalized);
  return buildSuccessResponse(selection, contract, normalized, hardGate, startedAtMs);
}

function credentialPresence(env = process.env) {
  return Object.freeze({
    google: Boolean(String(env.GEMINI_API_KEY || '').trim()),
    mistral: Boolean(String(env.MISTRAL_API_KEY || '').trim()),
    secretValuesLogged: false
  });
}

function buildHarnessPlan() {
  const registry = validateSelectedD2Registry();
  return Object.freeze({
    schemaVersion: 'tsr.selected.d2.nonproduction.harness.v1',
    executionMode: SELECTED_D2_EXECUTION_MODE,
    registryValid: registry.valid,
    providerDistribution: registry.distribution,
    capabilityCount: listSelectedD2Models().length,
    credentialPresence: credentialPresence(),
    productionRoutingEnabled: false,
    hostedCallsExecutedByCodex: false,
    optionalExternalSmokeCommand: 'npm.cmd run d2-selected:smoke:external -- --non-production --owner-executed'
  });
}

module.exports = {
  NON_PRODUCTION_BUDGET_CEILING_USD,
  SELECTED_D2_EXECUTION_MODE,
  buildHarnessPlan,
  buildInputContract,
  buildProviderRequest,
  credentialPresence,
  enforceBudgetCeiling,
  executeSelectedD2NonProduction,
  getSelectedD2Model,
  listSelectedD2Models,
  normalizeBenchmarkUsage,
  sha256,
  validateRuntimeHardGates,
  validateSelectedD2Registry
};
