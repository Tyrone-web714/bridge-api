# Architecture Governance Baseline v1.1

**Status:** Approved Architecture Baseline Extension
**Version:** 1.1
**Supersedes:** v1.0 by extension only. v1.0 remains the approved Phase 0 baseline history.
**Applies To:** Truck-Safe Routing platform architecture, implementation planning, tenant migration, security model, lifecycle governance, enterprise identity, and production-pilot readiness.

## Purpose

This document extends Architecture Governance Baseline v1.0 with two additional approved architecture decisions:

- ODR-019 - Data Lifecycle, Deletion, Retention, Anonymization, and Referential Integrity Architecture
- ODR-020 - Enterprise SSO and Identity Federation Architecture

Detailed requirements live in:

- `docs/architecture/data-lifecycle/`
- `docs/architecture/enterprise-identity/`

## Unchanged v1.0 Principles

All v1.0 governance principles remain in force, including Organization tenant boundary, Private-by-Default APIs, five approved roles, explicit permissions, Shared Safety governance, category-based retention, environment strategy, rollback baseline, object storage abstraction, and warehouse authentication.

## Data Lifecycle Extension

TSR SHALL use deactivation as the default offboarding mechanism. Deletion SHALL NOT cascade into historically significant operational, safety, audit, financial, KPI, route, warehouse, BI, or compliance records. Organization-private data and Platform-global safety intelligence SHALL have independent lifecycles. Legal holds SHALL override purge. Unapproved retention durations SHALL be marked `POLICY_DECISION_REQUIRED`.

## Enterprise Identity Extension

TSR SHALL support tenant-scoped OIDC and SAML 2.0 enterprise identity federation. External IdPs authenticate; TSR authorizes. External identity SHALL remain distinct from TSR internal identity. Email alone SHALL NOT be the permanent federated identity key. JIT provisioning is disabled by default. SCIM 2.0 is approved as an enterprise lifecycle capability. Enterprise identity SHALL NOT weaken tenant isolation, RBAC, audit logging, or Private-by-Default APIs.

## Cross-Workstream Alignment

Enterprise identity lifecycle events SHALL follow Data Lifecycle rules:

- SSO deprovisioning deactivates access but does not erase historical records.
- SCIM deactivation and account deletion are separate operations.
- IdP deletion SHALL NOT cascade into users' operational history.
- Federated identity mappings have lifecycle and retention rules.
- Identity audit records follow audit immutability rules.
- Identity-provider configuration deletion follows explicit referential lifecycle rules.
- Legal holds may prevent purge of identity evidence.
- Break-glass audit events remain protected.
- Offline queues cannot replay after deactivation merely because a stale mobile session exists.

## Implementation Status

Data Lifecycle: GOVERNANCE APPROVED / ARCHITECTURE DESIGNED. FOUNDATION IMPLEMENTED is not claimed.

Enterprise Identity: GOVERNANCE APPROVED / ARCHITECTURE DESIGNED. FOUNDATION IMPLEMENTED is not claimed.

## Future Governance Review

Future ADRs or ODRs are required when a proposed change materially affects business policy, tenant isolation, security model, product behavior, platform governance, or regulatory/legal obligations. Ordinary implementation details do not require ODRs.
