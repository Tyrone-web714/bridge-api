# TSR Data Lifecycle and Cascade Map

**Status:** ARCHITECTURE DESIGNED
**Implementation State:** Schema classification pending implementation audit.

## Purpose

This document defines the required Cascade Map structure. It does not claim that all current table relationships have been verified. Every relevant entity relationship MUST eventually receive an explicit classification based on the actual implemented schema.

## Canonical Classifications

- `CASCADE`: child is purely dependent and has no independent historical value.
- `RESTRICT`: parent deletion is blocked while dependent records exist.
- `SET NULL`: historical child remains while direct parent reference is removed.
- `SOFT DELETE`: record remains recoverable during a recovery window.
- `HARD DELETE`: record is permanently removed after eligibility checks.
- `ANONYMIZE`: personal identity is irreversibly removed or transformed.
- `PSEUDONYMIZE`: direct identity is replaced with a protected surrogate.
- `DETACH`: contribution remains while contributor linkage is removed.
- `ARCHIVE`: record leaves active workflow but remains retained.
- `RETAIN`: record remains under approved retention.
- `LEGAL HOLD`: purge is blocked until hold release.
- `PLATFORM-GLOBAL PRESERVE`: validated platform-global safety fact remains independently managed.

## Required Cascade Map Columns

| Entity | Parent Relationship | Data Classification | Contains Personal Data | Historical Importance | Tenant Scope | Deletion Action | Retention Rule | Anonymization Rule | Legal Hold Eligible |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POLICY_DECISION_REQUIRED | Actual schema audit required | POLICY_DECISION_REQUIRED | POLICY_DECISION_REQUIRED | POLICY_DECISION_REQUIRED | POLICY_DECISION_REQUIRED | POLICY_DECISION_REQUIRED | POLICY_DECISION_REQUIRED | POLICY_DECISION_REQUIRED | POLICY_DECISION_REQUIRED |

## Rules

- Blanket destructive `ON DELETE CASCADE` MUST NOT be used for historically significant records.
- Correct cascade behavior MAY exist for dependent ephemeral records, but it MUST be justified.
- Audit logs, KPI snapshots, historical route records, delivery history, safety evidence, and validated shared safety intelligence SHOULD default to retain, restrict, detach, anonymize, or pseudonymize rather than destructive cascade.
- Platform-global safety intelligence MUST be evaluated independently from the originating Organization lifecycle.
