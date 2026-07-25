# Content Hashing and Reproducibility

The framework implements stable serialization, per-case hashes, manifest hashes, deterministic ordering, fixture-count verification, source-hash validation, and generated artifact freshness checks. Hash helpers exclude managed integrity hash fields from semantic hashing so stored hashes can be regenerated deterministically.

Use `npm run benchmark-datasets:update-hashes` after intentional source fixture edits, then `npm run benchmark-datasets:generate`. Running generation repeatedly without source changes should produce no diff.