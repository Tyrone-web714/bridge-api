#!/usr/bin/env node
const rbac = require('../services/rbac');
const d2 = require('../services/intelligenceExecution/selectedD2NonProductionExecution');

const args = new Set(process.argv.slice(2));
const argv = process.argv.slice(2);

class SmokeRunnerError extends Error {
  constructor(message, code = 'D2_SELECTED_SMOKE_RUNNER_FAILED') {
    super(message);
    this.name = 'SmokeRunnerError';
    this.code = code;
    this.smokeMessage = message;
  }
}

function fail(message) {
  throw new SmokeRunnerError(message);
}

function validateInvocation() {
  if (!args.has('--owner-executed') || !args.has('--non-production')) {
    fail('Refusing to run without --owner-executed and --non-production.');
  }

  if (process.env.NODE_ENV === 'production') {
    fail('Refusing to run with NODE_ENV=production.');
  }

  const presence = d2.credentialPresence();
  if (!presence.google || !presence.mistral) {
    fail(`Missing required selected-D2 provider credentials: google=${presence.google}, mistral=${presence.mistral}`);
  }
}

const authContext = Object.freeze({
  authenticated: true,
  organizationId: process.env.D2_SELECTED_SMOKE_ORGANIZATION_ID || 'non-production-smoke-org',
  actorId: process.env.D2_SELECTED_SMOKE_ACTOR_ID || 'non-production-smoke-owner',
  approvedRole: rbac.ROLES.SUPERVISOR,
  permissions: rbac.permissionsForRole(rbac.ROLES.SUPERVISOR)
});

const SMOKE_FACTS_BY_CAPABILITY = Object.freeze({
  'customer.account_guidance.presentation': Object.freeze({
    knownFacts: [
      'Account ACME-FROZEN has two active refrigerated delivery orders today.',
      'One delivery is delayed by 18 minutes because deterministic route execution shows an active dock queue.',
      'The account guidance must summarize operational evidence without promising a recovery time.'
    ],
    unknownFacts: ['Customer sentiment and future unloading time are unknown in this non-production fixture.']
  }),
  'driver.copilot.contextual_response': Object.freeze({
    knownFacts: [
      'Driver D-204 is assigned to route R-17 in non-production fixture data.',
      'Deterministic route safety shows a low-clearance restriction remains active on Segment B.',
      'The driver-facing answer must explain the restriction and defer to route safety systems.'
    ],
    unknownFacts: ['The fixture does not include live traffic updates or driver free-text intent.']
  }),
  'operations.executive_dashboard_synthesis': Object.freeze({
    knownFacts: [
      'Operations dashboard evidence shows 42 planned stops, 3 late-risk stops, and 1 warehouse exception.',
      'Deterministic analytics classify the late-risk stops as advisory review items.',
      'The synthesis must cite supplied source evidence and preserve uncertainty.'
    ],
    unknownFacts: ['Financial impact and customer escalation state are not included.']
  }),
  'platform.legacy_structured_ai_response': Object.freeze({
    knownFacts: [
      'Legacy structured AI compatibility requires a JSON advisory response.',
      'The request is non-production and tenant scoped.',
      'The response must not claim production activation or model selection authority.'
    ],
    unknownFacts: ['No production prompt or customer payload is included.']
  }),
  'route.risk_explanation.presentation': Object.freeze({
    knownFacts: [
      'Route R-17 includes a bridge-height warning from deterministic route intelligence.',
      'The current vehicle profile exceeds the advisory clearance threshold.',
      'The explanation must frame the model as advisory and leave all route authority with deterministic Route Intelligence.'
    ],
    unknownFacts: ['No municipal update newer than the fixture timestamp is available.']
  }),
  'safety.narrative_summary.presentation': Object.freeze({
    knownFacts: [
      'Safety Intelligence reports one unresolved inspection warning and one resolved documentation item.',
      'Shared Safety governance marks the unresolved warning as human-review required.',
      'The narrative must summarize supplied safety evidence without creating authorization or changing Safety authority.'
    ],
    unknownFacts: ['The final inspection outcome is not present in the fixture.']
  }),
  'supervisor.daily_operations_report.narrative': Object.freeze({
    knownFacts: [
      'Supervisor report evidence includes 11 completed routes, 2 delayed routes, and 1 pending warehouse release.',
      'No employee performance ranking is present in the authoritative evidence.',
      'The report must summarize operational state without workforce scoring.'
    ],
    unknownFacts: ['Tomorrow forecast and staffing decisions are outside this fixture.']
  }),
  'supervisor.freeform_question_answer': Object.freeze({
    knownFacts: [
      'Supervisor question asks why Route R-17 was delayed.',
      'Authoritative evidence says the delay came from a dock queue and a low-clearance reroute advisory.',
      'The answer must cite source evidence and preserve unknowns.'
    ],
    unknownFacts: ['The exact dock release time is unknown.']
  }),
  'warehouse.exception_summary.presentation': Object.freeze({
    knownFacts: [
      'Warehouse exception W-9 is open for pallet staging mismatch.',
      'Deterministic warehouse readiness marks the load as hold-for-review.',
      'The summary must not release the load or override warehouse readiness.'
    ],
    unknownFacts: ['Corrected pallet scan confirmation is not present.']
  })
});

