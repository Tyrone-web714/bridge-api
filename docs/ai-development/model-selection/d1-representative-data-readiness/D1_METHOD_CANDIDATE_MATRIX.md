# D1 Method Candidate Matrix

Status: CANDIDATES_DEFINED_SELECTION_DEFERRED

D1 method comparison is local/statistical/computational. Hosted LLM provider selection is out of scope for D1 unless separately approved and justified under MS-002, and D1 must not default to generative AI.

| Capability ID | Candidate | Method family | Current status | Notes |
| --- | --- | --- | --- | --- |
| prediction.account_reorder_forecast | existing-baseline | existing_deterministic_statistical_baseline | PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | Cheapest baseline; uses deterministic-v1 account forecast logic. |
| prediction.account_reorder_forecast | gradient-boosted-trees | tree_based_gradient_boosting | PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | Candidate for nonlinear tabular account/order signals after representative data freeze. |
| prediction.account_reorder_forecast | regularized-linear-or-logistic | regularized_linear_regression | PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | Interpretable low-complexity regression candidate. |
| prediction.delivery_failure_risk | existing-baseline | existing_deterministic_statistical_baseline | PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | Cheapest baseline; uses deterministic-v1 failure-rate/risk logic. |
| prediction.delivery_failure_risk | gradient-boosted-trees | tree_based_gradient_boosting | PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | Candidate for nonlinear operational risk signals after representative data freeze. |
| prediction.delivery_failure_risk | regularized-linear-or-logistic | regularized_logistic_classification | PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | Interpretable classification candidate. |
| prediction.product_demand_forecast | existing-baseline | existing_deterministic_statistical_baseline | PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | Cheapest baseline; uses deterministic-v1 product-demand trend logic. |
| prediction.product_demand_forecast | gradient-boosted-trees | tree_based_gradient_boosting | PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | Candidate for nonlinear SKU/account demand signals after representative data freeze. |
| prediction.product_demand_forecast | regularized-linear-or-logistic | regularized_linear_regression | PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | Interpretable low-complexity regression candidate. |
| prediction.route_completion_forecast | existing-baseline | existing_deterministic_statistical_baseline | PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | Cheapest baseline; uses deterministic-v1 route completion logic. |
| prediction.route_completion_forecast | gradient-boosted-trees | tree_based_gradient_boosting | PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | Candidate for nonlinear route-state signals after representative data freeze. |
| prediction.route_completion_forecast | regularized-linear-or-logistic | regularized_linear_regression | PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | Interpretable low-complexity regression candidate. |

## Selection Policy

- Apply hard gates before scoring.
- Select the cheapest sufficient method, not the highest raw score.
- Do not use cost to waive tenant, privacy, schema, evidence, safety, or quality gates.
- Existing baseline must remain in every comparison as the cheapest reference method.
- No method can be selected until representative historical evidence and thresholds are approved.
