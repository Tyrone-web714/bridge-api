# Performance

AI-IEP-004A.8 Intelligence Knowledge Graph is repository-only, deterministic, offline, provider-neutral, and test-only. It does not enable runtime planning, provider routing, production recommendations, graph databases, SPARQL, RDF, Neo4j, cloud graph services, deployments, migrations, object storage mutations, or production writes.

The graph build is repository-wide and intentionally recomputes upstream synthetic evidence. It is suitable for local checks and generated documentation, not request-path execution.

No caching, queueing, background worker, service endpoint, or runtime performance optimization was added because the graph is not part of production execution.
