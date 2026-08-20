# D1 Candidate Methods

D1 capabilities begin with deterministic/statistical/local methods, not LLMs.

| Capability ID | Method | Family | Reason |
| --- | --- | --- | --- |
| prediction.account_reorder_forecast | existing-baseline | existing_deterministic_statistical_baseline | Keeps the current TSR deterministic/statistical implementation as the required cheapest baseline. |
| prediction.account_reorder_forecast | gradient-boosted-trees | tree_based_gradient_boosting | Compact tabular ML candidate suitable for nonlinear operational signals without hosted generative inference. |
| prediction.account_reorder_forecast | regularized-linear-or-logistic | regularized_linear_regression | Low-complexity interpretable benchmark candidate with explicit coefficients and reproducible behavior. |
| prediction.delivery_failure_risk | existing-baseline | existing_deterministic_statistical_baseline | Keeps the current TSR deterministic/statistical implementation as the required cheapest baseline. |
| prediction.delivery_failure_risk | gradient-boosted-trees | tree_based_gradient_boosting | Compact tabular ML candidate suitable for nonlinear operational signals without hosted generative inference. |
| prediction.delivery_failure_risk | regularized-linear-or-logistic | regularized_logistic_classification | Low-complexity interpretable benchmark candidate with explicit coefficients and reproducible behavior. |
| prediction.product_demand_forecast | existing-baseline | existing_deterministic_statistical_baseline | Keeps the current TSR deterministic/statistical implementation as the required cheapest baseline. |
| prediction.product_demand_forecast | gradient-boosted-trees | tree_based_gradient_boosting | Compact tabular ML candidate suitable for nonlinear operational signals without hosted generative inference. |
| prediction.product_demand_forecast | regularized-linear-or-logistic | regularized_linear_regression | Low-complexity interpretable benchmark candidate with explicit coefficients and reproducible behavior. |
| prediction.route_completion_forecast | existing-baseline | existing_deterministic_statistical_baseline | Keeps the current TSR deterministic/statistical implementation as the required cheapest baseline. |
| prediction.route_completion_forecast | gradient-boosted-trees | tree_based_gradient_boosting | Compact tabular ML candidate suitable for nonlinear operational signals without hosted generative inference. |
| prediction.route_completion_forecast | regularized-linear-or-logistic | regularized_linear_regression | Low-complexity interpretable benchmark candidate with explicit coefficients and reproducible behavior. |
