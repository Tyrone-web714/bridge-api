# Retention Policy Engine

`services/dataLifecycle.js` provides centralized policy lookup. `retention_policies` stores platform and optional Organization-scoped policies.

The default account recovery window is 30 days. Operational, analytical, backup, object-storage, and Organization termination durations remain `POLICY_DECISION_REQUIRED`.

Missing policy does not imply deletion approval; it returns `POLICY_DECISION_REQUIRED`.
