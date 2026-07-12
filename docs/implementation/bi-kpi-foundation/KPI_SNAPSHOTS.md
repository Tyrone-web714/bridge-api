# KPI Snapshots

Snapshots are immutable historical KPI results.

Each snapshot stores:

- Organization
- KPI definition
- formula version
- subject type and ID
- time period
- raw inputs
- calculated value
- normalized score
- threshold status
- calculation trace
- source freshness
- calculated timestamp
- immutable snapshot ID
- calculation run key

Snapshots must not be silently recomputed. Explicit recalculation creates a new snapshot with a new run key.
