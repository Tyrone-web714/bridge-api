# Repository Integration

AI-IEP-004A.8 Intelligence Knowledge Graph is repository-only, deterministic, offline, provider-neutral, and test-only. It does not enable runtime planning, provider routing, production recommendations, graph databases, SPARQL, RDF, Neo4j, cloud graph services, deployments, migrations, object storage mutations, or production writes.

Integration points are limited to package scripts and generated documentation. The npm test chain now includes npm run test:knowledge-graph after decision governance and before intelligence execution.

Repository modules, scripts, docs, generated artifacts, and architecture records are represented as graph nodes so future source-control reviews can reason about dependency and impact evidence without production access.
