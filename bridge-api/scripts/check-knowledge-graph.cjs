#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const kg = require('../services/intelligenceExecution/knowledgeGraph');
const { generate } = require('./generate-knowledge-graph-artifacts.cjs');

const repoRoot = path.resolve(__dirname, '..', '..');
const generatedDir = path.join(repoRoot, 'docs', 'implementation', 'intelligence-knowledge-graph', 'generated');

function readGenerated() {
  if (!fs.existsSync(generatedDir)) return [];
  return fs.readdirSync(generatedDir).sort().map((file) => [file, fs.readFileSync(path.join(generatedDir, file), 'utf8')]);
}

function assertNode(graph, type, label) {
  const id = `${type}:${label}`;
  assert.ok(kg.getNode(id, graph), `expected graph node ${id}`);
}

function assertEdgeType(graph, relationshipType) {
  assert.ok(graph.edges.some((edge) => edge.relationshipType === relationshipType), `expected edge type ${relationshipType}`);
}

function assertNoProductionActivation(graph) {
  const text = JSON.stringify(graph);
  const prohibitedTrueKeys = [
    'productionApplicable',
    'productionUseAllowed',
    'liveRuntimeActivated',
    'liveProviderExecutionRequested',
    'providerProcurementApproved',
    'complianceCertified',
    'SOC2Certified'
  ];
  for (const key of prohibitedTrueKeys) {
    assert.ok(!new RegExp(`"${key}"\\s*:\\s*true`).test(text), `${key} must not be true in knowledge graph artifacts`);
  }
  assert.ok(!/Neo4j|SPARQL|RDF store|cloud graph service/i.test(text), 'knowledge graph must not depend on graph databases or cloud graph services');
}

function main() {
  assert.strictEqual(kg.KNOWLEDGE_GRAPH_SCHEMA_VERSION, 'intelligence.knowledge.graph.v1');
  assert.strictEqual(kg.KNOWLEDGE_GRAPH_ENGINE_VERSION, 'intelligence.knowledge.graph.engine.v1');

  const graph = kg.createGraph();
  const secondGraph = kg.createGraph();
  assert.deepStrictEqual(secondGraph, graph, 'graph generation must be deterministic');
  assert.strictEqual(kg.hashGraph(graph), graph.graphHash);

  const validation = kg.validateGraph(graph);
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.ok(graph.nodes.length >= 100, 'expected repository knowledge graph node coverage');
  assert.ok(graph.edges.length >= 100, 'expected repository knowledge graph edge coverage');
  assert.strictEqual(kg.findCycles(graph).length, 0, 'dependency graph must be acyclic for prohibited dependency edges');
  assert.strictEqual(kg.findDuplicateNodes(graph).length, 0, 'node ids must be unique');
  assert.strictEqual(kg.findDuplicateEdges(graph).length, 0, 'edge ids must be unique');
  assertNoProductionActivation(graph);

  for (const type of ['Capability', 'Benchmark Dataset', 'Evaluation Run', 'Score Run', 'Cost Governance Record', 'Execution Decision Record', 'Decision History Record', 'Governance Event', 'Documentation Page', 'Generated Artifact', 'Script', 'Repository Module']) {
    assert.ok(kg.listByType(type, graph).length > 0, `expected node type ${type}`);
  }

  for (const relationshipType of ['IMPLEMENTS', 'USES', 'DEPENDS_ON', 'PRODUCES', 'GENERATED_FROM', 'DOCUMENTS', 'GOVERNS', 'HAS_POLICY', 'EVALUATES', 'SCORES']) {
    assertEdgeType(graph, relationshipType);
  }

  assertNode(graph, 'Service', 'intelligence-execution-platform');
  assertNode(graph, 'Package', 'bridge-api');
  assertNode(graph, 'Script', 'bridge-api/scripts/generate-knowledge-graph-artifacts.cjs');
  assert.ok(kg.downstream('Service:intelligence-execution-platform', graph).length > 0);
  assert.ok(kg.upstream('Script:bridge-api/scripts/generate-knowledge-graph-artifacts.cjs', graph).length > 0);

  const capabilityNode = kg.listByType('Capability', graph)[0].nodeId;
  const dependency = kg.dependencyAnalysis(capabilityNode, graph);
  const impact = kg.impactAnalysis(capabilityNode, graph);
  assert.strictEqual(dependency.nodeId, capabilityNode);
  assert.strictEqual(impact.nodeId, capabilityNode);
  assert.ok(Array.isArray(kg.dependencyMatrix(graph)));
  assert.ok(Array.isArray(kg.impactMatrix(graph)));
  assert.ok(kg.graphStatistics(graph).nodeCount === graph.nodes.length);

  const before = readGenerated();
  const result = generate({ check: true });
  assert.deepStrictEqual(result.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  console.log('[test:knowledge-graph] nodes, edges, dependency analysis, impact analysis, cycle detection, determinism, artifacts, and production-safety boundaries verified.');
}

main();
