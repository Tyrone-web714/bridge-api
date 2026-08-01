# Architecture

The Driver Intelligence Foundation is implemented as a repository-native service under `services/intelligenceExecution`. It mirrors the Route Intelligence Foundation pattern: deterministic rules accept trusted server-side context and supplied operational evidence, produce normalized assessment records, and expose deterministic builders for synthetic evidence and generated artifacts.

The service integrates by reference with existing Intelligence Execution Platform layers:

- Enterprise capability registry availability is verified without adding a direct registry capability in this phase.
- Intelligence Capability Orchestration already models the driver intelligence domain.
- Intelligence Lifecycle Framework derives lifecycle evidence for the driver intelligence capability.
- Route Intelligence provides shared route-safety policy context for approach-distance thresholds.

No new platform component or production execution boundary is introduced.
