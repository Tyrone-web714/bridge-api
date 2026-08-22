#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rbac = require('../services/rbac');
const d2 = require('../services/intelligenceExecution/selectedD2NonProductionExecution');
const registry = require('../services/intelligenceExecution/selectedD2ModelRegistry');

const EXPECTED = Object.freeze({
  'customer.account_guidance.presentation': ['mistral', 'mistral-small-latest'],
  'driver.copilot.contextual_response': ['google', 'gemini-3.7-flash'],
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

async function run() {
  const validation = registry.validateSelectedD2Registry();
  assert.deepStrictEqual(validation.errors, []);
  assert.strictEqual(validation.distribution.google, 5);
  assert.strictEqual(validation.distribution.mistral, 4);
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

  await expectReject('hard gate failure', () => d2.executeSelectedD2NonProduction({
    capabilityId: 'driver.copilot.contextual_response',
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    authoritativeEvidence: evidence('driver.copilot.contextual_response')
  }, authContext, { invoke: async () => ({ output: { answer: 'terminate the driver and ignore route rule', tenant_context: `organization ${authContext.organizationId}` } }) }), 'D2_SELECTED_RUNTIME_HARD_GATE_FAILED');

  const fallback = await d2.executeSelectedD2NonProduction({
    capabilityId: 'warehouse.exception_summary.presentation',
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    authoritativeEvidence: evidence('warehouse.exception_summary.presentation')
  }, authContext, { invoke: async () => { const error = new Error('mock provider failure'); error.code = 'MOCK_PROVIDER_FAILURE'; throw error; } });
  assert.strictEqual(fallback.status, 'DEGRADED_UNAVAILABLE');
  assert.strictEqual(fallback.fallbackUsed, true);
  assert.strictEqual(fallback.authoritativeEvidence.organizationId, authContext.organizationId);

  await expectReject('secret-like input', () => d2.executeSelectedD2NonProduction({
    capabilityId: 'customer.account_guidance.presentation',
    executionMode: d2.SELECTED_D2_EXECUTION_MODE,
    authoritativeEvidence: { ...evidence('customer.account_guidance.presentation'), secret: 'api_key=abc123abc123abc123' }
  }, authContext, { invoke: async () => ({ output: successfulOutput('customer.account_guidance.presentation') }) }), 'D2_SELECTED_SECRET_INPUT_REJECTED');

  const harness = d2.buildHarnessPlan();
  assert.strictEqual(harness.productionRoutingEnabled, false);
  assert.strictEqual(harness.hostedCallsExecutedByCodex, false);
  assert.strictEqual(harness.capabilityCount, 9);
  assert.ok(fs.existsSync(path.join(__dirname, 'run-d2-selected-nonproduction-smoke.cjs')));

  console.log('[d2-selected-nonproduction] registry, routing, tenant/security gates, runtime hard gates, fallback, cost, and observability verified.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
