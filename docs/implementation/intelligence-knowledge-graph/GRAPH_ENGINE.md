# Graph Engine

AI-IEP-004A.8 Intelligence Knowledge Graph is repository-only, deterministic, offline, provider-neutral, and test-only. It does not enable runtime planning, provider routing, production recommendations, graph databases, SPARQL, RDF, Neo4j, cloud graph services, deployments, migrations, object storage mutations, or production writes.

The graph engine exposes createGraph, listNodes, listEdges, traversal helpers, grouping helpers, dependency analysis, impact analysis, cycle detection, graph statistics, hashing, and validation.

The engine reads repository files and deterministic synthetic fixtures only. It does not call OpenAI, hosted providers, databases, Cloudflare, Render, external services, or production APIs.

Generated artifact nodes use stable artifact identity hashes to avoid self-referential content hash loops. Normal documentation pages preserve file content hash metadata.
