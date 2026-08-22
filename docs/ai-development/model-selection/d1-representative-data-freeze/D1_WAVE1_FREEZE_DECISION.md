# D1 Wave 1 Freeze Decision

Status: NO_DATASET_FROZEN

## Final Decisions

| Capability ID | Decision | Method selection unlocked |
| --- | --- | --- |
| `prediction.route_completion_forecast` | SOURCE_DATA_NOT_AVAILABLE | No |
| `prediction.delivery_failure_risk` | SOURCE_DATA_NOT_AVAILABLE | No |

## Route Completion Decision

Route completion did not receive `REPRESENTATIVE_DATASET_FROZEN_METHOD_SELECTION_READY`.

Reasons:

- no representative planned-vs-actual route timing dataset is available in repository-local sources;
- local planned manifest has only one date, one route, and five stops;
- target label fields are absent;
- `organization_id` tenant provenance is absent;
- no time-aware split can be created;
- no route mix, seasonal coverage, route-length distribution, or completion-duration quality profile can be established.

## Delivery Failure Risk Decision

Delivery failure risk did not receive `REPRESENTATIVE_DATASET_FROZEN_METHOD_SELECTION_READY`.

Reasons:

- no representative stop outcome history is available in repository-local sources;
- local planned manifest has no stop status, non-delivery reason, delivery settlement, or failure label fields;
- positive failure count is 0 available/0 proven;
- negative count is 0 available/0 proven;
- unknown/unusable local candidate rows are 5;
- failure rate cannot be calculated;
- tenant provenance is absent.

## Raw Data Treatment

Raw operational records were not copied into this documentation package. The local planned manifest remains in its existing repository location and is treated as not representative for D1 method selection.
