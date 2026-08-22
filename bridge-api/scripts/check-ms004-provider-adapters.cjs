#!/usr/bin/env node
const assert = require('assert');
const {
  assertBenchmarkCandidateSupported,
  buildBenchmarkRequest,
  buildBenchmarkPrompt,
  executeBenchmarkProviderRequest,
  getBenchmarkAdapterCatalog,
  getHostedAdapterCatalog,
  getBenchmarkProviderModelId,
  normalizeBenchmarkFailure,
  normalizeBenchmarkResponse
} = require('../services/intelligenceExecution/providerAdapters');
const { buildCandidateSelection } = require('./generate-ms003-candidate-selection-artifacts.cjs');
const { buildMs004CandidateExpansion } = require('./ms004-candidate-expansion.cjs');
const { buildFramework } = require('./generate-ms002-benchmark-acceptance-artifacts.cjs');

const REQUIRED_ENV = Object.freeze({
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GEMINI_API_KEY',
  mistral: 'MISTRAL_API_KEY'
});
const SECRET_SENTINEL = 'MS004_TEST_SECRET_SHOULD_NOT_APPEAR';

function readyEnv() {
  return Object.fromEntries(Object.values(REQUIRED_ENV).map((name) => [name, SECRET_SENTINEL]));
}

function assertNoSecret(value, label) {
  assert.ok(!JSON.stringify(value).includes(SECRET_SENTINEL), `${label} leaked a credential value`);
}

function providerKey(provider) {
  return String(provider || '').toLowerCase();
}