function evidence(capabilityId) {
  const fixture = SMOKE_FACTS_BY_CAPABILITY[capabilityId];
  if (!fixture) fail(`No smoke fixture exists for selected capability: ${capabilityId}`);
  return {
    organizationId: authContext.organizationId,
    evidenceId: `${capabilityId}.external-smoke`,
    sourceEvidenceReferences: [
      `${capabilityId}.external-smoke.source.1`,
      `${capabilityId}.external-smoke.source.2`
    ],
    knownFacts: fixture.knownFacts,
    unknownFacts: fixture.unknownFacts,
    outputContractReminder: 'Return every required output property exactly as named; include source_evidence_references and tenant_context.'
  };
}

function parseCapabilityFilter(inputArgs = argv) {
  const filters = [];
  for (let i = 0; i < inputArgs.length; i += 1) {
    const arg = inputArgs[i];
    if (arg === '--capability') {
      if (!inputArgs[i + 1]) fail('Missing value for --capability.');
      filters.push(inputArgs[i + 1]);
      i += 1;
    } else if (String(arg).startsWith('--capability=')) {
      filters.push(String(arg).slice('--capability='.length));
    }
  }
  return filters.map((item) => String(item || '').trim()).filter(Boolean);
}

function selectedCapabilities(inputArgs = argv) {
  const selections = d2.listSelectedD2Models();
  const filters = parseCapabilityFilter(inputArgs);
  if (!filters.length) return selections;
  const requested = new Set(filters);
  const filtered = selections.filter((selection) => requested.has(selection.capabilityId));
  const missing = filters.filter((capabilityId) => !filtered.some((selection) => selection.capabilityId === capabilityId));
  if (missing.length) fail(`Unknown selected D2 capability filter: ${missing.join(',')}`);
  return filtered;
}

function requiredFixtureFields(selection) {
  return Object.freeze({
    capabilityId: selection.capabilityId,
    provider: selection.provider,
    model: selection.modelId,
    requiredOutputProperties: selection.outputContract.requiredProperties
  });
}

function validateSmokeFixture(selection, smokeEvidence) {
  const failures = [];
  if (!smokeEvidence || typeof smokeEvidence !== 'object') failures.push('missing_fixture');
  if (smokeEvidence?.organizationId !== authContext.organizationId) failures.push('organization_mismatch');
  if (!smokeEvidence?.evidenceId) failures.push('missing_evidence_id');
  if (!Array.isArray(smokeEvidence?.sourceEvidenceReferences) || smokeEvidence.sourceEvidenceReferences.length < 1) failures.push('missing_source_evidence_references');
  if (!Array.isArray(smokeEvidence?.knownFacts) || smokeEvidence.knownFacts.length < 1) failures.push('missing_known_facts');
  if (!Array.isArray(smokeEvidence?.unknownFacts)) failures.push('missing_unknown_facts');
  if (!selection?.outputContract?.requiredProperties?.length) failures.push('missing_required_output_contract');
  return Object.freeze({
    passed: failures.length === 0,
    failures
  });
}

