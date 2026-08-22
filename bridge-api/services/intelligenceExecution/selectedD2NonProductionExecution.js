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
const driverPolicy = require('./driverCopilotPolicyInterceptor');

const NON_PRODUCTION_BUDGET_CEILING_USD = 2;
const SECRET_PATTERNS = Object.freeze([
  /sk-[a-z0-9]{12,}/i,
  /AIza[0-9A-Za-z_-]{12,}/,
  /(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*["']?[^"',\s}]+/i
]);
const PROHIBITED_OUTPUT_RULES = Object.freeze([
  Object.freeze({
    id: 'DRIVER_WORKFORCE_ACTION',
    category: 'workforce_or_disciplinary_language',
    pattern: /\b(terminate|termination|fire|fired|discipline|demote|withhold pay|dock pay|compensation)\b/i
  }),
  Object.freeze({
    id: 'DRIVER_DISCIPLINARY_LANGUAGE',
    category: 'workforce_or_disciplinary_language',
    pattern: /\b(negligence|misconduct)\b/i
  }),
  Object.freeze({
    id: 'PROVIDER_OR_PRODUCTION_AUTHORITY_CLAIM',
    category: 'authority_or_selection_claim',
    pattern: /\b(production certified|provider selected|model selected)\b/i
  }),
  Object.freeze({
    id: 'DRIVER_SAFETY_CLEARANCE',
    category: 'safety_clearance_claim',
    pattern: /\b(safety clearance|cleared to proceed|safe to proceed|you are cleared)\b/i
  }),
  Object.freeze({
    id: 'DRIVER_OPERATIONAL_COMMAND',
    category: 'operational_command',
    pattern: /\b(?:take|choose|use)\s+(?:route\s+[a-z0-9-]+|this\s+route)\b/i
  }),
  Object.freeze({
    id: 'DRIVER_OPERATIONAL_OVERRIDE',
    category: 'operational_override',
    pattern: /\b(route is safe despite|override deterministic|ignore route rule|remove bridge restriction|remove truck restriction|override\s+(?:the\s+)?(?:route|restriction|warning|route intelligence))\b/i
  }),
  Object.freeze({
    id: 'DRIVER_ROUTE_AUTHORIZATION_CLAIM',
    category: 'route_authorization_claim',
    pattern: /\b(route\s+(?:status:\s*)?(?:is\s+)?(?:safe|approved|authorized)|(?:safe|approved|authorized)\s+route)\b/i
  }),
  Object.freeze({
    id: 'SAFETY_CLEARANCE_CLAIM',
    category: 'safety_clearance_claim',
    pattern: /\b(?:this|the)\s+(?:situation|condition|hazard|warning|blocker)\s+(?:is\s+)?(?:safe|cleared|resolved|removed)\b/i
  }),
  Object.freeze({
    id: 'EMPLOYEE_SAFETY_CLEARANCE_OR_SCORING',
    category: 'safety_or_employee_scoring_claim',
    pattern: /\b(?:driver|employee)\s+(?:is\s+)?(?:cleared|scored|ranked)\b/i
  }),
  Object.freeze({
    id: 'EMPLOYEE_BLAME_CLAIM',
    category: 'employee_blame_claim',
    pattern: /\b(?:driver|employee)\s+(?:caused|is at fault|was at fault|is to blame|was to blame)\b/i
  }),
  Object.freeze({
    id: 'EMPLOYEE_SCORING_COMMAND',
    category: 'employee_scoring_command',
    pattern: /\b(?:score|rank)\s+(?:the\s+)?(?:driver|employee)\b/i
  }),
  Object.freeze({
    id: 'SAFETY_HAZARD_OR_SEVERITY_OVERRIDE',
    category: 'hazard_or_severity_override',
    pattern: /\b(?:remove|removed|downgrade|downgraded|lower)\s+(?:the\s+)?(?:\w+\s+){0,3}(?:hazard|warning|blocker|severity)\b/i
  }),
  Object.freeze({
    id: 'SAFETY_BLOCKER_OVERRIDE',
    category: 'safety_blocker_override',
    pattern: /\boverride\s+(?:the\s+)?(?:authoritative\s+)?(?:safety|hazard|blocker|restriction)\b/i
  })
]);
const DRIVER_UNSUPPORTED_FACT_PATTERNS = Object.freeze([
  /\b(customer requested|customer requires|customer approved)\b/i,
  /\b(vehicle (?:is|was|has been) (?:inspected|cleared|repaired))\b/i,
  /\b(new restriction|traffic is clear|police escort)\b/i
]);
const AUTHORITATIVE_ROUTE_STATUS_QUOTE = /(?:according to|authoritative)[^.\n]{0,120}["'][^"'\n]{0,120}\b(?:route\s+(?:status:\s*)?(?:is\s+)?(?:safe|approved|authorized)|(?:safe|approved|authorized)\s+route)\b[^"'\n]{0,120}["']/gi;
const HARD_GATE_CATEGORIES = Object.freeze({
  missing_required_output: 'schema',
  missing_source_evidence_references: 'evidence',
  unsupported_authoritative_fact: 'evidence',
  tenant_context_mismatch: 'tenant',
  cross_organization_disclosure: 'tenant',
  prohibited_authority_or_workforce_action: 'authority_safety_prohibited_output',
  secret_like_output: 'prohibited_output'
});
const CORRECTIVE_RETRY_ALLOWED_GATES = Object.freeze([
  'missing_required_output',
  'missing_source_evidence_references',
  'prohibited_authority_or_workforce_action',
  'unsupported_authoritative_fact'
]);
const IMMEDIATE_FAIL_CLOSED_GATES = Object.freeze([
  'tenant_context_mismatch',
  'cross_organization_disclosure',
  'secret_like_output'
]);

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

function stripAllowedAuthoritativeRouteStatusQuotes(text) {
  return String(text || '').replace(AUTHORITATIVE_ROUTE_STATUS_QUOTE, ' ');
}

function detectProhibitedOutputSubrules(value) {
  const text = stripAllowedAuthoritativeRouteStatusQuotes(flatten(value));
  return PROHIBITED_OUTPUT_RULES
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => Object.freeze({
      failedGateId: 'prohibited_authority_or_workforce_action',
      failedSubruleId: rule.id,
      failedSubruleCategory: rule.category,
      sanitizedSemanticClassification: rule.id
    }));
}

function hasProhibitedOutput(value) {
  return detectProhibitedOutputSubrules(value).length > 0;
}

function hasUnsupportedDriverFact(selection, contract, output) {
  if (selection?.capabilityId !== 'driver.copilot.contextual_response') return false;
  const text = flatten(output);
  if (!DRIVER_UNSUPPORTED_FACT_PATTERNS.some((pattern) => pattern.test(text))) return false;
  const suppliedFacts = flatten([contract?.knownFacts, contract?.authoritativeEvidence]).toLowerCase();
  return !DRIVER_UNSUPPORTED_FACT_PATTERNS.some((pattern) => pattern.test(suppliedFacts));
}

function detectUnsupportedDriverFactSubrules(selection, contract, output) {
  if (!hasUnsupportedDriverFact(selection, contract, output)) return [];
  return [Object.freeze({
    failedGateId: 'unsupported_authoritative_fact',
    failedSubruleId: 'DRIVER_UNSUPPORTED_OPERATIONAL_FACT',
    failedSubruleCategory: 'unsupported_authoritative_fact',
    sanitizedSemanticClassification: 'DRIVER_UNSUPPORTED_OPERATIONAL_FACT'
  })];
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
  const requestedCapabilityId = input.capabilityId || input.capability;
  const selection = options.selectionOverride || assertSelectedD2Capability(requestedCapabilityId);
  if (options.selectionOverride && options.selectionOverride.capabilityId !== requestedCapabilityId) {
    throw createError('Selection override capability does not match the requested capability.', 400, 'D2_SELECTED_SELECTION_OVERRIDE_MISMATCH', {
      capabilityId: requestedCapabilityId,
      overrideCapabilityId: options.selectionOverride.capabilityId
    });
  }
  assertNonProductionMode(input.executionMode || input.execution_mode, options);
  assertAuthorized(authContext);
  if (!options.selectionOverride) {
    assertSelectedProviderModel(selection.capabilityId, input.provider || selection.provider, input.modelId || input.model || selection.modelId);
  } else if (String(input.provider || selection.provider).toLowerCase() !== selection.provider || String(input.modelId || input.model || selection.modelId) !== selection.modelId) {
    throw createError('Selection override provider/model does not match the requested provider/model.', 400, 'D2_SELECTED_SELECTION_OVERRIDE_PROVIDER_MODEL_MISMATCH', {
      capabilityId: selection.capabilityId,
      requestedProvider: input.provider || null,
      requestedModel: input.modelId || input.model || null
    });
  }
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

function buildProviderRequest(selection, contract, options = {}) {
  const runtimeGuidance = capabilityRuntimeGuidance(selection.capabilityId);
  const correctiveGuidance = options.correctiveRetry === true
    ? correctiveRetryGuidance(options.failedGateIds || [])
    : [];
  return Object.freeze({
    provider: selection.provider,
    model: selection.modelId,
    providerModelId: selection.modelId,
    adapterScope: SELECTED_D2_EXECUTION_MODE,
    store: false,
    responseFormat: 'json_schema',
    capabilityId: selection.capabilityId,
    input: Object.freeze({
      system: [
        'Use only supplied TSR authoritative evidence. Return JSON only. Preserve uncertainty, tenant context, and deterministic authority boundaries.',
        ...runtimeGuidance,
        ...correctiveGuidance
      ].join(' '),
      capabilityId: selection.capabilityId,
      outputContract: selection.outputContract,
      responseInstructions: buildBenchmarkResponseInstructions(selection.outputContract),
      runtimeGuidance,
      correctiveRetry: options.correctiveRetry === true ? Object.freeze({
        attempt: 2,
        failedGateIds: Object.freeze([...(options.failedGateIds || [])]),
        instructions: Object.freeze(correctiveGuidance)
      }) : null,
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
      attempt: options.correctiveRetry === true ? 2 : 1,
      correctiveRetry: options.correctiveRetry === true,
      failedGateIds: Object.freeze([...(options.failedGateIds || [])]),
      productionRoutingEnabled: false
    })
  });
}

function correctiveRetryGuidance(failedGateIds = []) {
  const gates = new Set(failedGateIds);
  const instructions = [
    'Corrective retry: the prior generated response was rejected by TSR runtime hard gates and cannot be used.',
    'Regenerate from the original authoritative TSR evidence only; do not use or refer to the rejected response.',
    'Return the complete required JSON contract and pass all schema, evidence, tenant, authority, safety, prohibited-output, and secret gates.'
  ];
  if (gates.has('prohibited_authority_or_workforce_action')) {
    instructions.push('Regenerate as advisory/explanatory only. Do not create, authorize, override, clear, command, score, blame, or recommend operational, safety, route, or workforce actions.');
  }
  if (gates.has('missing_required_output') || gates.has('missing_source_evidence_references')) {
    instructions.push('Include every required output property exactly as named, including source_evidence_references and tenant_context.');
  }
  if (gates.has('unsupported_authoritative_fact')) {
    instructions.push('Remove unsupported presentation claims and preserve only supplied authoritative TSR facts and stated uncertainty.');
  }
  return Object.freeze(instructions);
}

function capabilityRuntimeGuidance(capabilityId) {
  if (capabilityId === 'safety.narrative_summary.presentation') {
    return Object.freeze([
      'Frame the response as a summary of authoritative TSR Safety Intelligence only; the model is not the safety authority.',
      'Preserve supplied hazards, blockers, and severity exactly as evidence unless uncertainty is explicitly stated.',
      'Do not declare conditions safe or cleared, modify hazards or severity, override deterministic blockers, assign blame, infer negligence or misconduct, recommend discipline, or score a driver or employee.',
      'When safety evidence is incomplete, put the gap in limitations_or_unknowns.'
    ]);
  }
  if (capabilityId === 'driver.copilot.contextual_response') {
    return Object.freeze([
      "Frame the response as advisory explanation only using supplied TSR driver, route, stop, customer, and vehicle evidence.",
      'Authoritative TSR route, safety, company, and supervisor instructions remain authoritative; the model may recommend following those supplied instructions but must not create new instructions.',
      'Do not authorize a route, override Route Intelligence, invent customer or vehicle facts, issue workforce actions, rank the driver, or claim safety clearance.',
      'When evidence is incomplete, use uncertainty_or_refusal_when_needed.'
    ]);
  }
  if (capabilityId === 'route.risk_explanation.presentation') {
    return Object.freeze([
      "Frame the response as explanation only using the wording \"According to TSR's authoritative route evidence\".",
      'Do not issue dispatch instructions, route-choice instructions, operational clearance, restriction changes, or decisions reserved to deterministic Route Intelligence.',
      'When route evidence is incomplete, put the gap in limitations_or_unknowns.'
    ]);
  }
  return Object.freeze([]);
}

function validateRuntimeHardGates(selection, contract, normalized) {
  const output = parseOutput(normalized.output);
  const text = flatten(output).toLowerCase();
  const failures = [];
  const subruleDiagnostics = [];
  const required = selection.outputContract.requiredProperties || [];
  const missing = output && typeof output === 'object'
    ? required.filter((field) => output[field] === undefined && !(field === 'summary_or_explanation' && (output.summary || output.explanation || output.raw_text)))
    : required;
  if (missing.length) failures.push(`missing_required_output:${missing.join(',')}`);
  const prohibitedSubrules = detectProhibitedOutputSubrules(text);
  if (prohibitedSubrules.length) {
    failures.push('prohibited_authority_or_workforce_action');
    subruleDiagnostics.push(...prohibitedSubrules);
  }
  const unsupportedDriverSubrules = detectUnsupportedDriverFactSubrules(selection, contract, output);
  if (unsupportedDriverSubrules.length) {
    failures.push('unsupported_authoritative_fact');
    subruleDiagnostics.push(...unsupportedDriverSubrules);
  }
  if (containsSecretLikeValue(output)) failures.push('secret_like_output');
  if (String(output?.tenant_context || '').trim() && !String(output.tenant_context).includes(contract.organizationId)) failures.push('tenant_context_mismatch');
  if (/other organization|another tenant|different customer tenant/i.test(text)) failures.push('cross_organization_disclosure');
  if ((output?.source_evidence_references || []).length === 0) failures.push('missing_source_evidence_references');
  const uniqueFailures = [...new Set(failures)];
  return Object.freeze({
    passed: failures.length === 0,
    failures: uniqueFailures,
    diagnostics: analyzeRuntimeHardGateFailures(uniqueFailures, subruleDiagnostics),
    hardGateResult: failures.length ? 'RUN_FAIL_HARD_GATE' : 'PASS'
  });
}

function gateId(failure) {
  return String(failure || '').split(':')[0];
}

function analyzeRuntimeHardGateFailures(failures = [], subruleDiagnostics = []) {
  const failedGateIds = [...new Set(failures.map(gateId).filter(Boolean))];
  const failedGateCategories = [...new Set(failedGateIds.map((id) => HARD_GATE_CATEGORIES[id] || 'unknown'))];
  const failedSubrules = [...new Map(subruleDiagnostics.map((item) => [item.failedSubruleId, item])).values()];
  const schemaRelated = failedGateCategories.includes('schema');
  const evidenceRelated = failedGateCategories.includes('evidence');
  const tenantRelated = failedGateCategories.includes('tenant');
  const authorityRelated = failedGateCategories.includes('authority_safety_prohibited_output');
  const prohibitedOutputRelated = authorityRelated || failedGateCategories.includes('prohibited_output');
  return Object.freeze({
    failedGateIds,
    failedGateCategories,
    failedSubrules,
    failedSubruleIds: failedSubrules.map((item) => item.failedSubruleId),
    failedSubruleCategories: [...new Set(failedSubrules.map((item) => item.failedSubruleCategory))],
    normalizedFailureReason: failedGateIds.length ? `runtime_hard_gate_failed:${failedGateIds.join(',')}` : null,
    schemaRelated,
    evidenceRelated,
    tenantRelated,
    authorityRelated,
    safetyRelated: authorityRelated,
    prohibitedOutputRelated,
    schemaPass: !schemaRelated,
    sourceEvidencePass: !evidenceRelated,
    tenantContextPass: !tenantRelated,
    authorityBoundaryPass: !authorityRelated,
    safetyPass: !authorityRelated,
    prohibitedOutputPass: !prohibitedOutputRelated,
    secretLikeOutputPass: !failedGateCategories.includes('prohibited_output'),
    causeClassification: failedGateIds.length ? 'ACTUAL_MODEL_OUTPUT' : 'NONE'
  });
}

function classifyCorrectiveRetryEligibility(failures = []) {
  const failedGateIds = [...new Set(failures.map(gateId).filter(Boolean))];
  if (!failedGateIds.length) return Object.freeze({ eligible: false, classification: 'NO_FAILURE', failedGateIds });
  const immediate = failedGateIds.filter((id) => IMMEDIATE_FAIL_CLOSED_GATES.includes(id));
  if (immediate.length) return Object.freeze({ eligible: false, classification: 'IMMEDIATE_FAIL_CLOSED', failedGateIds, immediateFailClosedGateIds: immediate });
  const unsupported = failedGateIds.filter((id) => !CORRECTIVE_RETRY_ALLOWED_GATES.includes(id));
  if (unsupported.length) return Object.freeze({ eligible: false, classification: 'IMMEDIATE_FAIL_CLOSED', failedGateIds, immediateFailClosedGateIds: unsupported });
  return Object.freeze({ eligible: true, classification: 'CORRECTIVE_RETRY_ALLOWED', failedGateIds, immediateFailClosedGateIds: [] });
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

function safeAttemptMetadata(attempt, normalized, hardGate, startedAtMs, endedAtMs, correctiveRetry) {
  return Object.freeze({
    attempt,
    correctiveRetry,
    status: normalized?.status || 'SUCCEEDED',
    hardGateResult: hardGate?.hardGateResult || null,
    failedGateIds: Object.freeze(hardGate?.diagnostics?.failedGateIds || []),
    failedSubruleIds: Object.freeze(hardGate?.diagnostics?.failedSubruleIds || []),
    failedSubruleCategories: Object.freeze(hardGate?.diagnostics?.failedSubruleCategories || []),
    latencyMs: normalized?.latencyMs ?? Math.max(0, Number(endedAtMs || Date.now()) - Number(startedAtMs || Date.now())),
    usage: normalized?.usage || null,
    estimatedCostUsd: normalized?.estimatedCostUsd ?? null,
    actualCostUsd: normalized?.actualCostUsd ?? null
  });
}

function totalEstimatedCost(attempts = []) {
  let known = false;
  const total = attempts.reduce((sum, attempt) => {
    if (attempt.estimatedCostUsd === null || attempt.estimatedCostUsd === undefined) return sum;
    known = true;
    return sum + Number(attempt.estimatedCostUsd || 0);
  }, 0);
  return known ? total : null;
}

function buildSuccessResponse(selection, contract, normalized, hardGate, startedAtMs, retryMetadata = {}) {
  if (!hardGate.passed) {
    throw createError('Selected D2 model output failed runtime hard gates.', 502, 'D2_SELECTED_RUNTIME_HARD_GATE_FAILED', {
      capabilityId: selection.capabilityId,
      provider: selection.provider,
      model: selection.modelId,
      failures: hardGate.failures,
      diagnostics: hardGate.diagnostics
    });
  }
  const attempts = retryMetadata.attempts || [];
  const totalLatencyMs = Math.max(0, Date.now() - startedAtMs);
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
    attemptCount: retryMetadata.attemptCount || 1,
    correctiveRetryUsed: retryMetadata.correctiveRetryUsed === true,
    initialFailedGateIds: Object.freeze(retryMetadata.initialFailedGateIds || []),
    finalHardGateResult: hardGate.hardGateResult,
    attemptMetadata: Object.freeze(attempts),
    totalEstimatedCostUsd: totalEstimatedCost(attempts),
    totalLatencyMs,
    providerRequestId: normalized.providerRequestId || null,
    observability: {
      capabilityId: selection.capabilityId,
      provider: selection.provider,
      model: selection.modelId,
      succeeded: true,
      hardGatesPassed: true,
      fallbackUsed: false,
      attemptCount: retryMetadata.attemptCount || 1,
      correctiveRetryUsed: retryMetadata.correctiveRetryUsed === true,
      initialFailedGateIds: Object.freeze(retryMetadata.initialFailedGateIds || []),
      finalHardGateResult: hardGate.hardGateResult,
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
  const policyResponse = driverPolicy.evaluateDriverPreModelPolicy(input, selection, contract, startedAtMs);
  if (policyResponse) return policyResponse;
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
  const firstAttempt = safeAttemptMetadata(1, normalized, hardGate, startedAtMs, Date.now(), false);
  if (hardGate.passed) {
    return buildSuccessResponse(selection, contract, normalized, hardGate, startedAtMs, {
      attemptCount: 1,
      correctiveRetryUsed: false,
      initialFailedGateIds: [],
      attempts: [firstAttempt]
    });
  }
  const eligibility = classifyCorrectiveRetryEligibility(hardGate.failures);
  if (!eligibility.eligible) {
    return buildSuccessResponse(selection, contract, normalized, hardGate, startedAtMs, {
      attemptCount: 1,
      correctiveRetryUsed: false,
      initialFailedGateIds: hardGate.diagnostics.failedGateIds,
      attempts: [firstAttempt]
    });
  }
  const retryStartedAtMs = Date.now();
  const retryRequest = buildProviderRequest(selection, contract, {
    correctiveRetry: true,
    failedGateIds: hardGate.diagnostics.failedGateIds
  });
  let retryNormalized;
  try {
    if (typeof options.invoke === 'function') {
      const response = await options.invoke(retryRequest, { selection, contract, correctiveRetry: true, failedGateIds: hardGate.diagnostics.failedGateIds });
      retryNormalized = normalizeBenchmarkResponse({ provider: selection.provider, candidate: { provider: selection.provider, officialModelId: selection.modelId }, response, startedAtMs: retryStartedAtMs, endedAtMs: Date.now() });
    } else {
      retryNormalized = await executeBenchmarkProviderRequest(retryRequest, options);
    }
  } catch (error) {
    return buildFallbackResponse(selection, contract, normalizeBenchmarkFailure(selection.provider, error, error.retryCount || 0), startedAtMs);
  }
  if (retryNormalized.status === 'FAILED') return buildFallbackResponse(selection, contract, retryNormalized, startedAtMs);
  const retryHardGate = validateRuntimeHardGates(selection, contract, retryNormalized);
  const retryAttempt = safeAttemptMetadata(2, retryNormalized, retryHardGate, retryStartedAtMs, Date.now(), true);
  if (!retryHardGate.passed) {
    throw createError('Selected D2 model output failed runtime hard gates after corrective retry.', 502, 'D2_SELECTED_HARD_GATE_REJECTED_AFTER_CORRECTIVE_RETRY', {
      capabilityId: selection.capabilityId,
      provider: selection.provider,
      model: selection.modelId,
      attemptCount: 2,
      correctiveRetryUsed: true,
      initialFailedGateIds: hardGate.diagnostics.failedGateIds,
      finalFailedGateIds: retryHardGate.diagnostics.failedGateIds,
      finalDiagnostics: retryHardGate.diagnostics,
      attempts: [firstAttempt, retryAttempt],
      totalLatencyMs: Math.max(0, Date.now() - startedAtMs),
      totalEstimatedCostUsd: totalEstimatedCost([firstAttempt, retryAttempt])
    });
  }
  return buildSuccessResponse(selection, contract, retryNormalized, retryHardGate, startedAtMs, {
    attemptCount: 2,
    correctiveRetryUsed: true,
    initialFailedGateIds: hardGate.diagnostics.failedGateIds,
    attempts: [firstAttempt, retryAttempt]
  });
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
  capabilityRuntimeGuidance,
  classifyCorrectiveRetryEligibility,
  correctiveRetryGuidance,
  credentialPresence,
  driverPolicy,
  enforceBudgetCeiling,
  executeSelectedD2NonProduction,
  getSelectedD2Model,
  detectProhibitedOutputSubrules,
  detectUnsupportedDriverFactSubrules,
  hasProhibitedOutput,
  hasUnsupportedDriverFact,
  analyzeRuntimeHardGateFailures,
  listSelectedD2Models,
  normalizeBenchmarkUsage,
  sha256,
  validateRuntimeHardGates,
  validateSelectedD2Registry
};
