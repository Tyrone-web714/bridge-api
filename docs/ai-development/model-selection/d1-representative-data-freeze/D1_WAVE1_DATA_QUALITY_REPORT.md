# D1 Wave 1 Data Quality Report

Status: DATA_QUALITY_BLOCKED_BY_SOURCE_DATA_ABSENCE

## Quality Summary

| Capability ID | Candidate source | Rows | Duplicate count | Missing tenant count | Invalid timestamp count | Broken relationship count | Target missingness | Contamination count | Decision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |
| `prediction.route_completion_forecast` | Local planned manifest CSV | 5 | 0 known from route/stop keys | 5 | 0 for planned date fields; actual timestamp columns absent | Not testable without database relationships | 100 percent for actual completion target | 5 unknown-provenance records | SOURCE_DATA_NOT_AVAILABLE |
| `prediction.delivery_failure_risk` | Local planned manifest CSV | 5 | 0 known from route/stop keys | 5 | 0 for planned date fields; outcome timestamp columns absent | Not testable without database relationships | 100 percent for delivery failure target | 5 unknown-provenance records | SOURCE_DATA_NOT_AVAILABLE |

## Important Field Missingness

| Field | Local manifest status | D1 consequence |
| --- | --- | --- |
| `organization_id` | Column absent | Tenant provenance blocked. |
| `actual_completed_at` | Column absent | Route completion target blocked. |
| route-level `completed_at` | Column absent | Route completion target blocked. |
| stop `status` | Column absent | Delivery outcome label blocked. |
| `non_delivery_reason` | Column absent | Failure taxonomy and reason quality blocked. |
| delivery settlement completion | Column absent | Delivery outcome confirmation blocked. |
| historical repeated dates | One route date only | Historical depth blocked. |

## Outlier And Impossible Value Review

No representative outlier review can be performed because there is no approved historical target dataset. The local CSV has planned route fields only and cannot support checks for negative route durations, extreme actual durations, duplicate completion events, or impossible delivery-outcome transitions.

## Data Quality Decision

Both Wave-1 capabilities are blocked by source-data absence and tenant provenance. The local CSV may be useful for import mechanics, but it is not a representative historical freeze candidate.