function classifyFailureCause(selection, error, fixtureCheck) {
  if (!fixtureCheck.passed) return 'SMOKE_FIXTURE_DEFECT';
  if (error?.code !== 'D2_SELECTED_RUNTIME_HARD_GATE_FAILED') return 'UNKNOWN';
  const failures = Array.isArray(error.details) ? error.details : error.details?.failures || [];
  const failedGateIds = failures.map((failure) => String(failure).split(':')[0]);
  const required = selection.outputContract.requiredProperties || [];
  const missingFields = failures
    .filter((failure) => String(failure).startsWith('missing_required_output:'))
    .flatMap((failure) => String(failure).split(':')[1]?.split(',') || [])
    .filter(Boolean);
  if (missingFields.some((field) => required.includes(field))) return 'ACTUAL_SELECTED_MODEL_RUNTIME_GATE_FAILURE';
  if (failedGateIds.includes('missing_source_evidence_references')) return 'ACTUAL_SELECTED_MODEL_RUNTIME_GATE_FAILURE';
  if (failedGateIds.includes('tenant_context_mismatch')) return 'ACTUAL_SELECTED_MODEL_RUNTIME_GATE_FAILURE';
  if (failedGateIds.includes('prohibited_authority_or_workforce_action')) return 'ACTUAL_SELECTED_MODEL_RUNTIME_GATE_FAILURE';
  if (failedGateIds.includes('secret_like_output')) return 'ACTUAL_SELECTED_MODEL_RUNTIME_GATE_FAILURE';
  return 'PROVIDER_RESPONSE_NORMALIZATION_DEFECT';
}

function hasSecretLikeText(value) {
  return /sk-[a-z0-9]{12,}|AIza[0-9A-Za-z_-]{12,}|(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]/i.test(JSON.stringify(value || null));
}

function classifyProviderFailure(error = {}) {
  const status = Number(error.providerStatus || 0);
  const code = String(error.code || '').toLowerCase();
  const message = String(error.message || '').toLowerCase();
  if (status === 429 || /resource_exhausted|quota|rate.?limit/.test(code) || /quota|rate.?limit/.test(message)) return 'QUOTA_OR_RATE_LIMIT';
  if (/billing|credit|payment|account/.test(code) || /billing|credit|payment|account/.test(message)) return 'ACCOUNT_OR_BILLING_BLOCKER';
  if (status === 404 || /not_found|not found|model.*unavailable|endpoint.*unavailable/.test(`${code} ${message}`)) return 'MODEL_OR_ENDPOINT_UNAVAILABLE';
  if (status === 400 || /invalid|bad_request|schema|request/.test(code)) return 'REQUEST_OR_ADAPTER_DEFECT';
  if (error.retryable === true || status >= 500 || /timeout|temporar|unavailable|deadline|overloaded/.test(`${code} ${message}`)) return 'RETRYABLE_TRANSIENT';
  if (status >= 400 || code) return 'NON_RETRYABLE_PROVIDER_FAILURE';
  return 'UNKNOWN';
}

