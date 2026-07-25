# Fixture Storage Model

Authoritative source fixtures live under `bridge-api/benchmarks/datasets/<capability>/<purpose>/dataset.json`. Initial framework-validation datasets intentionally embed cases in `dataset.json` because the current corpora are small, deterministic, and reviewable.

Case IDs are stable independently of array position. The loader currently walks `dataset.json` manifests only; larger future datasets can add separate case-file support by extending the loader while preserving dataset IDs and case IDs. Source manifests and generated artifacts remain separate, and there is no duplicate authoritative case source.

Templates live under `bridge-api/benchmarks/templates`. Generated catalogs live under `docs/implementation/benchmark-dataset-framework/generated` and must not be hand-edited.

The framework requires no database and no provider runtime.