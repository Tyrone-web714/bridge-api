# TSR Data Retention Policy Architecture

**Status:** ARCHITECTURE DESIGNED

## Retention Categories

TSR SHALL distinguish:

- Recovery retention
- Operational retention
- Analytical retention
- Backup retention

These are separate policies and SHALL NOT be treated as one setting.

## Recovery Retention

Soft-deleted accounts SHALL have a configurable recovery window. Initial default: 30 days unless superseded by approved centralized configuration.

## Operational Retention

Organization-owned operational data retention is Organization-configurable where allowed by platform policy and contract. Specific durations are `POLICY_DECISION_REQUIRED`.

## Analytical Retention

KPI, BI, score, route replay, and analytical snapshots SHALL preserve explainability and reproducibility. Specific durations are `POLICY_DECISION_REQUIRED`.

## Backup Retention

Backup retention SHALL align with provider capabilities, restore procedures, encryption, and legal/contractual requirements. Specific durations are `POLICY_DECISION_REQUIRED`.

## Purge Eligibility

Records are purge eligible only when retention has expired, no legal hold exists, no unresolved investigation blocks purge, Organization ownership is verified, and the Cascade Map action permits purge.

## Centralized Configuration

Retention settings SHALL be centralized. Application code SHALL NOT scatter hard-coded retention periods.
