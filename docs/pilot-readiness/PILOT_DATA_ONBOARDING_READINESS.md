# Pilot Data Onboarding Readiness

Status: BLOCKED by missing real Organization data and import rehearsal.

Repository evidence:

- Bulk import contract checks exist.
- Production rollout and data operations runbooks exist.
- Route manifest and route/stop workflows exist.
- Historical D1 data acquisition has been separated from immediate pilot readiness.

Required pilot data:

- Organization and depot identifiers.
- Pilot supervisors, admins, dispatch users, drivers, and support contacts.
- Driver-device mapping.
- Route dates, route manifests, stops, service windows, and delivery constraints.
- Customer and order data needed for the pilot route workflow.
- Hazard/source assumptions for representative pilot geography.

Required dry runs:

- Import pilot-format data into a non-production environment.
- Confirm tenant ownership on every imported record.
- Confirm rollback or delete strategy for bad pilot imports.
- Confirm route assignment, stop sequencing, supervisor visibility, and driver mobile display.

Out of scope:

- D1 predictive/statistical selection.
- Large historical data backfill.
- Broad enterprise data warehouse onboarding.
