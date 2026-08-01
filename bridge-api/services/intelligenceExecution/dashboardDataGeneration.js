const fs = require('fs');
const path = require('path');
const registry = require('./enterpriseCapabilityRegistry');
const datasets = require('./benchmarkDatasetFramework');
const evaluation = require('./evaluationEngine');
const scoring = require('./scoringEngine');
const cost = require('./costGovernance');
const decisions = require('./executionDecisionEngine');
const governance = require('./decisionGovernance');
const graphEngine = require('./knowledgeGraph');
const { EXECUTION_STRATEGIES } = require('./constants');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const dashboardDataRoot = path.join(backendRoot, 'dashboard-data');
const docsRoot = path.join(repoRoot, 'docs', 'implementation');
const DASHBOARD_SCHEMA_VERSION = 'intelligence.dashboard.dataset.v1';
const DASHBOARD_ENGINE_VERSION = 'intelligence.dashboard.generation.engine.v1';
const DETERMINISTIC_GENERATED_AT = '2026-07-25T00:00:00.000Z';
const DASHBOARDS = Object.freeze([
  ['executive.summary', 'Executive Summary Dashboard', 'executive_dashboard.json'],
  ['capability.overview', 'Capability Dashboard', 'capability_dashboard.json'],
  ['capability.coverage', 'Capability Coverage Dashboard', 'capability_coverage_dashboard.json'],
  ['capability.lifecycle', 'Capability Lifecycle Dashboard', 'capability_lifecycle_dashboard.json'],
  ['benchmark.dataset', 'Benchmark Dataset Dashboard', 'benchmark_dashboard.json'],
  ['evaluation.runs', 'Evaluation Dashboard', 'evaluation_dashboard.json'],
  ['execution.strategy', 'Execution Strategy Dashboard', 'execution_dashboard.json'],
  ['scoring.overview', 'Scoring Dashboard', 'scoring_dashboard.json'],
  ['cost.governance', 'Cost Governance Dashboard', 'cost_dashboard.json'],
  ['budget.overview', 'Budget Dashboard', 'budget_dashboard.json'],
  ['execution.decision', 'Execution Decision Dashboard', 'decision_dashboard.json'],
  ['decision.history', 'Decision History Dashboard', 'decision_history_dashboard.json'],
  ['governance.overview', 'Governance Dashboard', 'governance_dashboard.json'],
  ['human.review', 'Human Review Dashboard', 'human_review_dashboard.json'],
  ['exception.overview', 'Exception Dashboard', 'exception_dashboard.json'],
  ['findings.overview', 'Findings Dashboard', 'findings_dashboard.json'],
  ['attestation.overview', 'Attestation Dashboard', 'attestation_dashboard.json'],
  ['knowledge.graph', 'Knowledge Graph Dashboard', 'knowledge_graph_dashboard.json'],
  ['dependency.overview', 'Dependency Dashboard', 'dependency_dashboard.json'],
  ['impact.analysis', 'Impact Analysis Dashboard', 'impact_dashboard.json'],
  ['validation.overview', 'Validation Dashboard', 'validation_dashboard.json'],
  ['test.coverage', 'Test Coverage Dashboard', 'test_coverage_dashboard.json'],
  ['documentation.overview', 'Documentation Dashboard', 'documentation_dashboard.json'],
  ['generated.artifacts', 'Generated Artifact Dashboard', 'artifact_dashboard.json'],
  ['repository.health', 'Repository Health Dashboard', 'repository_health_dashboard.json'],
  ['technical.debt', 'Technical Debt Dashboard', 'technical_debt_dashboard.json'],
  ['owner.decisions', 'Owner Decision Dashboard', 'owner_decision_dashboard.json'],
  ['deferred.work', 'Deferred Work Dashboard', 'deferred_work_dashboard.json'],
  ['platform.readiness', 'Platform Readiness Dashboard', 'readiness_dashboard.json'],
  ['overall.platform', 'Overall Intelligence Platform Dashboard', 'overall_platform_dashboard.json']
].map(([dashboardId, title, fileName]) => ({ dashboardId, title, fileName, dashboardVersion: '0.1.0' })));
const REQUIRED_ARTIFACTS = Object.freeze(['dashboard_catalog.json','dashboard_catalog.csv','dashboard_summary.md','executive_dashboard.json','capability_dashboard.json','benchmark_dashboard.json','evaluation_dashboard.json','execution_dashboard.json','scoring_dashboard.json','cost_dashboard.json','decision_dashboard.json','governance_dashboard.json','knowledge_graph_dashboard.json','dependency_dashboard.json','impact_dashboard.json','validation_dashboard.json','documentation_dashboard.json','artifact_dashboard.json','technical_debt_dashboard.json','owner_decision_dashboard.json','readiness_dashboard.json','overall_platform_dashboard.json','dashboard_hashes.json']);
const PROHIBITED_KEYS = Object.freeze(['productionTimestamp','liveMetric','runtimeExecution','providerCallInvoked','policyChangeApplied','decisionChanged','governanceApprovalApplied','databaseWritePerformed','migrationExecuted','deploymentExecuted']);

