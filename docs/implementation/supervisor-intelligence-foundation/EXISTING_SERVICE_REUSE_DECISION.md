# Existing Service Reuse Decision

Decision: preserve the existing scheduled supervisor report service and add a separate deterministic foundation module.

Rationale: `services/supervisorIntelligence.js` is runtime-oriented and persists reports, alerts, and schedules. The approved package is repository-only and must not create production writes, migrations, deployments, notifications, or new public APIs.

The new module therefore provides deterministic operational intelligence primitives while leaving the existing daily report compatibility path unchanged.
