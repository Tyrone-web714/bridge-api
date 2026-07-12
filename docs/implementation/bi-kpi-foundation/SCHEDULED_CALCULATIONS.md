# Scheduled Calculations

Table: `kpi_calculation_jobs`.

Foundation support:

- `daily`
- `weekly`
- `monthly`
- `on_demand`

Run keys are Organization-scoped and unique. This prevents duplicate snapshots for the same approved run key. This phase creates the data and service foundation, but does not introduce a new external scheduler.
