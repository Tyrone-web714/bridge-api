# Graph Validation

AI-IEP-004A.8 Intelligence Knowledge Graph is repository-only, deterministic, offline, provider-neutral, and test-only. It does not enable runtime planning, provider routing, production recommendations, graph databases, SPARQL, RDF, Neo4j, cloud graph services, deployments, migrations, object storage mutations, or production writes.

Validation checks node types, edge types, endpoint references, hashes, duplicate node and edge ids, prohibited dependency self-edges, graph hash determinism, test-only edges, and production activation flags.

Run npm run knowledge-graph:validate or npm run test:knowledge-graph to validate the graph and stale generated artifacts.
