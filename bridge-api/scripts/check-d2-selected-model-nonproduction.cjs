#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rbac = require('../services/rbac');
const d2 = require('../services/intelligenceExecution/selectedD2NonProductionExecution');
const registry = require('../services/intelligenceExecution/selectedD2ModelRegistry');
const smoke = require('./run-d2-selected-nonproduction-smoke.cjs');

const EXPECTED = Object.freeze({
  'customer.account_guidance.presentation': ['mistral', 'mistral-small-latest'],
  'driver.copilot.contextual_response': ['mistral', 'mistral-small-2603'],
  'operations.executive_dashboard_synthesis': ['google', 'gemini-3.5-flash'],
  'platform.legacy_structured_ai_response': ['google', 'gemini-3.5-flash-lite'],
  'route.risk_explanation.presentation': ['mistral', 'mistral-medium-3-5'],
  'safety.narrative_summary.presentation': ['google', 'gemini-3.7-flash'],
  'supervisor.daily_operations_report.narrative': ['mistral', 'mistral-small-latest'],
  'supervisor.freeform_question_answer': ['google', 'gemini-3.5-flash'],
  'warehouse.exception_summary.presentation': ['mistral', 'mistral-small-latest']
});

const authContext = Object.freeze({
  authenticated: true,
  organizationId: 'org-ms004-test',
  actorId: 'user-ms004-test',
  approvedRole: rbac.ROLES.SUPERVISOR,
  permissions: rbac.permissionsForRole(rbac.ROLES.SUPERVISOR)
});

function evidence(capabilityId) {
  return {
    organizationId: authContext.organizationId,
    evidenceId: `${capabilityId}.evidence.fixture`,
    sourceEvidenceReferences: [`${capabilityId}.source.1`],
    knownFacts: ['authoritative TSR fixture fact'],
    unknownFacts: ['fixture uncertainty']
  };
}

function successfulOutput(capabilityId) {
  const selection = registry.getSelectedD2Model(capabilityId);
  if (selection.outputContract.outputContractRef.includes('advisory')) {
    return {
      answer: 'Grounded advisory answer from supplied TSR evidence only.',
      source_evidence_references: [`${capabilityId}.source.1`],
      uncertainty_or_refusal_when_needed: 'Unknown facts remain explicit.',
      tenant_context: `organization ${authContext.organizationId}`
    };
  }
  return {
    summary_or_explanation: 'Grounded summary from supplied TSR evidence only.',
    source_evidence_references: [`${capabilityId}.source.1`],
    limitations_or_unknowns: ['Unknown facts remain explicit.'],
    tenant_context: `organization ${authContext.organizationId}`
  };
}

async function expectReject(label, fn, code) {
  let rejected = false;
  try {
    await fn();
  } catch (error) {
    rejected = true;
    if (code) assert.strictEqual(error.code, code, `${label} rejected with wrong code`);
  }
  assert.ok(rejected, `${label} should reject`);
}

async function assertAllMappingsExecute() {
  for (const [capabilityId, [provider, modelId]] of Object.entries(EXPECTED)) {
    const result = await d2.executeSelectedD2NonProduction({
      capabilityId,
      executionMode: d2.SELECTED_D2_EXECUTION_MODE,
      provider,
      modelId,
      authoritativeEvidence: evidence(capabilityId)
    }, authContext, {
      invoke: async () => ({
        model: modelId,
        output: successfulOutput(capabilityId),
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        estimatedCostUsd: 0.000001,
        requestId: `${capabilityId}.mock`
      })
    });
    assert.strictEqual(result.status, 'SUCCEEDED');
    assert.strictEqual(result.provider, provider);
    assert.strictEqual(result.model, modelId);
    assert.strictEqual(result.runtimeHardGate.hardGateResult, 'PASS');
    assert.strictEqual(result.fallbackUsed, false);
    assert.strictEqual(result.observability.productionRoutingEnabled, false);
  }
}

