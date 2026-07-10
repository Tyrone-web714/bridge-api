# Coding Standards

## General

- Prefer clarity over cleverness.
- Keep functions small and focused.
- Keep business logic out of UI components.
- Keep database access out of presentation logic.
- Do not hardcode secrets, credentials, or tenant IDs.
- Use environment variables for configuration.
- Use meaningful names.
- Avoid magic numbers.
- Preserve existing behavior unless intentionally changing it.

## Backend

- Use service layers for business logic.
- Validate all input server-side.
- Enforce Organization isolation in backend services and database queries.
- Use centralized error handling.
- Return consistent API error formats.
- Add audit logging for sensitive actions.

## Frontend / Mobile

- Do not treat frontend filtering as security.
- UI should reflect permissions, but backend remains authoritative.
- Driver screens must minimize distraction.
- Offline actions must queue safely and sync reliably.

## Database

- Prefer additive migrations.
- Include rollback guidance.
- Use immutable Organization identifiers.
- Index Organization-scoped queries.
- Preserve historical records where practical.

## Tests

Add tests for:

- Tenant isolation
- Permission enforcement
- API validation
- Migration safety
- Offline sync
- Shared safety approval workflow
