# Cycle Detection

AI-IEP-004A.8 Intelligence Knowledge Graph is repository-only, deterministic, offline, provider-neutral, and test-only. It does not enable runtime planning, provider routing, production recommendations, graph databases, SPARQL, RDF, Neo4j, cloud graph services, deployments, migrations, object storage mutations, or production writes.

Cycle detection traverses dependency-like relationships including DEPENDS_ON, GENERATED_FROM, CREATED_FROM, DERIVES_FROM, FALLBACK_TO, and SUPERSEDES.

The current graph validation requires zero cycles across those prohibited dependency edges. The generated cycle report is stored in generated/cycle_report.json.
