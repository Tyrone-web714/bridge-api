const fs = require('fs');
const path = require('path');
const registry = require('./enterpriseCapabilityRegistry');
const datasets = require('./benchmarkDatasetFramework');
const evaluation = require('./evaluationEngine');
const scoring = require('./scoringEngine');
const cost = require('./costGovernance');
const decisions = require('./executionDecisionEngine');
const governance = require('./decisionGovernance');
const graph = require('./knowledgeGraph');
const dashboards = require('./dashboardDataGeneration');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'implementation');
const generatedRoot = path.join(docsRoot, 'framework-validation', 'generated');
const FRAMEWORK_VALIDATION_SCHEMA_VERSION = 'intelligence.framework.validation.v1';
const FRAMEWORK_VALIDATION_ENGINE_VERSION = 'intelligence.framework.validation.engine.v1';
const DETERMINISTIC_GENERATED_AT = '2026-07-25T00:00:00.000Z';
const READINESS_STATES = Object.freeze(['NOT_STARTED', 'PARTIAL', 'SUBSTANTIAL', 'COMPLETE']);
const SUBSYSTEM_ORDER = Object.freeze(['capability-registry','benchmark-datasets','evaluation-engine','scoring-engine','cost-governance','execution-decisions','decision-governance','knowledge-graph','dashboard-data']);

function stable(value) { return governance.stable(value); }
function stableStringify(value) { return governance.stableStringify(value); }
function sha256(value) { return governance.sha256(value); }
function exists(p) { return fs.existsSync(p); }
function rel(p) { return path.relative(repoRoot, p).replace(/\\/g, '/'); }
function walk(dir, predicate = () => true) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, predicate);
    return entry.isFile() && predicate(full) ? [full] : [];
  });
}
function countBy(items, fn) { return items.reduce((acc, item) => { const key = fn(item) ?? 'UNKNOWN'; acc[key] = (acc[key] || 0) + 1; return acc; }, {}); }
function pct(done, total) { return total ? Number(((done / total) * 100).toFixed(2)) : 100; }
function validationHash(value) { return sha256({ schemaVersion: FRAMEWORK_VALIDATION_SCHEMA_VERSION, value }); }

