# D1 Wave 1 Leakage Audit

Status: LEAKAGE_CONTROLS_DEFINED_DATASET_NOT_FROZEN

No representative dataset was frozen, so this audit defines leakage controls and records why the available local source cannot be approved.

## Route Completion Leakage Controls

| Candidate field | Availability classification | Freeze decision |
| --- | --- | --- |
| route date | FEATURE_AVAILABLE_AT_PREDICTION_TIME | Candidate feature after tenant validation. |
| route number | FEATURE_AVAILABLE_AT_PREDICTION_TIME | Candidate feature after tenant validation. |
| planned start/end | FEATURE_AVAILABLE_AT_PREDICTION_TIME | Candidate feature after tenant validation. |
| planned arrival/departure by stop | FEATURE_AVAILABLE_AT_PREDICTION_TIME | Candidate feature after tenant validation. |
| assigned driver ID/name | FEATURE_AVAILABLE_AT_PREDICTION_TIME if assignment existed before prediction timestamp | Requires prediction-time snapshot rule. |
| stop actual arrival/service/completion/departure | POST_OUTCOME / LEAKAGE for pre-route prediction; may be feature only for mid-route snapshots before later stops | Excluded unless prediction horizon explicitly allows prior actual activity. |
| route completed_at | POST_OUTCOME / TARGET | Target only; never a pre-outcome feature. |
| final delivery statuses | POST_OUTCOME / LEAKAGE for route completion prediction | Excluded as feature. |

## Delivery Failure Leakage Controls

| Candidate field | Availability classification | Freeze decision |
| --- | --- | --- |
| account number/context | FEATURE_AVAILABLE_AT_PREDICTION_TIME | Candidate feature after tenant validation. |
| planned route/stop timing | FEATURE_AVAILABLE_AT_PREDICTION_TIME | Candidate feature after tenant validation. |
| prior historical failure rates | FEATURE_AVAILABLE_AT_PREDICTION_TIME if calculated from earlier periods only | Candidate feature with time-aware cutoff. |
| current stop final status | POST_OUTCOME / TARGET | Target only; never a pre-outcome feature. |
| non_delivery_reason | POST_OUTCOME / TARGET_DETAIL | Label detail only; never a pre-outcome feature. |
| delivery settlement completion | POST_OUTCOME / TARGET_CONFIRMATION | Label validation only; never a pre-outcome feature. |
| post-delivery notes/deductions | POST_OUTCOME / LEAKAGE unless separately approved as later outcome analysis | Excluded as predictive feature. |

## Current Leakage Finding

No material leakage was introduced because no dataset was frozen. The local planned manifest cannot be approved because it lacks target labels and tenant context, not because it contains post-outcome leakage.
