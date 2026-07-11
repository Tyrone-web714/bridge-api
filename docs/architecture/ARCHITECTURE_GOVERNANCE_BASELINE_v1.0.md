# Architecture Governance Baseline v1.0

**Status:** Approved Architecture Baseline  
**Version:** 1.0  
**Governance Phase:** Complete  
**Applies To:** Truck-Safe Routing platform architecture, implementation planning, tenant migration, security model, and production-pilot readiness.

## Purpose

This document summarizes the approved Truck-Safe Routing governance decisions established during Phase 0. Future implementation work shall conform to this baseline unless a future Architecture Decision Record explicitly supersedes it.

## Governance Principles

- The Organization is the tenant boundary.
- Organization-private data must remain isolated.
- The platform shares knowledge, not customer operations.
- APIs are Private by Default.
- Authorization follows least privilege.
- Roles group permissions, but backend access decisions must be enforced through explicit permissions and Organization context.
- No Organization-level role may access another Organization's private data.
- AI recommendations remain explainable, auditable, and subordinate to approved human workflows unless a controlled automation policy is explicitly approved.
- Source control, backups, restore verification, deployment baselines, and rollback evidence are required before tenant migration work proceeds.

## Approved Governance Decisions

### Bootstrap Organization Strategy

Existing development, demonstration, and test data shall be assigned to one internal bootstrap Organization:

- Organization name: `Truck-Safe Routing Development`
- Organization slug: `truck-safe-routing-development`

No current records shall be assigned to Arca Continental Southwest Beverages, Sysco, Sigma, or any other real company. Real customer Organizations must not be created until an actual company is formally onboarded, approved for a pilot, or becomes a customer.

Neutral Organizations such as `Demo Fleet A`, `Demo Fleet B`, and `Demo Fleet C` may be used only in automated tests or non-production seed data when multiple-tenant testing is required.

Platform-wide reference datasets, including the low-clearance bridge dataset and other legally usable global safety reference data, are platform-global rather than Organization-private.

### Organization Tenant Boundary

Organization is the tenant boundary. Every Organization-private business record belongs to exactly one Organization unless explicitly classified as Platform Global. All authenticated Organization-level requests execute within the authenticated user's Organization context.

Clients shall not specify arbitrary Organization identifiers to access Organization-private data.

### Driver Identity Strategy

Driver identity uses two identifiers:

1. A globally unique internal driver ID, using UUID or an equivalent globally unique identifier, as the permanent platform database identity.
2. An Organization-scoped company driver number used by the employer for operational identification.

Company driver numbers are unique only within an Organization and shall be enforced with `(organization_id, company_driver_number)`.

Driver names must not be used as identifiers. Mobile app and API workflows may continue displaying or accepting company driver number where operationally appropriate, but backend relationships must resolve to the permanent internal driver ID.

### Five-Role Authorization Model

The approved role hierarchy is:

1. Platform Admin
2. Organization Admin
3. Supervisor
4. Driver
5. Warehouse Employee

Historical business titles such as Dispatcher, Regional Manager, Depot Manager, Safety Manager, Executive Viewer, Auditor, Maintenance Staff, Customer Service, and External Inspector are not independent roles. They are functional responsibilities or permission sets assigned to one of the approved roles where necessary.

Roles answer "Who is the user?" Permissions answer "What is the user allowed to do?"

### Private-by-Default API Policy

Every API endpoint is private unless there is an explicitly approved business reason for it to be public.

Public endpoints are limited to non-sensitive platform functions such as:

- Health check
- Readiness check
- Authentication bootstrap
- Password reset initiation
- Public documentation, if enabled
- Public status page, if enabled

All Organization operational data requires authentication and Organization context. Platform-only functions require Platform Admin privileges.

### Shared Safety Intelligence Policy

Guiding principle: "The platform shares knowledge, not customer operations."

The following must never be shared across Organizations:

- Driver names or identifiers
- User accounts
- Customer names or non-public customer addresses
- Delivery manifests
- Route assignments
- Company-specific routes
- Delivery notes
- Sales information
- Receipts
- Photos or videos unless explicitly approved and sanitized as shared safety evidence
- Internal comments
- Organization KPIs
- Operational metrics
- Private AI recommendations
- Any Organization-specific operational data

The following may become platform-global only after review, approval, and sanitization:

- Verified low-clearance bridges
- Truck restrictions
- Weight restrictions
- Height restrictions
- Commercial-vehicle road closures
- Construction affecting truck routing
- Hazardous intersections
- Dangerous turns
- Unsafe loading entrances
- Unsafe commercial-vehicle parking locations
- Verified GPS coordinates of truck hazards
- Approved hazard photos stripped of Organization-identifying information
- Other approved truck-safety intelligence determined to benefit all Organizations

Shared safety information must be submitted by an Organization, reviewed by Platform Administration or an approved moderation workflow, sanitized where appropriate, and approved before becoming platform-global.

### Data Retention Strategy

Truck-Safe Routing uses category-based retention, not one global retention period.

