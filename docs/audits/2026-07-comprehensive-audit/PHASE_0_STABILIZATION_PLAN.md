# Phase 0 Stabilization and Backups Plan

## Purpose

Phase 0 prepares Truck-Safe Routing for the Organization-model migration without implementing multi-tenancy yet. The goal is to stabilize source control, backups, deployment verification, API protection decisions, data ownership decisions, and rollback baselines before any schema, API, authentication, or mobile tenant changes begin.

## Scope

This plan covers planning and verification only. It does not authorize code changes, schema changes, migrations, deployment setting changes, data backfills, commits, pushes, or production restores.

## 1. Source-Control Stabilization

### Backend and Dashboard Repository

| Item | Current State |
| --- | --- |
| Repository path | `C:\dev\bridge-api` |
| Backend app path | `C:\dev\bridge-api\bridge-api` |
| Current branch | `main` |
| Remote status | `origin` points to `https://github.com/Tyrone-web714/bridge-api.git` |
| Working-tree status | Documentation changes are present and uncommitted. |
| Untracked files | `PROJECT_STATUS.md` and `docs/audits/` are untracked at inspection time. |
| Generated artifacts | Audit-generated Markdown and CSV reports under `docs/audits/2026-07-comprehensive-audit/`. |
| Files that should be ignored | `node_modules/`, `.env`, local logs, local temporary exports, database dumps, ad hoc backup files, local photo migration scratch output, and generated runtime caches. |
| Files that must be preserved | Governing docs under `docs/`, audit package, `PROJECT_STATUS.md`, backend source, migrations, deployment files, package lock, data files, scripts, and existing committed configuration. |

Recommended cleanup sequence:

1. Review all current documentation-only changes.
2. Confirm no application, schema, deployment, environment, or mobile files are staged.
3. Add or confirm ignore rules for local-only generated files before cleanup.
4. Stage documentation intentionally, not with a broad repository-wide add.
5. Commit approved documentation and audit files only.
6. Record the clean commit SHA as the Phase 0 documentation baseline.
7. Do not begin schema or API work until `git status --short` is clean except for explicitly approved Phase 0 documents.

### Active Mobile Repository

| Item | Current State |
| --- | --- |
| Repository path | `C:\dev\tsr-mobile` |
| Current branch | `master` |
| Remote status | No remote returned by `git remote -v` at inspection time. |
| Working-tree status | Modified source/config files plus many untracked source, documentation, asset, QR, cache, and build-adjacent files. |
| Untracked files | `.env.example`, `.github/`, `LICENSE`, `PROJECT_STATUS.md`, `ROAD_TEST_CHECKLIST.md`, `THIRD_PARTY_NOTICES.md`, `app.config.js`, `assets/landing-truck-hero.png`, `assets/truck-marker-3d.png`, `compliance/`, `plugins/`, `scripts/`, `src/`, QR PNGs, marker preview PNGs, and contact-sheet PNGs. |
| Generated artifacts | `.expo/`, `.expo-export-*`, QR PNGs, preview PNGs, contact-sheet PNGs, APK/AAB artifacts if present, local caches, `node_modules/`. |
| Files that should be ignored | `node_modules/`, `.expo/`, `.expo-export-*`, `.env`, APK/AAB outputs, QR-code PNGs, local preview screenshots, cache folders, build logs, and local EAS output. |
| Files that must be preserved | Source files, app configuration, package files, lockfile, EAS config, plugins, scripts, app assets used at runtime, truck marker/icon assets with retained rights records, compliance notices, road-test checklist, and any release notes needed to reproduce builds. |

Safe mobile plan:

1. Create a timestamped full backup of `C:\dev\tsr-mobile` before any cleanup, including modified and untracked files.
2. Export `git status --short`, `git diff`, and a recursive file inventory into a backup notes folder outside the repository.
3. Decide the GitHub repository name and visibility for the mobile app.
4. Configure the remote only after the backup exists.
5. Update `.gitignore` to separate source from generated files.
6. Move or archive QR, APK, preview, and cache artifacts outside tracked source unless a specific artifact is intentionally retained as release evidence.
7. Stage source files deliberately in groups: app source, assets, configuration, build scripts, compliance docs, and project docs.
8. Commit a clean mobile baseline.
9. Push the baseline to the approved GitHub remote.
10. Record the mobile baseline commit SHA and EAS build profile used for pilot builds.

