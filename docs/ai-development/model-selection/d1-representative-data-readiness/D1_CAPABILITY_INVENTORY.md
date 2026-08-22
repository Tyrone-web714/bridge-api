# D1 Capability Inventory

Status: DISCOVERY_COMPLETE_SELECTION_NOT_READY

This inventory records the four D1 capabilities that remain after D2 model selection. The authoritative source is the MS-001 capability registry and the MS-004 benchmark evidence. D1 capabilities are predictive or lightweight computational capabilities. They are not LLM presentation capabilities, and they must not default to hosted generative AI.

| Capability ID | Domain | Current repository implementation | Current selection state | Repository evidence |
| --- | --- | --- | --- | --- |
| prediction.account_reorder_forecast | Customer Intelligence | Deterministic account reorder forecast in `bridge-api/services/predictionEngine.js` | D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | MS-001 registry, MS-004 evidence, `bridge-api/services/predictionEngine.js` |
| prediction.delivery_failure_risk | Operations Intelligence | Deterministic delivery failure risk forecast in `bridge-api/services/predictionEngine.js` | D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | MS-001 registry, MS-004 evidence, `bridge-api/services/predictionEngine.js` |
| prediction.product_demand_forecast | Customer Intelligence | Deterministic product demand forecast in `bridge-api/services/predictionEngine.js` | D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | MS-001 registry, MS-004 evidence, `bridge-api/services/predictionEngine.js` |
| prediction.route_completion_forecast | Operations Intelligence | Deterministic route completion forecast in `bridge-api/services/predictionEngine.js` | D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA | MS-001 registry, MS-004 evidence, `bridge-api/services/predictionEngine.js` and `bridge-api/scripts/check-prediction-engine.cjs` |

## Current Boundary

- D1 pipelines were locally validated against synthetic frozen fixtures.
- No D1 method winner has been selected.
- No provider or hosted model is selected for D1.
- No production orchestration is active for D1 model selection.
- Representative historical data is required before final D1 method selection.

## Output Contract

MS-002 classifies each D1 output as a `prediction_or_classification_record` requiring:

- `prediction_value_or_label`
- `confidence_or_uncertainty`
- `evidence_lineage`
- `missing_data_flags`
- `tenant_context`

Prohibited output includes unsupported causation, fabricated evidence, and any provider/model selection assertion.
