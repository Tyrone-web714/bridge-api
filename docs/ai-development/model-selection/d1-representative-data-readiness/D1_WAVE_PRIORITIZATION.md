# D1 Wave Prioritization

Status: PREPARATION_WAVES_DEFINED_NO_SELECTION_AUTHORIZED

The waves below prioritize representative-data preparation, not method selection. No D1 method should be selected until the applicable representative dataset is frozen and thresholds are approved.

| Wave | Capability | Rationale | Entry criteria |
| --- | --- | --- | --- |
| 1 | prediction.route_completion_forecast | Repository has route manifest and stop-state structures plus deterministic route completion logic. This appears to be the clearest operational target once planned/actual timestamps are proven complete. | Frozen route-date dataset, actual completion labels, route/stop lineage, leakage controls, tenant approval |
| 1 | prediction.delivery_failure_risk | Repository has route stops, undelivered statuses, failure reasons, and deterministic failure-rate logic. Operational value is high, but class balance and false positive/negative costs must be defined. | Frozen delivery-outcome dataset, reason-code quality report, class balance report, threshold approval |
| 2 | prediction.account_reorder_forecast | Repository has customer/order/product import support and deterministic reorder logic. Needs account history coverage and target-window definition before comparison. | Frozen account-order dataset, order interval history, account coverage, seasonality review |
| 2 | prediction.product_demand_forecast | Repository has order item/product import support and deterministic demand trend logic. Sparse SKU behavior and stockout context need special handling. | Frozen SKU/account demand dataset, product hierarchy mapping, sparse-demand policy, seasonality review |

## Wave 1 Does Not Mean Ready

Wave 1 only means the repository appears to have the strongest schema and deterministic-function alignment for representative-data preparation. It does not authorize training, method selection, hosted calls, production routing, or deployment.