Do not delete or overwrite any modified or untracked mobile file before the full backup and inventory are verified.

## 2. Backup and Restore Verification

### Current Provider Assessment

The backend is PostgreSQL/PostGIS-oriented and deployment configuration expects `DATABASE_URL` with `DATABASE_SSL=true`. The repository does not prove the actual production database provider, backup tier, retention, or point-in-time recovery support. Treat those as owner decisions until verified in the hosting/provider console.

### Required Backup Procedure

| Requirement | Phase 0 Procedure |
| --- | --- |
| Backup type | Provider-native snapshot plus logical `pg_dump` backup before Phase 1 begins. |
| Backup location | Provider backup storage plus a separate encrypted owner-controlled storage location. |
| Encryption | Confirm provider encryption at rest and encrypt exported logical backups before storing outside the provider. |
| Retention | Owner decision ODR-013 is approved. Backup Retention is separate from Operational Retention and Analytical Retention. Recommended pilot backup baseline remains 7 daily backups and 4 weekly backups unless a provider, legal, contractual, or customer-specific requirement supersedes it. |
| PITR | Verify whether the provider supports point-in-time recovery and the recovery window. If unavailable, record that risk and require manual snapshot timing before migrations. |
| Restore target | Isolated staging/restore database, never production. |
| Restore validation | Restore backup, run migrations only if required by the restore target, verify `/ready`, verify PostGIS, compare key table counts, sample driver route lookup, sample route manifest, sample stop updates, sample delivery notes/photos metadata, admin login, and dashboard read paths. |
| Success criteria | Restore completes without data loss indicators; `/ready` passes; critical workflows read expected data; table counts and sample records match the backup baseline; rollback instructions are documented with backup ID and commit SHA. |
| Rollback procedure | Stop writes, identify last known-good commit and backup/PITR timestamp, redeploy last known-good backend, restore snapshot or PITR to a replacement database, repoint environment only after validation, preserve failed database for forensic review. |

No production data should be modified, restored, or overwritten during Phase 0.

### Data Retention Governance

Truck-Safe Routing shall implement category-based data retention rather than a single global retention period.

Retention categories:

1. Operational Retention
2. Analytical Retention
3. Backup Retention

These are separate policies and shall not be treated as one setting.

Platform-controlled retention applies to:

- Platform audit logs
- Security logs
- Shared Safety Intelligence
- Platform-global reference data
- Low-clearance bridge data
- Truck restriction reference data

Organization-configurable retention applies to:

- Route history
- Delivery history
- Driver performance history
- Delivery photos
- Organization operational reports
- Organization analytics
- Organization-generated documents

Organizations may choose different retention periods for Organization-owned operational data. Platform-wide reference data and platform audit/security records remain under Platform Admin control.

AI-related retention shall preserve explainability while avoiding unnecessary long-term storage of intermediate inference artifacts.

The retention policy shall support future legal, regulatory, contractual, and customer-specific requirements without requiring schema redesign.

## 3. Deployment Verification

### Approved Environment Strategy

Owner decision ODR-014 is approved. Truck-Safe Routing shall maintain separate environments for the complete application lifecycle:

1. Development
2. Staging
3. Pilot
4. Production

Environment definitions:

| Environment | Purpose |
| --- | --- |
| Development | Active software development, feature implementation, unit testing, and experimental work. Not customer facing. |
| Staging | Production-like integration testing, database migration verification, restore testing, performance validation, security validation, and release candidate verification. |
| Pilot | Production-like environment for approved pilot Organizations, real users, and real operational workflows with limited customer scope. |
| Production | Live customer environment with the highest availability, security, and governance requirements. |

No deployment shall move directly from Development to Production. The normal release path is Development to Staging to Pilot to Production. Emergency fixes may bypass Pilot only with explicit Platform Admin approval and documented justification.

Each environment shall maintain independent configuration, secrets, databases, object storage, logging, monitoring, backups, and audit records. Production data shall never be copied into Development except through an approved, sanitized process.

### Current Configuration

- Render blueprint exists at `C:\dev\bridge-api\bridge-api\render.yaml`.
- Render service name is `truck-safe-routing-api`.
- Runtime is Docker.
- Health check path is `/health`.
- Docker image uses `node:20-alpine`.
- Container command is `npm start`.
- Docker healthcheck runs `npm run healthcheck`.
- Deployment docs require PostgreSQL/PostGIS, Google Maps, named admin credentials, driver token, CORS origin, backend public URL, and durable object storage.