async function main() {
  const ms003 = buildCandidateSelection();
  const ms004Expansion = buildMs004CandidateExpansion();
  const ms002 = buildFramework();
  const capabilities = new Map(ms002.benchmarkCandidates.map((capability) => [capability.capabilityId, capability]));
  const hostedCandidates = [...ms003.candidates, ...ms004Expansion.candidates].filter((candidate) => candidate.candidateType === 'HOSTED_MODEL');
  const missingCatalog = getBenchmarkAdapterCatalog({});
  const readyCatalog = getBenchmarkAdapterCatalog(readyEnv());

  assert.deepStrictEqual(
    readyCatalog.map((adapter) => adapter.provider).sort(),
    ['anthropic', 'google', 'mistral', 'openai'],
    'benchmark catalog must expose exactly four providers'
  );
  for (const adapter of missingCatalog) {
    assert.strictEqual(adapter.configured, false, `${adapter.provider} should be unconfigured without process env credential`);
    assert.strictEqual(adapter.status, 'MISSING_CREDENTIALS', `${adapter.provider} missing-credential status`);
    assert.strictEqual(adapter.secretValuesLogged, false, `${adapter.provider} secret logging flag`);
    assert.strictEqual(adapter.productionRoutingEnabled, false, `${adapter.provider} production routing boundary`);
    assertNoSecret(adapter, `${adapter.provider} missing catalog`);
  }
  for (const adapter of readyCatalog) {
    assert.strictEqual(adapter.configured, true, `${adapter.provider} should be configured with process env credential`);
    assert.strictEqual(adapter.credentialPresent, true, `${adapter.provider} credential presence boolean`);
    assert.strictEqual(adapter.status, 'BENCHMARK_ADAPTER_READY', `${adapter.provider} benchmark readiness`);
    assert.strictEqual(adapter.adapterScope, 'BENCHMARK_ONLY', `${adapter.provider} scope`);
    assert.strictEqual(adapter.productionRoutingEnabled, false, `${adapter.provider} production routing boundary`);
    assert.strictEqual(adapter.credentialEnvironmentVariable, REQUIRED_ENV[adapter.provider], `${adapter.provider} env var contract`);
    assertNoSecret(adapter, `${adapter.provider} ready catalog`);
  }

  for (const candidate of hostedCandidates) {
    const capability = capabilities.get(candidate.capabilityId);
    const adapter = assertBenchmarkCandidateSupported(candidate, capability, readyEnv());
    assert.strictEqual(adapter.provider, providerKey(candidate.provider), `${candidate.candidateId} provider mapping`);
    assert.ok(adapter.supportedModelIds.includes(candidate.officialModelId), `${candidate.candidateId} model mapping`);
    assert.ok(adapter.supportedCapabilities.includes(candidate.capabilityId), `${candidate.candidateId} capability mapping`);

    const request = buildBenchmarkRequest(candidate, capability, {
      caseId: `${candidate.capabilityId}.offline.case`,
      requestPayload: { knownFact: 'offline fixture' },
      expectedResult: { mustNotInventFacts: true }
    }, readyEnv());
    assert.strictEqual(request.provider, providerKey(candidate.provider), `${candidate.candidateId} request provider`);
    assert.strictEqual(request.model, candidate.officialModelId, `${candidate.candidateId} request model`);
    assert.strictEqual(request.store, false, `${candidate.candidateId} no provider storage`);
    assert.strictEqual(request.responseFormat, 'json_schema', `${candidate.candidateId} structured output marker`);
    assert.deepStrictEqual(request.input.requiredProperties, capability.expectedOutputContract.requiredProperties, `${candidate.candidateId} required fields`);
    for (const field of capability.expectedOutputContract.requiredProperties) {
      assert.ok(Object.prototype.hasOwnProperty.call(request.input.responseInstructions.responseShape, field), `${candidate.candidateId} response template includes ${field}`);
      assert.ok(buildBenchmarkPrompt(request).includes(field), `${candidate.candidateId} prompt includes ${field}`);
    }
    assert.strictEqual(request.metadata.candidateId, candidate.candidateId, `${candidate.candidateId} metadata`);
    assertNoSecret(request, `${candidate.candidateId} request`);

    const normalized = normalizeBenchmarkResponse({
      provider: providerKey(candidate.provider),
      candidate,
      startedAtMs: 1000,
      endedAtMs: 1042,
      response: {
        id: 'offline-request-id',
        model: candidate.officialModelId,
        output: { ok: true },
        usage: {
          input_tokens: 11,
          output_tokens: 7,
          total_tokens: 18
        },
        retryCount: 1
      }
    });
    assert.strictEqual(normalized.status, 'SUCCEEDED', `${candidate.candidateId} normalized status`);
    assert.strictEqual(normalized.provider, providerKey(candidate.provider), `${candidate.candidateId} normalized provider`);
    assert.strictEqual(normalized.model, candidate.officialModelId, `${candidate.candidateId} normalized model`);
    assert.deepStrictEqual(normalized.output, { ok: true }, `${candidate.candidateId} normalized output`);
    assert.strictEqual(normalized.usage.inputTokens, 11, `${candidate.candidateId} usage input`);
    assert.strictEqual(normalized.usage.outputTokens, 7, `${candidate.candidateId} usage output`);
    assert.strictEqual(normalized.usage.totalTokens, 18, `${candidate.candidateId} usage total`);
    assert.strictEqual(normalized.latencyMs, 42, `${candidate.candidateId} latency`);
    assert.strictEqual(normalized.retryCount, 1, `${candidate.candidateId} retry accounting`);
    assert.strictEqual(normalized.productionActivation, false, `${candidate.candidateId} production boundary`);
    assertNoSecret(normalized, `${candidate.candidateId} normalized response`);
  }

  const anthropicCandidate = hostedCandidates.find((candidate) => providerKey(candidate.provider) === 'anthropic' && candidate.officialModelId === 'claude-haiku-4-5');
  const anthropicCapability = capabilities.get(anthropicCandidate.capabilityId);
  const anthropicRequest = buildBenchmarkRequest(anthropicCandidate, anthropicCapability, {
    caseId: `${anthropicCandidate.capabilityId}.offline.anthropic.case`,
    requestPayload: { knownFact: 'offline fixture' },
    expectedResult: { mustNotInventFacts: true }
  }, readyEnv());
  assert.strictEqual(anthropicRequest.model, 'claude-haiku-4-5', 'MS-003 Anthropic candidate identity is preserved');
  assert.strictEqual(anthropicRequest.providerModelId, 'claude-haiku-4-5-20251001', 'Anthropic Haiku alias maps to current API invocation id');
  assert.strictEqual(getBenchmarkProviderModelId('anthropic', 'claude-sonnet-4-6'), 'claude-sonnet-4-6', 'Anthropic Sonnet 4.6 invocation id');
  assert.strictEqual(getBenchmarkProviderModelId('anthropic', 'claude-sonnet-5'), 'claude-sonnet-5', 'Anthropic Sonnet 5 invocation id');

  let capturedAnthropicRequest = null;
  const anthropicNormalized = await executeBenchmarkProviderRequest(anthropicRequest, {
    env: readyEnv(),
    fetch: async (url, init) => {
      capturedAnthropicRequest = { url, init, body: JSON.parse(init.body) };
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => (name === 'request-id' ? 'offline-anthropic-request' : null) },
        text: async () => JSON.stringify({
          id: 'msg_offline_anthropic',
          model: capturedAnthropicRequest.body.model,
          content: [{ type: 'text', text: JSON.stringify({ summary_or_explanation: 'Anthropic JSON response', source_evidence_references: ['offline'], limitations_or_unknowns: [] }) }],
          usage: { input_tokens: 21, output_tokens: 13 }
        })
      };
    }
  });
  assert.strictEqual(capturedAnthropicRequest.url, 'https://api.anthropic.com/v1/messages', 'Anthropic Messages endpoint');
  assert.strictEqual(capturedAnthropicRequest.init.method, 'POST', 'Anthropic method');
  assert.strictEqual(capturedAnthropicRequest.init.headers['anthropic-version'], '2023-06-01', 'Anthropic API version header');
  assert.strictEqual(capturedAnthropicRequest.init.headers['x-api-key'], SECRET_SENTINEL, 'Anthropic API key header is supplied only to transport');
  assert.strictEqual(capturedAnthropicRequest.body.model, 'claude-haiku-4-5-20251001', 'Anthropic payload uses provider model id');
  assert.strictEqual(capturedAnthropicRequest.body.max_tokens, 1200, 'Anthropic max_tokens is set');
  assert.strictEqual(capturedAnthropicRequest.body.system, anthropicRequest.input.system, 'Anthropic system prompt field');
  assert.deepStrictEqual(capturedAnthropicRequest.body.messages.map((message) => message.role), ['user'], 'Anthropic user message structure');
  assert.strictEqual(capturedAnthropicRequest.body.temperature, undefined, 'Anthropic payload excludes unapproved temperature');
  assert.strictEqual(capturedAnthropicRequest.body.response_format, undefined, 'Anthropic payload excludes OpenAI-style response_format');
  assert.strictEqual(capturedAnthropicRequest.body.text, undefined, 'Anthropic payload excludes OpenAI-style text config');
  assert.strictEqual(capturedAnthropicRequest.body.tools, undefined, 'Anthropic payload excludes unapproved tool schema');
  assert.strictEqual(anthropicNormalized.status, 'SUCCEEDED', 'Anthropic success normalizes');
  assert.strictEqual(anthropicNormalized.provider, 'anthropic', 'Anthropic normalized provider');
  assert.strictEqual(anthropicNormalized.model, 'claude-haiku-4-5-20251001', 'Anthropic normalized provider model');
  assert.strictEqual(anthropicNormalized.usage.inputTokens, 21, 'Anthropic usage input');
  assert.strictEqual(anthropicNormalized.usage.outputTokens, 13, 'Anthropic usage output');
  assert.ok(anthropicNormalized.latencyMs >= 0, 'Anthropic latency captured');
  assertNoSecret(anthropicNormalized, 'Anthropic normalized response');

  let anthropicFailure = null;
  try {
    await executeBenchmarkProviderRequest(anthropicRequest, {
      env: readyEnv(),
      fetch: async () => ({
        ok: false,
        status: 400,
        headers: { get: () => 'offline-anthropic-400' },
        text: async () => JSON.stringify({ error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' } })
      })
    });
  } catch (error) {
    anthropicFailure = normalizeBenchmarkFailure('anthropic', error, 0);
  }
  assert.strictEqual(anthropicFailure.status, 'FAILED', 'Anthropic failure normalizes');
  assert.strictEqual(anthropicFailure.error.code, 'invalid_request_error', 'Anthropic 400 code preserved');
  assert.strictEqual(anthropicFailure.error.providerStatus, 400, 'Anthropic 400 status preserved');
  assert.strictEqual(anthropicFailure.error.retryable, false, 'Anthropic billing 400 is not provider-transient');
  assertNoSecret(anthropicFailure, 'Anthropic failure');

  assert.throws(
    () => assertBenchmarkCandidateSupported(hostedCandidates[0], capabilities.get(hostedCandidates[0].capabilityId), {}),
    /Benchmark provider credential is not configured/,
    'missing credential must fail safely'
  );
  assert.throws(
    () => assertBenchmarkCandidateSupported({ ...hostedCandidates[0], officialModelId: 'not-shortlisted' }, capabilities.get(hostedCandidates[0].capabilityId), readyEnv()),
    /Benchmark candidate model is not enabled/,
    'unapproved model must be rejected'
  );

  const failure = normalizeBenchmarkFailure('openai', {
    code: 'RATE_LIMIT',
    message: 'provider unavailable',
    retryable: true,
    providerStatus: 429,
    requestId: 'offline-failure-id'
  }, 2);
  assert.strictEqual(failure.status, 'FAILED', 'failure status');
  assert.strictEqual(failure.error.retryable, true, 'retryable failure');
  assert.strictEqual(failure.retryCount, 2, 'failure retry count');
  assert.strictEqual(failure.productionActivation, false, 'failure production boundary');
  assertNoSecret(failure, 'failure normalization');

  const productionCatalog = getHostedAdapterCatalog();
  assert.strictEqual(productionCatalog.length, 1, 'production hosted catalog remains legacy OpenAI only');
  assert.strictEqual(productionCatalog[0].provider, 'openai', 'production hosted provider unchanged');
  assert.ok(!productionCatalog[0].supportedCapabilities.includes('customer.account_guidance.presentation'), 'MS-004 capabilities must not be added to production hosted catalog');

  console.log(`[ms004-provider-adapters] ready providers=${readyCatalog.length}, hosted candidate mappings=${hostedCandidates.length}, productionCatalogProviders=${productionCatalog.length}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[ms004-provider-adapters] failed: ${error.message}`);
    process.exitCode = 1;
  });
}
