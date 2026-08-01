# Rollback Plan

AI-IEP-004A.8 Intelligence Knowledge Graph is repository-only, deterministic, offline, provider-neutral, and test-only. It does not enable runtime planning, provider routing, production recommendations, graph databases, SPARQL, RDF, Neo4j, cloud graph services, deployments, migrations, object storage mutations, or production writes.

Rollback is source-control only. Revert the A.8 files and package script changes to remove the knowledge graph subsystem.

No database rollback, object storage rollback, Cloudflare rollback, credential rollback, provider rollback, or deployment rollback is required because A.8 does not modify those systems.