### Verification Checklist

| Area | Verification Step |
| --- | --- |
| Deployed backend URL | Confirm the current production/pilot URL in Render and record it in the Phase 0 evidence log. |
| `/health` | Call `GET /health`; require `ok: true` and expected service response. |
| `/ready` | Call `GET /ready`; require `ok: true` and dependency checks passing. |
| Database connectivity | Confirm Render environment has non-placeholder `DATABASE_URL` and `DATABASE_SSL=true`; verify connection through `/ready` and production verification script. |
| PostGIS readiness | Confirm `/ready` or verification script checks spatial support successfully. |
| Google Maps configuration | Confirm `GOOGLE_MAPS_API_KEY` exists, is server-side appropriate, APIs are enabled, key restrictions are documented, and terms/caching posture is approved. |
| Object storage configuration | Confirm the approved Object Storage abstraction is configured with a durable provider, bucket/container, region, endpoint, credentials, lifecycle/retention policy, and access model. |
| Required environment variables | Verify all required variables from `DEPLOYMENT.md` and `render.yaml`; do not print secret values. |
| Logs | Review startup logs, healthcheck logs, database connection errors, storage errors, Google API errors, auth errors, and rate-limit errors. |
| Restart behavior | Restart service in a maintenance window or staging first; verify `/health`, `/ready`, admin page load, driver route lookup, and photo URL persistence after restart. |
| Deployment rollback | Confirm Render rollback mechanism, last known-good deploy ID, rollback baseline, environment variable/configuration snapshot process, database rollback plan, mobile compatibility, and recovery validation. |

Do not change Render settings during this verification unless a separate owner-approved implementation task is opened.

### Rollback Baseline Governance

Owner decision ODR-015 is approved. Every production deployment shall create a rollback baseline before release.

A rollback baseline shall include, at minimum:

- Application: Git commit hash, release version, and build identifier.
- Database: database schema version, migration version, and backup identifier.
- Mobile: mobile application version, build number, and EAS build identifier where applicable.
- Deployment: environment, deployment timestamp, deployment package version, and configuration version.
- Infrastructure: object storage configuration version, API version, and external dependency versions where applicable.

Every deployment shall have a documented rollback procedure supporting application rollback, database rollback where possible, data restoration from verified backups, mobile version compatibility, API compatibility, and configuration restoration.

Rollback documentation shall include trigger conditions, decision authority, validation steps, recovery verification, and post-rollback review. A deployment is not complete until rollback verification requirements have been satisfied.

### Object Storage Governance

Owner decision ODR-018 is approved. Truck-Safe Routing shall use an Object Storage abstraction layer and shall not permanently bind platform architecture to a single storage vendor.

The implementation shall support interchangeable object storage providers, including examples such as Amazon S3, Cloudflare R2, Azure Blob Storage, and Google Cloud Storage.

The database shall store object identifiers, Organization ownership, metadata, permissions, file hashes/checksums, MIME type, size, upload timestamps, retention policy, and lifecycle status.

Object storage shall store photos, documents, PDFs, receipts, images, videos, export files, AI-generated reports, and other binary assets.

Every uploaded object shall belong to exactly one Organization unless explicitly classified as Platform Global. Objects submitted for Shared Safety Intelligence shall follow ODR-011 review, sanitization, and approval before becoming Platform Global.

Objects shall be referenced by immutable internal identifiers. User-supplied filenames shall never be treated as permanent identifiers.

Object access shall be enforced using Organization context and platform authorization. Direct public access shall not be permitted unless explicitly approved. Changing storage providers shall not require redesign of application business logic.

## 4. API Protection Matrix Review

The audit inventory contains 167 endpoints:

| Auth classification | Count |
| --- | ---: |
| `admin` | 98 |
| `driver` | 24 |
| `admin-role` | 10 |
| `ai` | 3 |
| `public-or-inline` | 32 |

### Public Endpoints

Owner decision ODR-009 is approved. Truck-Safe Routing shall use a "Private by Default" API security model.

Guiding principle: every API endpoint is considered private unless there is an explicitly approved business reason for it to be publicly accessible.

Public endpoints shall be limited to non-sensitive platform functions such as:

- `GET /health`
- `GET /ready`
- Authentication bootstrap
- Password reset initiation
- Public documentation, if explicitly enabled
- Public status page, if explicitly enabled

