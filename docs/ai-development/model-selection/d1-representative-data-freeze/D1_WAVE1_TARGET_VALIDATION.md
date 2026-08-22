# D1 Wave 1 Target Validation

Status: TARGET_NOT_READY_FOR_FREEZE

The D1 readiness audit defines Wave 1 targets conceptually but requires historical evidence before freezing.

## Route Completion

| Field | Decision |
| --- | --- |
| Capability ID | `prediction.route_completion_forecast` |
| Business purpose | Predict route completion time, remaining minutes, or pace risk for operational planning. |
| Target variable | Actual route completion time, remaining minutes error, or pace risk label derived from planned and actual route/stop timing. |
| Prediction horizon | Before or during route execution, using only information available at prediction time. |
| Unit of prediction | Route/date or route-state snapshot. |
| Source of truth | Tenant-scoped `daily_route_manifests` and `daily_route_stops` with actual activity and completion timestamps. |
| Decision consumer | Supervisor/operations planning workflows. |
| Authority classification | Advisory predictive signal; deterministic route records remain authoritative. |
| Target readiness | TARGET_NOT_READY |

Route completion cannot be frozen from the inspected local sources because the only local route manifest file contains planned route/stop fields only. It does not contain actual route completion, actual stop timestamps, route status history, tenant ownership, or enough historical depth.

## Delivery Failure Risk

| Field | Decision |
| --- | --- |
| Capability ID | `prediction.delivery_failure_risk` |
| Business purpose | Estimate probability or risk label for delivery failure by account, route, or date window. |
| Target variable | Delivery failure outcome such as undelivered/failed stop, with reason where available. |
| Prediction horizon | Before delivery attempt or before route execution, using only pre-outcome information. |
| Unit of prediction | Stop/account/route-date window, depending on approved target rule. |
| Source of truth | Tenant-scoped `daily_route_stops` statuses, `non_delivery_reason`, delivery settlements, and related route/account context. |
| Decision consumer | Supervisor/operations planning and human-review workflows. |
| Authority classification | Advisory predictive signal; backend failure-rate calculations and recorded delivery outcomes remain authoritative. |
| Target readiness | TARGET_NOT_READY |

Delivery failure risk cannot be frozen from the inspected local sources because there is no representative stop outcome history, no failure labels, no non-delivery reason counts, no tenant-provenance evidence, and no failure-event class balance.

## Ambiguities Blocking Freeze

- Final route completion target needs an approved label rule: route-level `completed_at`, last completed/undelivered stop timestamp, final inventory closeout, or another explicit operational completion definition.
- Delivery failure target needs an approved label taxonomy: undelivered, partial delivery, refused, unavailable, inventory failure, route/time failure, operational failure, cancellation, reschedule, and unknown outcome.
- Prediction time must be explicit for both targets so leakage can be evaluated.
