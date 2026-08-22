# D1 Leakage Classification

Status: LEAKAGE_CLASSIFICATION_DEFINED

| Field group | Classification | Notes |
| --- | --- | --- |
| Organization ID | AVAILABLE_BEFORE_PREDICTION | Required. |
| Route date/route ID/stop ID | AVAILABLE_BEFORE_PREDICTION | Required identifiers. |
| Planned route and stop times | AVAILABLE_BEFORE_PREDICTION | Required features. |
| Depot/start location | AVAILABLE_BEFORE_PREDICTION | Required context. |
| Account stable ID/number | AVAILABLE_BEFORE_PREDICTION | Required for delivery failure risk. |
| Driver assignment | AVAILABLE_BEFORE_PREDICTION if assigned before prediction cutoff | Optional approved feature. |
| Vehicle assignment | AVAILABLE_BEFORE_PREDICTION if assigned before prediction cutoff | Optional with justification. |
| Actual start/arrival/service/completion times | TARGET_ONLY or POST_OUTCOME | Target/context only depending on prediction horizon. |
| Delivery status/outcome/non-delivery reason | TARGET_ONLY | Never a pre-outcome feature. |
| Settlement completion/deduction details | POST_OUTCOME | Excluded from pre-outcome features unless later target review approves. |
| Free-form notes | UNAPPROVED | Exclude by default. |
| Future route changes | POST_OUTCOME | Exclude for earlier prediction timestamps. |

This classification must feed future dataset freeze checks.