function sanitizeHardGateFailure(selection, error) {
  const details = error?.details || {};
  const failures = Array.isArray(details) ? details : details.failures || [];
  const diagnostics = details.diagnostics || d2.analyzeRuntimeHardGateFailures(failures);
  const smokeEvidence = evidence(selection.capabilityId);
  const fixtureCheck = validateSmokeFixture(selection, smokeEvidence);
  const failureCause = classifyFailureCause(selection, error, fixtureCheck);
  return {
    schemaVersion: 'tsr.selected.d2.nonproduction.smoke.failure.v1',
    errorCode: error?.code || 'UNKNOWN_ERROR',
    capabilityId: selection.capabilityId,
    selectedProvider: selection.provider,
    selectedModel: selection.modelId,
    executionStage: 'runtime_hard_gate_validation',
    failedGateIds: diagnostics.failedGateIds,
    failedGateCategories: diagnostics.failedGateCategories,
    failedSubruleIds: diagnostics.failedSubruleIds || [],
    failedSubruleCategories: diagnostics.failedSubruleCategories || [],
    failedSubrules: diagnostics.failedSubrules || [],
    normalizedFailureReason: diagnostics.normalizedFailureReason || error?.code || 'UNKNOWN_ERROR',
    schemaPass: diagnostics.schemaPass,
    sourceEvidencePass: diagnostics.sourceEvidencePass,
    tenantContextPass: diagnostics.tenantContextPass,
    authorityBoundaryPass: diagnostics.authorityBoundaryPass,
    safetyPass: diagnostics.safetyPass,
    prohibitedOutputPass: diagnostics.prohibitedOutputPass,
    secretLikeOutputPass: diagnostics.secretLikeOutputPass,
    schemaRelated: diagnostics.schemaRelated,
    evidenceRelated: diagnostics.evidenceRelated,
    tenantRelated: diagnostics.tenantRelated,
    authorityRelated: diagnostics.authorityRelated,
    safetyRelated: diagnostics.safetyRelated,
    prohibitedOutputRelated: diagnostics.prohibitedOutputRelated,
    failureCause,
    smokeFixtureInputComplete: fixtureCheck.passed,
    fixtureFailures: fixtureCheck.failures,
    fixtureOrInputConstructionLikelyCause: failureCause === 'SMOKE_FIXTURE_DEFECT',
    requestNormalizationLikelyCause: failureCause === 'PROVIDER_REQUEST_NORMALIZATION_DEFECT',
    responseNormalizationLikelyCause: failureCause === 'PROVIDER_RESPONSE_NORMALIZATION_DEFECT',
    actualModelOutputLikelyCause: failureCause === 'ACTUAL_SELECTED_MODEL_RUNTIME_GATE_FAILURE',
    requiredFixtureFields: requiredFixtureFields(selection),
    rawProviderResponseLogged: false,
    credentialValuesLogged: false,
    diagnosticContainsSecretLikeText: false
  };
}

function sanitizeCorrectiveRetryFailure(selection, error) {
  const details = error?.details || {};
  return {
    schemaVersion: 'tsr.selected.d2.nonproduction.smoke.corrective_retry_failure.v1',
    errorCode: error?.code || 'D2_SELECTED_HARD_GATE_REJECTED_AFTER_CORRECTIVE_RETRY',
    capabilityId: selection.capabilityId,
    selectedProvider: selection.provider,
    selectedModel: selection.modelId,
    executionStage: 'runtime_hard_gate_corrective_retry',
    attemptCount: Number(details.attemptCount || 2),
    correctiveRetryUsed: details.correctiveRetryUsed === true,
    initialFailedGateIds: details.initialFailedGateIds || [],
    finalFailedGateIds: details.finalFailedGateIds || [],
    finalFailedGateCategories: details.finalDiagnostics?.failedGateCategories || [],
    finalFailedSubruleIds: details.finalDiagnostics?.failedSubruleIds || [],
    finalFailedSubruleCategories: details.finalDiagnostics?.failedSubruleCategories || [],
    finalFailedSubrules: details.finalDiagnostics?.failedSubrules || [],
    totalLatencyMs: details.totalLatencyMs || null,
    totalEstimatedCostUsd: details.totalEstimatedCostUsd ?? null,
    attempts: (details.attempts || []).map((attempt) => ({
      attempt: attempt.attempt,
      correctiveRetry: attempt.correctiveRetry === true,
      hardGateResult: attempt.hardGateResult || null,
      failedGateIds: attempt.failedGateIds || [],
      failedSubruleIds: attempt.failedSubruleIds || [],
      failedSubruleCategories: attempt.failedSubruleCategories || [],
      latencyMs: attempt.latencyMs ?? null,
      estimatedCostUsd: attempt.estimatedCostUsd ?? null,
      actualCostUsd: attempt.actualCostUsd ?? null,
      usagePresent: Boolean(attempt.usage)
    })),
    rawProviderResponseLogged: false,
    credentialValuesLogged: false,
    diagnosticContainsSecretLikeText: false
  };
}

