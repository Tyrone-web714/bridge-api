# Migration Plan

## Phase 0 - Stabilization and Backups
Objective: clean source-control state, verify backups, verify deployed/local readiness. Effort: Medium. Exit: green gates and owner decisions closed.

## Phase 1 - Organization Model
Add Organization entity and bootstrap current data owner. Effort: Large.

## Phase 2 - Data Classification and Tenant Keys
Classify tables and add tenant keys to private records. Effort: Very Large.

## Phase 3 - Authentication Context
Add Organization claims to admin/driver sessions. Effort: Large.

## Phase 4 - Authorization and RBAC
Implement permission model and deny-by-default checks. Effort: Large.

## Phase 5 - API Tenant Enforcement
Enforce org filters in handlers/services/repositories. Effort: Very Large.

## Phase 6 - Data Backfill
Backfill current data into initial Organization. Effort: Large.

## Phase 7 - Shared Safety Separation
Split private submissions from approved global safety records. Effort: Large.

## Phase 8 - Mobile Tenant Context and Sync
Update API headers, queues, cache keys, conflict/idempotency. Effort: Large.

## Phase 9 - Audit Logging
Make audit events tenant-aware and immutable. Effort: Medium.

## Phase 10 - BI/KPI Foundation
Add org-scoped analytics, metric definitions, formula versioning. Effort: Very Large.

## Phase 11 - Logistics Intelligence Foundation
Add event model, signals, recommendations, approval/outcome lifecycle. Effort: Very Large.

## Phase 12 - Production Hardening
Load tests, monitoring, DR, CI/CD gates, mobile release reproducibility. Effort: Large.
