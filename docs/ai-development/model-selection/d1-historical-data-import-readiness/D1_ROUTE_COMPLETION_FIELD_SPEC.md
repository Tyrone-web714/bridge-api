# D1 Route Completion Field Spec

Status: FIELD_SPEC_DEFINED_TARGET_NOT_IMPORTED

Capability: `prediction.route_completion_forecast`

Target: route completion time, remaining minutes error, or pace risk label derived from canonical planned and actual route/stop history. The final target definition remains versioned and must be approved before dataset freeze.

| Field | Classification | Requirement | Notes |
| --- | --- | --- | --- |
| `organization_id` | AVAILABLE_BEFORE_PREDICTION | REQUIRED | Must be deterministic and validated. Missing/ambiguous values fail closed. |
| `route_id` | AVAILABLE_BEFORE_PREDICTION | REQUIRED | Stable route identity, preferably source-system route key. |
| `route_date` | AVAILABLE_BEFORE_PREDICTION | REQUIRED | Service date in declared timezone. |
| `depot_or_start_location` | AVAILABLE_BEFORE_PREDICTION | REQUIRED | Used for representativeness and route context. |
| `driver_assignment_id` | AVAILABLE_BEFORE_PREDICTION | OPTIONAL_APPROVED | Use stable internal/company ID; avoid names when possible. |
| `vehicle_assignment_id` | AVAILABLE_BEFORE_PREDICTION | OPTIONAL_REQUIRES_JUSTIFICATION | Include only if approved and available before prediction. |
| `planned_start_at` | AVAILABLE_BEFORE_PREDICTION | REQUIRED | Timestamp with timezone semantics. |
| `actual_start_at` | TARGET_OR_CONTEXT | OPTIONAL | Target/context depending on prediction horizon. Post-start predictions may use prior actual activity only if before cutoff. |
| `planned_completion_at` | AVAILABLE_BEFORE_PREDICTION | OPTIONAL | Existing planned end time, if source provides it. |
| `actual_completion_at` | TARGET_ONLY | REQUIRED_FOR_TARGET | Target field, never predictive feature. |
| `route_status` | TARGET_ONLY or CONTEXT_ONLY | REQUIRED | Required to classify completed/cancelled/aborted/unknown. |
| `planned_stop_count` | AVAILABLE_BEFORE_PREDICTION | REQUIRED | Derivable from route stops if not supplied. |
| `actual_completed_stop_count` | TARGET_ONLY | DERIVABLE | Derive from completed/departed/undelivered/skipped stop outcomes. |
| `cancelled_indicator` | TARGET_ONLY | REQUIRED | Needed for exclusion or separate target treatment. |
| `aborted_indicator` | TARGET_ONLY | REQUIRED | Needed for exclusion or separate target treatment. |
| `reassignment_indicator` | CONTEXT_ONLY | OPTIONAL_APPROVED | Must be timestamped to avoid leakage. |
| `timezone` | CONTEXT_ONLY | REQUIRED | Required for timestamp parsing and chronological splits. |
| `source_system` | CONTEXT_ONLY | REQUIRED | Provenance. |
| `source_record_id` | CONTEXT_ONLY | REQUIRED | Idempotency/provenance. |
| `ingested_at` | CONTEXT_ONLY | DERIVABLE | Import timestamp. |

## Ambiguity Rules

Do not silently label cancelled, aborted, multi-day, reassigned, duplicate-completion, negative-duration, or extreme-duration routes. Quarantine or exclude until a target definition version approves treatment.
