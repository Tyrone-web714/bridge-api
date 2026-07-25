# Generated Artifacts

Generated artifacts are produced by `npm run capability-registry:generate` into `docs/implementation/enterprise-intelligence-capability-registry/generated/`.

Artifacts:

- `capability_registry.json`
- `capability_registry.csv`
- `CAPABILITY_REGISTRY.md`
- `capability_dependencies.json`

`npm run capability-registry:check` verifies they are current and deterministic.

Benchmark dataset artifacts are generated separately under docs/implementation/benchmark-dataset-framework/generated/ by AI-IEP-004A.2. They consume registry capability metadata but are not registry source artifacts.
