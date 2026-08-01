#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const kg = require('../services/intelligenceExecution/knowledgeGraph');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(repoRoot, 'docs', 'implementation', 'intelligence-knowledge-graph', 'generated');
const generatedFrom = 'bridge-api/intelligence-knowledge-graph';
const generatedHeader = 'Generated from bridge-api/intelligence-knowledge-graph. Do not hand-edit.';

function ensureDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

function json(value) {
  return `${JSON.stringify(kg.stable(value), null, 2)}\n`;
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join('|') : typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeIfChanged(fileName, content, options = {}) {
  const filePath = path.join(outDir, fileName);
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(filePath, content, 'utf8');
  return changed;
}

function nodeRows(graph) {
  return graph.nodes.map((node) => ({
    nodeId: node.nodeId,
    type: node.type,
    label: node.label,
    version: node.version,
    lifecycleState: node.lifecycleState,
    source: node.source,
    testOnly: node.testOnly,
    productionApplicable: node.productionApplicable,
    hash: node.hash
  }));
}

function edgeRows(graph) {
  return graph.edges.map((edge) => ({
    edgeId: edge.edgeId,
    sourceNodeId: edge.sourceNodeId,
    relationshipType: edge.relationshipType,
    targetNodeId: edge.targetNodeId,
    relationshipVersion: edge.relationshipVersion,
    relationshipConfidence: edge.relationshipConfidence,
    relationshipSource: edge.relationshipSource,
    testOnly: edge.testOnly,
    relationshipHash: edge.relationshipHash
  }));
}

function csv(rows, fields) {
  return [`# ${generatedHeader}`, fields.join(',')]
    .concat(rows.map((row) => fields.map((field) => csvEscape(row[field])).join(',')))
    .join('\n') + '\n';
}

function summaryMd(graph, validation, stats) {
  return [
    `<!-- ${generatedHeader} -->`,
    '# Intelligence Knowledge Graph Summary',
    '',
    'The Intelligence Knowledge Graph is repository-only, deterministic, offline, provider-neutral, and test-only. It does not activate runtime planning, provider routing, production recommendations, graph databases, SPARQL, RDF, Neo4j, cloud graph services, deployments, migrations, or production writes.',
    '',
    `- Schema version: ${graph.schemaVersion}`,
    `- Engine version: ${graph.engineVersion}`,
    `- Graph hash: ${graph.graphHash}`,
    `- Nodes: ${stats.nodeCount}`,
    `- Edges: ${stats.edgeCount}`,
    `- Cycles: ${stats.cycleCount}`,
    `- Validation: ${validation.valid ? 'valid' : 'invalid'}`,
    '',
    '## Node Types',
    '',
    '| Type | Count |',
    '| --- | ---: |',
    ...Object.entries(stats.nodeTypes).map(([type, count]) => `| ${type} | ${count} |`),
    '',
    '## Edge Types',
    '',
    '| Relationship | Count |',
    '| --- | ---: |',
    ...Object.entries(stats.edgeTypes).map(([type, count]) => `| ${type} | ${count} |`)
  ].join('\n') + '\n';
}

function typedDependencyReports(graph) {
  return {
    'capability_dependency_report.json': kg.dependencyReportByType('Capability', graph),
    'dataset_dependency_report.json': kg.dependencyReportByType('Benchmark Dataset', graph),
    'policy_dependency_report.json': kg.dependencyReportByType('Decision Policy Profile', graph),
    'cost_dependency_report.json': kg.dependencyReportByType('Cost Governance Record', graph),
    'decision_dependency_report.json': kg.dependencyReportByType('Execution Decision Record', graph),
    'governance_dependency_report.json': kg.dependencyReportByType('Decision History Record', graph).concat(kg.dependencyReportByType('Governance Event', graph)),
    'documentation_dependency_report.json': kg.dependencyReportByType('Documentation Page', graph),
    'generated_artifact_dependency_report.json': kg.dependencyReportByType('Generated Artifact', graph),
    'test_dependency_report.json': kg.dependencyReportByType('Script', graph).concat(kg.dependencyReportByType('Test Suite', graph))
  };
}

function generate(options = {}) {
  ensureDir();
  const graph = kg.createGraph();
  const validation = kg.validateGraph(graph);
  const stats = kg.graphStatistics(graph);
  const outputs = {
    'knowledge_graph.json': json({ generatedFrom, generatedArtifact: true, graph }),
    'knowledge_graph.csv': csv(edgeRows(graph), ['edgeId', 'sourceNodeId', 'relationshipType', 'targetNodeId', 'relationshipVersion', 'relationshipConfidence', 'relationshipSource', 'testOnly', 'relationshipHash']),
    'knowledge_graph_summary.md': summaryMd(graph, validation, stats),
    'node_catalog.json': json({ generatedFrom, generatedArtifact: true, nodes: nodeRows(graph) }),
    'edge_catalog.json': json({ generatedFrom, generatedArtifact: true, edges: edgeRows(graph) }),
    'dependency_matrix.json': json({ generatedFrom, generatedArtifact: true, matrix: kg.dependencyMatrix(graph) }),
    'impact_matrix.json': json({ generatedFrom, generatedArtifact: true, matrix: kg.impactMatrix(graph) }),
    'cycle_report.json': json({ generatedFrom, generatedArtifact: true, cycles: kg.findCycles(graph) }),
    'orphan_report.json': json({ generatedFrom, generatedArtifact: true, orphanCount: kg.findOrphans(graph).length, orphans: kg.findOrphans(graph).map((node) => node.nodeId), disconnectedCount: kg.findDisconnected(graph).length, disconnected: kg.findDisconnected(graph).map((node) => node.nodeId) }),
    'graph_statistics.json': json({ generatedFrom, generatedArtifact: true, statistics: stats }),
    'knowledge_graph_hash.json': json({ generatedFrom, generatedArtifact: true, graphHash: graph.graphHash, validation })
  };
  for (const [fileName, report] of Object.entries(typedDependencyReports(graph))) outputs[fileName] = json({ generatedFrom, generatedArtifact: true, report });
  const changed = Object.entries(outputs).filter(([name, content]) => writeIfChanged(name, content, options)).map(([name]) => name);
  if (options.check && changed.length) {
    console.error(`[knowledge-graph] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[knowledge-graph] generated ${Object.keys(outputs).length} artifacts in ${path.relative(repoRoot, outDir).replace(/\\/g, '/')}`);
  }
  return { changed, graph, validation, stats };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate };
