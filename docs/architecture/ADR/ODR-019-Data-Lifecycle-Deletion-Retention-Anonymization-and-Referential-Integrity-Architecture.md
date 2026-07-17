# ODR-019 - Data Lifecycle, Deletion, Retention, Anonymization, and Referential Integrity Architecture

## Status

Approved Architecture Baseline Extension

## Context

TSR is a multi-tenant logistics intelligence and truck-safety platform. Historical operational records, safety records, audit evidence, KPI records, routing history, and validated shared safety intelligence may need to survive deletion or departure of the user or Organization that originally created them.

## Decision

TSR SHALL adopt the Data Lifecycle architecture in `docs/architecture/data-lifecycle/`.

1. Deactivation is the default employee offboarding mechanism.
2. User deletion does not cascade into historically significant records.
3. A configurable recovery window exists with an initial default policy of 30 days unless superseded by approved configuration.
4. Recovery windows and historical retention periods are separate concepts.
5. Personal identifiers may be deleted, anonymized, pseudonymized, or detached while legitimate historical records remain.
6. Organization termination follows a staged lifecycle.
7. Organization-private data and Platform-global safety intelligence have independent lifecycles.
8. Validated Platform-global safety intelligence may survive originating tenant deletion subject to approved retention basis.
9. Audit evidence cannot be erased merely by deleting the actor.
10. Legal holds override normal purge eligibility.
11. Unapproved retention durations are marked `POLICY_DECISION_REQUIRED`.
12. Referential deletion behavior must be explicitly justified in the Cascade Map.
13. Blanket destructive `ON DELETE CASCADE` behavior is prohibited for historically significant records.
14. Destructive lifecycle operations must be tenant-scoped, permission-controlled, auditable, and recoverable where appropriate.

## Rationale

This decision protects tenant isolation, historical integrity, auditability, safety intelligence, referential integrity, privacy rights, recovery, and eventual secure disposal.

## Owner Decisions Required

- Data export rights and formats for Organization termination are `OWNER_DECISION_REQUIRED`.
- Final retention durations for operational, analytical, and backup retention are `OWNER_DECISION_REQUIRED`.

## Legal Review Required

- Jurisdiction-specific data subject request obligations are `LEGAL_REVIEW_REQUIRED`.
- Legal hold authority and notification requirements are `LEGAL_REVIEW_REQUIRED`.

## Consequences

Implementation requires schema audit, Cascade Map completion, centralized retention configuration, lifecycle services, authorization gates, audit events, object-storage coordination, backup/restore procedures, and mobile/offline sync revalidation.

## Verification Requirements

Tests must prove deletion does not destroy historical records, legal holds block purge, cross-tenant data remains isolated, stale offline queues cannot replay after deactivation, Platform-global safety data is independently governed, and destructive operations are audited.
