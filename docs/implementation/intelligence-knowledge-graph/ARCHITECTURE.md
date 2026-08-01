# Architecture

AI-IEP-004A.8 Intelligence Knowledge Graph is repository-only, deterministic, offline, provider-neutral, and test-only. It does not enable runtime planning, provider routing, production recommendations, graph databases, SPARQL, RDF, Neo4j, cloud graph services, deployments, migrations, object storage mutations, or production writes.

The graph engine is a CommonJS repository utility under services/intelligenceExecution. It imports existing offline A.1-A.7 modules and builds an in-memory graph from their deterministic repository fixtures and generated evidence.

The architecture deliberately avoids runtime integration. No route, planner, executor, provider adapter, database, queue, cache, or production service imports the graph engine.

The graph is materialized only by scripts for documentation and test validation.
