# D1 Wave 1 Method Selection Unlock Criteria

Status: UNLOCK_CRITERIA_DEFINED_NOT_MET

The next phase, D1 predictive/statistical method benchmarking, remains blocked for both Wave-1 capabilities.

## Route Completion Unlock Criteria

All of the following must be true:

- target definition approved;
- prediction timestamp/horizon approved;
- tenant-scoped route/stop historical extract approved;
- `organization_id` present and validated for every row;
- route completion label available and quality-checked;
- planned and actual timestamp quality profile complete;
- cancelled, aborted, reassigned, duplicate, multi-day, negative-duration, and extreme-duration rules approved;
- leakage audit passed;
- historical depth and route diversity sufficient;
- chronological TRAIN/VALIDATION/TEST split frozen;
- immutable dataset ID, version, hashes, row counts, and provenance recorded;
- baseline deterministic-v1 route completion method is evaluable.

## Delivery Failure Risk Unlock Criteria

All of the following must be true:

- target taxonomy approved;
- prediction timestamp/horizon approved;
- tenant-scoped stop/outcome historical extract approved;
- `organization_id` present and validated for every row;
- success/failure/partial/cancelled/rescheduled/unknown labels quality-checked;
- non-delivery reasons normalized and completeness reported;
- positive/negative/unknown counts and failure rate reported;
- rare-event imbalance assessment complete;
- false positive/false negative consequence policy approved;
- leakage audit passed;
- chronological TRAIN/VALIDATION/TEST split frozen;
- immutable dataset ID, version, hashes, row counts, and provenance recorded;
- baseline deterministic-v1 delivery failure risk method is evaluable.

## Baseline Specifications

| Capability ID | Baseline |
| --- | --- |
| `prediction.route_completion_forecast` | `existing_deterministic_statistical_baseline`, implemented by deterministic-v1 route completion logic in `bridge-api/services/predictionEngine.js`. |
| `prediction.delivery_failure_risk` | `existing_deterministic_statistical_baseline`, implemented by deterministic-v1 failure-rate/risk logic in `bridge-api/services/predictionEngine.js`. |

No baseline was executed against representative data in this package because no representative data was frozen.
