const crypto = require('crypto');

const DRIVER_POLICY_RESPONSE_MODE = 'DETERMINISTIC_POLICY';
const SELECTED_D2_MODEL_RESPONSE_MODE = 'SELECTED_D2_MODEL';

const DRIVER_POLICY_CLASSES = Object.freeze({
  SAFETY_CLEARANCE: 'DRIVER_SAFETY_CLEARANCE_REQUEST',
  WORKFORCE_DECISION: 'DRIVER_WORKFORCE_DECISION_REQUEST',
  WORKFORCE_SCORING: 'DRIVER_WORKFORCE_SCORING_REQUEST',
  ROUTE_AUTHORIZATION: 'DRIVER_ROUTE_AUTHORIZATION_REQUEST',
  RESTRICTION_OVERRIDE: 'DRIVER_RESTRICTION_OVERRIDE_REQUEST'
});

const POLICY_RESPONSES = Object.freeze({
  [DRIVER_POLICY_CLASSES.SAFETY_CLEARANCE]: 'Driver Copilot cannot determine or issue safety clearance. Follow TSR authoritative safety and routing information. If conditions differ from the information shown, stop and contact your supervisor or approved operational authority.',
  [DRIVER_POLICY_CLASSES.WORKFORCE_DECISION]: "Driver Copilot does not make disciplinary, negligence, blame, or workforce decisions. Those determinations must be handled through the Organization's authorized supervisory process.",
  [DRIVER_POLICY_CLASSES.WORKFORCE_SCORING]: "Driver Copilot does not score, rate, rank, or judge driver performance. Workforce evaluations must be handled through the Organization's authorized supervisory process.",
  [DRIVER_POLICY_CLASSES.ROUTE_AUTHORIZATION]: "Driver Copilot cannot authorize, select, or approve a route. Follow the route and restrictions provided by TSR's authoritative routing system.",
  [DRIVER_POLICY_CLASSES.RESTRICTION_OVERRIDE]: 'Driver Copilot cannot override, bypass, ignore, or remove an authoritative restriction or warning. Follow TSR authoritative routing and safety information and contact your supervisor if field conditions differ.'
});

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function extractDriverPolicyRequestText(input = {}, contract = {}) {
  const evidence = contract.authoritativeEvidence || {};
  return String(
    input.requestText ||
    input.driverRequest ||
    input.driverQuestion ||
    input.question ||
    input.message ||
    input.prompt ||
    evidence.requestText ||
    evidence.driverRequest ||
    evidence.driverQuestion ||
    evidence.question ||
    ''
  );
}

function classifyDriverPolicyRequest(requestText) {
  const text = normalizeText(requestText);
  if (!text) return null;
  const asksDecision = /\b(can|should|may|am i|are we|is it|do i|could i|allowed|authorize|approve|clear|cleared)\b/.test(text);
  const asksMeaning = /\b(why|what does|what do|explain|meaning|show|information|recorded|say|indicates|indicate)\b/.test(text);

  if (/\b(ignore|bypass|override|disregard|remove|waive)\b.*\b(restriction|warning|blocker|no-truck|truck restriction|route rule|low-clearance|clearance restriction)\b/.test(text)) {
    return DRIVER_POLICY_CLASSES.RESTRICTION_OVERRIDE;
  }
  if (/\b(restriction|warning|blocker|no-truck|truck restriction|route rule|low-clearance|clearance restriction)\b.*\b(ignore|bypass|override|disregard|remove|waive)\b/.test(text)) {
    return DRIVER_POLICY_CLASSES.RESTRICTION_OVERRIDE;
  }
  if (/\b(write up|written up|discipline|disciplined|disciplinary|negligent|negligence|at fault|to blame|blame|misconduct)\b/.test(text)) {
    return DRIVER_POLICY_CLASSES.WORKFORCE_DECISION;
  }
  if (/\b(rate|rank|score|performing poorly|performance score|driver score|driver ranking)\b/.test(text)) {
    return DRIVER_POLICY_CLASSES.WORKFORCE_SCORING;
  }
  if (asksDecision && /\b(safe to proceed|safe to continue|safe to go|cleared to proceed|clear to proceed|safety clearance|am i safe|is it safe|can i go through|can i continue|can i proceed)\b/.test(text)) {
    return DRIVER_POLICY_CLASSES.SAFETY_CLEARANCE;
  }
  if (!asksMeaning && /\b(am i cleared|are we cleared|cleared|clearance)\b.*\b(proceed|continue|go through|drive|route)\b/.test(text)) {
    return DRIVER_POLICY_CLASSES.SAFETY_CLEARANCE;
  }
  if (!asksMeaning && asksDecision && /\b(take|use|choose|select|switch to|alternate|another)\b.*\b(route|road|path)\b/.test(text)) {
    return DRIVER_POLICY_CLASSES.ROUTE_AUTHORIZATION;
  }
  if (/\bauthorize\b.*\b(route|alternate|road|path)\b/.test(text)) {
    return DRIVER_POLICY_CLASSES.ROUTE_AUTHORIZATION;
  }
  return null;
}

