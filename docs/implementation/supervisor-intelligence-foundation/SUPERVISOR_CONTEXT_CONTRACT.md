# Supervisor Context Contract

Supervisor context is server-derived in future runtime use. The deterministic contract requires organization ID, supervisor user ID, authorized role, reporting window, source references, evidence timestamp, and test-only marker.

Allowed roles are Supervisor, Organization Admin, and Platform Admin equivalents. Caller-controlled provider, model, premium, organization override, employee score, or driver rank fields are rejected by validation.

The generated contract artifact is `generated/supervisor_context_contract.json`.