All Organization operational data shall require authentication, including drivers, users, customers, vehicles, routes, stops, deliveries, hazards, photos, reports, KPIs, Business Intelligence, AI recommendations, route replay, Organization settings, and audit information.

All authenticated requests shall execute within the authenticated user's Organization context. Clients shall not specify arbitrary Organization identifiers to access Organization-private data.

Platform-only functions shall require Platform Admin privileges, including Organization management, billing, platform configuration, Shared Safety approval, platform analytics, and platform audit logs.

Authorization shall enforce least privilege. Organization-private information shall never be returned to another Organization.

### Driver-Authenticated Endpoints

Driver endpoints must remain compatible with company driver ID assignment, but Phase 0 should confirm session-based driver authentication before tenant migration:

- Driver session endpoints.
- Driver route manifest lookup and assigned route access.
- Route stop updates, closeout, delivery documents, inventory closeout, and print confirmations.
- Driver delivery notes.
- Driver hazard reports.
- Driver route session events.
- Driver AI/copilot endpoints where enabled.

### Supervisor/Admin Endpoints

Supervisor/admin endpoints include route manifests, driver registry/team management, static hazard verification, delivery notes administration, account intelligence, operational dashboards, supervisor queues, reports, route replay, and data import screens.

These must require named supervisor/admin identity and later Organization context. Shared fallback passwords should remain bootstrap-only and should not be the long-term authorization model.

### Platform-Admin Endpoints

Platform-admin classification is required before tenant migration for:

- Supervisor account management.
- Admin user activation/deactivation.
- Route-session bulk deletion.
- Global/shared safety approval controls.
- Operational geography master data.
- Any future Organization creation, tenant settings, or cross-Organization support.

### Approved Role Hierarchy

Owner decision ODR-008 is approved. Truck-Safe Routing shall use five role types:

1. Platform Admin
2. Organization Admin
3. Supervisor
4. Driver
5. Warehouse Employee

Role boundaries:

| Role | Boundary |
| --- | --- |
| Platform Admin | Manages the overall SaaS platform, Organizations, platform-wide configuration, subscriptions/billing controls, shared safety intelligence approval, and platform-level health/audit information. Platform Admins do not perform routine customer Organization operations except through explicitly authorized and audited support workflows. |
| Organization Admin | Manages one Organization only, including that Organization's users, supervisors, drivers, vehicles, routes, customers, settings, dashboards, KPIs, and reports. Organization Admins cannot manage another Organization, platform-wide settings, subscriptions, or global shared-safety approval. |
| Supervisor | Manages operational activity within the assigned Organization, including drivers, routes, permitted route work, delivery operations, hazards, exceptions, reports, and driver performance. Supervisors cannot manage Organization ownership, subscriptions, Platform Admins, or platform-wide configuration. |
| Driver | Accesses only assigned and personally permitted operational information, including route execution, navigation, stop completion, permitted photos/documents, hazard reports, closeout workflows, and permitted personal performance information. Drivers cannot access administration or other drivers' private operational data unless explicitly permitted. |
| Warehouse Employee | Performs warehouse-specific operational workflows such as inventory confirmation, loading, returns, manifests, and permitted warehouse documentation. Warehouse Employees cannot manage users, Organization settings, subscriptions, company-wide KPIs, or platform administration. |

Do not create separate role types for Dispatcher, Maintenance staff, Customer service, Auditor, External inspector, Regional Manager, Depot Manager, Safety Manager, or Executive Viewer. Those functions should be handled through explicit permissions assigned to one of the approved five roles where necessary.

Authorization shall follow least privilege. Roles group permissions, but backend access decisions must ultimately be enforced through explicit permissions and Organization context, not role names alone. No Organization-level role may access another Organization's private data.

### Warehouse Authentication Governance

Owner decision ODR-010 is approved. Warehouse employees shall authenticate using at least two factors of knowledge or possession before performing warehouse operations that affect operational records.

Approved examples include:

- Employee ID + PIN
- Employee ID + Badge
- Employee ID + Password
- Badge + PIN
- Other equivalent multi-factor workflow appropriate for the customer's operational environment

The specific authentication technology may vary by Organization. Truck-Safe Routing shall support multiple warehouse authentication mechanisms without changing the core authorization model.

