# Generated Artifacts

Generated artifacts are produced by `npm run benchmark-datasets:generate` into `docs/implementation/benchmark-dataset-framework/generated`. Artifacts include JSON, CSV, Markdown catalog, case index, coverage report, and dependency map.

`npm run benchmark-datasets:check` validates that generated artifacts are current and deterministic. Source fixture hash fields are maintained by `npm run benchmark-datasets:update-hashes` and validated before artifact generation.