function sanitizeProviderFailure(selection, result) {
  const error = Array.isArray(result?.errors) ? result.errors[0] || {} : {};
  return {
    schemaVersion: 'tsr.selected.d2.nonproduction.smoke.provider_failure.v1',
    capabilityId: selection.capabilityId,
    selectedProvider: selection.provider,
    selectedModel: selection.modelId,
    executionStage: 'provider_execution',
    status: result?.status || 'DEGRADED_UNAVAILABLE',
    hardGateResult: result?.runtimeHardGate?.hardGateResult || 'PROVIDER_FAILURE',
    fallbackUsed: result?.fallbackUsed === true,
    providerStatus: error.providerStatus || null,
    providerErrorCode: error.code || null,
    providerErrorCategory: classifyProviderFailure(error),
    retryable: error.retryable === true,
    requestId: error.requestId || null,
    retryCount: Number(result?.retryCount || 0),
    quotaOrRateLimitRelated: classifyProviderFailure(error) === 'QUOTA_OR_RATE_LIMIT',
    rawProviderResponseLogged: false,
    credentialValuesLogged: false,
    diagnosticContainsSecretLikeText: false
  };
}

function logProgress(selection, status, extra = {}) {
  const message = {
    capability: selection.capabilityId,
    provider: selection.provider,
    model: selection.modelId,
    status,
    ...extra
  };
  if (hasSecretLikeText(message)) fail('Refusing to print smoke progress containing secret-like text.');
  const prefix = `[d2-selected-smoke] capability=${selection.capabilityId} provider=${selection.provider} model=${selection.modelId}`;
  if (status === 'starting') console.error(`${prefix} starting`);
  else if (status === 'SUCCEEDED') console.error(`${prefix} status=SUCCEEDED`);
  else if (status === 'DEGRADED_UNAVAILABLE') console.error(`${prefix} status=DEGRADED_UNAVAILABLE hardGateResult=${extra.hardGateResult || 'PROVIDER_FAILURE'} fallbackUsed=${extra.fallbackUsed === true}`);
  else if (status === 'HARD_GATE_FAILED') console.error(`${prefix} status=HARD_GATE_FAILED`);
  else if (status === 'HARD_GATE_REJECTED') console.error(`${prefix} attempt=${extra.attempt || 1} status=HARD_GATE_REJECTED failedGates=${(extra.failedGateIds || []).join(',')}`);
  else if (status === 'CORRECTIVE_RETRY') console.error(`${prefix} attempt=2 reason=CORRECTIVE_RETRY`);
  else if (status === 'HARD_GATE_REJECTED_AFTER_CORRECTIVE_RETRY') console.error(`${prefix} status=HARD_GATE_REJECTED_AFTER_CORRECTIVE_RETRY failedGates=${(extra.failedGateIds || []).join(',')}`);
  else if (status === 'PROVIDER_FAILURE') console.error(`${prefix} status=PROVIDER_FAILURE`);
  else console.error(`[d2-selected-smoke] ${JSON.stringify(message, null, 2)}`);
}

