# ADR-0001 — Use Organization as Tenant Boundary

## Status

Accepted

## Context

Truck-Safe Routing must serve multiple companies without exposing data between them.

## Decision

Use `Organization` as the top-level tenant boundary.

Every private record belongs to exactly one Organization.

## Consequences

- All private data requires `organization_id`.
- API endpoints must enforce Organization isolation.
- Users may not belong to multiple Organizations.
