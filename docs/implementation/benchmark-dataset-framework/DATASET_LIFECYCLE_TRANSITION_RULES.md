# Dataset Lifecycle Transition Rules

Transition validation is advisory and does not mutate state. Moving to `BENCHMARK_READY` requires schema validation, case validation, source classification, provenance completeness, privacy review, quality review, capability compatibility, coverage metadata, approval metadata, and integrity hashes.

Moving to `FROZEN` additionally requires immutable versioning, deterministic generation, manifest hash, generated catalog freshness, decision record reference, approval evidence, and supersession rules.
