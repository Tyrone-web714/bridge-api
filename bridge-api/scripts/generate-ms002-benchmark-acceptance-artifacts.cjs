#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildRegistry, stable } = require('./generate-ms001-capability-classification-artifacts.cjs');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'ai-development', 'model-selection', 'ms-002-benchmark-acceptance-framework');
const generatedRoot = path.join(docsRoot, 'generated');

const EXECUTION_STRATEGY_ORDER = Object.freeze([
  'deterministic_rules',
  'conventional_algorithms',
  'statistical_or_mathematical_methods',
  'optimization_engines',
  'conventional_machine_learning',
  'local_models',
  'low_cost_hosted_models',
  'balanced_hosted_models',
  'premium_hosted_models',
  'human_review'
]);

const GATE_STATUSES = Object.freeze(['NOT_STARTED', 'REPOSITORY_DEFINED', 'OWNER_APPROVAL_REQUIRED']);

function sha(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function json(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((value) => String(value ?? '').replace(/\|/g, '/')).join(' | ')} |`)
  ].join('\n');
}

function mdList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function candidateFamily(capability) {
  if (capability.executionClass === 'D1') return 'prediction_or_lightweight_computation';
  if (capability.futureAiRoles.includes('CONVERSATION')) return 'conversational_response';
  if (capability.futureAiRoles.includes('REASONING')) return 'operational_synthesis';
  if (capability.futureAiRoles.includes('EXTRACTION')) return 'structured_response_compatibility';
  if (capability.futureAiRoles.includes('EXPLANATION')) return 'explanation_or_presentation';
  return 'summarization_or_presentation';
}

function intendedFunction(capability) {
  if (capability.executionClass === 'D1') return `Evaluate future lightweight computational approaches for ${capability.capabilityName} without defaulting to generative AI.`;
  return `Evaluate future advisory presentation quality for ${capability.capabilityName} while preserving supplied TSR evidence and deterministic authority.`;
}

function expectedOutputContract(capability) {
  if (capability.executionClass === 'D1') {
    return {
      outputType: 'prediction_or_classification_record',
      requiredProperties: ['prediction_value_or_label', 'confidence_or_uncertainty', 'evidence_lineage', 'missing_data_flags', 'tenant_context'],
      prohibitedProperties: ['unsupported_causation', 'fabricated_evidence', 'provider_selected', 'model_selected']
    };
  }
  if (capability.futureAiRoles.includes('CONVERSATION')) {
    return {
      outputType: 'grounded_advisory_response',
      requiredProperties: ['answer', 'source_evidence_references', 'uncertainty_or_refusal_when_needed', 'tenant_context'],
      prohibitedProperties: ['fabricated_operational_fact', 'deterministic_override', 'cross_organization_content']
    };
  }
  return {
    outputType: 'grounded_summary_or_explanation',
    requiredProperties: ['summary_or_explanation', 'source_evidence_references', 'limitations_or_unknowns', 'tenant_context'],
    prohibitedProperties: ['fabricated_evidence', 'deterministic_override', 'unsupported_recommendation']
  };
}

function qualityDimensions(capability) {
  if (capability.executionClass === 'D1') {
    return [
      'prediction_error_defined_metric_threshold_deferred',
      'calibration_defined_metric_threshold_deferred',
      'precision_recall_defined_metric_threshold_deferred_where_classification_applies',
      'false_positive_false_negative_consequence_recording',
      'stability_across_repeated_runs',
      'missing_data_behavior',
      'stale_data_behavior',
      'tenant_isolation',
      'reproducibility'
    ];
  }
  const dimensions = [
    'factual_consistency',
    'grounding_to_supplied_evidence',
    'instruction_adherence',
    'structured_output_validity',
    'completeness',
    'relevance',
    'concision',
    'deterministic_authority_preservation',
    'uncertainty_or_refusal_behavior'
  ];
  if (capability.futureAiRoles.includes('EXPLANATION')) dimensions.push('explanation_usefulness');
  if (capability.futureAiRoles.includes('CONVERSATION')) dimensions.push('conversation_context_control');
  if (capability.futureAiRoles.includes('REASONING')) dimensions.push('reasoning_trace_grounded_in_supplied_facts');
  if (capability.futureAiRoles.includes('EXTRACTION')) dimensions.push('schema_field_accuracy');
  dimensions.push('hallucination_or_error_rate_defined_metric_threshold_deferred');
  return dimensions;
}

function hardDisqualificationConditions(capability) {
  const common = [
    'cross-Organization leakage',
    'presenting unknown evidence as known',
    'converting insufficient evidence into certainty',
    'fabricating source evidence',
    'malformed required output contract',
    'provider or model selection asserted by benchmark evidence'
  ];
  const safety = capability.safetyRelevant ? [
    'contradicting authoritative route restriction',
    'inventing safe clearance',
    'suppressing known safety blocker',
    'changing vehicle/route compatibility facts',
    'changing warehouse readiness facts',
    'fabricating driver operational evidence'
  ] : [];
  const customer = capability.domain === 'Customer Intelligence' ? ['fabricating customer/account facts'] : [];
  return [...safety, ...customer, ...common];
}

function acceptanceProfile(capability) {
  const safetyGate = capability.safetyRelevant
    ? 'Deterministic safety, legal, physical, tenant, authorization, and policy controls must remain authoritative and non-overridable.'
    : 'Deterministic tenant, authorization, privacy, policy, and evidence controls must remain authoritative.';
  const roleSet = capability.futureAiRoles.filter((role) => role !== 'NONE');
  const family = candidateFamily(capability);
  return stable({
    capabilityId: capability.capabilityId,
    capabilityName: capability.capabilityName,
    domain: capability.domain,
    executionClass: capability.executionClass,
    capabilityFamily: family,
    intendedFunction: intendedFunction(capability),
    authoritativeInputs: capability.repositoryEvidence,
    expectedOutputContract: expectedOutputContract(capability),
    benchmarkDatasetReference: {
      source: 'future owner-approved synthetic/offline benchmark dataset',
      requiredCaseTypes: [
        'known-answer cases',
        'edge cases',
        'missing evidence',
        'conflicting evidence',
        'stale evidence',
        'malformed evidence',
        'tenant mismatch',
        'normal/no-exception cases',
        'difficult but valid cases'
      ],
      safetyCriticalCasesRequired: Boolean(capability.safetyRelevant),
      versionHashRequiredForFutureRuns: true,
      providerOutputMayBecomeGroundTruth: false
    },
    benchmarkRequirement: capability.benchmarkRequirement,
    modelBenchmarkRequired: capability.modelBenchmarkRequired,
    safetyRelevant: Boolean(capability.safetyRelevant),
    futureAiRoles: roleSet,
    benchmarkPlanStatus: 'REPOSITORY_DEFINED',
    liveBenchmarkStatus: 'NOT_STARTED',
    providerSelectionStatus: 'NOT_STARTED',
    modelSelectionStatus: 'NOT_STARTED',
    productionActivationStatus: 'NOT_STARTED',
    allowedStrategiesForFutureEvaluation: capability.executionClass === 'D1'
      ? ['deterministic_rules','statistical_or_mathematical_methods','conventional_algorithms','conventional_machine_learning','local_models','low_cost_hosted_models','human_review']
      : EXECUTION_STRATEGY_ORDER,
    d1MustNotDefaultToGenerativeAi: capability.executionClass === 'D1',
    qualityDimensions: qualityDimensions(capability),
    reliabilityRequirements: [
      'request failures counted',
      'timeouts counted',
      'malformed outputs counted',
      'schema failures counted',
      'retries counted',
      'non-deterministic instability measured where relevant',
      'refusal failures counted where response is required',
      'grounding failures counted',
      'unavailable service behavior recorded'
    ],
    latencyMeasurement: {
      metricDefined: true,
      thresholdStatus: 'OWNER_OR_EMPIRICAL_THRESHOLD_REQUIRED',
      productionSloClaimed: false
    },
    usageMeasurement: {
      inputUsageRequired: true,
      outputUsageRequired: true,
      requestCountRequired: true,
      retryCountRequired: true,
      failedRequestCountRequired: true
    },
    costMeasurement: {
      unitCostRequiredForFutureRun: true,
      perCapabilityExecutionCostRequired: true,
      operationalVolumeEstimateRequired: true,
      aggregateCostEstimateRequired: true,
      currentProviderPricingInserted: false,
      retryAndFailureOverheadIncluded: true
    },
    failureConditions: [
      'timeout',
      'request failure',
      'malformed output',
      'schema failure',
      'grounding failure',
      'refusal failure where response is required',
      'unsafe certainty from insufficient evidence',
      'fallback unavailable'
    ],
    hardDisqualificationConditions: hardDisqualificationConditions(capability),
    minimumAcceptanceEvidence: [
      'input dataset lineage and fixture version recorded',
      'expected output contract documented',
      'deterministic authority boundary preserved',
      'quality observations captured without selecting a winner',
      'latency observations captured without production SLO claims',
      'cost observations captured without pricing approval',
      'failure mode and fallback behavior recorded',
      'tenant isolation and privacy controls verified',
      'human review requirement recorded when applicable'
    ],
    rejectionConditions: [
      'model output overrides deterministic safety or legal controls',
      'provider or model is selected before owner approval',
      'hosted benchmark is executed before owner approval',
      'production orchestration or runtime activation is claimed',
      'benchmark data uses production data without separate approval',
      'cost is used to waive safety, compliance, privacy, tenant isolation, or minimum quality gates'
    ],
    acceptanceDecisionState: 'OWNER_APPROVAL_REQUIRED_AFTER_EVIDENCE',
    aggregateScoringPolicy: {
      hardGatesBeforeAggregateScore: true,
      aggregateScoreMayOverrideMandatoryGate: false,
      safetyFailureCanBeAveragedOut: false,
      selectionRule: 'cost_constrained_sufficiency_not_highest_score_wins'
    },
    safetyGate,
    costPolicy: 'Choose the least expensive adequate future strategy only after evidence satisfies quality, safety, reliability, latency, governance, and fallback requirements.',
    deterministicAuthorityBoundary: capability.hybridBoundary || capability.safetyAuthority || 'Repository facts and deterministic TSR services remain authoritative.',
    thresholdPolicy: 'No numeric pass/fail threshold is approved by MS-002; thresholds must be owner-approved before live benchmarking or selection.',
    thresholdState: {
      metricDefined: true,
      ownerOrEmpiricalThresholdRequired: true,
      passByDefaultAllowed: false
    },
    reproducibilityRequirements: [
      'capability ID',
      'candidate execution method',
      'provider where applicable',
      'model where applicable',
      'model/version identifier where applicable',
      'benchmark dataset version/hash',
      'prompt/template version where applicable',
      'execution configuration',
      'timestamp',
      'run ID',
      'response/output',
      'latency',
      'usage',
      'retry count',
      'pass/fail gates',
      'scoring breakdown',
      'cost calculation',
      'disqualification reason',
      'final eligibility status'
    ]
  });
}

function buildFramework() {
  const ms001 = buildRegistry();
  const candidates = ms001.capabilities
    .filter((capability) => capability.modelBenchmarkRequired)
    .map(acceptanceProfile)
    .sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
  const d0Exclusions = ms001.capabilities
    .filter((capability) => !capability.modelBenchmarkRequired)
    .map((capability) => capability.capabilityId)
    .sort();
  const counts = {
    sourceCapabilityCount: ms001.counts.totalCapabilityCount,
    benchmarkCandidateCount: candidates.length,
    benchmarkExcludedD0Count: d0Exclusions.length,
    d1CandidateCount: candidates.filter((c) => c.executionClass === 'D1').length,
    d2CandidateCount: candidates.filter((c) => c.executionClass === 'D2').length,
    d3CandidateCount: candidates.filter((c) => c.executionClass === 'D3').length,
    ownerReviewRequiredCount: 0,
    providerSelectedCount: candidates.filter((c) => c.providerSelectionStatus !== 'NOT_STARTED').length,
    modelSelectedCount: candidates.filter((c) => c.modelSelectionStatus !== 'NOT_STARTED').length,
    liveBenchmarkExecutedCount: candidates.filter((c) => c.liveBenchmarkStatus !== 'NOT_STARTED').length,
    productionActivationCount: candidates.filter((c) => c.productionActivationStatus !== 'NOT_STARTED').length
  };
  const framework = stable({
    packageId: 'MS-002',
    title: 'Benchmark & Acceptance Framework',
    generatedFrom: 'bridge-api/scripts/generate-ms002-benchmark-acceptance-artifacts.cjs',
    generatedArtifact: true,
    sourcePackage: 'MS-001',
    sourceRegistryHash: ms001.registryHash,
    scope: {
      repositoryOnlyAnalysisDesign: true,
      providerSelectionPerformed: false,
      modelSelectionPerformed: false,
      hostedBenchmarkingPerformed: false,
      productionActivationPerformed: false,
      deploymentPerformed: false,
      migrationPerformed: false,
      productionChangePerformed: false,
      noNinthDomain: true
    },
    gateState: {
      modelSelectionGateStatus: 'DEFERRED',
      modelSelectionGateComplete: false,
      modelSelectionGateActive: false,
      productionOrchestrationGateStatus: 'DEFERRED',
      productionOrchestrationGateComplete: false,
      productionOrchestrationGateActive: false
    },
    executionStrategyOrder: EXECUTION_STRATEGY_ORDER,
    counts,
    benchmarkCandidates: candidates,
    benchmarkExclusions: d0Exclusions,
    cheapestSufficientSelectionPolicy: {
      governingRule: 'least_expensive_execution_option_that_reliably_satisfies_capability_acceptance_requirements',
      highestRawQualityScoreWins: false,
      sequence: [
        'D0 satisfies capability means no model',
        'D1 evaluates least-complex deterministic/statistical/lightweight methods before model escalation',
        'D2 evaluates eligible low-cost candidates before balanced or premium candidates',
        'hard gate failure disqualifies candidate before aggregate scoring',
        'among candidates passing mandatory gates, prefer lowest expected total operating cost',
        'more expensive candidate requires documented material operational advantage',
        'escalate only when cheaper eligible candidates fail or an explicit operational reason justifies escalation'
      ]
    },
    benchmarkDatasetGovernance: {
      syntheticOrOfflineCasesRequired: true,
      deterministicExpectedEvidenceRequired: true,
      knownAnswerCasesRequired: true,
      edgeCasesRequired: true,
      missingConflictingStaleMalformedEvidenceCasesRequired: true,
      tenantMismatchCasesRequired: true,
      safetyCriticalCasesRequiredWhereRelevant: true,
      normalNoExceptionCasesRequired: true,
      providerOutputMayBecomeGroundTruth: false,
      expectedResultsVersionable: true,
      datasetVersionHashTraceable: true,
      benchmarkRunMustIdentifyDatasetVersion: true
    },
    reproducibilityRunRecordSchema: [
      'capabilityId',
      'candidateExecutionMethod',
      'provider',
      'model',
      'modelVersionIdentifier',
      'benchmarkDatasetVersionHash',
      'promptTemplateVersion',
      'executionConfiguration',
      'timestamp',
      'runId',
      'responseOutput',
      'latency',
      'usage',
      'retryCount',
      'passFailGates',
      'scoringBreakdown',
      'costCalculation',
      'disqualificationReason',
      'finalEligibilityStatus'
    ],
    acceptanceGovernance: {
      allowedEvidenceThisPackage: [
        'repository-derived capability inventory',
        'repository-only benchmark design',
        'synthetic/offline dataset requirements',
        'metric definitions',
        'gate definitions',
        'owner-decision checkpoints'
      ],
      prohibitedEvidenceThisPackage: [
        'live provider output',
        'hosted model benchmark result',
        'provider ranking',
        'model ranking',
        'highest score wins selection rule',
        'pricing research approval',
        'premium tier approval',
        'production traffic evidence',
        'production orchestration evidence'
      ],
      decisionBoundary: 'MS-002 defines how future evidence will be accepted or rejected. It does not collect hosted benchmark evidence or select an execution strategy.'
    },
    frameworkHash: sha({ candidates, d0Exclusions, counts })
  });
  return framework;
}

function renderDocs(framework) {
  const candidates = framework.benchmarkCandidates;
  const candidateRows = candidates.map((c) => [
    c.capabilityId,
    c.domain,
    c.executionClass,
    c.futureAiRoles.join(', '),
    c.acceptanceDecisionState
  ]);
  const docs = {
    'README.md': [
      '# MS-002 - Benchmark & Acceptance Framework',
      '',
      'MS-002 defines the repository-only benchmark and acceptance framework for the Model Selection Gate. It consumes the MS-001 benchmark-candidate set and documents future evidence requirements, gates, metrics, rejection conditions, and owner-decision checkpoints.',
      '',
      'MS-002 does not select providers, select models, rank models, execute hosted benchmarks, activate hosted AI, deploy, run migrations, change production systems, or start production orchestration.',
      '',
      '## Source Inputs',
      '',
      `- Source package: ${framework.sourcePackage}`,
      `- Source capability count: ${framework.counts.sourceCapabilityCount}`,
      `- Benchmark candidate count: ${framework.counts.benchmarkCandidateCount}`,
      `- D0 benchmark exclusion count: ${framework.counts.benchmarkExcludedD0Count}`,
      '',
      '## Candidate Set',
      '',
      table(['Capability ID', 'Domain', 'Class', 'Future AI Roles', 'Acceptance State'], candidateRows)
    ].join('\n'),
    'BENCHMARK_SCOPE.md': [
      '# Benchmark Scope',
      '',
      'Future benchmarking is limited to the MS-001 candidate set where `modelBenchmarkRequired` is true. D0 deterministic capabilities remain excluded unless a later owner-approved scope change reclassifies them.',
      '',
      table(['Scope Item', 'State'], [
        ['Repository-only framework definition', true],
        ['Hosted benchmark execution', false],
        ['Provider selection', false],
        ['Model selection', false],
        ['Production activation', false],
        ['Deployment', false],
        ['Migration', false],
        ['Production data use', false]
      ]),
      '',
      '## Excluded D0 Capabilities',
      '',
      mdList(framework.benchmarkExclusions)
    ].join('\n'),
    'ACCEPTANCE_CRITERIA.md': [
      '# Acceptance Criteria',
      '',
      'Future benchmark evidence can be accepted only when every candidate records the following evidence categories before any owner decision.',
      '',
      mdList(candidates[0].minimumAcceptanceEvidence),
      '',
      'No numeric pass/fail threshold is approved by MS-002. Numeric thresholds require separate owner approval before live benchmarking or selection.'
    ].join('\n'),
    'CAPABILITY_ACCEPTANCE_CONTRACTS.md': [
      '# Capability Acceptance Contracts',
      '',
      'Every benchmark-required capability has its own acceptance contract. Metrics are defined here, while empirical pass/fail thresholds remain owner-approved future work.',
      '',
      table(
        ['Capability ID','Class','Family','Intended Function','Output Contract','Quality Dimensions','Threshold State'],
        candidates.map((c) => [
          c.capabilityId,
          c.executionClass,
          c.capabilityFamily,
          c.intendedFunction,
          c.expectedOutputContract.outputType,
          c.qualityDimensions.join('; '),
          c.thresholdState.ownerOrEmpiricalThresholdRequired ? 'OWNER_OR_EMPIRICAL_THRESHOLD_REQUIRED' : 'DEFINED'
        ])
      )
    ].join('\n'),
    'EVALUATION_METRICS.md': [
      '# Evaluation Metrics',
      '',
      table(['Metric Family', 'Purpose', 'MS-002 State'], [
        ['quality', 'Measure task-specific output usefulness against expected output contracts.', 'defined only'],
        ['safety', 'Verify deterministic safety/legal controls remain authoritative.', 'blocking gate'],
        ['reliability', 'Capture retry, fallback, timeout, and malformed-output behavior.', 'defined only'],
        ['latency', 'Record observed response time without production SLO claims.', 'defined only'],
        ['cost', 'Record future cost observations without pricing approval or procurement recommendation.', 'defined only'],
        ['privacy', 'Verify tenant isolation and sensitive-data minimization.', 'blocking gate'],
        ['fallback', 'Verify deterministic fallback or human-review behavior.', 'blocking gate']
      ])
    ].join('\n'),
    'CHEAPEST_SUFFICIENT_SELECTION.md': [
      '# Cheapest-Sufficient Selection',
      '',
      'The goal is not to find the most powerful model. The goal is to find the least expensive execution option that reliably satisfies the acceptance requirements of each TSR capability.',
      '',
      table(['Policy Item','Value'], [
        ['Governing rule', framework.cheapestSufficientSelectionPolicy.governingRule],
        ['Highest raw quality score wins', framework.cheapestSufficientSelectionPolicy.highestRawQualityScoreWins],
        ['Hard gates precede aggregate scoring', true]
      ]),
      '',
      '## Decision Sequence',
      '',
      mdList(framework.cheapestSufficientSelectionPolicy.sequence)
    ].join('\n'),
    'SAFETY_AND_GOVERNANCE_GATES.md': [
      '# Safety And Governance Gates',
      '',
      'Safety, legal, tenant, privacy, and authorization gates are blocking gates. Cost and model quality cannot waive them.',
      '',
      table(['Gate', 'Requirement'], [
        ['Safety authority', 'Model output must not override deterministic safety, legal, physical, route, or policy controls.'],
        ['Tenant isolation', 'Future benchmark inputs and outputs must preserve organization/user boundaries.'],
        ['Privacy', 'Future evidence must avoid unapproved production data and minimize sensitive content.'],
        ['Human review', 'Human-review requirements must be recorded before any advisory use.'],
        ['Fallback', 'A deterministic fallback or safe non-response must be defined.'],
        ['Auditability', 'Input lineage, output contract, observations, and decision rationale must be reproducible.']
      ]),
      '',
      '## Hard Disqualification Examples',
      '',
      mdList([...new Set(candidates.flatMap((c) => c.hardDisqualificationConditions))].sort()),
      '',
      'A severe deterministic-authority violation disqualifies the candidate regardless of aggregate quality score.'
    ].join('\n'),
    'COST_AND_LATENCY_POLICY.md': [
      '# Cost And Latency Policy',
      '',
      framework.benchmarkCandidates[0].costPolicy,
      '',
      'Cost is evaluated after blocking safety, compliance, privacy, tenant isolation, reliability, and minimum quality gates. The future selected strategy must be the least expensive adequate option, not the most capable option by default.',
      '',
      'Latency observations collected in a future approved package are evidence only. MS-002 does not define production SLOs.',
      '',
      'Future cost accounting must include input usage, output usage, request count, retries, failed requests, latency, unit cost, per-capability execution cost, operational volume, aggregate cost, and retry/failure overhead. MS-002 inserts no current provider pricing.'
    ].join('\n'),
    'RELIABILITY_FAILURE_ACCOUNTING.md': [
      '# Reliability And Failure Accounting',
      '',
      'MS-002 requires future benchmark runs to account for failed and degraded behavior, not only successful responses.',
      '',
      mdList(candidates[0].reliabilityRequirements),
      '',
      'Failure and retry overhead must be included in future cost calculations.'
    ].join('\n'),
    'BENCHMARK_DATASET_GOVERNANCE.md': [
      '# Benchmark Dataset Governance',
      '',
      'Benchmark ground truth must come from deterministic TSR evidence or owner-approved expected records. Provider/model output must not become ground truth merely because a model produced it.',
      '',
      table(['Requirement','State'], Object.entries(framework.benchmarkDatasetGovernance).map(([key, value]) => [key, value]))
    ].join('\n'),
    'REPRODUCIBILITY_CONTRACT.md': [
      '# Reproducibility Contract',
      '',
      'Future benchmark runs must record enough information to reproduce or audit the run. This is a schema/framework requirement only; MS-002 does not execute hosted runs.',
      '',
      mdList(framework.reproducibilityRunRecordSchema)
    ].join('\n'),
    'AGGREGATE_SCORING_POLICY.md': [
      '# Aggregate Scoring Policy',
      '',
      'Aggregate scoring cannot override mandatory gates.',
      '',
      'Correct conceptual order:',
      '',
      '1. Hard gates.',
      '2. Capability acceptance.',
      '3. Eligible candidates.',
      '4. Cost comparison.',
      '5. Escalation or justification if necessary.',
      '',
      'A candidate failing a mandatory safety, tenant, schema, output-contract, or deterministic-authority gate must not win through weighted averaging.'
    ].join('\n'),
    'PROVIDER_MODEL_DECISION_BOUNDARY.md': [
      '# Provider And Model Decision Boundary',
      '',
      'MS-002 intentionally stops before provider selection, model selection, provider ranking, model ranking, premium-tier approval, hosted AI activation, production orchestration, deployment, or migration.',
      '',
      'A later owner-approved package must authorize any hosted benchmark execution, provider comparison, model comparison, pricing research, premium model consideration, or production activation.'
    ].join('\n'),
    'OWNER_DECISIONS_REQUIRED.md': [
      '# Owner Decisions Required',
      '',
      mdList([
        'Approve or reject live hosted benchmark execution for the MS-001 candidate set.',
        'Approve benchmark datasets and whether production data may be used.',
        'Approve numeric acceptance thresholds before live benchmarking.',
        'Approve any provider list, model list, pricing research, premium-tier consideration, or hosted AI activation.',
        'Approve any production orchestration package only after benchmark evidence and governance controls exist.'
      ])
    ].join('\n'),
    'MS002_COMPLETION_REPORT.md': [
      '# MS-002 Completion Report',
      '',
      `Benchmark candidates: ${framework.counts.benchmarkCandidateCount}`,
      `D0 exclusions preserved: ${framework.counts.benchmarkExcludedD0Count}`,
      `D1 candidates: ${framework.counts.d1CandidateCount}`,
      `D2 candidates: ${framework.counts.d2CandidateCount}`,
      `D3 candidates: ${framework.counts.d3CandidateCount}`,
      '',
      'MS-002 defines repository-only benchmark and acceptance criteria for future owner-approved model-selection evidence. It does not execute hosted benchmarks, select providers, select models, rank models, activate hosted AI, deploy, run migrations, change production systems, or authorize production orchestration.'
    ].join('\n')
  };
  return docs;
}

function writeIfChanged(file, content, options = {}) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
  }
  return changed;
}

function generate(options = {}) {
  fs.mkdirSync(docsRoot, { recursive: true });
  fs.mkdirSync(generatedRoot, { recursive: true });
  const framework = buildFramework();
  const docs = renderDocs(framework);
  const outputs = {
    ...Object.fromEntries(Object.entries(docs).map(([name, content]) => [path.join(docsRoot, name), `${content}\n`])),
    [path.join(generatedRoot, 'ms002_framework.json')]: json(framework),
    [path.join(generatedRoot, 'ms002_summary.json')]: json(framework.counts),
    [path.join(generatedRoot, 'ms002_capability_acceptance_matrix.json')]: json(framework.benchmarkCandidates),
    [path.join(generatedRoot, 'ms002_readiness_checklist.json')]: json({
      packageId: framework.packageId,
      gateStatuses: GATE_STATUSES,
      repositoryOnlyFrameworkDefined: true,
      hostedBenchmarkingAuthorized: false,
      providerSelectionAuthorized: false,
      modelSelectionAuthorized: false,
      productionActivationAuthorized: false,
      requiredOwnerApprovalsBeforeNextPhase: [
        'live benchmark execution',
        'benchmark dataset approval',
        'numeric threshold approval',
        'provider/model candidate list approval',
        'pricing research approval if needed',
        'production orchestration approval'
      ]
    }),
    [path.join(generatedRoot, 'ms002_hash.json')]: json({
      frameworkHash: framework.frameworkHash,
      sourceRegistryHash: framework.sourceRegistryHash,
      benchmarkCandidateCount: framework.counts.benchmarkCandidateCount
    })
  };
  const changed = Object.entries(outputs)
    .filter(([file, content]) => writeIfChanged(file, content, options))
    .map(([file]) => path.relative(repoRoot, file).replace(/\\/g, '/'));
  if (options.check && changed.length) {
    console.error(`[ms002] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[ms002] generated ${Object.keys(outputs).length} artifacts in ${path.relative(repoRoot, docsRoot).replace(/\\/g, '/')}`);
  }
  return { changed, framework };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { buildFramework, generate, paths: { backendRoot, repoRoot, docsRoot, generatedRoot }, EXECUTION_STRATEGY_ORDER, GATE_STATUSES };
