# Database Change Plan

Migration file: ridge-api/migrations/012_intelligence_execution_foundation.sql.

Additive tables:

- intelligence_requests
- intelligence_execution_attempts
- intelligence_usage_records
- intelligence_policy_versions
- intelligence_prompt_versions

The migration is additive, tenant-aware, indexed, and designed for traceability. It was not executed against production by Codex.
