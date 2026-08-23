# Pilot Wave 1 Validator Reconciliation

Status: COMPLETED FOR REPOSITORY VALIDATION

## Root Cause

`validate:production-rollout` used a hardcoded approved migration list ending at
`010_enterprise_identity_foundation.sql`. The repository now contains legitimate migrations
011 and 012, so the validator produced a stale tooling failure even though no migration
defect was identified.

The migration sequence is defined in:

- `bridge-api/scripts/validate-production-rollout.cjs`

The check sorts files in `bridge-api/migrations/` and compares them to the approved
sequence. No more maintainable canonical migration manifest already existed, so Wave 1
keeps the explicit governance list and updates it through 012.

## Migration 011

Filename: `011_driver_copilot_permission_repair.sql`

Purpose: repair Driver Copilot permissions by inserting `ai.driver_copilot.use` for
platform admin, organization admin, supervisor, and driver roles.

Schema changes: no table creation; inserts role-permission rows.

Dependencies: requires role permission storage from earlier RBAC/auth foundation.

Idempotency/order: uses `ON CONFLICT (role, permission) DO NOTHING`, so repeated execution
is safe and it legitimately follows 010.

## Migration 012

Filename: `012_intelligence_execution_foundation.sql`

Purpose: create Intelligence Execution foundation tables for request, attempt, usage,
policy, and prompt version evidence.

Schema changes:

- `intelligence_requests`
- `intelligence_execution_attempts`
- `intelligence_usage_records`
- `intelligence_policy_versions`
- `intelligence_prompt_versions`
- supporting indexes and constraints

Dependencies: references `organizations(id)`, which exists before 012.

Idempotency/order: uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`,
and it legitimately follows 011.

## Correction

Wave 1 updates the approved sequence through 012 and adds reusable sequence validation that
continues to reject:

- missing migrations
- duplicate migrations
- out-of-order migrations
- numbering gaps
- unapproved migration files
- filename/order inconsistency

Classification: VALIDATOR_STALE_ONLY

No real migration defect was found.
