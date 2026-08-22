# D1 Wave 1 Exclusion Manifest

Status: ALL_LOCAL_CANDIDATE_RECORDS_EXCLUDED_FROM_REPRESENTATIVE_FREEZE

## Exclusion Rules

| Rule ID | Rule | Route completion count | Delivery failure count | Reason |
| --- | --- | ---: | ---: | --- |
| EXCLUDE_MISSING_TENANT | Exclude records without validated `organization_id` or equivalent approved tenant provenance. | 5 | 5 | Organization identity is absent from the local CSV. |
| EXCLUDE_MISSING_TARGET | Exclude records missing target label fields. | 5 | 5 | Route completion and delivery failure targets are absent. |
| EXCLUDE_UNKNOWN_PROVENANCE | Exclude records where source is local/sample/unknown and not approved representative historical data. | 5 | 5 | The local CSV has no approved representative provenance record. |
| EXCLUDE_INSUFFICIENT_DEPTH | Exclude from method-selection freeze where history is one day/one route only. | 5 | 5 | Historical depth is insufficient for representative evaluation. |
| EXCLUDE_SENSITIVE_RAW_GIT | Do not commit raw customer/address/invoice/driver rows as a representative dataset. | 5 | 5 | Raw operational rows contain private/sensitive fields. |

## Excluded Record Summary

| Capability ID | Candidate rows | Included rows | Excluded rows | Primary exclusion |
| --- | ---: | ---: | ---: | --- |
| `prediction.route_completion_forecast` | 5 | 0 | 5 | Missing target and tenant provenance |
| `prediction.delivery_failure_risk` | 5 | 0 | 5 | Missing target and tenant provenance |

No silent drops were performed. No raw source record was transformed into a frozen representative dataset.
