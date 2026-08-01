const fs = require('fs');
const path = require('path');
const registry = require('./enterpriseCapabilityRegistry');
const datasets = require('./benchmarkDatasetFramework');
const evaluation = require('./evaluationEngine');
const scoring = require('./scoringEngine');
const cost = require('./costGovernance');
const decisions = require('./executionDecisionEngine');
const governance = require('./decisionGovernance');
const { EXECUTION_STRATEGIES, EXECUTION_PROFILES } = require('./constants');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'implementation');
const KNOWLEDGE_GRAPH_ENGINE_VERSION = 'intelligence.knowledge.graph.engine.v1';
const KNOWLEDGE_GRAPH_SCHEMA_VERSION = 'intelligence.knowledge.graph.v1';
const KNOWLEDGE_GRAPH_GENERATED_ARTIFACTS = Object.freeze(['knowledge_graph.json','knowledge_graph.csv','knowledge_graph_summary.md','node_catalog.json','edge_catalog.json','dependency_matrix.json','impact_matrix.json','capability_dependency_report.json','dataset_dependency_report.json','policy_dependency_report.json','cost_dependency_report.json','decision_dependency_report.json','governance_dependency_report.json','documentation_dependency_report.json','generated_artifact_dependency_report.json','test_dependency_report.json','cycle_report.json','orphan_report.json','graph_statistics.json','knowledge_graph_hash.json']);
const NODE_TYPES = Object.freeze(['Capability','Capability Version','Execution Strategy','Execution Profile','Decision Policy Profile','Capability Registry Entry','Benchmark Dataset','Evaluation Run','Evaluation Result','Score Profile','Score Run','Cost Model Profile','Pricing Catalog','Budget Profile','Cost Governance Record','Execution Decision Request','Execution Decision Record','Decision History Record','Governance Event','Human Review Record','Exception Record','Finding','Attestation','Generated Artifact','Template','Validation Rule','Owner Decision','Architecture Decision','Documentation Page','Script','Test Suite','Repository Module','Package','Service','Hash','Version','Lifecycle State','Organization Context','Unknown']);
const EDGE_TYPES = Object.freeze(['DEPENDS_ON','GENERATES','GENERATED_FROM','USES','USED_BY','EVALUATES','SCORES','GOVERNS','VALIDATES','SUPERSEDES','SUPERSEDED_BY','PRODUCES','CONSUMES','CREATED_FROM','REFERENCES','IMPLEMENTS','DOCUMENTS','TESTS','REPLAYS','ANNOTATES','HAS_POLICY','HAS_VERSION','HAS_HASH','BELONGS_TO','REQUIRES','ALLOWS','PROHIBITS','FALLBACK_TO','DERIVES_FROM','CONSTRAINS','INFLUENCES','TRIGGERS','RELATED_TO']);
const PROHIBITED_SELF_EDGES = new Set(['DEPENDS_ON','GENERATED_FROM','SUPERSEDES','SUPERSEDED_BY','CREATED_FROM','DERIVES_FROM','FALLBACK_TO']);

