# D1 Wave 1 Split Specification

Status: SPLIT_NOT_CREATED

No train/validation/test split was created because no Wave-1 representative dataset was frozen.

## Required Future Split Rule

When representative data exists, use chronological splits only. Do not use random splitting for these operational prediction targets.

| Split | Future rule |
| --- | --- |
| TRAIN | Earliest approved historical period only. Fit preprocessing statistics here only. |
| VALIDATION | Later period after TRAIN. Use for threshold and method tuning. |
| TEST | Latest held-out period. Use once for final method comparison evidence. |

## Tenant Split Rule

Tenant-private data must remain tenant-isolated. Per the D1 tenant strategy:

- freeze by `organization_id`;
- record tenant-specific row counts and exclusions;
- do not pool private operational data across organizations without separate approval;
- avoid cross-tenant leakage through aggregate preprocessing statistics.

## Current Split Counts

| Capability ID | TRAIN | VALIDATION | TEST | Reason |
| --- | ---: | ---: | ---: | --- |
| `prediction.route_completion_forecast` | 0 | 0 | 0 | No representative target dataset. |
| `prediction.delivery_failure_risk` | 0 | 0 | 0 | No representative target dataset. |
