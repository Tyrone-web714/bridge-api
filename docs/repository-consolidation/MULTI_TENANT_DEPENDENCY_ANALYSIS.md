# Multi-Tenant Foundation Dependency Analysis

## Why Consolidation Should Finish First

Multi-tenant work changes shared contracts across backend and mobile:

- Organization model
- tenant context
- auth/session claims
- RBAC/permissions
- database tenant keys
- mobile tenant context
- offline queue tenant context
- shared API contracts

If backend and mobile remain in unstable separate source-control states, tenant work can split across repositories and create drift in the exact areas that must stay synchronized.

## Must Wait Until Consolidation Validates

- Organization-scoped API contract rollout.
- Driver and warehouse session payload changes.
- RBAC and permission enforcement affecting mobile workflows.
- Database tenant-key migrations.
- Mobile offline queue tenant context.
- Shared API DTOs and versioning.
- Route manifest tenant backfill.
- Shared Safety Intelligence private/global split.

## Can Proceed Independently Before Consolidation

Planning-only or read-only work:

- final schema design documents,
- API protection matrix review,
- tenant data classification,
- migration dry-run design,
- test-case design,
- backup/restore operational verification,
- Render and EAS evidence capture.

## Rule

Do not implement tenant-bearing code until mobile source is backed up and source-controlled, the consolidated repo structure is chosen, backend/mobile validation gates pass, and rollback baselines are recorded.
