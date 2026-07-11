# Multi-Tenant Readiness

## Score

25/100 - unsafe for multi-tenant production until Organization model, claims, database keys, API filters, and mobile offline queues are migrated.

## Approved Model

Organization is the tenant boundary. Users belong to exactly one Organization. Private data never crosses Organizations. Shared safety may be global only after review and sanitization.

## Tenant Context Propagation Map

`login/session -> req.auth.organizationId -> service input -> repository WHERE organization_id -> audit log -> mobile queue/cache key -> storage object path`

This chain is not complete today.

## Required Changes

- Organization table and bootstrap plan.
- Organization claim on admin and driver sessions.
- Tenant-filtered repository contracts.
- Organization-aware mobile queues and cache keys.
- Storage object paths with tenant partitioning.
- Cross-tenant denial tests for private APIs.

## Readiness Classification

| Area | Classification |
| --- | --- |
| Database | Major refactor |
| Backend API | Major refactor |
| Admin UI | Major refactor |
| Mobile online calls | Major refactor |
| Mobile offline sync | Unsafe |
| BI/AI | Unsafe until tenant event model exists |