function stable(value) { return governance.stable(value); }
function stableStringify(value) { return governance.stableStringify(value); }
function sha256(value) { return governance.sha256(value); }
function rel(p) { return path.relative(repoRoot, p).replace(/\\/g, '/'); }
function exists(p) { return fs.existsSync(p); }
function walk(dir, predicate = () => true) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, predicate);
    return entry.isFile() && predicate(full) ? [full] : [];
  });
}
function countBy(items, fn) { return items.reduce((acc, item) => { const key = fn(item) ?? 'UNKNOWN'; acc[key] = (acc[key] || 0) + 1; return acc; }, {}); }
function unique(values) { return [...new Set(values.flat().filter((value) => value !== undefined && value !== null))].sort(); }
function avg(values) { const nums = values.filter(Number.isFinite); return nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(6)) : null; }
function sum(values) { return values.filter(Number.isFinite).reduce((a, b) => a + b, 0); }
function fileNameFor(dashboardId) { return DASHBOARDS.find((d) => d.dashboardId === dashboardId)?.fileName || `${dashboardId.replace(/\./g, '_')}_dashboard.json`; }

function loadEvidence() {
  const graph = graphEngine.createGraph();
  const packageJson = JSON.parse(fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf8'));
  const docs = walk(docsRoot, (p) => p.endsWith('.md') || p.endsWith('.json') || p.endsWith('.csv'));
  return {
    capabilities: registry.listEnterpriseCapabilities(),
    benchmarkDatasets: datasets.listDatasets(),
    evaluationRuns: evaluation.runInitialEvaluations(),
    scoringProfiles: scoring.loadScoringProfiles(),
    scoreRuns: scoring.runInitialScoring(),
    pricingCatalogs: cost.loadPricingCatalogs(),
    costModelProfiles: cost.loadCostModelProfiles(),
    budgetProfiles: cost.loadBudgetProfiles(),
    costRuns: cost.runInitialCostGovernance(),
    decisionPolicies: decisions.loadDecisionPolicyProfiles(),
    decisionRequests: decisions.loadDecisionRequests(),
    decisionRecords: decisions.runInitialDecisions(),
    governancePolicies: governance.loadGovernancePolicyProfiles(),
    historyRecords: governance.listDecisionHistoryRecords(),
    governanceEvents: governance.listGovernanceEvents(),
    graph,
    graphValidation: graphEngine.validateGraph(graph),
    graphStats: graphEngine.graphStatistics(graph),
    docs,
    generatedArtifacts: docs.filter((p) => /generated/.test(rel(p))),
    packageJson,
    scripts: Object.keys(packageJson.scripts || {}).sort(),
    repoFiles: walk(repoRoot, (p) => !/\.git|node_modules|dashboard-data/.test(p)).map(rel)
  };
}

function commonDashboard(def, body) {
  const dashboard = {
    dashboardId: def.dashboardId,
    dashboardTitle: def.title,
    dashboardVersion: def.dashboardVersion,
    generatedAt: DETERMINISTIC_GENERATED_AT,
    sourceSubsystems: unique(body.sourceSubsystems || []),
    authoritativeSources: unique([def.dashboardId].concat(body.sourceSubsystems || [], body.authoritativeSources || [])),
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    engineVersion: DASHBOARD_ENGINE_VERSION,
    testOnly: true,
    productionApplicable: false,
    summary: body.summary || {},
    statistics: body.statistics || {},
    statusIndicators: body.statusIndicators || [],
    warnings: body.warnings || [],
    errors: body.errors || [],
    unknownValues: body.unknownValues || [],
    drillDownReferences: body.drillDownReferences || [],
    relatedDashboards: unique(body.relatedDashboards || []),
    documentationReferences: unique(body.documentationReferences || ['docs/implementation/dashboard-data-generation/README.md']),
    generatedArtifacts: unique(body.generatedArtifacts || ['dashboard-data/dashboard_catalog.json']),
    records: body.records || []
  };
  dashboard.generationHash = hashDashboard(dashboard);
  return stable(dashboard);
}
function hashDashboard(dashboard) {
  return sha256({
    schemaVersion: dashboard.schemaVersion,
    dashboardId: dashboard.dashboardId,
    dashboardVersion: dashboard.dashboardVersion,
    sourceSubsystems: dashboard.sourceSubsystems,
    authoritativeSources: dashboard.authoritativeSources,
    summary: dashboard.summary,
    statistics: dashboard.statistics,
    statusIndicators: dashboard.statusIndicators,
    warnings: dashboard.warnings,
    errors: dashboard.errors,
    unknownValues: dashboard.unknownValues,
    drillDownReferences: dashboard.drillDownReferences,
    relatedDashboards: dashboard.relatedDashboards,
    documentationReferences: dashboard.documentationReferences,
    generatedArtifacts: dashboard.generatedArtifacts,
    records: dashboard.records
  });
}

function buildDashboards(e = loadEvidence()) {
  const d = Object.fromEntries(DASHBOARDS.map((def) => [def.dashboardId, def]));
  const evalResults = e.evaluationRuns.flatMap((run) => run.results || []);
  const scoreRecords = e.scoreRuns.flatMap((run) => run.scoreRecords || []);
  const costRecords = e.costRuns.flatMap((run) => run.costRecords || []);
  const candidates = e.decisionRecords.flatMap((record) => record.enumeratedCandidates || []);
  const findings = e.historyRecords.flatMap((record) => record.findingRecords || []);
  const attestations = e.historyRecords.flatMap((record) => record.attestationRecords || []);
  const humanReviews = e.historyRecords.map((record) => record.humanReviewRecord).filter(Boolean);
  const exceptions = e.historyRecords.map((record) => record.exceptionRequestRecord).filter(Boolean);
  const capabilityStats = {
    total: e.capabilities.length,
    enabled: e.capabilities.filter((cap) => cap.enabled !== false).length,
    disabled: e.capabilities.filter((cap) => cap.enabled === false).length,
    experimental: e.capabilities.filter((cap) => /experimental/i.test(cap.lifecycleState || '')).length,
    deprecated: e.capabilities.filter((cap) => /deprecated/i.test(cap.lifecycleState || '')).length,
    retired: e.capabilities.filter((cap) => /retired/i.test(cap.lifecycleState || '')).length,
    byLifecycle: countBy(e.capabilities, (cap) => cap.lifecycleState),
    versionDistribution: countBy(e.capabilities, (cap) => cap.capabilityVersion || cap.version),
    executionStrategySupport: Object.fromEntries(Object.values(EXECUTION_STRATEGIES).map((strategy) => [strategy, e.capabilities.filter((cap) => (cap.allowedExecutionStrategies || []).includes(strategy)).length]))
  };
  const readiness = ['capabilities','benchmarkDatasets','evaluationRuns','scoreRuns','costRuns','decisionRecords','historyRecords'].map((key) => ({ area: key, ready: e[key].length > 0, status: e[key].length > 0 ? 'READY_REPOSITORY_ONLY' : 'MISSING_REPOSITORY_EVIDENCE' })).concat([{ area: 'knowledgeGraph', ready: e.graphValidation.valid, status: e.graphValidation.valid ? 'READY_REPOSITORY_ONLY' : 'INVALID_GRAPH' }]);
  const debtTokens = ['TODO', 'FIXME', 'DEFERRED', 'future work'];
  const debtCount = walk(repoRoot, (p) => /\.(js|cjs|md|json)$/.test(p) && !/\.git|node_modules|dashboard-data/.test(p)).filter((file) => debtTokens.some((token) => fs.readFileSync(file, 'utf8').includes(token))).length;
  const docsByArea = countBy(e.docs, (file) => rel(file).split('/').slice(0, 3).join('/'));
  const matrix = graphEngine.dependencyMatrix(e.graph);
  const impacts = graphEngine.impactMatrix(e.graph);
  const dashboardSpecs = [
    ['executive.summary', ['capability-registry','benchmark-datasets','evaluation-engine','scoring-engine','cost-governance','execution-decisions','decision-governance','knowledge-graph'], { capabilities: e.capabilities.length, dashboards: DASHBOARDS.length, graphHash: e.graph.graphHash }, { generatedArtifacts: REQUIRED_ARTIFACTS.length }, readiness],
    ['capability.overview', ['capability-registry','knowledge-graph'], capabilityStats, { datasetCoverage: countBy(e.benchmarkDatasets, (x) => x.capabilityId), decisionCoverage: countBy(e.decisionRecords, (x) => x.capabilityId), governanceCoverage: countBy(e.historyRecords, (x) => x.capabilityId), costCoverage: countBy(costRecords, (x) => x.capabilityId) }],
    ['capability.coverage', ['capability-registry','benchmark-datasets','execution-decisions','decision-governance'], { capabilityCount: e.capabilities.length }, { testScripts: e.scripts.filter((s) => s.startsWith('test')).length, documentationCoverage: docsByArea }],
    ['capability.lifecycle', ['capability-registry'], { byLifecycle: capabilityStats.byLifecycle }, { versionDistribution: capabilityStats.versionDistribution }],
    ['benchmark.dataset', ['benchmark-datasets'], { datasets: e.benchmarkDatasets.length, cases: sum(e.benchmarkDatasets.map((x) => x.cases?.length || 0)) }, { byCapability: countBy(e.benchmarkDatasets, (x) => x.capabilityId), byVersion: countBy(e.benchmarkDatasets, (x) => x.version) }],
    ['evaluation.runs', ['evaluation-engine'], { runs: e.evaluationRuns.length, results: evalResults.length }, { byStrategy: countBy(evalResults, (x) => x.strategy), byResultClass: countBy(evalResults, (x) => x.resultClass) }],
    ['execution.strategy', ['evaluation-engine','execution-decisions'], { supportedStrategies: Object.values(EXECUTION_STRATEGIES).length, candidates: candidates.length }, { usage: countBy(candidates.concat(evalResults), (x) => x.strategyId || x.strategy), selectedSynthetic: countBy(e.decisionRecords, (x) => x.advisorySelectedCandidateId || 'NONE'), fallbackCoverage: e.decisionRecords.filter((x) => (x.fallbackPlan || []).length).length }],
    ['scoring.overview', ['scoring-engine'], { profiles: e.scoringProfiles.length, runs: e.scoreRuns.length, records: scoreRecords.length }, { confidenceAverage: avg(scoreRecords.map((x) => x.confidence?.score)), completenessAverage: avg(scoreRecords.map((x) => x.completeness?.score)), gates: countBy(scoreRecords, (x) => x.gateStatus) }],
    ['cost.governance', ['cost-governance'], { pricingCatalogs: e.pricingCatalogs.length, budgets: e.budgetProfiles.length, models: e.costModelProfiles.length, records: costRecords.length }, { unknownCosts: costRecords.filter((x) => x.unknownCost).length, measuredCosts: costRecords.filter((x) => x.costSource === 'MEASURED').length, estimatedCosts: costRecords.filter((x) => x.costSource === 'ESTIMATED').length, mockCosts: costRecords.filter((x) => /mock/i.test(x.costSource || '')).length, confidence: countBy(costRecords, (x) => x.costConfidence) }],
    ['budget.overview', ['cost-governance'], { budgetProfiles: e.budgetProfiles.length }, { budgetViolationsSynthetic: e.costRuns.flatMap((x) => x.budgetEvaluations || []).filter((x) => x.budgetStatus === 'EXCEEDED').length, status: countBy(e.costRuns.flatMap((x) => x.budgetEvaluations || []), (x) => x.budgetStatus) }],
    ['execution.decision', ['execution-decisions'], { requests: e.decisionRequests.length, records: e.decisionRecords.length, abstentions: e.decisionRecords.filter((x) => /ABSTAIN/i.test(x.decisionOutcome || '')).length }, { outcomes: countBy(e.decisionRecords, (x) => x.decisionOutcome), policyUsage: countBy(e.decisionRecords, (x) => x.decisionPolicyProfileId), candidateFeasibility: countBy(candidates, (x) => x.feasibilityStatus), confidenceAverage: avg(candidates.map((x) => x.confidence?.score)) }],
    ['decision.history', ['decision-governance'], { histories: e.historyRecords.length, events: e.governanceEvents.length }, { byLifecycle: countBy(e.historyRecords, (x) => x.governanceLifecycleState), byOutcome: countBy(e.historyRecords, (x) => x.decisionOutcome), supersession: countBy(e.historyRecords, (x) => x.supersededByHistoryRecordId ? 'SUPERSEDED' : 'CURRENT') }],
    ['governance.overview', ['decision-governance'], { histories: e.historyRecords.length, events: e.governanceEvents.length, findings: findings.length, attestations: attestations.length }, { review: countBy(e.historyRecords, (x) => x.reviewState), approval: countBy(e.historyRecords, (x) => x.approvalState), exceptions: countBy(e.historyRecords, (x) => x.exceptionState), humanReview: countBy(e.historyRecords, (x) => x.humanReviewState), policyDrift: e.historyRecords.filter((x) => x.currentGovernanceProjection?.policyDriftDetected).length, evidenceStaleness: e.historyRecords.filter((x) => x.currentGovernanceProjection?.evidenceStaleDetected).length }],
    ['human.review', ['decision-governance'], { records: humanReviews.length }, { state: countBy(e.historyRecords, (x) => x.humanReviewState), reviewerType: countBy(humanReviews, (x) => x.reviewer?.actorType) }],
    ['exception.overview', ['decision-governance'], { records: exceptions.length }, { state: countBy(e.historyRecords, (x) => x.exceptionState), type: countBy(exceptions, (x) => x.exceptionType) }],
    ['findings.overview', ['decision-governance'], { findings: findings.length }, { status: countBy(findings, (x) => x.status), severity: countBy(findings, (x) => x.severity) }],
    ['attestation.overview', ['decision-governance'], { attestations: attestations.length }, { type: countBy(attestations, (x) => x.attestationType), actor: countBy(attestations, (x) => x.actor?.actorType) }],
    ['knowledge.graph', ['knowledge-graph'], { nodes: e.graph.nodes.length, edges: e.graph.edges.length, valid: e.graphValidation.valid, graphHash: e.graph.graphHash }, { ...e.graphStats, graphDensity: e.graph.nodes.length ? Number((e.graph.edges.length / (e.graph.nodes.length * e.graph.nodes.length)).toFixed(8)) : 0 }, [], e.graphValidation.errors],
    ['dependency.overview', ['knowledge-graph'], { matrixRows: matrix.length }, { nodesWithDependencies: matrix.filter((x) => x.dependencies.length).length, reverseDependencyRows: matrix.filter((x) => x.reverseDependencies.length).length }],
    ['impact.analysis', ['knowledge-graph'], { matrixRows: impacts.length }, { impactedNodes: impacts.filter((x) => x.impact.indirectImpacts.length).length, unknownImpacts: sum(impacts.map((x) => x.impact.unknownImpacts.length)) }],
    ['validation.overview', ['validation','knowledge-graph'], { allRepositoryOnly: true }, { readyChecks: readiness.filter((x) => x.ready).length, totalChecks: readiness.length }, readiness, e.graphValidation.errors],
    ['test.coverage', ['package-metadata'], { testScripts: e.scripts.filter((x) => x.startsWith('test')).length }, { intelligenceScripts: e.scripts.filter((x) => /capability|benchmark|evaluation|scoring|cost|execution|decision|knowledge|dashboard|intelligence|ai/.test(x)) }],
    ['documentation.overview', ['documentation-metadata'], { documentationFiles: e.docs.length }, { docsByArea, generatedDocs: e.generatedArtifacts.length }],
    ['generated.artifacts', ['generated-artifacts'], { generatedArtifacts: e.generatedArtifacts.length }, { byArea: countBy(e.generatedArtifacts, (x) => rel(x).split('/').slice(0, 4).join('/')), dashboardArtifacts: REQUIRED_ARTIFACTS.length }],
    ['repository.health', ['repository-inventory','package-metadata'], { filesIndexed: e.repoFiles.length, packageName: e.packageJson.name, packageVersion: e.packageJson.version }, { dependencyCount: Object.keys(e.packageJson.dependencies || {}).length, scriptCount: e.scripts.length }],
    ['technical.debt', ['documentation-metadata','repository-inventory'], { todoReferences: debtCount }, { deferredWorkDocs: e.docs.filter((x) => /DEFERRED_WORK/i.test(path.basename(x))).map(rel), unsupportedProviders: ['premium-hosted-providers-deferred'], missingIntegrations: ['runtime-dashboard-ui','public-dashboard-api','graph-visualization','cross-repository-mobile-dashboard-data'] }],
    ['owner.decisions', ['owner-decisions','architecture-decisions','knowledge-graph'], { ownerDecisionNodes: graphEngine.listByType('Owner Decision', e.graph).length, architectureDecisionNodes: graphEngine.listByType('Architecture Decision', e.graph).length }, { ownerDecisions: graphEngine.listByType('Owner Decision', e.graph).map((x) => x.nodeId), architectureDecisions: graphEngine.listByType('Architecture Decision', e.graph).map((x) => x.nodeId) }],
    ['deferred.work', ['documentation-metadata'], { deferredWorkDashboard: true }, { deferredItems: ['runtime dashboard UI','dashboard API exposure','production dashboard validation','provider benchmarking expansion','graph visualization','BI connector export'], requiresOwnerApproval: true }],
    ['platform.readiness', ['validation','governance','cost-governance','execution-decisions','knowledge-graph','dashboard-generation'], { advisoryOnly: true, certificationClaimed: false }, { readiness }, readiness],
    ['overall.platform', ['all-intelligence-repository-evidence'], { dashboardCount: DASHBOARDS.length, allDashboardsTestOnly: true, platformReadinessAdvisoryOnly: true, productionCertification: false }, { capabilities: e.capabilities.length, datasets: e.benchmarkDatasets.length, evaluations: e.evaluationRuns.length, scores: e.scoreRuns.length, costs: e.costRuns.length, decisions: e.decisionRecords.length, governanceRecords: e.historyRecords.length, graphNodes: e.graph.nodes.length, graphEdges: e.graph.edges.length }]
  ];
  return dashboardSpecs.map(([id, subsystems, summary, statistics, statusIndicators = [], errors = []]) => commonDashboard(d[id], { sourceSubsystems: subsystems, summary, statistics, statusIndicators, errors, relatedDashboards: DASHBOARDS.filter((def) => def.dashboardId !== id).slice(0, 4).map((def) => def.dashboardId), generatedArtifacts: ['dashboard-data/' + fileNameFor(id)] })).sort((a, b) => a.dashboardId.localeCompare(b.dashboardId));
}

function buildCatalog(dashboards = buildDashboards()) {
  return dashboards.map((dashboard) => ({
    dashboardId: dashboard.dashboardId,
    dashboardTitle: dashboard.dashboardTitle,
    dashboardVersion: dashboard.dashboardVersion,
    schemaVersion: dashboard.schemaVersion,
    generatedAt: dashboard.generatedAt,
    sourceSubsystems: dashboard.sourceSubsystems,
    generationHash: dashboard.generationHash,
    testOnly: dashboard.testOnly,
    productionApplicable: dashboard.productionApplicable,
    fileName: fileNameFor(dashboard.dashboardId)
  })).sort((a, b) => a.dashboardId.localeCompare(b.dashboardId));
}
function dashboardHashes(dashboards = buildDashboards()) { return Object.fromEntries(dashboards.map((dashboard) => [dashboard.dashboardId, dashboard.generationHash]).sort(([a], [b]) => a.localeCompare(b))); }

function validateDashboards(dashboards = buildDashboards()) {
  const errors = [];
  const seen = new Set();
  for (const dashboard of dashboards) {
    if (seen.has(dashboard.dashboardId)) errors.push({ rule: 'DUPLICATE_DASHBOARD_ID', dashboardId: dashboard.dashboardId });
    seen.add(dashboard.dashboardId);
    if (dashboard.schemaVersion !== DASHBOARD_SCHEMA_VERSION) errors.push({ rule: 'UNKNOWN_DASHBOARD_SCHEMA', dashboardId: dashboard.dashboardId });
    if (dashboard.generatedAt !== DETERMINISTIC_GENERATED_AT) errors.push({ rule: 'NON_DETERMINISTIC_GENERATED_AT', dashboardId: dashboard.dashboardId });
    if (!dashboard.generationHash) errors.push({ rule: 'MISSING_GENERATION_HASH', dashboardId: dashboard.dashboardId });
    if (!dashboard.sourceSubsystems.length || !dashboard.authoritativeSources.length) errors.push({ rule: 'MISSING_SOURCE_REFERENCES', dashboardId: dashboard.dashboardId });
    if (dashboard.testOnly !== true || dashboard.productionApplicable === true) errors.push({ rule: 'PRODUCTION_DASHBOARD_PROHIBITED', dashboardId: dashboard.dashboardId });
    for (const key of PROHIBITED_KEYS) if (Object.prototype.hasOwnProperty.call(dashboard, key)) errors.push({ rule: 'PROHIBITED_RUNTIME_FIELD', dashboardId: dashboard.dashboardId, key });
    if (dashboard.generationHash !== hashDashboard(dashboard)) errors.push({ rule: 'GENERATION_HASH_MISMATCH', dashboardId: dashboard.dashboardId });
  }
  for (const def of DASHBOARDS) if (!seen.has(def.dashboardId)) errors.push({ rule: 'MISSING_REQUIRED_DASHBOARD', dashboardId: def.dashboardId });
  return { valid: errors.length === 0, errors };
}

module.exports = { DASHBOARD_SCHEMA_VERSION, DASHBOARD_ENGINE_VERSION, DETERMINISTIC_GENERATED_AT, DASHBOARDS, REQUIRED_ARTIFACTS, PROHIBITED_KEYS, loadEvidence, buildDashboards, buildCatalog, dashboardHashes, fileNameFor, validateDashboards, stable, stableStringify, sha256, paths: { backendRoot, repoRoot, dashboardDataRoot, docsRoot } };
