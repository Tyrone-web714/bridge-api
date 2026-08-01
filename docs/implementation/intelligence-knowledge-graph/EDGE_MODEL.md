# Edge Model

AI-IEP-004A.8 Intelligence Knowledge Graph is repository-only, deterministic, offline, provider-neutral, and test-only. It does not enable runtime planning, provider routing, production recommendations, graph databases, SPARQL, RDF, Neo4j, cloud graph services, deployments, migrations, object storage mutations, or production writes.

Edges use edgeId, sourceNodeId, targetNodeId, relationshipType, relationshipVersion, relationshipHash, relationshipSource, relationshipConfidence, testOnly, and metadata. Edge identifiers and hashes are deterministic.

Relationship types include DEPENDS_ON, USES, EVALUATES, SCORES, GOVERNS, PRODUCES, CREATED_FROM, REPLAYS, HAS_POLICY, HAS_VERSION, HAS_HASH, BELONGS_TO, REQUIRES, ALLOWS, IMPLEMENTS, DOCUMENTS, GENERATED_FROM, INFLUENCES, and TESTS.

Validation rejects invalid edge types, missing endpoints, missing hashes, non-test edges, and prohibited dependency self-edges.
