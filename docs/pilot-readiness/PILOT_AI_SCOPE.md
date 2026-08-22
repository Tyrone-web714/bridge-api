# Pilot AI Scope

Status: RESTRICTED.

Initial live pilot AI decision:

- D1: DISABLED. D1 remains pending representative historical data and predictive/statistical method selection.
- D2: DISABLED FOR PRODUCTION ROUTING. Selected D2 models and non-production smoke evidence do not authorize live production AI routing.
- D2 shadow: OPTIONAL ONLY after a separate owner-approved non-production/shadow validation package.

Allowed during initial pilot:

- Existing deterministic routing, safety, audit, and supervisor workflows.
- Repository-only AI architecture validation.
- Non-production evidence review.

Not allowed during initial pilot without a new change request:

- Production provider activation.
- Production model selection changes.
- Hosted AI benchmarking from the pilot launch window.
- Driver-facing D2 responses in production.
- D1 predictive or statistical output.
- Premium model activation.

Rationale:

Pilot safety and tenant correctness must not depend on newly activated production AI routes.
The pilot can proceed only after core operational flows are independently safe, observable,
tenant-scoped, and recoverable.
