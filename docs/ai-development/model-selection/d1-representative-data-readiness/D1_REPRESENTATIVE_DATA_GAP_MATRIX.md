# D1 Representative Data Gap Matrix

Status: ALL_D1_CAPABILITIES_BLOCKED_BY_REPRESENTATIVE_DATA

MS-004 records all four D1 capabilities as `D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA`. The gap matrix below identifies the minimum missing evidence before method comparison can become selection evidence.

| Capability ID | Current data evidence | Primary blockers | Readiness decision |
| --- | --- | --- | --- |
| prediction.account_reorder_forecast | Synthetic frozen MS-004 cases plus deterministic-v1 code path | Representative account/order history not frozen; target window and pass/fail thresholds not approved; tenant coverage not measured | NOT_READY_FOR_METHOD_SELECTION |
| prediction.delivery_failure_risk | Synthetic frozen MS-004 cases plus deterministic-v1 code path | Representative stop/outcome history not frozen; failure labels and false positive/negative consequences not approved; class balance not measured | NOT_READY_FOR_METHOD_SELECTION |
| prediction.product_demand_forecast | Synthetic frozen MS-004 cases plus deterministic-v1 code path | Representative SKU/account demand history not frozen; sparse-demand and stockout treatment not approved; seasonality coverage not measured | NOT_READY_FOR_METHOD_SELECTION |
| prediction.route_completion_forecast | Synthetic frozen MS-004 cases plus deterministic-v1 code path | Representative planned/actual route timing data not frozen; completion target and leakage controls not approved; route mix coverage not measured | NOT_READY_FOR_METHOD_SELECTION |

## Cross-Capability Gaps

- No owner-approved representative data extraction plan is present.
- No dataset freeze manifest exists for D1 representative historical data.
- No row-count, date-span, tenant-span, or label-completeness evidence is recorded.
- No numeric acceptance thresholds are approved for D1 prediction error, calibration, precision/recall, or stability.
- No legal/privacy approval is recorded for production data use in D1 benchmarking.

## Non-Blocking Evidence

The following evidence supports readiness for future work but does not close the representative-data blocker:

- D1 pipeline validation executed locally.
- Hard gates passed for synthetic pipeline-validation records.
- D1 candidate methods were defined by MS-003.
- Existing deterministic baseline functions are present and tested.
