# Node Model

AI-IEP-004A.8 Intelligence Knowledge Graph is repository-only, deterministic, offline, provider-neutral, and test-only. It does not enable runtime planning, provider routing, production recommendations, graph databases, SPARQL, RDF, Neo4j, cloud graph services, deployments, migrations, object storage mutations, or production writes.

Nodes use the fields nodeId, type, label, version, lifecycleState, hash, source, testOnly, productionApplicable, and metadata. Node identifiers are deterministic and typed as Type:identifier.

Covered node classes include Capability, Benchmark Dataset, Evaluation Run, Score Run, Cost Governance Record, Execution Decision Request, Execution Decision Record, Decision History Record, Governance Event, Documentation Page, Generated Artifact, Script, Repository Module, Package, Service, Hash, Version, Lifecycle State, Owner Decision, Architecture Decision, and Unknown.

Unknown nodes are limited to synthetic fallback candidates already present in offline decision evidence.
