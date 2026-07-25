# Current Test Data Audit

The repository uses script-based validation under `bridge-api/scripts`; no `bridge-api/tests` directory was present during this work. Existing reusable patterns include contract checks, controlled prohibited fixtures, synthetic runtime validation payloads, low-clearance and zone reference data, provider mocks in AI checks, and deterministic assertions in intelligence, tenant, security, routing, BI/KPI, logistics, and fleet scoring scripts.

Sensitive-data caution remains for historical audit findings around route manifests and real-looking customer/driver/product examples. Those files were not promoted into benchmark fixtures. The initial benchmark datasets use only manually authored synthetic values.
