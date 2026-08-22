# D1 Evaluation Metrics

Status: METRIC_FAMILIES_DEFINED_THRESHOLDS_DEFERRED

MS-002 defines D1 quality dimensions but leaves numeric thresholds owner/empirical. This document records the minimum metric package required before D1 method selection.

| Capability ID | Primary metric family | Secondary metrics | Required operational evidence |
| --- | --- | --- | --- |
| prediction.account_reorder_forecast | Forecast error for next order date or days-to-next-order | Calibration by confidence band, overdue/due-soon classification precision/recall if labels are used, stability across runs, missing/stale data behavior | Account-level holdout windows, order-history lineage, confidence-band reliability, human review triggers |
| prediction.delivery_failure_risk | Classification precision/recall and calibration for failure-risk label or probability | False positive/negative consequence recording, AUC/PR-AUC where class balance allows, stability, missing/stale data behavior | Failure-label definition, reason-code quality, class balance, per-tenant calibration, review threshold |
| prediction.product_demand_forecast | Quantity forecast error by SKU/account/window | Direction accuracy, calibration by confidence band, sparse-demand handling, stability, missing/stale data behavior | SKU/account holdout windows, stockout/availability decision, seasonal coverage, product hierarchy mapping |
| prediction.route_completion_forecast | Completion-time or remaining-minutes forecast error | Pace-status classification accuracy, calibration by confidence band, route-mix stability, missing/stale data behavior | Planned/actual timestamp completeness, route-date holdout, stop-state lineage, leakage controls |

## Required Hard Gates

Every D1 method run must pass:

- tenant isolation;
- evidence lineage preservation;
- missing data flagging;
- stale data behavior;
- required output contract preservation;
- reproducibility;
- no fabricated source evidence;
- no unsupported causation;
- no provider/model selection assertion.

## Threshold State

No numeric D1 pass/fail threshold is approved by the current repository evidence. A future owner-approved threshold record must define acceptable error, calibration, reliability, and latency before method winners can be selected.