function stable(value) { return governance.stable(value); }
function stableStringify(value) { return governance.stableStringify(value); }
function sha256(value) { return governance.sha256(value); }
function rel(p) { return path.relative(repoRoot, p).replace(/\\/g, '/'); }
function exists(p) { return fs.existsSync(p); }
function walk(dir, predicate = () => true) { if (!exists(dir)) return []; return fs.readdirSync(dir, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name)).flatMap((entry)=>{ const full=path.join(dir, entry.name); if (entry.isDirectory()) return walk(full, predicate); return entry.isFile() && predicate(full) ? [full] : []; }); }
function nodeId(type, id) { return `${type}:${id}`; }
function edgeId(source, type, target) { return `edge:${sha256({ source, type, target }).slice(0, 20)}`; }
function contentHash(value) { return sha256(value); }
function addNode(nodes, type, id, attrs = {}) { const node = { nodeId: nodeId(type, id), type, label: attrs.label || id, version: attrs.version || null, lifecycleState: attrs.lifecycleState || null, hash: attrs.hash || contentHash({ type, id, version: attrs.version || null }), source: attrs.source || KNOWLEDGE_GRAPH_ENGINE_VERSION, testOnly: attrs.testOnly !== false, productionApplicable: attrs.productionApplicable === true, metadata: stable(attrs.metadata || {}) }; nodes.push(node); return node.nodeId; }
function addEdge(edges, sourceNodeId, relationshipType, targetNodeId, attrs = {}) { const edge = { edgeId: edgeId(sourceNodeId, relationshipType, targetNodeId), sourceNodeId, targetNodeId, relationshipType, relationshipVersion: attrs.relationshipVersion || '0.1.0', relationshipHash: sha256({ sourceNodeId, relationshipType, targetNodeId, evidence: attrs.evidence || null }), relationshipSource: attrs.relationshipSource || KNOWLEDGE_GRAPH_ENGINE_VERSION, relationshipConfidence: attrs.relationshipConfidence || 'DETERMINISTIC', testOnly: attrs.testOnly !== false, metadata: stable(attrs.metadata || {}) }; edges.push(edge); return edge.edgeId; }
function createGraph() {
  const nodes = [];
  const edges = [];
  const packageNode = addNode(nodes, 'Package', 'bridge-api', { source: 'bridge-api/package.json', hash: fileHash(path.join(backendRoot, 'package.json')) });
  const serviceNode = addNode(nodes, 'Service', 'intelligence-execution-platform', { source: 'bridge-api/services/intelligenceExecution', metadata: { engineVersion: KNOWLEDGE_GRAPH_ENGINE_VERSION } });
  addEdge(edges, packageNode, 'IMPLEMENTS', serviceNode);
  for (const strategy of Object.values(EXECUTION_STRATEGIES)) addEdge(edges, serviceNode, 'ALLOWS', addNode(nodes, 'Execution Strategy', strategy, { source: 'bridge-api/services/intelligenceExecution/constants.js' }));
  for (const profile of Object.keys(EXECUTION_PROFILES || {})) addEdge(edges, serviceNode, 'ALLOWS', addNode(nodes, 'Execution Profile', profile, { source: 'bridge-api/services/intelligenceExecution/constants.js' }));
  const moduleFiles = walk(path.join(backendRoot, 'services', 'intelligenceExecution'), (p) => p.endsWith('.js'));
  for (const file of moduleFiles) addEdge(edges, serviceNode, 'IMPLEMENTS', addNode(nodes, 'Repository Module', rel(file), { source: rel(file), hash: fileHash(file) }));
  const scriptFiles = walk(path.join(backendRoot, 'scripts'), (p) => /(?:knowledge-graph|decision-governance|execution-decision|cost-governance|scoring|evaluation|benchmark|capability)/.test(path.basename(p)));
  for (const file of scriptFiles) addEdge(edges, packageNode, 'TESTS', addNode(nodes, 'Script', rel(file), { source: rel(file), hash: fileHash(file) }));
  addCapabilityLayer(nodes, edges, serviceNode);
  addDatasetLayer(nodes, edges);
  addEvaluationLayer(nodes, edges);
  addScoringLayer(nodes, edges);
  addCostLayer(nodes, edges);
  addDecisionLayer(nodes, edges);
  addGovernanceLayer(nodes, edges);
  addDocumentationLayer(nodes, edges);
  const graph = { schemaVersion: KNOWLEDGE_GRAPH_SCHEMA_VERSION, engineVersion: KNOWLEDGE_GRAPH_ENGINE_VERSION, generatedFrom: 'repository', nodes: stable(uniqueBy(nodes, 'nodeId')), edges: stable(uniqueBy(edges, 'edgeId')), testOnly: true, productionApplicable: false };
  graph.graphHash = hashGraph(graph);
  return graph;
}
function fileHash(file) { return exists(file) ? sha256(fs.readFileSync(file, 'utf8')) : null; }
function uniqueBy(items, field) { const map = new Map(); for (const item of items) if (!map.has(item[field])) map.set(item[field], item); return [...map.values()]; }
function addCapabilityLayer(nodes, edges, serviceNode) {
  for (const cap of registry.listEnterpriseCapabilities()) {
    const capId = addNode(nodes, 'Capability', cap.capabilityId, { version: cap.capabilityVersion || cap.version, lifecycleState: cap.lifecycleState, hash: sha256(cap), source: 'enterpriseCapabilityRegistry', metadata: { domain: cap.domain, implementationStatus: cap.implementationStatus } });
    addEdge(edges, serviceNode, 'IMPLEMENTS', capId);
    addEdge(edges, capId, 'HAS_VERSION', addNode(nodes, 'Capability Version', `${cap.capabilityId}@${cap.capabilityVersion || cap.version}`, { version: cap.capabilityVersion || cap.version, hash: sha256({ id: cap.capabilityId, version: cap.capabilityVersion || cap.version }) }));
    addEdge(edges, capId, 'HAS_HASH', addNode(nodes, 'Hash', sha256(cap), { hash: sha256(cap) }));
    if (cap.lifecycleState) addEdge(edges, capId, 'HAS_VERSION', addNode(nodes, 'Lifecycle State', cap.lifecycleState));
    for (const strategy of cap.allowedExecutionStrategies || []) addEdge(edges, capId, 'ALLOWS', nodeId('Execution Strategy', strategy));
    for (const dep of cap.dependencies || cap.dependencyCapabilityIds || []) addEdge(edges, capId, 'DEPENDS_ON', nodeId('Capability', dep));
  }
}
function addDatasetLayer(nodes, edges) {
  for (const dataset of datasets.listDatasets()) {
    const datasetNode = addNode(nodes, 'Benchmark Dataset', dataset.datasetId, { version: dataset.version, lifecycleState: dataset.lifecycleState, hash: sha256(dataset), source: dataset.__filePath || 'benchmarkDatasetFramework', metadata: { capabilityId: dataset.capabilityId, caseCount: dataset.cases?.length || 0 } });
    addEdge(edges, nodeId('Capability', dataset.capabilityId), 'USES', datasetNode);
    addEdge(edges, datasetNode, 'BELONGS_TO', nodeId('Capability', dataset.capabilityId));
    addEdge(edges, datasetNode, 'HAS_VERSION', addNode(nodes, 'Version', `${dataset.datasetId}@${dataset.version}`, { version: dataset.version }));
  }
}
function addEvaluationLayer(nodes, edges) {
  for (const run of evaluation.runInitialEvaluations()) {
    const runNode = addNode(nodes, 'Evaluation Run', run.runId, { version: run.schemaVersion, hash: run.runHash || sha256(run), source: 'evaluationEngine', metadata: { capabilityId: run.capabilityId, datasetId: run.datasetId } });
    addEdge(edges, runNode, 'EVALUATES', nodeId('Capability', run.capabilityId));
    addEdge(edges, runNode, 'USES', nodeId('Benchmark Dataset', run.datasetId));
    for (const result of run.results || []) {
      const resultNode = addNode(nodes, 'Evaluation Result', result.resultId, { hash: sha256(result), source: run.runId, metadata: { resultClass: result.resultClass, executorId: result.executorId, strategy: result.strategy } });
      addEdge(edges, runNode, 'PRODUCES', resultNode);
      if (result.strategy) addEdge(edges, resultNode, 'USES', nodeId('Execution Strategy', result.strategy));
    }
  }
}
function addScoringLayer(nodes, edges) {
  for (const profile of scoring.loadScoringProfiles()) addNode(nodes, 'Score Profile', profile.scoringProfileId, { version: profile.version, hash: sha256(profile), source: profile.__filePath || 'scoringEngine' });
  for (const run of scoring.runInitialScoring()) {
    const runNode = addNode(nodes, 'Score Run', run.scoringRequestId, { version: run.schemaVersion, hash: run.scoreRunHash, source: 'scoringEngine', metadata: { scoringProfileId: run.scoringProfileId } });
    addEdge(edges, runNode, 'USES', nodeId('Score Profile', run.scoringProfileId));
    for (const evalId of run.evaluationRunIds || []) addEdge(edges, runNode, 'SCORES', nodeId('Evaluation Run', evalId));
    for (const record of run.scoreRecords || []) {
      addEdge(edges, runNode, 'PRODUCES', addNode(nodes, 'Hash', record.scoreHash || sha256(record), { hash: record.scoreHash || sha256(record), metadata: { scoreId: record.scoreId } }));
      addEdge(edges, runNode, 'SCORES', nodeId('Capability', record.capabilityId));
      addEdge(edges, runNode, 'USES', nodeId('Benchmark Dataset', record.datasetId));
    }
  }
}
function addCostLayer(nodes, edges) {
  for (const catalog of cost.loadPricingCatalogs()) addNode(nodes, 'Pricing Catalog', catalog.pricingCatalogId, { version: catalog.version, hash: cost.pricingCatalogHash ? cost.pricingCatalogHash(catalog) : sha256(catalog), source: catalog.__filePath || 'costGovernance' });
  for (const profile of cost.loadCostModelProfiles()) addNode(nodes, 'Cost Model Profile', profile.costModelProfileId, { version: profile.version, hash: cost.costModelProfileHash ? cost.costModelProfileHash(profile) : sha256(profile), source: profile.__filePath || 'costGovernance' });
  for (const budget of cost.loadBudgetProfiles()) addNode(nodes, 'Budget Profile', budget.budgetProfileId, { version: budget.version, hash: cost.budgetProfileHash ? cost.budgetProfileHash(budget) : sha256(budget), source: budget.__filePath || 'costGovernance' });
  for (const run of cost.runInitialCostGovernance()) {
    const runNode = addNode(nodes, 'Cost Governance Record', run.costGovernanceRequestId, { version: run.schemaVersion, hash: run.costGovernanceRunHash, source: 'costGovernance', metadata: { pricingCatalogId: run.pricingCatalogId, budgetProfileId: run.budgetProfileId } });
    addEdge(edges, runNode, 'USES', nodeId('Pricing Catalog', run.pricingCatalogId));
    addEdge(edges, runNode, 'USES', nodeId('Cost Model Profile', run.costModelProfileId));
    addEdge(edges, runNode, 'USES', nodeId('Budget Profile', run.budgetProfileId));
    for (const scoreRunId of run.scoreRunIds || []) addEdge(edges, runNode, 'DEPENDS_ON', nodeId('Score Run', scoreRunId));
    for (const record of run.costRecords || []) { addEdge(edges, runNode, 'GOVERNS', nodeId('Capability', record.capabilityId)); addEdge(edges, runNode, 'USES', nodeId('Benchmark Dataset', record.datasetId)); }
  }
}
function addDecisionLayer(nodes, edges) {
  for (const policy of decisions.loadDecisionPolicyProfiles()) addNode(nodes, 'Decision Policy Profile', policy.decisionPolicyProfileId, { version: policy.version, lifecycleState: policy.lifecycleState, hash: decisions.policyProfileHash(policy), source: policy.__filePath || 'executionDecisionEngine' });
  for (const request of decisions.loadDecisionRequests()) {
    const reqNode = addNode(nodes, 'Execution Decision Request', request.decisionRequestId, { version: request.version, hash: decisions.decisionRequestHash(request), source: request.__filePath || 'executionDecisionEngine', metadata: { capabilityId: request.capabilityId } });
    addEdge(edges, reqNode, 'USES', nodeId('Capability', request.capabilityId));
    addEdge(edges, reqNode, 'HAS_POLICY', nodeId('Decision Policy Profile', request.decisionPolicyProfileId));
    for (const scoreRunId of request.scoreRunIds || []) addEdge(edges, reqNode, 'DEPENDS_ON', nodeId('Score Run', scoreRunId));
    for (const costRunId of request.costGovernanceRunIds || []) addEdge(edges, reqNode, 'DEPENDS_ON', nodeId('Cost Governance Record', costRunId));
  }
  for (const record of decisions.runInitialDecisions()) {
    const recNode = addNode(nodes, 'Execution Decision Record', record.decisionRecordId, { version: record.schemaVersion, hash: record.decisionRecordHash, source: 'executionDecisionEngine', metadata: { decisionOutcome: record.decisionOutcome, capabilityId: record.capabilityId } });
    addEdge(edges, recNode, 'CREATED_FROM', nodeId('Execution Decision Request', record.decisionRequestId));
    addEdge(edges, recNode, 'USES', nodeId('Capability', record.capabilityId));
    addEdge(edges, recNode, 'HAS_POLICY', nodeId('Decision Policy Profile', record.decisionPolicyProfileId));
    for (const scoreRunId of record.scoreRunIds || []) addEdge(edges, recNode, 'DEPENDS_ON', nodeId('Score Run', scoreRunId));
    for (const costRunId of record.costGovernanceRunIds || []) addEdge(edges, recNode, 'DEPENDS_ON', nodeId('Cost Governance Record', costRunId));
    for (const fallback of record.fallbackPlan || []) addEdge(edges, recNode, 'FALLBACK_TO', addNode(nodes, 'Unknown', fallback.candidateId, { hash: sha256(fallback), metadata: { strategyId: fallback.strategyId } }));
  }
}
function addGovernanceLayer(nodes, edges) {
  for (const profile of governance.loadGovernancePolicyProfiles()) addNode(nodes, 'Decision Policy Profile', profile.governancePolicyProfileId, { version: profile.version, lifecycleState: profile.lifecycleState, hash: governance.governancePolicyProfileHash(profile), source: profile.__filePath || 'decisionGovernance' });
  for (const history of governance.listDecisionHistoryRecords()) {
    const historyNode = addNode(nodes, 'Decision History Record', history.decisionHistoryRecordId, { version: history.historyVersion, lifecycleState: history.governanceLifecycleState, hash: history.historyRecordHash, source: 'decisionGovernance', metadata: { decisionRecordId: history.decisionRecordId } });
    addEdge(edges, historyNode, 'CREATED_FROM', nodeId('Execution Decision Record', history.decisionRecordId));
    addEdge(edges, historyNode, 'GOVERNS', nodeId('Capability', history.capabilityId));
    addEdge(edges, historyNode, 'HAS_POLICY', nodeId('Decision Policy Profile', history.decisionPolicyProfileId));
    if (history.humanReviewRecord) addEdge(edges, historyNode, 'REQUIRES', addNode(nodes, 'Human Review Record', history.humanReviewRecord.humanReviewRecordId, { hash: history.humanReviewRecord.integrityHash, source: 'decisionGovernance' }));
    if (history.exceptionRequestRecord) addEdge(edges, historyNode, 'GOVERNS', addNode(nodes, 'Exception Record', history.exceptionRequestRecord.exceptionRequestId, { hash: history.exceptionRequestRecord.integrityHash, source: 'decisionGovernance' }));
    for (const finding of history.findingRecords || []) addEdge(edges, historyNode, 'PRODUCES', addNode(nodes, 'Finding', finding.findingRecordId, { hash: finding.integrityHash, lifecycleState: finding.status, source: 'decisionGovernance' }));
    for (const att of history.attestationRecords || []) addEdge(edges, historyNode, 'PRODUCES', addNode(nodes, 'Attestation', att.attestationRecordId, { hash: att.integrityHash, source: 'decisionGovernance' }));
    for (const replay of history.replayRecords || []) addEdge(edges, historyNode, 'REPLAYS', addNode(nodes, 'Hash', replay.replayDecisionRecordHash, { hash: replay.replayDecisionRecordHash, source: 'decisionGovernance' }));
  }
  for (const event of governance.listGovernanceEvents()) {
    const eventNode = addNode(nodes, 'Governance Event', event.governanceEventId, { version: event.eventVersion, hash: event.eventHash, source: 'decisionGovernance', metadata: { eventType: event.eventType, subjectId: event.subjectId } });
    addEdge(edges, eventNode, 'GOVERNS', nodeId('Decision History Record', event.decisionHistoryRecordId));
    if (event.previousEventId) addEdge(edges, eventNode, 'DEPENDS_ON', nodeId('Governance Event', event.previousEventId));
  }
}
function addDocumentationLayer(nodes, edges) {
  const docFiles = walk(docsRoot, (p) => p.endsWith('.md') || p.endsWith('.json') || p.endsWith('.csv'));
  const expectedKnowledgeGraphArtifacts = KNOWLEDGE_GRAPH_GENERATED_ARTIFACTS.map((file) => path.join(docsRoot, 'intelligence-knowledge-graph', 'generated', file));
  for (const file of uniqueBy(docFiles.concat(expectedKnowledgeGraphArtifacts).map((p) => ({ path: p })), 'path').map((item) => item.path).filter((p) => /intelligence|execution|decision|governance|cost|scoring|benchmark|capability/.test(rel(p)))) {
    const type = /generated/.test(rel(file)) ? 'Generated Artifact' : 'Documentation Page';
    const docNode = addNode(nodes, type, rel(file), { hash: type === 'Generated Artifact' ? sha256({ generatedArtifact: rel(file) }) : fileHash(file), source: rel(file), metadata: type === 'Generated Artifact' ? { generatedArtifact: true } : { fileContentHash: fileHash(file) } });
    if (/execution-decision-engine/.test(rel(file))) addEdge(edges, docNode, 'DOCUMENTS', nodeId('Service', 'intelligence-execution-platform'));
    if (/decision-history-and-governance/.test(rel(file))) addEdge(edges, docNode, 'DOCUMENTS', nodeId('Repository Module', 'bridge-api/services/intelligenceExecution/decisionGovernance.js'));
    if (/generated/.test(rel(file))) addEdge(edges, docNode, 'GENERATED_FROM', nodeId('Script', 'bridge-api/scripts/generate-knowledge-graph-artifacts.cjs'));
  }
  const odr = path.join(repoRoot, 'docs', 'audits', '2026-07-comprehensive-audit', 'OWNER_DECISION_REGISTER.md');
  if (exists(odr)) addEdge(edges, addNode(nodes, 'Owner Decision', 'OWNER_DECISION_REGISTER', { hash: fileHash(odr), source: rel(odr) }), 'INFLUENCES', nodeId('Service', 'intelligence-execution-platform'));
  for (const file of walk(path.join(repoRoot, 'docs', 'architecture'), (p) => /ADR|ODR|GOVERNANCE|ARCHITECTURE/.test(path.basename(p).toUpperCase()))) addEdge(edges, addNode(nodes, 'Architecture Decision', rel(file), { hash: fileHash(file), source: rel(file) }), 'INFLUENCES', nodeId('Service', 'intelligence-execution-platform'));
}
function listNodes(graph = createGraph()) { return graph.nodes; }
function listEdges(graph = createGraph()) { return graph.edges; }
function getNode(id, graph = createGraph()) { return graph.nodes.find((node) => node.nodeId === id || node.label === id) || null; }
function getEdge(id, graph = createGraph()) { return graph.edges.find((edge) => edge.edgeId === id) || null; }
function listByType(type, graph = createGraph()) { return graph.nodes.filter((node) => node.type === type); }
function outgoing(id, graph) { return graph.edges.filter((edge) => edge.sourceNodeId === id); }
function incoming(id, graph) { return graph.edges.filter((edge) => edge.targetNodeId === id); }
function children(id, graph = createGraph()) { return outgoing(id, graph).map((edge) => getNode(edge.targetNodeId, graph)).filter(Boolean); }
function parents(id, graph = createGraph()) { return incoming(id, graph).map((edge) => getNode(edge.sourceNodeId, graph)).filter(Boolean); }
function traverse(seed, dir, graph = createGraph()) { const seen = new Set(); const queue = [seed]; while (queue.length) { const id = queue.shift(); for (const edge of (dir === 'out' ? outgoing(id, graph) : incoming(id, graph))) { const next = dir === 'out' ? edge.targetNodeId : edge.sourceNodeId; if (!seen.has(next)) { seen.add(next); queue.push(next); } } } seen.delete(seed); return [...seen].map((id) => getNode(id, graph)).filter(Boolean); }
function descendants(id, graph = createGraph()) { return traverse(id, 'out', graph); }
function ancestors(id, graph = createGraph()) { return traverse(id, 'in', graph); }
function upstream(id, graph = createGraph()) { return ancestors(id, graph); }
function downstream(id, graph = createGraph()) { return descendants(id, graph); }
function dependencies(id, graph = createGraph()) { return graph.edges.filter((e) => e.sourceNodeId === id && ['DEPENDS_ON','USES','HAS_POLICY','REQUIRES','CONSUMES','CREATED_FROM','DERIVES_FROM'].includes(e.relationshipType)).map((e) => getNode(e.targetNodeId, graph)).filter(Boolean); }
function reverseDependencies(id, graph = createGraph()) { return graph.edges.filter((e) => e.targetNodeId === id && ['DEPENDS_ON','USES','HAS_POLICY','REQUIRES','CONSUMES','CREATED_FROM','DERIVES_FROM'].includes(e.relationshipType)).map((e) => getNode(e.sourceNodeId, graph)).filter(Boolean); }
function shortestPath(source, target, graph = createGraph()) { const queue = [[source]]; const seen = new Set([source]); while (queue.length) { const pathIds = queue.shift(); const last = pathIds.at(-1); if (last === target) return pathIds.map((id) => getNode(id, graph)).filter(Boolean); for (const edge of outgoing(last, graph)) if (!seen.has(edge.targetNodeId)) { seen.add(edge.targetNodeId); queue.push([...pathIds, edge.targetNodeId]); } } return []; }
function findCycles(graph = createGraph()) { const cycles = []; const stack = []; const visiting = new Set(); const visited = new Set(); function visit(id) { if (visiting.has(id)) { cycles.push([...stack.slice(stack.indexOf(id)), id]); return; } if (visited.has(id)) return; visiting.add(id); stack.push(id); for (const edge of outgoing(id, graph).filter((e) => ['DEPENDS_ON','GENERATED_FROM','CREATED_FROM','DERIVES_FROM','FALLBACK_TO','SUPERSEDES'].includes(e.relationshipType))) visit(edge.targetNodeId); stack.pop(); visiting.delete(id); visited.add(id); } for (const node of graph.nodes) visit(node.nodeId); return cycles; }
function findDisconnected(graph = createGraph()) { return graph.nodes.filter((node) => !graph.edges.some((edge) => edge.sourceNodeId === node.nodeId || edge.targetNodeId === node.nodeId)); }
function findOrphans(graph = createGraph()) { return graph.nodes.filter((node) => !incoming(node.nodeId, graph).length && !['Package','Service','Owner Decision','Architecture Decision'].includes(node.type)); }
function findUnused(graph = createGraph()) { return graph.nodes.filter((node) => !outgoing(node.nodeId, graph).length && ['Template','Validation Rule','Generated Artifact'].includes(node.type)); }
function findDuplicateNodes(graph = createGraph()) { const counts = new Map(); for (const node of graph.nodes) counts.set(node.nodeId, (counts.get(node.nodeId) || 0) + 1); return [...counts].filter(([, count]) => count > 1).map(([nodeId, count]) => ({ nodeId, count })); }
function findDuplicateEdges(graph = createGraph()) { const counts = new Map(); for (const edge of graph.edges) counts.set(edge.edgeId, (counts.get(edge.edgeId) || 0) + 1); return [...counts].filter(([, count]) => count > 1).map(([edgeId, count]) => ({ edgeId, count })); }
function groupByType(graph = createGraph()) { return group(graph.nodes, 'type'); }
function groupByLifecycle(graph = createGraph()) { return group(graph.nodes, 'lifecycleState'); }
function groupByVersion(graph = createGraph()) { return group(graph.nodes, 'version'); }
function groupByCapability(graph = createGraph()) { const result = {}; for (const node of graph.nodes) { const cap = node.metadata?.capabilityId || (node.type === 'Capability' ? node.label : null); if (cap) (result[cap] ||= []).push(node.nodeId); } return result; }
function groupByOwnerDecision(graph = createGraph()) { return { OWNER_DECISION_REGISTER: downstream(nodeId('Owner Decision', 'OWNER_DECISION_REGISTER'), graph).map((n) => n.nodeId) }; }
function groupByDocumentation(graph = createGraph()) { return Object.fromEntries(graph.nodes.filter((n) => n.type === 'Documentation Page').map((n) => [n.nodeId, downstream(n.nodeId, graph).map((x) => x.nodeId)])); }
function group(items, field) { return items.reduce((acc, item) => { const key = item[field] || 'UNKNOWN'; (acc[key] ||= []).push(item.nodeId || item.edgeId); return acc; }, {}); }
function graphStatistics(graph = createGraph()) { return { nodeCount: graph.nodes.length, edgeCount: graph.edges.length, nodeTypes: Object.fromEntries(Object.entries(groupByType(graph)).map(([k,v])=>[k,v.length])), edgeTypes: Object.fromEntries(Object.entries(group(graph.edges, 'relationshipType')).map(([k,v])=>[k,v.length])), disconnectedCount: findDisconnected(graph).length, orphanCount: findOrphans(graph).length, cycleCount: findCycles(graph).length, graphHash: hashGraph(graph) }; }
function hashGraph(graph = createGraph()) { const copy = { schemaVersion: graph.schemaVersion, engineVersion: graph.engineVersion, nodes: stable(graph.nodes || []), edges: stable(graph.edges || []), testOnly: true, productionApplicable: false }; return sha256(copy); }
function validateGraph(graph = createGraph()) { const errors = []; const nodeIds = new Set(graph.nodes.map((n) => n.nodeId)); for (const dup of findDuplicateNodes(graph)) errors.push({ field: 'nodeId', rule: 'DUPLICATE_NODE_ID', guidance: dup.nodeId }); for (const dup of findDuplicateEdges(graph)) errors.push({ field: 'edgeId', rule: 'DUPLICATE_EDGE_ID', guidance: dup.edgeId }); for (const node of graph.nodes) { if (!NODE_TYPES.includes(node.type)) errors.push({ field: 'type', rule: 'INVALID_NODE_TYPE', guidance: node.nodeId }); if (!node.hash) errors.push({ field: 'hash', rule: 'MISSING_NODE_HASH', guidance: node.nodeId }); if (node.productionApplicable === true) errors.push({ field: 'productionApplicable', rule: 'PRODUCTION_GRAPH_NODE_PROHIBITED', guidance: node.nodeId }); }
  for (const edge of graph.edges) { if (!EDGE_TYPES.includes(edge.relationshipType)) errors.push({ field: 'relationshipType', rule: 'INVALID_EDGE_TYPE', guidance: edge.edgeId }); if (!nodeIds.has(edge.sourceNodeId)) errors.push({ field: 'sourceNodeId', rule: 'UNKNOWN_EDGE_SOURCE', guidance: edge.edgeId }); if (!nodeIds.has(edge.targetNodeId)) errors.push({ field: 'targetNodeId', rule: 'UNKNOWN_EDGE_TARGET', guidance: edge.edgeId }); if (!edge.relationshipHash) errors.push({ field: 'relationshipHash', rule: 'MISSING_EDGE_HASH', guidance: edge.edgeId }); if (edge.sourceNodeId === edge.targetNodeId && PROHIBITED_SELF_EDGES.has(edge.relationshipType)) errors.push({ field: 'edge', rule: 'PROHIBITED_SELF_EDGE', guidance: edge.edgeId }); if (edge.testOnly !== true) errors.push({ field: 'testOnly', rule: 'NON_TEST_GRAPH_EDGE', guidance: edge.edgeId }); }
  for (const cycle of findCycles(graph)) errors.push({ field: 'cycle', rule: 'PROHIBITED_GRAPH_CYCLE', guidance: cycle.join(' -> ') });
  if (graph.graphHash !== hashGraph(graph)) errors.push({ field: 'graphHash', rule: 'GRAPH_HASH_MISMATCH', guidance: 'Graph hash must match deterministic content.' });
  return { valid: errors.length === 0, errors };
}
function dependencyAnalysis(nodeIdValue, graph = createGraph()) { const direct = dependencies(nodeIdValue, graph); const indirect = descendants(nodeIdValue, graph).filter((n) => !direct.some((d) => d.nodeId === n.nodeId)); const reverse = reverseDependencies(nodeIdValue, graph); return { nodeId: nodeIdValue, directDependencies: direct.map((n)=>n.nodeId), indirectDependencies: indirect.map((n)=>n.nodeId), reverseDependencies: reverse.map((n)=>n.nodeId), generatedArtifactsToRefresh: downstream(nodeIdValue, graph).filter((n)=>n.type === 'Generated Artifact').map((n)=>n.nodeId), documentationToReview: downstream(nodeIdValue, graph).filter((n)=>n.type === 'Documentation Page').map((n)=>n.nodeId), testsToRerun: downstream(nodeIdValue, graph).filter((n)=>n.type === 'Script' || n.type === 'Test Suite').map((n)=>n.nodeId) }; }
function impactAnalysis(nodeIdValue, graph = createGraph()) { const down = downstream(nodeIdValue, graph); const up = upstream(nodeIdValue, graph); return { nodeId: nodeIdValue, directImpacts: children(nodeIdValue, graph).map((n)=>n.nodeId), indirectImpacts: down.map((n)=>n.nodeId), potentialImpacts: up.map((n)=>n.nodeId), unknownImpacts: down.filter((n)=>n.type === 'Unknown').map((n)=>n.nodeId), blockedImpacts: [] }; }
function dependencyReportByType(type, graph = createGraph()) { return listByType(type, graph).map((node) => ({ nodeId: node.nodeId, ...dependencyAnalysis(node.nodeId, graph), impact: impactAnalysis(node.nodeId, graph) })); }
function dependencyMatrix(graph = createGraph()) { return graph.nodes.map((node) => ({ nodeId: node.nodeId, dependencies: dependencies(node.nodeId, graph).map((n)=>n.nodeId), reverseDependencies: reverseDependencies(node.nodeId, graph).map((n)=>n.nodeId) })); }
function impactMatrix(graph = createGraph()) { return graph.nodes.map((node) => ({ nodeId: node.nodeId, impact: impactAnalysis(node.nodeId, graph) })); }
module.exports = { KNOWLEDGE_GRAPH_ENGINE_VERSION, KNOWLEDGE_GRAPH_SCHEMA_VERSION, KNOWLEDGE_GRAPH_GENERATED_ARTIFACTS, NODE_TYPES, EDGE_TYPES, createGraph, getNode, getEdge, listNodes, listEdges, listByType, parents, children, ancestors, descendants, upstream, downstream, dependencies, reverseDependencies, shortestPath, findCycles, findDisconnected, findOrphans, findUnused, findDuplicateNodes, findDuplicateEdges, groupByType, groupByLifecycle, groupByCapability, groupByVersion, groupByOwnerDecision, groupByDocumentation, graphStatistics, hashGraph, validateGraph, dependencyAnalysis, impactAnalysis, dependencyReportByType, dependencyMatrix, impactMatrix, stable, stableStringify, sha256, paths: { backendRoot, repoRoot, docsRoot } };