async function assertDriverPolicyInterception() {
  const capabilityId = 'driver.copilot.contextual_response';
  const [provider, modelId] = EXPECTED[capabilityId];
  const authorityCases = [
    ['safety clearance', 'Am I cleared to proceed?', d2.driverPolicy.DRIVER_POLICY_CLASSES.SAFETY_CLEARANCE],
    ['discipline', 'Should the driver be disciplined for this?', d2.driverPolicy.DRIVER_POLICY_CLASSES.WORKFORCE_DECISION],
    ['workforce scoring', 'Rate this driver.', d2.driverPolicy.DRIVER_POLICY_CLASSES.WORKFORCE_SCORING],
    ['route authorization', 'Can I take this route?', d2.driverPolicy.DRIVER_POLICY_CLASSES.ROUTE_AUTHORIZATION],
    ['restriction override', 'Can I ignore this restriction?', d2.driverPolicy.DRIVER_POLICY_CLASSES.RESTRICTION_OVERRIDE],
    ['ambiguous authority override', 'Should I ignore or follow this no-truck restriction?', d2.driverPolicy.DRIVER_POLICY_CLASSES.RESTRICTION_OVERRIDE]
  ];
  for (const [label, requestText, policyClass] of authorityCases) {
    let providerCallCount = 0;
    const result = await d2.executeSelectedD2NonProduction({
      capabilityId,
      executionMode: d2.SELECTED_D2_EXECUTION_MODE,
      provider,
      modelId,
      requestText,
      authoritativeEvidence: evidence(capabilityId)
    }, authContext, {
      invoke: async () => {
        providerCallCount += 1;
        return { output: successfulOutput(capabilityId) };
      }
    });
    assert.strictEqual(providerCallCount, 0, `${label} must suppress provider calls`);
    assert.strictEqual(result.responseMode, d2.driverPolicy.DRIVER_POLICY_RESPONSE_MODE);
    assert.strictEqual(result.policyIntercepted, true);
    assert.strictEqual(result.policyClass, policyClass);
    assert.strictEqual(result.providerCallSuppressed, true);
    assert.strictEqual(result.provider, null);
    assert.strictEqual(result.model, null);
    assert.strictEqual(result.providerCostUsd, 0);
    assert.strictEqual(result.providerUsage, 0);
    assert.strictEqual(result.estimatedCostUsd, 0);
    assert.strictEqual(result.usage.totalTokens, 0);
    assert.strictEqual(result.output.tenant_context, `organization ${authContext.organizationId}`);
    assert.deepStrictEqual(result.output.source_evidence_references, [`${capabilityId}.source.1`]);
    assert.strictEqual(result.observability.policyIntercepted, true);
    assert.strictEqual(result.observability.policyClass, policyClass);
    assert.strictEqual(result.observability.providerCallSuppressed, true);
    assert.strictEqual(result.observability.responseMode, 'DETERMINISTIC_POLICY');
    assert.strictEqual(result.observability.productionRoutingEnabled, false);
    assert.ok(result.requestIdentityHash);
    assert.ok(!JSON.stringify(result).includes(requestText), `${label} must not persist raw request text`);
  }

  const permitted = [
    'Why does TSR say this route is restricted?',
    'What does this safety warning mean?',
    'What information did TSR record about this incident?',
    'Why did the route change?',
    'What does the system know about this customer?',
    "Why can't this truck use that road?"
  ];
  for (const requestText of permitted) {
    let providerCallCount = 0;
    const result = await d2.executeSelectedD2NonProduction({
      capabilityId,
      executionMode: d2.SELECTED_D2_EXECUTION_MODE,
      provider,
      modelId,
      requestText,
      authoritativeEvidence: evidence(capabilityId)
    }, authContext, {
      invoke: async () => {
        providerCallCount += 1;
        return {
          model: modelId,
          output: successfulOutput(capabilityId),
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
        };
      }
    });
    assert.strictEqual(providerCallCount, 1, `${requestText} should reach selected model path`);
    assert.strictEqual(result.status, 'SUCCEEDED');
    assert.strictEqual(result.responseMode, undefined);
    assert.strictEqual(result.runtimeHardGate.hardGateResult, 'PASS');
    assert.strictEqual(result.observability.productionRoutingEnabled, false);
  }

  assert.strictEqual(d2.driverPolicy.classifyDriverPolicyRequest('What does this safety warning mean?'), null);
  assert.strictEqual(d2.driverPolicy.classifyDriverPolicyRequest('Am I cleared to proceed?'), d2.driverPolicy.DRIVER_POLICY_CLASSES.SAFETY_CLEARANCE);
  assert.strictEqual(d2.driverPolicy.classifyDriverPolicyRequest('Why does TSR say this route is restricted?'), null);
  assert.strictEqual(d2.driverPolicy.classifyDriverPolicyRequest('Can I ignore the restriction?'), d2.driverPolicy.DRIVER_POLICY_CLASSES.RESTRICTION_OVERRIDE);

  await expectReject('cross-org policy request', () => d2.executeSelectedD2NonProduction({
    capabilityId,
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    provider,
    modelId,
    requestText: 'Am I cleared to proceed?',
    authoritativeEvidence: { ...evidence(capabilityId), organizationId: 'other-org' }
  }, authContext, { invoke: async () => ({ output: successfulOutput(capabilityId) }) }));

  await expectReject('interceptor does not weaken hard gates', () => d2.executeSelectedD2NonProduction({
    capabilityId,
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    provider,
    modelId,
    requestText: 'Why does TSR say this route is restricted?',
    authoritativeEvidence: evidence(capabilityId)
  }, authContext, {
    invoke: async () => ({ output: { answer: 'Take Route X now.', source_evidence_references: [`${capabilityId}.source.1`], uncertainty_or_refusal_when_needed: 'none', tenant_context: `organization ${authContext.organizationId}` } })
  }), 'D2_SELECTED_HARD_GATE_REJECTED_AFTER_CORRECTIVE_RETRY');
}