Warehouse employees may perform only warehouse-authorized operational workflows, including truck loading confirmation, inventory confirmation, manifest confirmation, return verification, warehouse documentation, and authorized printing operations.

Warehouse employees shall not receive administrative privileges. Authentication confirms identity. Authorization determines what actions the authenticated user may perform.

All warehouse actions shall execute within the authenticated user's Organization context. All significant warehouse operations shall be audit logged.

### Endpoints Lacking Sufficient Authorization

Critical and High Phase 0 review targets:

1. Public write-capable warehouse inventory endpoints under `/api/route-manifests/warehouse/*`.
2. Public `POST /api/places/recent-destinations`.
3. Public Places and Street View proxy endpoints that require rate, quota, terms, and tenant review.
4. Public hazard lookup/manual-hazard endpoints where write or admin behavior is inline rather than consistently authenticated.
5. Admin pages classified as `public-or-inline` that rely on page-level inline authentication rather than consistent middleware.

Endpoints that must be protected before tenant migration:

- All write endpoints.
- All driver route, stop, delivery, signature, receipt, photo, inventory, and print endpoints.
- All supervisor/admin dashboard data endpoints.
- All AI endpoints.
- All warehouse employee confirmation endpoints.
- All platform-admin/user-management endpoints.
- Any endpoint exposing customer, driver, GPS, route replay, receipt, signature, photo, KPI, or audit data.

## 5. Organization Backfill Decision Package

### Approved Initial Organization

Approved bootstrap record:

| Field | Recommended Value |
| --- | --- |
| Organization name | `Truck-Safe Routing Development` |
| Organization slug | `truck-safe-routing-development` |
| Status | `active` |
| Purpose | Own all existing internal development, demonstration, and test data during initial tenant migration |

Owner decision ODR-001 is approved: no current records should be assigned to Arca Continental Southwest Beverages, Sysco, Sigma, or any other real company. Real customer Organizations must not be created until an actual company is formally onboarded, approved for a pilot, or becomes a customer.

Neutral Organizations such as `Demo Fleet A`, `Demo Fleet B`, and `Demo Fleet C` may be used only in automated tests or non-production seed data when multiple-tenant testing is required.

### Existing User Assignment

- Existing named admin users become users in the initial Organization unless explicitly marked Platform Admin.
- The bootstrap admin should be reviewed and converted to a named user or disabled after named accounts exist.
- Platform Admin should be reserved for cross-tenant system administration, not routine supervisor work.

### Existing Driver Assignment

- Existing drivers become drivers in the initial Organization.
- Existing company driver IDs remain operational login/assignment identifiers during migration.
- Each driver also receives or retains a globally unique internal driver primary key.

### Data Classification

| Data Area | Classification |
| --- | --- |
| Users and supervisor accounts | Organization-private, except Platform Admin records |
| Drivers and driver teams | Organization-private |
| Routes, stops, manifests, route assignments | Organization-private |
| Vehicles and route equipment | Organization-private |
| Customers/accounts/delivery locations | Organization-private |
| Delivery notes, photos, signatures, receipts | Organization-private |
| Route replay/GPS trail and driver operational events | Organization-private |
| Route inventory, damaged items, returns, closeout records | Organization-private |
| KPIs, BI metrics, route performance, driver performance | Organization-private unless aggregated and approved |
| Driver-submitted hazard reports | Organization-private at submission |
| Approved shared low-bridge/no-truck/residential safety hazards | Eligible for approved shared safety after review and sanitization |
| Base low-clearance bridge reference data | Platform-global if sourced/licensed for platform-wide use |
| Other legally usable global safety reference data | Platform-global |
| Google Places/Directions/Street View/photo content | External provider data subject to Google terms; not Organization-owned |
| AI prompts, outputs, recommendations, approvals | Organization-private unless sanitized and explicitly approved |
| Audit logs | Organization-private, with Platform Admin access only where approved |

Shared Safety Intelligence policy:

