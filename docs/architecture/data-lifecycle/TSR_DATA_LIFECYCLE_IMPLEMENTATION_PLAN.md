# TSR Data Lifecycle Implementation Plan

**Status:** ARCHITECTURE DESIGNED
**Implementation State:** Not started

## Phase 1 - Current-State Audit

Audit schemas, migrations, foreign keys, routes, authorization, object storage, mobile queues, sessions, exports, backups, and current deletion logic.

## Phase 2 - Cascade Map and Data Classification

Populate the Cascade Map from actual schema evidence. Mark unresolved retention values as `POLICY_DECISION_REQUIRED`.

## Phase 3 - Lifecycle Model Foundation

Design and implement lifecycle states, centralized retention configuration, legal hold model, and audit events.

## Phase 4 - User Lifecycle Workflows

Implement deactivate, reactivate, deletion request, cancellation during recovery, anonymization, and purge eligibility.

## Phase 5 - Organization Termination Workflows

Implement termination stages, data exit architecture, read-only retention, and purge preview.

## Phase 6 - Retention and Purge Engine

Implement idempotent retention jobs, object-storage cleanup, backup tombstone handling, and audit reporting.

## Phase 7 - Mobile and Offline Enforcement

Enforce deactivation and Organization lifecycle checks during offline queue replay.

## Phase 8 - Production Validation

Validate backups, restore behavior, legal holds, tenant isolation, authorization, audit logs, object cleanup, and rollback.
