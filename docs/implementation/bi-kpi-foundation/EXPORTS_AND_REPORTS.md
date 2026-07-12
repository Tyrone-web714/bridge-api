# Exports and Reports

Implemented export:

- `GET /api/bi-kpi/export.csv`

Properties:

- permission protected by `dashboard.export`
- Organization-scoped
- bounded row limit
- CSV only
- no unrelated private fields
- includes formula version, result, threshold status, and calculation timestamp

Complex PDF reporting is intentionally out of scope for this phase.
