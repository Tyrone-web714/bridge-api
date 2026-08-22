# D1 Dataset Freeze Plan

Status: PLAN_DEFINED_FREEZE_NOT_EXECUTED

This plan defines the minimum evidence required to freeze representative D1 datasets. It does not extract, mutate, or persist production data.

## Required Freeze Artifacts

Each D1 capability needs:

- dataset ID and semantic version;
- source tables/files and field lineage;
- tenant scope and legal/privacy approval reference;
- extraction timestamp and code version;
- row counts by tenant;
- date range by tenant;
- target definition and label-generation logic;
- feature schema and missingness report;
- train/validation/test or backtest split definition;
- leakage analysis;
- known exclusion rules;
- reproducibility hash;
- approval status;
- lifecycle state.

## Capability Freeze Requirements

| Capability ID | Minimum representative data requirement |
| --- | --- |
| prediction.account_reorder_forecast | Account-level order history with enough repeated order cycles to test next-order timing or reorder-status labels across holdout windows. |
| prediction.delivery_failure_risk | Stop or delivery outcome history with finished and undelivered outcomes, reason codes, account/route grouping, and enough positive failures to measure precision/recall. |
| prediction.product_demand_forecast | SKU/account/order-item history with quantities, order counts, revenue, product metadata, and enough repeated demand windows to assess forecast error and sparse-demand behavior. |
| prediction.route_completion_forecast | Route/stop history with planned timing, actual activity, completion timestamps, remaining-stop state, route assignments, and enough route days to backtest completion estimates. |

## Lifecycle Rule

The existing MS-004 D1 synthetic fixtures remain valid as pipeline-validation data only. They must not be relabeled as representative historical performance-selection data.

## Freeze Decision

No D1 representative dataset is frozen by this package.
