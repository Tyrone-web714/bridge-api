# TSR AI Master Roadmap

The machine-readable source of truth is `TSR_AI_MASTER_ROADMAP.json`. This Markdown file summarizes the same approved roadmap.

## Current Verified Source-Control State

- Local branch: `legacy-public-url-final-cleanup`
- Remote branch: `origin/legacy-public-url-final-cleanup`
- Local HEAD after MS-004 preservation: `7f4ef7538a894b9ae3fd3c654c22fcbc5e558904`
- Remote HEAD after MS-004 preservation: `7f4ef7538a894b9ae3fd3c654c22fcbc5e558904`

## Model Selection and Benchmarking

- `MS-001`: `PUSHED`, TSR AI Capability & Execution Classification. Documentation: `docs/ai-development/model-selection/ms-001-ai-capability-execution-classification`. Commit: `9de484e2bf87cee2ae61e25e1997d7427d289e90`. Pushed: `true`. Deployed: `false`.
- `MS-002`: `PUSHED`, Benchmark & Acceptance Framework. Documentation: `docs/ai-development/model-selection/ms-002-benchmark-acceptance-framework`. Commit: `9c68894de9609c8f884a11c31be0e45eb44b058a`. Pushed: `true`. Deployed: `false`.
- `MS-003`: `PUSHED`, Candidate Model & Method Selection. Documentation: `docs/ai-development/model-selection/ms-003-candidate-model-method-selection`. Commit: `8ef625be90aadc11647f33296ca20ab965207097`. Pushed: `true`. Deployed: `false`.
- `MS-004`: `PUSHED`, Comparative Benchmark Execution. Documentation: `docs/ai-development/model-selection/ms-004-comparative-benchmark-execution`. Commit: `7f4ef7538a894b9ae3fd3c654c22fcbc5e558904`. Pushed: `true`. Deployed: `false`.
- `D2-SELECTED-MODEL-NONPRODUCTION-INTEGRATION`: `IMPLEMENTED_UNCOMMITTED`, D2 Selected-Model Non-Production Integration. Documentation: `docs/implementation/d2-selected-model-nonproduction-integration`. Commit: `UNCOMMITTED`. Pushed: `false`. Deployed: `false`.

MS-004 is complete and pushed. The current package integrates the selected D2 model matrix into an explicit non-production execution boundary. The Model Selection Gate remains `DEFERRED`, incomplete, inactive, and owner-approval gated because production model routing and production orchestration are not active.

D1 remains `D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA`.

Production orchestration remains `DEFERRED`, incomplete, inactive, and owner-approval gated.