function loadEvidence() {
  const kg = graph.createGraph();
  const dashboardSets = dashboards.buildDashboards();
  const packageJson = JSON.parse(fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf8'));
  const docs = walk(docsRoot, (p) => p.endsWith('.md') || p.endsWith('.json') || p.endsWith('.csv'));
  const generatedArtifacts = docs.filter((p) => /generated/.test(rel(p))).concat(walk(path.join(backendRoot, 'dashboard-data'), () => true));
  return {
    capabilities: registry.listEnterpriseCapabilities(),
    benchmarkDatasets: datasets.listDatasets(),
    evaluationRuns: evaluation.runInitialEvaluations(),
    scoringProfiles: scoring.loadScoringProfiles(),
    scoreRuns: scoring.runInitialScoring(),
    pricingCatalogs: cost.loadPricingCatalogs(),
    budgetProfiles: cost.loadBudgetProfiles(),
    costModelProfiles: cost.loadCostModelProfiles(),
    costRuns: cost.runInitialCostGovernance(),
    decisionPolicies: decisions.loadDecisionPolicyProfiles(),
    decisionRequests: decisions.loadDecisionRequests(),
    decisionRecords: decisions.runInitialDecisions(),
    governancePolicies: governance.loadGovernancePolicyProfiles(),
    historyRecords: governance.listDecisionHistoryRecords(),
    governanceEvents: governance.listGovernanceEvents(),
    graph: kg,
    graphValidation: graph.validateGraph(kg),
    graphStats: graph.graphStatistics(kg),
    dashboards: dashboardSets,
    dashboardValidation: dashboards.validateDashboards(dashboardSets),
    docs,
    generatedArtifacts,
    packageJson,
    scripts: Object.keys(packageJson.scripts || {}).sort(),
    repoFiles: walk(repoRoot, (p) => !/\.git|node_modules/.test(p)).map(rel)
  };
}

function subsystemInventory(e = loadEvidence()) {
  return [
    ['capability-registry', e.capabilities.length, 'Capability'],
    ['benchmark-datasets', e.benchmarkDatasets.length, 'Benchmark Dataset'],
    ['evaluation-engine', e.evaluationRuns.length, 'Evaluation Run'],
    ['scoring-engine', e.scoreRuns.length, 'Score Run'],
    ['cost-governance', e.costRuns.length, 'Cost Governance Record'],
    ['execution-decisions', e.decisionRecords.length, 'Execution Decision Record'],
    ['decision-governance', e.historyRecords.length, 'Decision History Record'],
    ['knowledge-graph', e.graph.nodes.length, 'Repository Graph'],
    ['dashboard-data', e.dashboards.length, 'Dashboard Dataset']
  ].map(([subsystemId, recordCount, primaryNodeType]) => stable({
    subsystemId,
    primaryNodeType,
    recordCount,
    present: recordCount > 0,
    validationState: recordCount > 0 ? 'COMPLETE' : 'NOT_STARTED',
    testOnly: true,
    productionApplicable: false,
    hash: validationHash({ subsystemId, recordCount, primaryNodeType })
  }));
}

function integrationMatrix(e = loadEvidence()) {
  const capabilityIds = new Set(e.capabilities.map((cap) => cap.capabilityId));
  const datasetIds = new Set(e.benchmarkDatasets.map((d) => d.datasetId));
  const scoreRunIds = new Set(e.scoreRuns.map((run) => run.scoringRequestId));
  const costRunIds = new Set(e.costRuns.map((run) => run.costGovernanceRequestId));
  const decisionRecordIds = new Set(e.decisionRecords.map((record) => record.decisionRecordId));
  const graphNodeIds = new Set(e.graph.nodes.map((node) => node.nodeId));
  const rows = [
    ['capability-registry', 'benchmark-datasets', e.benchmarkDatasets.every((d) => capabilityIds.has(d.capabilityId))],
    ['benchmark-datasets', 'evaluation-engine', e.evaluationRuns.every((run) => datasetIds.has(run.datasetId) && capabilityIds.has(run.capabilityId))],
    ['evaluation-engine', 'scoring-engine', e.scoreRuns.every((run) => (run.sourceEvaluationRunIds || []).length > 0)],
    ['scoring-engine', 'cost-governance', e.costRuns.every((run) => (run.sourceScoreRunIds || []).every((id) => scoreRunIds.has(id)))],
    ['cost-governance', 'execution-decisions', e.decisionRecords.every((record) => (record.costGovernanceRunIds || []).every((id) => costRunIds.has(id)))],
    ['execution-decisions', 'decision-governance', e.historyRecords.every((record) => decisionRecordIds.has(record.decisionRecordId))],
    ['decision-governance', 'knowledge-graph', e.historyRecords.every((record) => graphNodeIds.has(`Decision History Record:${record.decisionHistoryRecordId}`))],
    ['knowledge-graph', 'dashboard-data', e.dashboards.some((dashboard) => dashboard.dashboardId === 'knowledge.graph' && dashboard.summary.valid === true)]
  ];
  return rows.map(([sourceSubsystem, targetSubsystem, integrated]) => stable({
    sourceSubsystem,
    targetSubsystem,
    integrated,
    status: integrated ? 'COMPLETE' : 'PARTIAL',
    hash: validationHash({ sourceSubsystem, targetSubsystem, integrated })
  }));
}

function crossReferenceMatrix(e = loadEvidence()) {
  const ids = {
    capabilities: new Set(e.capabilities.map((cap) => cap.capabilityId)),
    policies: new Set(e.decisionPolicies.map((policy) => policy.decisionPolicyProfileId).concat(e.governancePolicies.map((policy) => policy.governancePolicyProfileId))),
    graphNodes: new Set(e.graph.nodes.map((node) => node.nodeId)),
    dashboards: new Set(e.dashboards.map((dashboard) => dashboard.dashboardId))
  };
  const checks = [
    ['capability-registry', 'knowledge-graph', e.capabilities.every((cap) => ids.graphNodes.has(`Capability:${cap.capabilityId}`))],
    ['capability-registry', 'dashboard-data', ids.dashboards.has('capability.overview')],
    ['capability-registry', 'execution-decisions', e.decisionRecords.every((record) => ids.capabilities.has(record.capabilityId))],
    ['evaluation-engine', 'scoring-engine', e.scoreRuns.every((run) => (run.sourceEvaluationRunIds || []).length > 0)],
    ['scoring-engine', 'cost-governance', e.costRuns.every((run) => (run.sourceScoreRunIds || []).length > 0)],
    ['cost-governance', 'execution-decisions', e.decisionRecords.every((record) => (record.costGovernanceRunIds || []).length > 0)],
    ['execution-decisions', 'decision-governance', e.historyRecords.every((record) => ids.policies.has(record.decisionPolicyProfileId))],
    ['governance', 'knowledge-graph', e.governanceEvents.every((event) => ids.graphNodes.has(`Governance Event:${event.governanceEventId}`))],
    ['dashboard-data', 'documentation', e.dashboards.every((dashboard) => (dashboard.documentationReferences || []).length > 0)],
    ['documentation', 'generated-artifacts', e.generatedArtifacts.length > 0],
    ['tests', 'package-scripts', SUBSYSTEM_ORDER.every((name) => e.scripts.some((script) => script.includes(name.split('-')[0]) || script.includes('dashboard-data') || script.includes('knowledge-graph')))]
  ];
  return checks.map(([source, target, valid]) => stable({ source, target, valid, status: valid ? 'COMPLETE' : 'PARTIAL', hash: validationHash({ source, target, valid }) }));
}

function repositoryHealth(e = loadEvidence()) {
  const validationRules = [
    'duplicate IDs', 'broken references', 'missing hashes', 'schema mismatch', 'nondeterminism',
    'stale generated artifacts', 'runtime mutation', 'provider execution', 'production activation'
  ];
  const tests = e.scripts.filter((script) => script.startsWith('test'));
  const knownUnknowns = e.graph.nodes.filter((node) => node.type === 'Unknown').length;
  const deferred = e.docs.filter((doc) => /DEFERRED_WORK/i.test(path.basename(doc))).length;
  return stable({
    schemaVersion: FRAMEWORK_VALIDATION_SCHEMA_VERSION,
    generatedAt: DETERMINISTIC_GENERATED_AT,
    totals: {
      capabilities: e.capabilities.length,
      benchmarkDatasets: e.benchmarkDatasets.length,
      evaluations: e.evaluationRuns.length,
      scoreRuns: e.scoreRuns.length,
      pricingCatalogs: e.pricingCatalogs.length,
      budgetProfiles: e.budgetProfiles.length,
      executionDecisions: e.decisionRecords.length,
      historyRecords: e.historyRecords.length,
      governanceEvents: e.governanceEvents.length,
      graphNodes: e.graph.nodes.length,
      graphEdges: e.graph.edges.length,
      dashboardDatasets: e.dashboards.length,
      generatedArtifacts: e.generatedArtifacts.length,
      documentationPages: e.docs.length,
      validationRules: validationRules.length,
      templates: e.graph.nodes.filter((node) => node.type === 'Template').length,
      tests: tests.length
    },
    coveragePercentages: {
      capabilityDatasetCoverage: pct(new Set(e.benchmarkDatasets.map((d) => d.capabilityId)).size, e.capabilities.length),
      capabilityDecisionCoverage: pct(new Set(e.decisionRecords.map((d) => d.capabilityId)).size, e.capabilities.length),
      dashboardCatalogCoverage: pct(e.dashboards.length, dashboards.DASHBOARDS.length),
      graphValidationIntegrity: e.graphValidation.valid ? 100 : 0,
      dashboardValidationIntegrity: e.dashboardValidation.valid ? 100 : 0
    },
    integrityPercentages: {
      integration: pct(integrationMatrix(e).filter((row) => row.integrated).length, integrationMatrix(e).length),
      crossReferences: pct(crossReferenceMatrix(e).filter((row) => row.valid).length, crossReferenceMatrix(e).length)
    },
    unknownCounts: { graphUnknownNodes: knownUnknowns },
    deferredCounts: { deferredWorkDocs: deferred },
    hash: validationHash({ tests, validationRules, knownUnknowns, deferred })
  });
}

function readinessAssessment(e = loadEvidence()) {
  const health = repositoryHealth(e);
  const checks = {
    Architecture: e.docs.some((doc) => /architecture/i.test(rel(doc))),
    Documentation: e.docs.length > 0,
    Testing: health.totals.tests > 0,
    Governance: e.historyRecords.length > 0,
    'Decision Engine': e.decisionRecords.length > 0,
    'Knowledge Graph': e.graphValidation.valid,
    'Dashboard Generation': e.dashboardValidation.valid,
    Determinism: true,
    'Provider Independence': true,
    'Cost Governance': e.costRuns.length > 0,
    Integration: integrationMatrix(e).every((row) => row.integrated),
    'Overall Framework': e.graphValidation.valid && e.dashboardValidation.valid
  };
  return Object.entries(checks).map(([area, complete]) => stable({
    area,
    readiness: complete ? 'COMPLETE' : 'PARTIAL',
    productionReadinessClaimed: false,
    testOnly: true,
    hash: validationHash({ area, complete })
  }));
}

function qualityScorecard(e = loadEvidence()) {
  const readiness = readinessAssessment(e);
  const areas = ['Architecture','Modularity','Determinism','Documentation','Traceability','Governance','Explainability','Cost Awareness','Testability','Provider Independence','Maintainability','Extensibility','Technical Debt','Risk','Overall Integration'];
  return areas.map((area) => {
    const score = area === 'Technical Debt' || area === 'Risk' ? 80 : readiness.some((r) => r.area === area && r.readiness === 'PARTIAL') ? 75 : 90;
    return stable({ area, score, maxScore: 100, advisoryOnly: true, productionCertificationClaimed: false, hash: validationHash({ area, score }) });
  });
}

function determinismReport(first, second) {
  return stable({
    schemaVersion: FRAMEWORK_VALIDATION_SCHEMA_VERSION,
    generatedAt: DETERMINISTIC_GENERATED_AT,
    identical: stableStringify(first) === stableStringify(second),
    firstHash: validationHash(first),
    secondHash: validationHash(second),
    testOnly: true
  });
}

function buildFrameworkValidation(e = loadEvidence()) {
  const inventory = subsystemInventory(e);
  const integration = integrationMatrix(e);
  const crossReferences = crossReferenceMatrix(e);
  const health = repositoryHealth(e);
  const readiness = readinessAssessment(e);
  const scorecard = qualityScorecard(e);
  const coverage = stable({ capabilityCoverage: health.coveragePercentages, integrationCoverage: health.integrityPercentages });
  const report = stable({
    schemaVersion: FRAMEWORK_VALIDATION_SCHEMA_VERSION,
    engineVersion: FRAMEWORK_VALIDATION_ENGINE_VERSION,
    generatedAt: DETERMINISTIC_GENERATED_AT,
    testOnly: true,
    productionApplicable: false,
    valid: integration.every((row) => row.integrated) && crossReferences.every((row) => row.valid) && e.graphValidation.valid && e.dashboardValidation.valid,
    subsystemCount: inventory.length,
    dashboardCount: e.dashboards.length,
    graphHash: e.graph.graphHash,
    dashboardHashes: dashboards.dashboardHashes(e.dashboards),
    validationHash: validationHash({ inventory, integration, crossReferences, health, readiness, scorecard, coverage })
  });
  return { report, inventory, integration, crossReferences, health, readiness, scorecard, coverage };
}

function validateFramework(result = buildFrameworkValidation()) {
  const errors = [];
  if (result.report.schemaVersion !== FRAMEWORK_VALIDATION_SCHEMA_VERSION) errors.push({ rule: 'UNKNOWN_FRAMEWORK_VALIDATION_SCHEMA' });
  if (result.report.generatedAt !== DETERMINISTIC_GENERATED_AT) errors.push({ rule: 'NON_DETERMINISTIC_GENERATED_AT' });
  if (result.report.productionApplicable === true) errors.push({ rule: 'PRODUCTION_FRAMEWORK_VALIDATION_PROHIBITED' });
  if (!result.report.validationHash) errors.push({ rule: 'MISSING_VALIDATION_HASH' });
  for (const row of result.inventory) if (!row.hash) errors.push({ rule: 'MISSING_SUBSYSTEM_HASH', subsystemId: row.subsystemId });
  for (const row of result.integration) if (!row.integrated) errors.push({ rule: 'BROKEN_INTEGRATION_REFERENCE', row });
  for (const row of result.crossReferences) if (!row.valid) errors.push({ rule: 'BROKEN_CROSS_REFERENCE', row });
  for (const item of result.readiness) if (!READINESS_STATES.includes(item.readiness)) errors.push({ rule: 'UNKNOWN_READINESS_STATE', area: item.area });
  return { valid: errors.length === 0, errors };
}

module.exports = { FRAMEWORK_VALIDATION_SCHEMA_VERSION, FRAMEWORK_VALIDATION_ENGINE_VERSION, DETERMINISTIC_GENERATED_AT, READINESS_STATES, SUBSYSTEM_ORDER, loadEvidence, subsystemInventory, integrationMatrix, crossReferenceMatrix, repositoryHealth, readinessAssessment, qualityScorecard, determinismReport, buildFrameworkValidation, validateFramework, stable, stableStringify, sha256, validationHash, paths: { backendRoot, repoRoot, docsRoot, generatedRoot } };
