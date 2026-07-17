# TSR Data Lifecycle, Deletion, Retention, Anonymization, and Referential Integrity Architecture

**Status:** GOVERNANCE APPROVED / ARCHITECTURE DESIGNED
**ODR:** ODR-019
**Implementation State:** FOUNDATION NOT IMPLEMENTED

## Purpose

Truck-Safe Routing (TSR) SHALL provide a governed data lifecycle architecture for user offboarding, user deletion requests, Organization termination, retention, anonymization, pseudonymization, purge eligibility, object storage, legal holds, and referential integrity.

## Scope

This architecture applies to Organization-private operational records, user and driver identity records, route and stop history, delivery history, warehouse records, safety records, Shared Safety Intelligence, KPI and BI records, audit events, authentication/session records, object-storage references, mobile/offline queues, exports, and backups.

## Governing Principles

- TSR SHALL use deactivation as the default employee and user offboarding mechanism.
- User deletion SHALL NOT automatically cascade into operational, safety, audit, financial, KPI, routing, compliance, or historically significant records.
- Organization-private data and Platform-global safety intelligence SHALL have independent lifecycles.
- Personal identifiers MAY be deleted, anonymized, pseudonymized, detached, or retained according to explicit policy.
- Audit evidence SHALL remain immutable except through approved legal and governance processes.
- Legal holds SHALL override normal purge eligibility.
- Destructive lifecycle operations SHALL be tenant-scoped, permission-controlled, auditable, idempotent where practical, and recoverable where appropriate.
- Retention periods SHALL be centralized and configurable. Unapproved durations SHALL be marked `POLICY_DECISION_REQUIRED`.

## User Lifecycle

User lifecycle states SHALL support the following semantics:

- `ACTIVE`
- `SUSPENDED`
- `DEACTIVATED`
- `DELETION_REQUESTED`
- `SOFT_DELETED`
- `ANONYMIZED`
- `PURGED`

Names MAY adapt to the implemented schema, but the semantics SHALL be preserved.

Deactivated users SHALL lose authentication access, active sessions, refresh tokens, active device authorization where applicable, operational permissions, and eligibility for new assignments. Legitimate historical records SHALL remain referenceable.

## Organization Lifecycle

Organization lifecycle states SHALL support:

- `ACTIVE`
- `SUSPENDED`
- `TERMINATION_REQUESTED`
- `READ_ONLY_RETENTION`
- `PURGE_ELIGIBLE`
- `PURGED`

Organization termination SHALL be staged: request, operational shutdown, authorized export, read-only retention, purge eligibility review, controlled purge, and audited result.

## Deactivation

Deactivation is the default access-removal action for users, drivers, supervisors, warehouse employees, and local enterprise identity mappings. Deactivation SHALL revoke active access without destroying history.

## Soft Deletion

Soft deletion SHALL preserve recovery capability during a configurable recovery window. The initial default recovery window is 30 days unless superseded by approved centralized configuration.

## Recovery Window

The account recovery window and historical data retention period are separate concepts. Recovery expiration SHALL NOT automatically destroy records still subject to operational, analytical, audit, backup, legal hold, or platform-global retention.

## Anonymization

Anonymization SHALL remove or irreversibly transform direct personal identifiers where approved. Historical records MAY retain non-identifying operational facts.

## Pseudonymization

Pseudonymization SHALL replace direct identity with a protected surrogate identifier where historical linkage remains legitimate and authorized.

## Hard Deletion

Hard deletion SHOULD be limited to records that are ephemeral, expired, or approved for purge, such as expired sessions, expired reset tokens, abandoned invitations, temporary uploads, transient caches, and obsolete processing records. Historical operational records SHALL NOT be hard-deleted without approved policy and impact review.

## Historical Record Preservation

Completed routes, route assignments, completed stops, delivery history, route compliance, KPI calculations, BI snapshots, audit events, safety submissions, supervisor actions, warehouse confirmations, receipts, photos under retention, and validated safety submissions SHALL survive user deletion when legitimate retention applies.

## Audit Immutability

Deleting or anonymizing a user SHALL NOT erase evidence of historical actions. Audit records SHALL preserve what occurred, when it occurred, Organization context, actor type, and retained or pseudonymized actor identifiers where legitimate.

## Platform-Global Safety Lifecycle Separation

Validated Platform-global safety intelligence MAY survive the deletion or termination of the originating user or Organization. Contributor identity and attribution MAY be anonymized, detached, or removed without destroying the validated safety fact.

## Data Classification

TSR SHALL classify lifecycle behavior for:

- Direct personal identifiers
- Employment identifiers
- Authentication data
- Operational historical data
- Safety data
- Audit data
- Financial and KPI data
- User-generated content
- Platform-global safety intelligence
- Temporary and cache data
- Object-storage assets

## Retention Architecture

Retention SHALL distinguish recovery retention, operational retention, analytical retention, backup retention, purge eligibility, and legal hold. Retention configuration SHALL be centralized. Unapproved durations SHALL be `POLICY_DECISION_REQUIRED`.

## Legal Holds

Legal holds SHALL block purge by user deletion, Organization termination, retention jobs, and administrator cleanup. Holds SHALL be authorized, auditable, and removable only by authorized personnel.

## Data Subject Request Architecture

TSR SHALL support jurisdiction-neutral request categories: access, export, correction, deletion, and restriction. Deletion requests SHALL be evaluated and may result in delete, anonymize, partially delete, retain under policy, retain under legal hold, or reject with documented reason.

## Referential Integrity

Every relevant entity relationship SHALL eventually receive an explicit lifecycle classification in the Cascade Map based on the actual implemented schema. Blanket destructive `ON DELETE CASCADE` behavior is prohibited for historically significant records.

## Object-Storage Lifecycle

Database lifecycle actions SHALL coordinate with object-storage lifecycle. Retained evidence SHALL NOT be deleted solely because its parent record changes lifecycle state. Personal files SHALL NOT remain orphaned after applicable retention expires.

## Backup Implications

TSR SHALL NOT claim immediate physical deletion from immutable backups unless infrastructure guarantees it. Restore procedures SHALL include re-application of deletion tombstones and legal holds where required.

## Offline and Mobile Security

Deleted, deactivated, or suspended users SHALL NOT reconnect later and replay unauthorized offline mutations. Sync endpoints SHALL revalidate current authentication, user status, Organization status, membership, and permissions.

## Authorization

Lifecycle operations SHALL use the approved five-role model and explicit permissions. Drivers and warehouse employees SHALL NOT receive destructive data-management authority by default. Organization Admin authority is Organization-scoped. Platform Admin authority applies only to approved platform workflows.

## Destructive-Operation Safety Controls

High-impact lifecycle operations SHALL support authorization verification, tenant verification, explicit confirmation, dry-run or impact preview where practical, transaction safety, idempotency, audit logging, retry safety, and failure recovery.

## Production Safety Requirements

Production lifecycle implementation SHALL require a migration plan, rollback baseline, backup validation, restore validation, test evidence, security review, tenant-isolation review, and owner/legal decisions where marked.
