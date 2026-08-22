# D1 Target And Feature Readiness

Status: TARGETS_DEFINED_CONCEPTUALLY_DATA_READINESS_INCOMPLETE

The D1 target and feature plan below is repository-only. It does not train models, query production data, or freeze datasets.

| Capability ID | Candidate target | Required feature groups | Existing deterministic features | Missing readiness evidence |
| --- | --- | --- | --- | --- |
| prediction.account_reorder_forecast | Next expected order date, reorder status, or days-to-next-order error | Account order history, last order date, order interval history, product trends, route-stop coverage, delivery failure and deduction rates | `buildAccountForecast` computes average interval, expected next order date, days since last order, reorder status, order/revenue/quantity change, delivery failure rate, deduction rate, and product trends. | Representative account history, target window definition, holdout period, minimum account count, seasonality coverage, label completeness, tenant approval |
| prediction.delivery_failure_risk | Delivery failure probability or risk label for an account/route/date window | Finished stop count, undelivered stop count, failure reasons, current/prior periods, account/route attributes, route manifest context | `buildDeliveryFailurePrediction` computes current and previous failure rates, percentage-point change, risk level, failure reasons, confidence, and source coverage. | Outcome-label standard, failure reason normalization, class balance, false positive/negative cost definition, tenant-specific calibration evidence |
| prediction.product_demand_forecast | Product quantity demand or demand direction by SKU/account/window | Product order history, SKU/category/brand, current/prior quantities, current/prior order counts, net revenue, account/product scope | `buildProductDemandForecast` computes quantity and revenue changes, demand direction, confidence, and source coverage. | Representative SKU/account history, sparse-product handling, stockout/availability context, seasonal/holiday coverage, target granularity |
| prediction.route_completion_forecast | Route completion time, remaining minutes, or pace risk label | Route date, planned/actual activity, remaining stops, planned remaining minutes, schedule variance, undelivered stops, driver/route assignment | `buildRouteCompletionPredictions` computes predicted completion time, remaining minutes, pace status, stop-based confidence, and source coverage. | Actual completion labels, planned-vs-actual timestamp completeness, route mix coverage, driver/territory leakage controls, weather/traffic exclusion decision |

## Readiness Findings

- Feature construction exists for deterministic-v1 prediction records.
- Source-coverage and confidence outputs exist, but they are not a substitute for representative backtesting.
- MS-002 thresholds remain owner/empirical and are not numerically approved.
- Synthetic fixtures are contract-validation evidence only.
- No D1 capability is ready for final method selection.
