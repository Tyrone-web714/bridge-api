# Generated Artifacts

AI-IEP-004A.8 Intelligence Knowledge Graph is repository-only, deterministic, offline, provider-neutral, and test-only. It does not enable runtime planning, provider routing, production recommendations, graph databases, SPARQL, RDF, Neo4j, cloud graph services, deployments, migrations, object storage mutations, or production writes.

The generator writes JSON, CSV, and Markdown evidence to generated/. These files include the full graph, node catalog, edge catalog, dependency matrix, impact matrix, type-specific dependency reports, cycle report, orphan report, graph statistics, summary, and graph hash.

The checker verifies generated artifacts are current by running the generator in check mode and comparing expected content without writing.
