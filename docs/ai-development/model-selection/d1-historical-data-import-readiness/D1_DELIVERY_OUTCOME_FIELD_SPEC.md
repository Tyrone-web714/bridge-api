# D1 Delivery Outcome Field Spec

Status: FIELD_SPEC_DEFINED_TARGET_NOT_IMPORTED

Capability: `prediction.delivery_failure_risk`

Target: delivery failure outcome or probability by stop/account/route-date window, derived from canonical delivery outcome history. Ingestion must preserve detailed outcome semantics; binary labels are derived later by target definition version.

| Field | Classification | Requirement | Notes |
| --- | --- | --- | --- |
| `organization_id` | AVAILABLE_BEFORE_PREDICTION | REQUIRED | Deterministic tenant ownership. |
| `route_id` | AVAILABLE_BEFORE_PREDICTION | REQUIRED | Must link to route manifest. |
| `stop_id` | AVAILABLE_BEFORE_PREDICTION | REQUIRED | Stable stop identity. |
| `account_id` or `account_number` | AVAILABLE_BEFORE_PREDICTION | REQUIRED | Prefer stable account ID/number over customer name. |
| `route_date` | AVAILABLE_BEFORE_PREDICTION | REQUIRED | Needed for chronology and joins. |
| `stop_sequence` | AVAILABLE_BEFORE_PREDICTION | REQUIRED | Needed for relationship integrity and route context. |
| `planned_arrival_at` | AVAILABLE_BEFORE_PREDICTION | REQUIRED | Timestamp with declared timezone. |
| `actual_arrival_at` | POST_OUTCOME | OPTIONAL | Target/context only depending on prediction horizon. |
| `service_start_at` | POST_OUTCOME | OPTIONAL | Post-outcome for pre-route prediction. |
| `service_end_at` | POST_OUTCOME | OPTIONAL | Post-outcome for pre-route prediction. |
| `delivery_status` | TARGET_ONLY | REQUIRED | Preserve source status and canonical status. |
| `delivered_indicator` | TARGET_ONLY | DERIVABLE | Derive from canonical outcome. |
| `partial_delivery_indicator` | TARGET_ONLY | DERIVABLE | Preserve separate from failure. |
| `non_delivery_reason` | TARGET_ONLY | REQUIRED_WHEN_NOT_DELIVERED | Must map to canonical taxonomy or UNKNOWN. |
| `rescheduled_indicator` | TARGET_ONLY | REQUIRED | Do not collapse into failure without target rule. |
| `cancelled_indicator` | TARGET_ONLY | REQUIRED | Separate from attempted delivery failure. |
| `exception_code` | TARGET_ONLY | OPTIONAL_APPROVED | Preserve source code and mapped canonical outcome. |
| `source_system` | CONTEXT_ONLY | REQUIRED | Provenance. |
| `source_record_id` | CONTEXT_ONLY | REQUIRED | Idempotency/provenance. |

## Label Rule

The importer stores canonical outcomes. It does not force final ML labels. Binary or probabilistic failure labels are derived later by `targetDefinitionVersion`.
