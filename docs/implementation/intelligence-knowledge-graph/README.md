# Intelligence Knowledge Graph

AI-IEP-004A.8 Intelligence Knowledge Graph is repository-only, deterministic, offline, provider-neutral, and test-only. It does not enable runtime planning, provider routing, production recommendations, graph databases, SPARQL, RDF, Neo4j, cloud graph services, deployments, migrations, object storage mutations, or production writes.

## Scope

This package models repository evidence from the Intelligence Execution Platform as typed graph nodes and deterministic relationships. It covers capability registry, benchmark datasets, evaluation, scoring, cost governance, execution decisions, decision governance, generated artifacts, scripts, modules, and implementation documentation.

## Primary entry points

- Engine: bridge-api/services/intelligenceExecution/knowledgeGraph.js
- Generator: bridge-api/scripts/generate-knowledge-graph-artifacts.cjs
- Checker: bridge-api/scripts/check-knowledge-graph.cjs
- Test gate: npm run test:knowledge-graph

## Generated evidence

Generated artifacts are written under docs/implementation/intelligence-knowledge-graph/generated and are intended to be regenerated from repository state, not hand edited.