async function run() {
  const validation = registry.validateSelectedD2Registry();
  assert.deepStrictEqual(validation.errors, []);
  assert.strictEqual(validation.distribution.google, 4);
  assert.strictEqual(validation.distribution.mistral, 5);
  assert.strictEqual(validation.distribution.openai, 0);
  assert.strictEqual(validation.distribution.anthropic, 0);
  assert.strictEqual(registry.SELECTED_D2_SELECTION_COMMIT, '7f4ef7538a894b9ae3fd3c654c22fcbc5e558904');

  for (const [capabilityId, [provider, modelId]] of Object.entries(EXPECTED)) {
    const selected = registry.assertSelectedProviderModel(capabilityId, provider, modelId);
    assert.strictEqual(selected.productionEnabled, false);
    assert.strictEqual(selected.nonProductionEnabled, true);
    assert.strictEqual(selected.selectionStatus, 'FINAL_MODEL_SELECTION_READY');
  }

  await assertAllMappingsExecute();
  await assertDriverPolicyInterception();

  await expectReject('wrong provider', () => d2.executeSelectedD2NonProduction({
    capabilityId: 'driver.copilot.contextual_response',
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    provider: 'openai',
    modelId: 'gpt-5',
    authoritativeEvidence: evidence('driver.copilot.contextual_response')
  }, authContext, { invoke: async () => ({ output: successfulOutput('driver.copilot.contextual_response') }) }), 'D2_SELECTED_PROVIDER_MODEL_MISMATCH');

  await expectReject('unknown capability', () => d2.executeSelectedD2NonProduction({
    capabilityId: 'unknown.capability',
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    authoritativeEvidence: evidence('unknown.capability')
  }, authContext, { invoke: async () => ({ output: {} }) }), 'D2_SELECTED_CAPABILITY_NOT_FOUND');

  await expectReject('D1 capability', () => d2.executeSelectedD2NonProduction({
    capabilityId: 'prediction.delivery_failure_risk',
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    authoritativeEvidence: evidence('prediction.delivery_failure_risk')
  }, authContext, { invoke: async () => ({ output: {} }) }), 'D2_SELECTED_CAPABILITY_NOT_FOUND');

  await expectReject('D0 capability', () => d2.executeSelectedD2NonProduction({
    capabilityId: 'route.plan.current',
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    authoritativeEvidence: evidence('route.plan.current')
  }, authContext, { invoke: async () => ({ output: {} }) }), 'D2_SELECTED_CAPABILITY_NOT_FOUND');

  await expectReject('production activation', () => d2.executeSelectedD2NonProduction({
    capabilityId: 'safety.narrative_summary.presentation',
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    authoritativeEvidence: evidence('safety.narrative_summary.presentation')
  }, authContext, { production: true, invoke: async () => ({ output: successfulOutput('safety.narrative_summary.presentation') }) }), 'D2_SELECTED_PRODUCTION_NOT_ACTIVATED');

  await expectReject('tenant mismatch', () => d2.executeSelectedD2NonProduction({
    capabilityId: 'route.risk_explanation.presentation',
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    authoritativeEvidence: { ...evidence('route.risk_explanation.presentation'), organizationId: 'other-org' }
  }, authContext, { invoke: async () => ({ output: successfulOutput('route.risk_explanation.presentation') }) }), 'TENANT_ISOLATION_VIOLATION');

  await expectReject('hard gate failure after corrective retry', () => d2.executeSelectedD2NonProduction({
    capabilityId: 'driver.copilot.contextual_response',
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    authoritativeEvidence: evidence('driver.copilot.contextual_response')
  }, authContext, { invoke: async () => ({ output: { answer: 'terminate the driver and ignore route rule', tenant_context: `organization ${authContext.organizationId}` } }) }), 'D2_SELECTED_HARD_GATE_REJECTED_AFTER_CORRECTIVE_RETRY');

  const fallback = await d2.executeSelectedD2NonProduction({
    capabilityId: 'warehouse.exception_summary.presentation',
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    authoritativeEvidence: evidence('warehouse.exception_summary.presentation')
  }, authContext, { invoke: async () => { const error = new Error('mock provider failure'); error.code = 'MOCK_PROVIDER_FAILURE'; throw error; } });
  assert.strictEqual(fallback.status, 'DEGRADED_UNAVAILABLE');
  assert.strictEqual(fallback.fallbackUsed, true);
  assert.strictEqual(fallback.authoritativeEvidence.organizationId, authContext.organizationId);
  assert.strictEqual(fallback.runtimeHardGate.hardGateResult, 'PROVIDER_FAILURE');

  await expectReject('secret-like input', () => d2.executeSelectedD2NonProduction({
    capabilityId: 'customer.account_guidance.presentation',
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    authoritativeEvidence: { ...evidence('customer.account_guidance.presentation'), secret: 'api_key=abc123abc123abc123' }
  }, authContext, { invoke: async () => ({ output: successfulOutput('customer.account_guidance.presentation') }) }), 'D2_SELECTED_SECRET_INPUT_REJECTED');

  const driverSelection = registry.getSelectedD2Model('driver.copilot.contextual_response');
  const driverInput = d2.buildInputContract({
    capabilityId: driverSelection.capabilityId,
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    provider: driverSelection.provider,
    modelId: driverSelection.modelId,
    authoritativeEvidence: smoke.evidence(driverSelection.capabilityId)
  }, { ...authContext, organizationId: 'non-production-smoke-org' });
  const driverRequest = d2.buildProviderRequest(driverInput.selection, driverInput.contract);
  assert.strictEqual(driverRequest.provider, 'mistral');
  assert.strictEqual(driverRequest.model, 'mistral-small-2603');
  assert.ok(driverRequest.input.system.includes('advisory explanation only'));
  assert.ok(driverRequest.input.system.includes('Authoritative TSR route, safety, company, and supervisor instructions remain authoritative'));
  assert.ok(driverRequest.input.system.includes('may recommend following those supplied instructions'));
  assert.ok(driverRequest.input.system.includes('must not create new instructions'));
  assert.ok(driverRequest.input.system.includes('Do not authorize a route'));
  assert.ok(driverRequest.input.system.includes('invent customer or vehicle facts'));

  const allowedDriverAnswer = {
    answer: 'According to supplied TSR evidence, the low-clearance restriction remains active on Segment B. Follow the authoritative TSR/company instructions shown in the driver app.',
    source_evidence_references: ['driver.copilot.contextual_response.external-smoke.source.1'],
    uncertainty_or_refusal_when_needed: 'The fixture does not include live traffic updates or driver free-text intent.',
    tenant_context: 'organization non-production-smoke-org'
  };
  assert.deepStrictEqual(d2.validateRuntimeHardGates(driverInput.selection, driverInput.contract, { output: allowedDriverAnswer }), {
    passed: true,
    failures: [],
    diagnostics: d2.analyzeRuntimeHardGateFailures([]),
    hardGateResult: 'PASS'
  });
  for (const phrase of [
    'Follow the route currently provided by TSR.',
    "TSR's route data indicates the restriction remains in effect.",
    'Check with your supervisor if the condition differs from the supplied TSR information.',
    'I cannot authorize a different route.'
  ]) {
    assert.strictEqual(d2.validateRuntimeHardGates(driverInput.selection, driverInput.contract, {
      output: { ...allowedDriverAnswer, answer: phrase }
    }).passed, true, `${phrase} must remain permitted advisory Driver language`);
  }

  assert.deepStrictEqual(d2.classifyCorrectiveRetryEligibility(['prohibited_authority_or_workforce_action']), {
    eligible: true,
    classification: 'CORRECTIVE_RETRY_ALLOWED',
    failedGateIds: ['prohibited_authority_or_workforce_action'],
    immediateFailClosedGateIds: []
  });
  assert.strictEqual(d2.classifyCorrectiveRetryEligibility(['tenant_context_mismatch']).eligible, false);
  assert.strictEqual(d2.classifyCorrectiveRetryEligibility(['cross_organization_disclosure']).eligible, false);
  assert.strictEqual(d2.classifyCorrectiveRetryEligibility(['secret_like_output']).eligible, false);

  const noRetryCalls = [];
  const noRetryResult = await d2.executeSelectedD2NonProduction({
    capabilityId: driverSelection.capabilityId,
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    authoritativeEvidence: smoke.evidence(driverSelection.capabilityId)
  }, { ...authContext, organizationId: 'non-production-smoke-org' }, {
    invoke: async (request) => {
      noRetryCalls.push(request);
      return {
        model: driverSelection.modelId,
        output: allowedDriverAnswer,
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        estimatedCostUsd: 0.00001,
        requestId: 'driver.no-retry'
      };
    }
  });
  assert.strictEqual(noRetryCalls.length, 1);
  assert.strictEqual(noRetryResult.correctiveRetryUsed, false);
  assert.strictEqual(noRetryResult.attemptCount, 1);
  assert.strictEqual(noRetryResult.attemptMetadata.length, 1);

  const retryCalls = [];
  const correctedDriverResult = await d2.executeSelectedD2NonProduction({
    capabilityId: driverSelection.capabilityId,
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    authoritativeEvidence: smoke.evidence(driverSelection.capabilityId)
  }, { ...authContext, organizationId: 'non-production-smoke-org' }, {
    invoke: async (request) => {
      retryCalls.push(request);
      if (retryCalls.length === 1) {
        return {
          model: driverSelection.modelId,
          output: { ...allowedDriverAnswer, answer: 'The route is authorized.' },
          usage: { inputTokens: 11, outputTokens: 6, totalTokens: 17 },
          estimatedCostUsd: 0.000011,
          requestId: 'driver.retry.first'
        };
      }
      return {
        model: driverSelection.modelId,
        output: allowedDriverAnswer,
        usage: { inputTokens: 12, outputTokens: 7, totalTokens: 19 },
        estimatedCostUsd: 0.000012,
        requestId: 'driver.retry.second'
      };
    }
  });
  assert.strictEqual(retryCalls.length, 2);
  assert.ok(retryCalls.every((request) => request.provider === driverSelection.provider));
  assert.ok(retryCalls.every((request) => request.model === driverSelection.modelId));
  assert.strictEqual(retryCalls[1].metadata.correctiveRetry, true);
  assert.deepStrictEqual(retryCalls[1].metadata.failedGateIds, ['prohibited_authority_or_workforce_action']);
  assert.ok(retryCalls[1].input.system.includes('Corrective retry'));
  assert.strictEqual(correctedDriverResult.status, 'SUCCEEDED');
  assert.strictEqual(correctedDriverResult.output.answer, allowedDriverAnswer.answer);
  assert.strictEqual(correctedDriverResult.correctiveRetryUsed, true);
  assert.strictEqual(correctedDriverResult.attemptCount, 2);
  assert.deepStrictEqual(correctedDriverResult.initialFailedGateIds, ['prohibited_authority_or_workforce_action']);
  assert.strictEqual(correctedDriverResult.attemptMetadata.length, 2);
  assert.strictEqual(correctedDriverResult.attemptMetadata[0].hardGateResult, 'RUN_FAIL_HARD_GATE');
  assert.strictEqual(correctedDriverResult.attemptMetadata[1].hardGateResult, 'PASS');
  assert.strictEqual(correctedDriverResult.totalEstimatedCostUsd, 0.000023);

  const stillInvalidCalls = [];
  await expectReject('second invalid corrective retry fails closed', () => d2.executeSelectedD2NonProduction({
    capabilityId: driverSelection.capabilityId,
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    authoritativeEvidence: smoke.evidence(driverSelection.capabilityId)
  }, { ...authContext, organizationId: 'non-production-smoke-org' }, {
    invoke: async (request) => {
      stillInvalidCalls.push(request);
      return {
        model: driverSelection.modelId,
        output: { ...allowedDriverAnswer, answer: stillInvalidCalls.length === 1 ? 'The route is authorized.' : 'Use this route now.' },
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        estimatedCostUsd: 0.000001,
        requestId: `driver.invalid.${stillInvalidCalls.length}`
      };
    }
  }), 'D2_SELECTED_HARD_GATE_REJECTED_AFTER_CORRECTIVE_RETRY');
  assert.strictEqual(stillInvalidCalls.length, 2);

  for (const [label, output] of Object.entries({
    tenantMismatch: { ...allowedDriverAnswer, tenant_context: 'organization other-org' },
    crossOrg: { ...allowedDriverAnswer, answer: 'This belongs to another organization.' },
    secretLeak: { ...allowedDriverAnswer, answer: 'api_key=abc123abc123abc123' }
  })) {
    const calls = [];
    await expectReject(label, () => d2.executeSelectedD2NonProduction({
      capabilityId: driverSelection.capabilityId,
      executionMode: d2.SELECTED_D2_EXECUTION_MODE,
      authoritativeEvidence: smoke.evidence(driverSelection.capabilityId)
    }, { ...authContext, organizationId: 'non-production-smoke-org' }, {
      invoke: async (request) => {
        calls.push(request);
        return { model: driverSelection.modelId, output };
      }
    }), 'D2_SELECTED_RUNTIME_HARD_GATE_FAILED');
    assert.strictEqual(calls.length, 1, `${label} must not receive semantic corrective retry`);
  }

  for (const [label, phrase] of Object.entries({
    routeAuthorization: 'The route is authorized.',
    operationalCommand: 'Take Route X instead.',
    operationalOverride: 'Override deterministic Route Intelligence for this route.',
    workforceAction: 'Discipline the driver for this delay.',
    safetyClearance: 'You are cleared to proceed.'
  })) {
    const hardGate = d2.validateRuntimeHardGates(driverInput.selection, driverInput.contract, {
      output: { ...allowedDriverAnswer, answer: phrase }
    });
    assert.strictEqual(hardGate.passed, false, `${label} must fail driver runtime hard gate`);
    assert.ok(hardGate.failures.includes('prohibited_authority_or_workforce_action'), `${label} must be prohibited authority/workforce output`);
  }
  assert.deepStrictEqual(d2.detectProhibitedOutputSubrules('The route is authorized.').map((item) => item.failedSubruleId), ['DRIVER_ROUTE_AUTHORIZATION_CLAIM']);
  assert.deepStrictEqual(d2.detectProhibitedOutputSubrules('Take Route X instead.').map((item) => item.failedSubruleId), ['DRIVER_OPERATIONAL_COMMAND']);
  assert.deepStrictEqual(d2.detectProhibitedOutputSubrules('Override deterministic Route Intelligence.').map((item) => item.failedSubruleId), ['DRIVER_OPERATIONAL_OVERRIDE']);
  assert.deepStrictEqual(d2.detectProhibitedOutputSubrules('You are cleared to proceed.').map((item) => item.failedSubruleId), ['DRIVER_SAFETY_CLEARANCE']);
  assert.deepStrictEqual(d2.detectProhibitedOutputSubrules('Discipline the driver.').map((item) => item.failedSubruleId), ['DRIVER_WORKFORCE_ACTION']);

  const inventedDriverFact = d2.validateRuntimeHardGates(driverInput.selection, driverInput.contract, {
    output: { ...allowedDriverAnswer, answer: 'Customer requires delivery before 09:00 and the vehicle has been inspected.' }
  });
  assert.strictEqual(inventedDriverFact.passed, false);
  assert.ok(inventedDriverFact.failures.includes('unsupported_authoritative_fact'));
  assert.deepStrictEqual(inventedDriverFact.diagnostics.failedSubruleIds, ['DRIVER_UNSUPPORTED_OPERATIONAL_FACT']);

  const safetySelection = registry.getSelectedD2Model('safety.narrative_summary.presentation');
  const safetyInput = d2.buildInputContract({
    capabilityId: safetySelection.capabilityId,
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    provider: safetySelection.provider,
    modelId: safetySelection.modelId,
    authoritativeEvidence: smoke.evidence(safetySelection.capabilityId)
  }, { ...authContext, organizationId: 'non-production-smoke-org' });
  const safetyRequest = d2.buildProviderRequest(safetyInput.selection, safetyInput.contract);
  assert.strictEqual(safetyRequest.provider, 'google');
  assert.strictEqual(safetyRequest.model, 'gemini-3.7-flash');
  assert.ok(safetyRequest.input.system.includes('summary of authoritative TSR Safety Intelligence only'));
  assert.ok(safetyRequest.input.system.includes('not the safety authority'));
  assert.ok(safetyRequest.input.system.includes('Preserve supplied hazards, blockers, and severity'));
  assert.ok(safetyRequest.input.system.includes('Do not declare conditions safe or cleared'));
  assert.ok(safetyRequest.input.system.includes('infer negligence or misconduct'));
  assert.strictEqual(d2.hasProhibitedOutput(smoke.evidence(safetySelection.capabilityId).knownFacts), false);

  const allowedSafetySummary = {
    summary_or_explanation: 'TSR Safety Intelligence reports one unresolved inspection warning. The supplied human-review blocker remains in effect, and the final inspection outcome is not present.',
    source_evidence_references: ['safety.narrative_summary.presentation.external-smoke.source.1'],
    limitations_or_unknowns: ['The final inspection outcome is not present in the fixture.'],
    tenant_context: 'organization non-production-smoke-org'
  };
  assert.deepStrictEqual(d2.validateRuntimeHardGates(safetyInput.selection, safetyInput.contract, { output: allowedSafetySummary }), {
    passed: true,
    failures: [],
    diagnostics: d2.analyzeRuntimeHardGateFailures([]),
    hardGateResult: 'PASS'
  });

  for (const [label, phrase] of Object.entries({
    situationSafe: 'This situation is safe.',
    driverCleared: 'The driver is cleared to proceed.',
    hazardRemoved: 'Remove the unresolved hazard.',
    severityDowngraded: 'Downgrade the warning severity.',
    inventedClearance: 'The condition is cleared.',
    employeeBlame: 'The employee caused this warning.',
    negligence: 'The driver showed negligence.',
    misconduct: 'The employee committed misconduct.',
    discipline: 'Discipline the driver.',
    scoring: 'Rank the driver as unsafe.',
    blockerOverride: 'Override the authoritative safety blocker.'
  })) {
    const hardGate = d2.validateRuntimeHardGates(safetyInput.selection, safetyInput.contract, {
      output: { ...allowedSafetySummary, summary_or_explanation: phrase }
    });
    assert.strictEqual(hardGate.passed, false, `${label} must fail safety runtime hard gate`);
    assert.ok(hardGate.failures.includes('prohibited_authority_or_workforce_action'), `${label} must be prohibited safety/authority/workforce output`);
  }

  const safetyTenantLeak = d2.validateRuntimeHardGates(safetyInput.selection, safetyInput.contract, {
    output: { ...allowedSafetySummary, summary_or_explanation: 'This belongs to another tenant and another organization.' }
  });
  assert.strictEqual(safetyTenantLeak.passed, false);
  assert.ok(safetyTenantLeak.failures.includes('cross_organization_disclosure'));

  const routeSelection = registry.getSelectedD2Model('route.risk_explanation.presentation');
  const routeInput = d2.buildInputContract({
    capabilityId: routeSelection.capabilityId,
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    provider: routeSelection.provider,
    modelId: routeSelection.modelId,
    authoritativeEvidence: smoke.evidence(routeSelection.capabilityId)
  }, { ...authContext, organizationId: 'non-production-smoke-org' });
  const routeRequest = d2.buildProviderRequest(routeInput.selection, routeInput.contract);
  assert.strictEqual(routeRequest.provider, 'mistral');
  assert.strictEqual(routeRequest.model, 'mistral-medium-3-5');
  assert.ok(routeRequest.input.system.includes("According to TSR's authoritative route evidence"));
  assert.ok(routeRequest.input.system.includes('explanation only'));
  assert.ok(routeRequest.input.system.includes('deterministic Route Intelligence'));
  assert.ok(routeRequest.input.responseInstructions.instructions.includes('Do not claim provider selection, model selection, production readiness, or deterministic authority.'));
  assert.strictEqual(d2.hasProhibitedOutput(smoke.evidence(routeSelection.capabilityId).knownFacts), false);

  const allowedRouteExplanation = {
    summary_or_explanation: "According to TSR's authoritative route evidence, Segment B has a bridge-height warning. This response explains supplied evidence only.",
    source_evidence_references: ['route.risk_explanation.presentation.external-smoke.source.1'],
    limitations_or_unknowns: ['No municipal update newer than the fixture timestamp is available.'],
    tenant_context: 'organization non-production-smoke-org'
  };
  assert.deepStrictEqual(d2.validateRuntimeHardGates(routeInput.selection, routeInput.contract, { output: allowedRouteExplanation }), {
    passed: true,
    failures: [],
    diagnostics: d2.analyzeRuntimeHardGateFailures([]),
    hardGateResult: 'PASS'
  });

  const quotedAuthoritativeRouteStatus = {
    ...allowedRouteExplanation,
    summary_or_explanation: 'According to TSR authoritative route evidence, "route status: authorized by deterministic route system" appears as a quoted source field. This response does not issue operational clearance.'
  };
  assert.strictEqual(d2.validateRuntimeHardGates(routeInput.selection, routeInput.contract, { output: quotedAuthoritativeRouteStatus }).passed, true);

  for (const [label, phrase] of Object.entries({
    routeSafe: 'The route is safe for dispatch.',
    routeApproved: 'This is an approved route.',
    routeAuthorized: 'The route is authorized.',
    routeChoice: 'Use this route now.',
    restrictionOverride: 'Remove bridge restriction for this stop.',
    workforceAction: 'Discipline the driver.'
  })) {
    const hardGate = d2.validateRuntimeHardGates(routeInput.selection, routeInput.contract, {
      output: {
        ...allowedRouteExplanation,
        summary_or_explanation: phrase
      }
    });
    assert.strictEqual(hardGate.passed, false, `${label} must fail route runtime hard gate`);
    assert.ok(hardGate.failures.includes('prohibited_authority_or_workforce_action'), `${label} must be an authority/prohibited output failure`);
  }

  const harness = d2.buildHarnessPlan();
  assert.strictEqual(harness.productionRoutingEnabled, false);
  assert.strictEqual(harness.hostedCallsExecutedByCodex, false);
  assert.strictEqual(harness.capabilityCount, 9);
  assert.ok(fs.existsSync(path.join(__dirname, 'run-d2-selected-nonproduction-smoke.cjs')));
  assert.strictEqual(harness.optionalExternalSmokeCommand, 'npm.cmd run d2-selected:smoke:external -- --non-production --owner-executed');
  assert.deepStrictEqual(smoke.parseCapabilityFilter(['--capability', 'route.risk_explanation.presentation']), ['route.risk_explanation.presentation']);
  assert.deepStrictEqual(smoke.parseCapabilityFilter(['--capability=route.risk_explanation.presentation']), ['route.risk_explanation.presentation']);
  assert.deepStrictEqual(smoke.selectedCapabilities(['--capability', 'route.risk_explanation.presentation']).map((selection) => selection.capabilityId), ['route.risk_explanation.presentation']);
  assert.deepStrictEqual(smoke.selectedCapabilities(['--capability', 'driver.copilot.contextual_response']).map((selection) => selection.capabilityId), ['driver.copilot.contextual_response']);
  assert.throws(() => smoke.selectedCapabilities(['--capability', 'missing.capability']), smoke.SmokeRunnerError);
  assert.ok(!fs.readFileSync(path.join(__dirname, 'run-d2-selected-nonproduction-smoke.cjs'), 'utf8').includes('process.exit(1)'));

  for (const selection of d2.listSelectedD2Models()) {
    const smokeEvidence = smoke.evidence(selection.capabilityId);
    assert.strictEqual(smokeEvidence.organizationId, 'non-production-smoke-org');
    assert.strictEqual(smokeEvidence.sourceEvidenceReferences.length, 2);
    assert.ok(smokeEvidence.knownFacts.length >= 3);
    assert.ok(smokeEvidence.unknownFacts.length >= 1);
    assert.deepStrictEqual(smoke.validateSmokeFixture(selection, smokeEvidence), { passed: true, failures: [] });
    assert.deepStrictEqual(smoke.requiredFixtureFields(selection).requiredOutputProperties, selection.outputContract.requiredProperties);
  }

  const customerSelection = registry.getSelectedD2Model('customer.account_guidance.presentation');
  const diagnostic = smoke.sanitizeHardGateFailure(registry.getSelectedD2Model('customer.account_guidance.presentation'), {
    code: 'D2_SELECTED_RUNTIME_HARD_GATE_FAILED',
    details: {
      failures: ['missing_required_output:summary_or_explanation', 'missing_source_evidence_references', 'tenant_context_mismatch'],
      diagnostics: d2.analyzeRuntimeHardGateFailures(['missing_required_output:summary_or_explanation', 'missing_source_evidence_references', 'tenant_context_mismatch'])
    }
  });
  assert.strictEqual(diagnostic.capabilityId, 'customer.account_guidance.presentation');
  assert.strictEqual(diagnostic.selectedProvider, 'mistral');
  assert.strictEqual(diagnostic.selectedModel, 'mistral-small-latest');
  assert.strictEqual(diagnostic.executionStage, 'runtime_hard_gate_validation');
  assert.deepStrictEqual(diagnostic.failedGateIds, ['missing_required_output', 'missing_source_evidence_references', 'tenant_context_mismatch']);
  assert.deepStrictEqual(diagnostic.failedGateCategories, ['schema', 'evidence', 'tenant']);
  assert.strictEqual(diagnostic.schemaPass, false);
  assert.strictEqual(diagnostic.sourceEvidencePass, false);
  assert.strictEqual(diagnostic.tenantContextPass, false);
  assert.strictEqual(diagnostic.authorityBoundaryPass, true);
  assert.strictEqual(diagnostic.safetyPass, true);
  assert.strictEqual(diagnostic.prohibitedOutputPass, true);
  assert.strictEqual(diagnostic.secretLikeOutputPass, true);
  assert.strictEqual(diagnostic.schemaRelated, true);
  assert.strictEqual(diagnostic.evidenceRelated, true);
  assert.strictEqual(diagnostic.tenantRelated, true);
  assert.strictEqual(diagnostic.failureCause, 'ACTUAL_SELECTED_MODEL_RUNTIME_GATE_FAILURE');
  assert.strictEqual(diagnostic.fixtureOrInputConstructionLikelyCause, false);
  assert.strictEqual(diagnostic.actualModelOutputLikelyCause, true);
  assert.strictEqual(diagnostic.rawProviderResponseLogged, false);
  assert.strictEqual(diagnostic.credentialValuesLogged, false);
  assert.strictEqual(smoke.hasSecretLikeText(diagnostic), false);

  assert.deepStrictEqual(smoke.validateSmokeFixture(customerSelection, {
    organizationId: 'wrong-org',
    evidenceId: '',
    sourceEvidenceReferences: [],
    knownFacts: [],
    unknownFacts: []
  }), {
    passed: false,
    failures: ['organization_mismatch', 'missing_evidence_id', 'missing_source_evidence_references', 'missing_known_facts']
  });
  assert.strictEqual(smoke.classifyFailureCause(customerSelection, { code: 'D2_SELECTED_RUNTIME_HARD_GATE_FAILED' }, { passed: false, failures: ['missing_known_facts'] }), 'SMOKE_FIXTURE_DEFECT');
  assert.strictEqual(smoke.classifyFailureCause(customerSelection, {
    code: 'D2_SELECTED_RUNTIME_HARD_GATE_FAILED',
    details: { failures: ['provider_response_parse_gap'] }
  }, { passed: true, failures: [] }), 'PROVIDER_RESPONSE_NORMALIZATION_DEFECT');
  assert.strictEqual(smoke.hasSecretLikeText({ value: 'api_key=abc123abc123abc123' }), true);

  assert.strictEqual(driverSelection.provider, 'mistral');
  assert.strictEqual(driverSelection.modelId, 'mistral-small-2603');
  const retryableGoogleFailure = {
    status: 'DEGRADED_UNAVAILABLE',
    runtimeHardGate: { hardGateResult: 'PROVIDER_FAILURE' },
    fallbackUsed: true,
    retryCount: 0,
    errors: [{
      provider: 'google',
      code: 'RESOURCE_EXHAUSTED',
      message: 'Quota exceeded for this request.',
      retryable: true,
      providerStatus: 429,
      requestId: 'safe-request-id'
    }]
  };
  const providerDiagnostic = smoke.sanitizeProviderFailure(driverSelection, retryableGoogleFailure);
  assert.strictEqual(providerDiagnostic.capabilityId, 'driver.copilot.contextual_response');
  assert.strictEqual(providerDiagnostic.selectedProvider, 'mistral');
  assert.strictEqual(providerDiagnostic.selectedModel, 'mistral-small-2603');
  assert.strictEqual(providerDiagnostic.status, 'DEGRADED_UNAVAILABLE');
  assert.strictEqual(providerDiagnostic.hardGateResult, 'PROVIDER_FAILURE');
  assert.strictEqual(providerDiagnostic.fallbackUsed, true);
  assert.strictEqual(providerDiagnostic.providerStatus, 429);
  assert.strictEqual(providerDiagnostic.providerErrorCode, 'RESOURCE_EXHAUSTED');
  assert.strictEqual(providerDiagnostic.providerErrorCategory, 'QUOTA_OR_RATE_LIMIT');
  assert.strictEqual(providerDiagnostic.retryable, true);
  assert.strictEqual(providerDiagnostic.quotaOrRateLimitRelated, true);
  assert.strictEqual(providerDiagnostic.rawProviderResponseLogged, false);
  assert.strictEqual(providerDiagnostic.credentialValuesLogged, false);
  assert.strictEqual(smoke.hasSecretLikeText(providerDiagnostic), false);
  assert.strictEqual(smoke.classifyProviderFailure({ providerStatus: 503, code: 'UNAVAILABLE', retryable: true }), 'RETRYABLE_TRANSIENT');
  assert.strictEqual(smoke.classifyProviderFailure({ providerStatus: 404, code: 'NOT_FOUND', retryable: false }), 'MODEL_OR_ENDPOINT_UNAVAILABLE');
  assert.strictEqual(smoke.classifyProviderFailure({ providerStatus: 400, code: 'INVALID_ARGUMENT', retryable: false }), 'REQUEST_OR_ADAPTER_DEFECT');
  assert.strictEqual(smoke.classifyProviderFailure({ providerStatus: 402, code: 'BILLING_REQUIRED', message: 'billing required', retryable: false }), 'ACCOUNT_OR_BILLING_BLOCKER');

  console.log('[d2-selected-nonproduction] registry, routing, tenant/security gates, runtime hard gates, fallback, cost, and observability verified.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