- Guiding principle: "The platform shares knowledge, not customer operations."
- Never share Driver names, Driver identifiers, User accounts, Customer names, non-public Customer addresses, Delivery manifests, Route assignments, company-specific routes, Delivery notes, Sales information, Receipts, Photos, Videos, Internal comments, Organization KPIs, Operational metrics, Private AI recommendations, or any Organization-specific operational data across Organizations.
- Share only reviewed, approved, and sanitized truck-safety intelligence such as verified low-clearance bridges, truck restrictions, weight restrictions, height restrictions, commercial-vehicle road closures, construction affecting truck routing, hazardous intersections, dangerous turns, unsafe loading entrances, unsafe parking locations for commercial vehicles, verified truck-hazard GPS coordinates, and approved hazard photos stripped of Organization-identifying information.
- Shared safety information must be submitted by an Organization, reviewed by Platform Administration or an approved moderation workflow, sanitized where appropriate, and approved before becoming platform-global.
- No Organization shall have direct access to another Organization's private operational data.

### Unknown Ownership Records

Records needing owner decision or data review before backfill:

- Legacy route manifests without explicit driver/team/customer ownership.
- Photos or notes with missing route/account references.
- Hazard records that may be local driver submissions or platform-global static hazards.
- Operational geography records that may be company-specific or platform master data.
- Demo/test routes, test drivers, and QR/build artifacts that should not be migrated into tenant-owned production data.

## 6. Driver Identity Strategy

Approved final model:

1. Use a globally unique internal driver ID as the permanent platform database identity.
2. The internal driver ID should use a UUID or equivalent globally unique identifier.
3. Keep the company employee/driver number as an Organization-scoped operational identifier.
4. Enforce uniqueness on `(organization_id, company_driver_number)`.
5. Do not require company driver numbers to be globally unique across all Organizations.
6. Do not use driver names as identifiers.
7. Preserve mobile login and route assignment by company driver ID during migration where operationally appropriate.
8. Add Organization context to driver sessions after Phase 1/Phase 3 so the same company driver number can safely exist in another Organization later.
9. Keep API compatibility by displaying or accepting the company driver number during transition where needed, while backend relationships resolve to the permanent internal driver record within the authenticated Organization.

Migration behavior:

- Existing `assigned_driver_id` values are backfilled into the initial Organization as company driver numbers.
- A new internal driver primary key maps each existing driver record to the tenant-owned driver entity.
- Mobile cached route/stop queues must support old driver ID fields until the new session payload is verified.
- API responses should continue exposing the company driver number where the mobile app expects it.

## 7. Phase 0 Exit Criteria

Phase 1 Organization-model implementation must not begin until all criteria are met:

1. Backend Git status is clean or contains only explicitly approved Phase 0 documentation changes.
2. Mobile work is fully backed up, source-controlled, and pushed to an approved GitHub remote.
3. Mobile generated artifacts are separated from source code.
4. Database provider, backup capability, backup ID, retention, encryption, and PITR status are documented.
5. A restore to an isolated target is successfully tested or formally scheduled with owner approval.
6. Deployed backend URL is recorded.
7. `/health` passes in the target environment.
8. `/ready` passes in the target environment.
9. Database connectivity and PostGIS readiness are verified.
10. Google Maps API restrictions, quota posture, and storage/caching terms posture are approved or accepted as a documented risk.
11. Durable object storage for photos is verified.
12. Critical audit findings are addressed or explicitly accepted for Phase 1 entry.
13. High audit findings that block tenant safety are addressed or explicitly accepted.
14. API protection priorities are approved.
15. Organization backfill decisions are approved.
16. Driver identity strategy is approved.
17. Rollback baseline is recorded: backend commit SHA, mobile commit SHA, database backup ID, Render deploy ID, environment-variable snapshot process, and restore procedure.

## Phase 0 Workstreams

1. Source-control stabilization.
2. Mobile repository baseline and remote setup.
3. Backup and restore verification.
4. Deployment readiness verification.
5. API protection matrix approval.
6. Organization backfill decision approval.
7. Driver identity approval.
8. Rollback baseline evidence capture.

## Governance Completion

Owner Decision governance is complete as Architecture Baseline Version 1.0. Future implementation work shall conform to this baseline unless a future Architecture Decision Record explicitly supersedes it.

Remaining items formerly listed as open ODRs are reclassified as Engineering Decisions or Operational Verification items. They must be completed before their related implementation gates, but they no longer require separate business Owner Decision approval under Phase 0 governance.

## Phase 0 Stop Conditions

Stop Phase 0 and do not begin Phase 1 if:

- Production backup capability cannot be verified.
- Restore target cannot be created or scheduled.
- Mobile source cannot be safely backed up before cleanup.
- Critical write endpoints remain public without owner risk acceptance.
- Driver identity strategy is not approved.
- Organization ownership for existing data is unresolved.