function buildDeterministicDriverPolicyResponse({ selection, contract, policyClass, requestText, startedAtMs }) {
  const answer = POLICY_RESPONSES[policyClass];
  const sourceRefs = Array.isArray(contract.authoritativeSourceReferences) ? contract.authoritativeSourceReferences.slice() : [];
  const latencyMs = Math.max(0, Date.now() - Number(startedAtMs || Date.now()));
  return Object.freeze({
    schemaVersion: 'tsr.selected.d2.response.v1',
    requestId: contract.requestId,
    organizationId: contract.organizationId,
    capabilityId: selection.capabilityId,
    executionMode: contract.executionMode,
    status: 'SUCCEEDED',
    provider: null,
    model: null,
    output: Object.freeze({
      answer,
      source_evidence_references: Object.freeze(sourceRefs),
      uncertainty_or_refusal_when_needed: 'This request asks Driver Copilot to make an authority decision, so it was handled by deterministic TSR policy before model execution.',
      tenant_context: `organization ${contract.organizationId}`
    }),
    authoritativeEvidence: null,
    fallbackUsed: false,
    fallbackPolicy: selection.fallbackPolicy,
    runtimeHardGate: { passed: true, failures: [], diagnostics: { failedGateIds: [], failedSubruleIds: [], failedGateCategories: [] }, hardGateResult: 'DETERMINISTIC_POLICY_PASS' },
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, fabricated: false, provider: 'deterministic_policy' },
    estimatedCostUsd: 0,
    actualCostUsd: 0,
    latencyMs,
    deterministicPolicyLatencyMs: latencyMs,
    retryCount: 0,
    attemptCount: 0,
    correctiveRetryUsed: false,
    initialFailedGateIds: [],
    finalHardGateResult: 'DETERMINISTIC_POLICY_PASS',
    attemptMetadata: [],
    totalEstimatedCostUsd: 0,
    totalLatencyMs: latencyMs,
    providerRequestId: null,
    responseMode: DRIVER_POLICY_RESPONSE_MODE,
    policyIntercepted: true,
    policyClass,
    providerCallSuppressed: true,
    providerCostUsd: 0,
    providerUsage: 0,
    requestIdentityHash: hashText(requestText),
    observability: {
      capabilityId: selection.capabilityId,
      policyIntercepted: true,
      policyClass,
      providerCallSuppressed: true,
      tenantId: contract.organizationId,
      requestIdentityHash: hashText(requestText),
      responseMode: DRIVER_POLICY_RESPONSE_MODE,
      provider: null,
      model: null,
      succeeded: true,
      hardGatesPassed: true,
      fallbackUsed: false,
      providerFailure: null,
      providerCostUsd: 0,
      providerUsage: 0,
      providerLatency: 0,
      deterministicPolicyLatencyMs: latencyMs,
      productionRoutingEnabled: false
    },
    errors: []
  });
}

function evaluateDriverPreModelPolicy(input = {}, selection, contract, startedAtMs) {
  if (selection?.capabilityId !== 'driver.copilot.contextual_response') return null;
  const requestText = extractDriverPolicyRequestText(input, contract);
  const policyClass = classifyDriverPolicyRequest(requestText);
  if (!policyClass) return null;
  return buildDeterministicDriverPolicyResponse({ selection, contract, policyClass, requestText, startedAtMs });
}

module.exports = {
  DRIVER_POLICY_CLASSES,
  DRIVER_POLICY_RESPONSE_MODE,
  POLICY_RESPONSES,
  SELECTED_D2_MODEL_RESPONSE_MODE,
  buildDeterministicDriverPolicyResponse,
  classifyDriverPolicyRequest,
  evaluateDriverPreModelPolicy,
  extractDriverPolicyRequestText
};