The three retention categories are:

1. Operational Retention
2. Analytical Retention
3. Backup Retention

Platform-controlled retention applies to Platform audit logs, security logs, Shared Safety Intelligence, platform-global reference data, low-clearance bridge data, and truck restriction reference data.

Organization-configurable retention applies to route history, delivery history, driver performance history, delivery photos, Organization operational reports, Organization analytics, and Organization-generated documents.

AI-related retention shall preserve explainability while avoiding unnecessary long-term storage of intermediate inference artifacts.

### Environment Strategy

The approved environments are:

1. Development
2. Staging
3. Pilot
4. Production

The normal release path is Development to Staging to Pilot to Production.

No deployment shall move directly from Development to Production. Emergency fixes may bypass Pilot only with explicit Platform Admin approval and documented justification.

Each environment maintains independent configuration, secrets, databases, object storage, logging, monitoring, backups, and audit records. Production data shall never be copied into Development except through an approved, sanitized process.

### Rollback Baseline Policy

Every production deployment shall create a rollback baseline before release.

The baseline includes, at minimum:

- Git commit hash
- Release version
- Build identifier
- Database schema version
- Migration version
- Backup identifier
- Mobile application version
- Mobile build number
- EAS build identifier where applicable
- Environment
- Deployment timestamp
- Deployment package version
- Configuration version
- Object storage configuration version
- API version
- External dependency versions where applicable

Rollback documentation must include trigger conditions, decision authority, validation steps, recovery verification, and post-rollback review.

A deployment is not complete until rollback verification requirements have been satisfied.

### Object Storage Strategy

Truck-Safe Routing uses an Object Storage abstraction layer and shall not permanently bind platform architecture to a single storage vendor.

Supported providers may include Amazon S3, Cloudflare R2, Azure Blob Storage, Google Cloud Storage, or equivalent object storage providers.

The database stores object identifiers, Organization ownership, metadata, permissions, file hashes/checksums, MIME type, size, upload timestamps, retention policy, and lifecycle status.

Object storage stores photos, documents, PDFs, receipts, images, videos, export files, AI-generated reports, and other binary assets.

Every uploaded object belongs to exactly one Organization unless explicitly classified as Platform Global. Objects submitted for Shared Safety Intelligence follow the approved shared safety workflow.

Objects are referenced by immutable internal identifiers. User-supplied filenames are not permanent identifiers.

Object access is enforced using Organization context and platform authorization. Direct public access is not permitted unless explicitly approved.

### Warehouse Authentication Policy

Warehouse employees shall authenticate using at least two factors of knowledge or possession before performing warehouse operations that affect operational records.

Approved examples include:

- Employee ID + PIN
- Employee ID + Badge
- Employee ID + Password
- Badge + PIN
- Other equivalent multi-factor workflow appropriate for the customer's operational environment

The specific authentication technology may vary by Organization. Truck-Safe Routing shall support multiple authentication mechanisms without changing the core authorization model.

Warehouse employees may perform only warehouse-authorized operational workflows, including truck loading confirmation, inventory confirmation, manifest confirmation, return verification, warehouse documentation, and authorized printing operations.

Warehouse employees shall not receive administrative privileges. Authentication confirms identity. Authorization determines what actions the authenticated user may perform.

All warehouse actions execute within the authenticated user's Organization context. All significant warehouse operations are audit logged.

## Decisions Deferred To Engineering

The following items are implementation design decisions under this baseline:

- Mobile GitHub repository creation, remote configuration, baseline commit, branch policy, and generated artifact separation.
- Exact database/API field names for company driver number and company employee ID, provided they preserve the approved identity model.
- Test/demo data cleanup and migration mechanics under the `Truck-Safe Routing Development` bootstrap Organization strategy.
- API versioning implementation, compatibility redirects, adapters, and rollout sequence under the Private-by-Default API policy.

## Decisions Requiring Operational Verification

The following items require operational verification rather than additional business Owner Decision approval:

- Production database provider, backup tier, encryption, and PITR capability.
- Concrete restore target and restore validation procedure.
- Provider-specific backup retention configuration aligned to the category-based retention policy.
- Google Maps terms, caching restrictions, key restrictions, quota posture, and any legal/commercial approvals required by the provider.

## Future Governance Review

Future governance review is required when a proposed change materially affects:

- Business policy
- Tenant isolation
- Security model
- Product behavior
- Platform governance
- Regulatory or legal obligations

## Criteria For Future ODRs

Create a future Owner Decision or ADR only when a proposed change materially affects business policy, tenant isolation, the security model, product behavior, platform governance, or regulatory/legal obligations.

Do not create ODRs for ordinary implementation details, local refactors, dependency updates, minor UI adjustments, file naming choices, or code organization choices that do not change the approved architecture or governance model.

## Architecture Freeze

The governance phase is complete. The governance model is Architecture Baseline Version 1.0.

Future implementation work shall conform to this baseline unless a future Architecture Decision Record explicitly supersedes it.
