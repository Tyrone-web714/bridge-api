# Runtime Hard Gates

Selected-D2 execution enforces runtime gates after provider normalization and before a response is treated as usable.

Mandatory gates include:

- schema-required fields;
- source evidence references;
- tenant context;
- authority boundary;
- safety boundary;
- prohibited workforce or operational authority language;
- secret-like output rejection;
- cross-organization disclosure rejection.

Hard-gate failure raises `D2_SELECTED_RUNTIME_HARD_GATE_FAILED`. Aggregate quality scoring cannot rescue a hard-gate failure.
