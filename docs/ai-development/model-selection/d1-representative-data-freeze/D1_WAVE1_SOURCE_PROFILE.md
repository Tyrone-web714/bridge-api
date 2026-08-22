# D1 Wave 1 Source Profile

Status: SOURCE_DATA_NOT_AVAILABLE_FOR_REPRESENTATIVE_FREEZE

This profile covers the two Wave-1 D1 capabilities from the D1 readiness audit:

- `prediction.route_completion_forecast`
- `prediction.delivery_failure_risk`

No production database reads, production writes, migrations, deployments, hosted AI calls, training, model selection, D2 changes, or raw sensitive dataset commits were performed.

## Repository-Accessible Sources Inspected

| Source | Entity/type | Record count | Earliest timestamp | Latest timestamp | Organization scope | Distinct routes | Distinct stops | Distinct accounts | Target availability | Provenance classification | Freeze use |
| --- | --- | ---: | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| `bridge-api/data/route-manifest-2026-06-20-827826.csv` | Planned route manifest CSV | 5 rows | 2026-06-20 | 2026-06-20 | Missing `organization_id` | 1 | 5 | 5 | Planned-only; no actual completion or delivery outcome columns | UNKNOWN_PROVENANCE | Not approved for freeze |
| `bridge-api/data/delivery_notes.json` | Local JSON delivery notes file | 0 records | n/a | n/a | n/a | 0 | 0 | 0 | No target evidence | SOURCE_EMPTY | Not approved for freeze |
| `bridge-api/data/recent_destinations.json` | Local recent destination cache | 7 records | not route/outcome history | not route/outcome history | not representative D1 source | n/a | n/a | n/a | No route completion or delivery-failure target | SUPPORTING_REFERENCE_ONLY | Not approved for freeze |
| `bridge-api/db/postgres.js` | Schema source | n/a | n/a | n/a | Defines tenant-scoped route/stop fields | n/a | n/a | n/a | Defines possible target fields | SCHEMA_ONLY | Not a dataset |
| `bridge-api/db/repositories.js` | Repository access layer | n/a | n/a | n/a | Enforces organization filters in route/stop access paths | n/a | n/a | n/a | Defines possible query/source lineage | CODE_ONLY | Not a dataset |

## Planned Manifest CSV Profile

The local planned manifest CSV has:

- 5 rows;
- 1 route;
- 5 route stops;
- 5 accounts;
- 1 assigned driver;
- date range of one day only;
- no `organization_id` column;
- no `status` column;
- no `actual_completed_at` column;
- no `non_delivery_reason` column;
- no final route `completed_at` column;
- no delivery failure label;
- no route completion target label.

Raw customer, account, driver, address, invoice, and product rows were not copied into this package.

## Source Conclusion

The repository contains useful source schemas and one small planned-route CSV, but it does not contain approved representative historical route completion or delivery failure records. Both Wave-1 capabilities remain blocked for representative dataset freeze.
