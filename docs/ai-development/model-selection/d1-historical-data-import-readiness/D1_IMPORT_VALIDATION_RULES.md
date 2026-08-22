# D1 Import Validation Rules

Status: VALIDATION_RULES_DEFINED

Validation must run before acceptance and before any production import.

| Rule ID | Category | Description | Failure handling |
| --- | --- | --- | --- |
| REQUIRED_FIELD_MISSING | schema | Required canonical field is absent or blank. | reject |
| ORGANIZATION_ID_MISSING | tenant | `organization_id` is absent. | quarantine |
| ORGANIZATION_ID_AMBIGUOUS | tenant | Organization cannot be deterministically verified. | quarantine |
| CROSS_TENANT_RELATIONSHIP | tenant | Route, stop, account, or outcome points to a different Organization. | reject |
| DUPLICATE_SOURCE_RECORD | idempotency | Same `organization_id + source_system + source_record_id` appears more than once. | quarantine |
| CONFLICTING_SOURCE_RECORD | idempotency | Same source identity has conflicting content. | quarantine |
| INVALID_TIMESTAMP | timestamp | Timestamp cannot be parsed with declared timezone. | reject |
| NEGATIVE_DURATION | timestamp | Actual completion precedes route start or stop timing is impossible. | quarantine |
| FUTURE_TIMESTAMP_UNAPPROVED | timestamp | Historical source contains future operational timestamp. | quarantine |
| UNKNOWN_OUTCOME_CODE | taxonomy | Source outcome code does not map to canonical taxonomy. | quarantine |
| MISSING_TARGET_SOURCE | target | Required target source fields absent. | reject for representative freeze |
| POST_OUTCOME_FEATURE | leakage | Post-outcome field proposed as predictive feature. | reject feature |
| UNKNOWN_PROVENANCE | provenance | Missing source system/export/record lineage. | quarantine |
| DEMO_TEST_SYNTHETIC | contamination | Record is demo/test/synthetic. | exclude from representative freeze |

Dry-run validation must produce accepted, rejected, quarantined, and warning counts with safe diagnostics.
