# Formula Versioning

Formula versions are stored in `kpi_formula_versions`.

Rules:

- Formula versions belong to one KPI definition.
- KPI definitions belong to one Organization.
- Active formula versions cannot be updated or deleted.
- Historical snapshots store the exact `formula_version_id`.
- Recalculation creates a new snapshot and does not mutate prior snapshots.

This preserves historical KPI reproducibility when an Organization changes a formula later.