async function main() {
  validateInvocation();
  const results = [];
  for (const selection of selectedCapabilities()) {
    let result;
    try {
      logProgress(selection, 'starting');
      result = await d2.executeSelectedD2NonProduction({
        capabilityId: selection.capabilityId,
        executionMode: d2.SELECTED_D2_EXECUTION_MODE,
        provider: selection.provider,
        modelId: selection.modelId,
        authoritativeEvidence: evidence(selection.capabilityId)
      }, authContext, { budgetCeilingUsd: Number(process.env.D2_SELECTED_SMOKE_BUDGET_CEILING_USD || 2) });
    } catch (error) {
      if (error?.code === 'D2_SELECTED_RUNTIME_HARD_GATE_FAILED') {
        const diagnostic = sanitizeHardGateFailure(selection, error);
        if (hasSecretLikeText(diagnostic)) fail('Refusing to print smoke diagnostic containing secret-like text.');
        console.error(`[d2-selected-smoke] ${JSON.stringify(diagnostic, null, 2)}`);
        logProgress(selection, 'HARD_GATE_FAILED');
      } else if (error?.code === 'D2_SELECTED_HARD_GATE_REJECTED_AFTER_CORRECTIVE_RETRY') {
        const diagnostic = sanitizeCorrectiveRetryFailure(selection, error);
        if (hasSecretLikeText(diagnostic)) fail('Refusing to print corrective retry diagnostic containing secret-like text.');
        console.error(`[d2-selected-smoke] ${JSON.stringify(diagnostic, null, 2)}`);
        for (const attempt of diagnostic.attempts) {
          if (attempt.attempt === 1) logProgress(selection, 'HARD_GATE_REJECTED', { attempt: 1, failedGateIds: attempt.failedGateIds });
          if (attempt.attempt === 2) logProgress(selection, 'CORRECTIVE_RETRY');
        }
        logProgress(selection, 'HARD_GATE_REJECTED_AFTER_CORRECTIVE_RETRY', { failedGateIds: diagnostic.finalFailedGateIds });
      }
      throw error;
    }
    if (result.correctiveRetryUsed === true) {
      for (const attempt of result.attemptMetadata || []) {
        if (attempt.attempt === 1 && attempt.hardGateResult === 'RUN_FAIL_HARD_GATE') {
          logProgress(selection, 'HARD_GATE_REJECTED', { attempt: 1, failedGateIds: attempt.failedGateIds });
        }
        if (attempt.attempt === 2 && attempt.correctiveRetry === true) logProgress(selection, 'CORRECTIVE_RETRY');
      }
    }
    if (result.status === 'SUCCEEDED' && result.runtimeHardGate?.hardGateResult === 'PASS') {
      logProgress(selection, 'SUCCEEDED');
    } else if (result.runtimeHardGate?.hardGateResult === 'PROVIDER_FAILURE') {
      const diagnostic = sanitizeProviderFailure(selection, result);
      if (hasSecretLikeText(diagnostic)) fail('Refusing to print provider diagnostic containing secret-like text.');
      console.error(`[d2-selected-smoke] ${JSON.stringify(diagnostic, null, 2)}`);
      logProgress(selection, 'DEGRADED_UNAVAILABLE', {
        hardGateResult: result.runtimeHardGate.hardGateResult,
        fallbackUsed: result.fallbackUsed
      });
    } else {
      logProgress(selection, result.status || 'UNKNOWN', {
        hardGateResult: result.runtimeHardGate?.hardGateResult || null,
        fallbackUsed: result.fallbackUsed
      });
    }
    results.push({
      capabilityId: result.capabilityId,
      provider: result.provider,
      model: result.model,
      status: result.status,
      hardGateResult: result.runtimeHardGate?.hardGateResult || null,
      fallbackUsed: result.fallbackUsed,
      latencyMs: result.latencyMs,
      estimatedCostUsd: result.estimatedCostUsd,
      actualCostUsd: result.actualCostUsd,
      attemptCount: result.attemptCount || 1,
      correctiveRetryUsed: result.correctiveRetryUsed === true,
      initialFailedGateIds: result.initialFailedGateIds || [],
      totalLatencyMs: result.totalLatencyMs ?? result.latencyMs,
      totalEstimatedCostUsd: result.totalEstimatedCostUsd ?? result.estimatedCostUsd
    });
  }
  console.log(JSON.stringify({
    schemaVersion: 'tsr.selected.d2.nonproduction.external-smoke.v1',
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    productionRoutingEnabled: false,
    hostedCallsExecutedByOwner: true,
    credentialValuesLogged: false,
    results
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[d2-selected-smoke] ${error.smokeMessage || error.code || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  SMOKE_FACTS_BY_CAPABILITY,
  SmokeRunnerError,
  evidence,
  classifyFailureCause,
  classifyProviderFailure,
  hasSecretLikeText,
  logProgress,
  parseCapabilityFilter,
  requiredFixtureFields,
  selectedCapabilities,
  sanitizeCorrectiveRetryFailure,
  sanitizeProviderFailure,
  validateInvocation,
  validateSmokeFixture,
  sanitizeHardGateFailure
};
