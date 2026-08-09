# Truck-Safe Routing Project Status

## 1. Document Control

- Status: Active
- Document Type: Living Project Status
- Last Updated: 2026-07-25
- Governing Architecture Version: 1.1
- Authoritative Repository: `C:\dev\bridge-api`
- GitHub Repository: `https://github.com/Tyrone-web714/bridge-api.git`
- Current Branch: `legacy-public-url-final-cleanup`
- Latest Documentation Commit: `cf23662b1bb7ab189960925f9521f6b1c0e8a394` - `Add Truck-Safe Routing governing documentation`
- Update Guidance: Update this file when the project phase, deployment status, repository structure, major risks, or implementation priorities change.

This file is a living operational snapshot. It does not replace the governing architecture documentation under `docs/` and should link to governing documents instead of duplicating them.

## 2. Project Summary

Truck-Safe Routing is being developed as an enterprise, multi-tenant Logistics Intelligence Platform for commercial fleets. The governing documentation defines a platform that includes truck-safe routing, fleet operations, shared safety intelligence, Business Intelligence, a custom KPI engine, a Logistics Intelligence Engine, a Fleet Intelligence Scoring System, and AI-assisted decision support.

Current implementation and planned architecture must be kept separate:

- Existing implementation: the repository contains a Node/Express backend, PostgreSQL/PostGIS-oriented data access, server-rendered supervisor/admin pages, routing and hazard APIs, route manifest workflows, AI/status endpoints, deployment configuration, and governing documentation. A separate local Expo mobile app exists at `C:\dev\tsr-mobile`.
- Planned architecture: the documentation defines the target multi-tenant SaaS platform, Organization tenant boundary, shared safety governance, BI/KPI expansion, Logistics Intelligence Engine, Fleet Intelligence Scoring System, and approved AI governance.
- Future roadmap: future work must begin with the comprehensive audit required by the governing documentation before multi-tenant implementation or major architecture changes.

## 3. Current Implementation Phase

| Area | Status | Verified Basis |
| --- | --- | --- |
| Product concept | Complete | Architecture Volume I and PRS Part I define the platform concept and product foundation. |
| Enterprise architecture baseline | Complete | Volumes I-VII and the architecture index are present under `docs/architecture`. |
| Repository governance documentation | Complete | Governing docs and Architecture Governance Baseline v1.1 are committed. |
| Product requirements | Complete | PRS Part I is present at `docs/product/Product-Requirements-Specification-Part-I-Platform-Foundation.md`. |
| Current codebase audit | Pending | Required as the next approved priority before multi-tenant work. Older audit files exist, but the new governance-driven comprehensive audit is not yet verified complete. |
| Multi-tenant migration | Pending | Architecture defines Organization as tenant boundary; implementation audit and migration plan are still required. |
| Authentication and RBAC | Merged to Main | Authentication/RBAC foundation is merged at `5a1888fec120285ae698d3ead2196ca8d2af6636`. |
| API Tenant Enforcement | Merged to Main | API Tenant Enforcement is merged at `1c78e4c4cf6d322fa47d867b2d05e684c5392aea`. |
| Mobile Tenant Context | Merged to Main | Mobile tenant context foundation was physically validated on device and merged before the Shared Safety branch. |
| Shared Safety Intelligence | Merged to Main | Shared Safety Foundation and Moderation UI are merged to main through commit `d56bc93`. Production migration `005` still requires release approval before production use. |
| Fleet operations expansion | In Progress | Drivers, route manifests, delivery notes, inventory closeouts, operational geography, and heatmap routes exist; full target platform expansion remains pending. |
| KPI and BI foundation | Merged to Main | BI/KPI foundation is merged through the active governance baseline; production migration `006` is applied and verified by read-only production preflight. |
| Data Lifecycle architecture | Merged to Main | ODR-019 foundation is merged through commit `36c006d`; production migration `009` is applied and verified by read-only production preflight. |
| Enterprise Identity architecture | Merged to Main | ODR-020 foundation is merged to main through commit `632709e`; production migration `010` is applied and verified by read-only production preflight. No external provider interoperability is claimed. Provider verification is paused pending remaining operational readiness verification. |
| Logistics Intelligence Engine | Merged to Main | Logistics Intelligence Foundation is merged through commit `3f2590d`; production migration `007` still requires release approval before production use. |
| Intelligence Execution Platform foundation | Enterprise Registry Implemented Locally | AI-IEP-001 adds the provider-neutral execution foundation under `bridge-api/services/intelligenceExecution`, an internal authenticated `/api/intelligence/execute` boundary, deterministic `text.cleanup`, policy-first/cost-first planning, additive migration `012_intelligence_execution_foundation.sql`, and contract test `npm run test:intelligence-execution`. AI-IEP-002 migrates the existing `/api/ai` structured-response route behind the IEP through capability `legacy.ai.structured_response`. AI-IEP-003 migrates scheduled supervisor intelligence narrative generation behind the IEP through capability `supervisor.daily_operations_report` and adds provider-bypass enforcement via `npm run test:ai-architecture`. AI-IEP-004A.1 adds the enterprise capability registry source of truth, generated artifacts, validation, lifecycle-transition checks, and `npm run test:capability-registry`. AI-IEP-004A.2 adds the repository-native benchmark dataset framework, synthetic test-only datasets for the three active capabilities, deterministic generated catalogs, coverage reporting, and `npm run test:benchmark-datasets`. AI-IEP-004A.3 adds a repository-native offline/mock execution strategy evaluation engine, initial synthetic evaluation requests, mock executor fixtures, deterministic generated run/observation/replay artifacts, descriptive raw aggregation, and `npm run test:evaluation-engine`. AI-IEP-004A.4 adds a downstream repository-native scoring engine, test-only scoring profiles and requests, observation-to-dimension mappings, raw metrics, normalized dimension scores, gates, thresholds, weighted composites, completeness, confidence, sensitivity analysis, deterministic generated score artifacts, and `npm run test:scoring-engine`. AI-IEP-004A.5 adds a downstream repository-native cost-governance subsystem, synthetic test-only pricing catalogs, cost model profiles, budget profiles, cost requests, cost records, budget simulations, cost sensitivity artifacts, and `npm run test:cost-governance`. AI-IEP-004A.6 adds a downstream repository-native Execution Decision Engine, synthetic test-only Decision Policy Profiles and requests, advisory candidate enumeration, mandatory-gates-before-utility selection, fallback planning, counterfactuals, sensitivity analysis, deterministic generated decision artifacts, and `npm run test:execution-decisions`. AI-IEP-004A.7 adds a repository-native Decision History and Governance Records subsystem, immutable decision snapshots, append-only governance events, typed subjects and actors, review/approval/human-review/exception/finding/attestation/replay records, deterministic generated governance reports, and `npm run test:decision-governance`. AI-IEP-004A.8 adds a repository-native Enterprise Intelligence Knowledge Graph, typed nodes and relationships across the capability registry, benchmark datasets, evaluation, scoring, cost governance, execution decisions, decision governance, documentation, scripts, generated artifacts, dependency/impact/cycle analysis, deterministic graph reports, and `npm run test:knowledge-graph`. AI-IEP-004A.9 adds a repository-only Dashboard Data Generation Framework, 30 deterministic dashboard datasets, catalog/hash/summary artifacts under `bridge-api/dashboard-data`, validation for schema/hash/source/runtime-safety boundaries, and `npm run test:dashboard-data`. AI-IEP-004A.10 adds repository-only Framework Validation and Enterprise Integration reports, subsystem/integration/cross-reference/coverage matrices, repository health metrics, advisory readiness and quality scorecards, deterministic generated validation artifacts, and `npm run test:framework-validation`. AI-IEP-005A.1 adds a repository-only Enterprise Intelligence Capability Orchestration Framework, 12 metadata-only intelligence domain capabilities, execution contracts, advisory execution plan templates, deterministic orchestration artifacts, and `npm run test:intelligence-orchestration`. AI-IEP-005A.2 adds a repository-only Enterprise Intelligence Lifecycle Framework, lifecycle transition rules, maturity/readiness/learning-policy/version-evolution metadata for all 12 orchestration capabilities, deterministic lifecycle artifacts, and `npm run test:intelligence-lifecycle`. AI-IEP-005B.1 adds a repository-only Route Intelligence Foundation, deterministic truck-safety rules, vehicle/route/hazard/restriction contracts, synthetic route benchmark cases, generated route-intelligence artifacts, IEP integration references, and `npm run test:route-intelligence`; it does not modify production routing endpoints, run providers, deploy code, execute migrations, mutate route data, or make production safety certification claims. AI-IEP-005B.2 adds a repository-only Driver Intelligence Foundation, deterministic driver profile/state/event contracts, route adherence/deviation, stop progress, speed compliance, low bridge/restricted road/no-through-truck/residential-area approach checks, hazard acknowledgement, advisories, explanations, evidence/confidence records, human-review flags, synthetic driver benchmarks, generated driver-intelligence artifacts, IEP integration references, and `npm run test:driver-intelligence`; it does not create production APIs, run providers, invoke hosted AI, deploy code, execute migrations, mutate databases or objects, score employees, rank drivers, recommend discipline, or change Cloudflare/R2 settings. TSR-AI-WORKFLOW-001 adds repository-only AI development roadmap and architect-builder handoff records under `docs/ai-development`, with validation command `npm run test:ai-roadmap`; it has been committed and pushed through `983457b`, and it does not begin Supervisor Intelligence, select models, enable production orchestration, deploy, run migrations, or change runtime behavior. No production deployment, production migration, live hosted benchmark execution, provider comparison, model ranking, production recommendation, production budget enforcement, procurement recommendation, TCO, ROI, or production benchmark approval is claimed. |
| Fleet Intelligence Scoring System | Merged to Main | Fleet Intelligence Scoring Foundation is merged through commit `630288e`; production migration `008` still requires release approval before production use. |
| Security hardening | In Progress | Security controls, auth services, rate limit middleware, secret audit scripts, and security review docs exist; production hardening remains ongoing. |
| Pilot readiness | Conditional GO | Pilot Integration and End-to-End Hardening completed with no unresolved Critical or High defects; remaining limitations require physical mobile offline/reconnect replay, dashboard browser walkthrough, deployment smoke, and backup/restore verification. |
| Production rollout planning | Merged to Main | Production rollout planning merged at `aa2832d`; it remains planning only and does not approve production deployment or production migrations. |
| Production readiness | Operational Verification In Progress | Operational blocker closure is underway. Public deployed smoke checks pass for `/health`, `/ready`, admin login redirect behavior, and unauthenticated API denial. Owner-completed read-only production preflight verified PostgreSQL/PostGIS, migrations `001`-`010`, core ownership, and driver identity. Production backup provider/PITR capability, non-production restore rehearsal, Render environment name inventory, deployed commit/schema alignment, production CORS remediation, and Cloudflare R2 object-storage smoke are verified. Mobile authenticated private-media source compatibility is implemented and awaits preview APK/physical validation. Authenticated browser walkthrough, physical mobile offline/reconnect replay, monitoring alert delivery, temporary restore cleanup review, and production rollout remain unresolved/not executed. |
| Web origin and private media hardening | Merged to Main | Web origin and private media hardening merged through commit `b0652e7`. New Organization-private S3/R2 delivery-note media uses authenticated TSR media access and ODR-019 lifecycle object references. Verified production evidence still shows 3 legacy delivery-note media references using direct public R2 current URLs, so public R2 access cannot be disabled until legacy migration is approved and completed. |
| Legacy private media migration | Complete | Branch `legacy-private-media-migration` contains validated migration tooling and documentation. Owner-run approved production apply migrated the 3 verified legacy delivery-note media metadata references; immediate post-migration dry-run reported `alreadyMigrated = 3`, `readyToMigrate = 0`, and no blocked/ambiguous/missing metadata items. Deployed `/health` and `/ready` remained HTTP 200 after migration. No R2 object mutation, deployment, or database write was performed by that migration; the later approved Private R2 Hardening closure disabled only the Cloudflare R2 Public Development URL setting. |
| Private R2 hardening | Complete | Private-media writer remediation is deployed, authenticated media delivery through `/api/media/:mediaId` is verified, unauthenticated media requests return HTTP 401, the bounded production cleanup removed the 5 obsolete `legacyPublicUrl` fields with no storage key, storage provider, lifecycle, organization, or media ID changes, and the owner-approved Cloudflare R2 Public Development URL shutdown is complete. Final smoke validation passed: `/health` HTTP 200, `/ready` HTTP 200, authenticated Delivery Notes media HTTP 200, unauthenticated media HTTP 401, and the former public R2 development endpoint HTTP 401 `This bucket cannot be viewed`. See `docs/PRIVATE_R2_HARDENING_FINAL_COMPLETION_REPORT.md`. |
| Mobile authenticated private media | In-App Camera Rebuild Merged; Physical Validation Passed | The in-app TSR camera and durable note composer repair passed owner-reported physical validation and is part of the active readiness baseline. Mobile private-media rendering no longer depends on direct public R2 URLs for verified delivery-note media. |

### Current Local AI Development Status

- `WAREHOUSE_INTELLIGENCE` is committed, validated, and pushed as a repository-only foundation through commit `4a2b2dc7e4a5c2d8bd9a4a0c9f0e407cdc8fd1bb`.
- `FLEET_INTELLIGENCE` is committed, validated, and pushed as a repository-only foundation through commit `9dfed02df38dc67240b089f4582926f14bbaae7d`. It is not deployed, not migrated, not production-certified, and does not add production APIs, provider activation, model selection, predictive maintenance models, autonomous dispatch, autonomous repair approval, autonomous purchasing, workforce scoring, production writes, database or object mutations, Cloudflare/R2 changes, or Customer Intelligence implementation.
- `CUSTOMER_INTELLIGENCE` is the current `APPROVED` Milestone 1 package. Implementation has not started. Approved scope is limited to customer/account operational context, delivery-account/product/invoice history awareness, service-pattern evidence, customer-specific route/stop context, operational exceptions, deterministic summaries/explanations, evidence completeness/confidence, human-review flags, and integration with Route, Driver, Supervisor, Warehouse, and Fleet Intelligence where relevant.
- Customer Intelligence does not approve customer credit scoring, automated lending or credit decisions, protected-class inference, autonomous pricing/discounting/contract/customer/sales decisions, marketing automation, CRM/payment/accounting platform expansion, model selection, provider activation, production APIs, deployment, migrations, production writes, or new AI infrastructure.

## 4. Repository Landscape

### Backend/API repository

- Local path: `C:\dev\bridge-api`
- Backend app path: `C:\dev\bridge-api\bridge-api`
- GitHub URL: `https://github.com/Tyrone-web714/bridge-api.git`
- Purpose: backend API, routing engine, database logic, supervisor/admin dashboard, deployment configuration, and governing platform documentation.

### Active mobile application

- Local path: `C:\dev\tsr-mobile`
- State: separate local Git repository on branch `master`.
- GitHub remote: none configured at last verified inspection in this session.
- Working tree: many modified and untracked files were present at inspection.
- Important boundary: mobile source is not contained in the `bridge-api` GitHub repository.

### Other local projects

- `C:\dev\truck-safe-routing`: local Vite/React project folder. No `.git` repository was verified there during current inspection. Treat as older or experimental unless a later audit proves otherwise.
- `C:\dev\truck-safe-routing-mobile`: local Expo project with a `.git` folder and no remote visible in `.git\config`. Git normal inspection previously hit ownership protection. Treat as older or experimental unless a later audit proves otherwise.

## 5. Current Technical Stack

### Backend/API/dashboard

- Runtime: Node.js, `>=18` declared in `bridge-api/package.json`; Docker image uses `node:20-alpine`.
- Server framework: Express.
- Database access: PostgreSQL via `pg`; production readiness checks require PostgreSQL and PostGIS.
- Maps services: `@googlemaps/google-maps-services-js`; deployment docs require a server-side Google Maps key.
- Storage: S3-compatible photo storage adapter via `@aws-sdk/client-s3`; deployment docs reference durable object storage such as Cloudflare R2 or S3-compatible storage.
- Dashboard implementation: server-rendered supervisor/admin pages served by Express routes, not a separate React dashboard app in this repository.
- Deployment: Render blueprint (`render.yaml`) and Dockerfile are present.

### Mobile application

- Runtime/app framework: React Native and Expo in `C:\dev\tsr-mobile`.
- Mobile dependencies verified: Expo, React Native, React Navigation, AsyncStorage, SecureStore, Location, Camera, Image Picker, Speech, React Native Maps, WebView, Signature Canvas, and React Native Bluetooth Classic.
- Offline storage/sync: AsyncStorage-backed route, stop, delivery, notes, product barcode, and route event queues are present in mobile services.
- Printer support: Zebra/Bluetooth service code exists through `react-native-bluetooth-classic`.

## 6. Existing Implemented Capabilities

Verified from repository structure and source files:

- Backend `/health` and `/ready` endpoints.
- Express routing API mounted under `/api/routing`.
- Safe-route endpoint in routing routes.
- Low-clearance bridge data under `bridge-api/data/low_clearance_bridges.json`.
- Manual hazards, driver hazard reports, hazards-near, hazards-in-bounds, and static hazard verification routes.
- Route manifest import, assignment, driver route, stop update, delivery, document, inventory, closeout, and supervisor review routes.
- PostgreSQL repository/data access layer and migration scripts.
- Supervisor/admin pages for dashboard, route manifests, hazards, delivery notes, driver registry/team management, supervisor accounts, operational heatmaps, geography, account intelligence, supervisor intelligence, alerts/reports, AI operations status, and route replay-related pages/routes.
- Backend rate-limit middleware and request body limits for selected API areas.
- Photo storage service and migration/verification scripts.
- Standalone Expo mobile app in `C:\dev\tsr-mobile`.
- Mobile assigned-route cache, offline stop-completion queue, delivery operation queue, delivery notes cache, route event queue, and reconnection synchronization logic.
- Mobile route execution screens, delivery settlement, final inventory closeout, warehouse inventory confirmation, route inventory, hazard report, barcode scanner, signature capture, Zebra printer service, and truck marker/navigation UI.

Items above are code-level capabilities. They are not proof that every workflow is field-tested or production-ready.

## 7. Governing Documentation

The governing documentation is now present under `docs/` and governs the complete Truck-Safe Routing platform even though source code is currently split across repositories/folders.

Key documentation includes:

- Enterprise Architecture Volumes I-VII.
- Product Requirements Specification Part I.
- Architecture index.
- Codex start file and Codex instructions.
- Implementation order.
- Coding standards.
- Glossary.
- ADR folder with an initial ADR.
- Diagrams folder with Mermaid and SVG diagrams.
- API, database, AI, and product documentation folders.

## 8. Current Deployment Status

- Backend hosting provider: Render is configured through `bridge-api/render.yaml` with service name `truck-safe-routing-api`.
- Backend deployment configuration: Docker-based Render web service, `healthCheckPath: /health`, and required environment variables are documented.
- Backend URL: Not yet verified from repository contents in this session. Deployment docs use placeholders, and repository evidence alone does not prove the live URL status.
- Mobile build status: Not yet verified. The mobile repo contains Expo/EAS build scripts and local APK QR artifacts, but this inspection did not verify the current build artifact or install status.
- Readiness status: Under development / production-pilot preparation. The production pilot checklist states 55-60% pilot readiness and lists open pilot items.
- Production readiness: Not verified; do not call the platform production-ready based on repository evidence.

## 9. Current Priority

Complete production and pilot operational verification before Enterprise Identity provider verification, production migration, or production rollout.

Current validation basis:

- Full backend test suite passes with `npm test`.
- Auth/RBAC foundation test passes with `npm run test:auth-rbac`.
- API tenant-enforcement test passes with `npm run test:api-tenant`.
- Mobile tenant-context test passes with `npm run test:mobile-tenant`.
- Shared Safety foundation test passes with `npm run test:shared-safety`.
- Shared Safety moderation UI test passes with `npm run test:shared-safety-ui`.
- BI/KPI foundation test passes with `npm run test:bi-kpi`.
- BI/KPI runtime validation passes with `npm run validate:bi-kpi` against an isolated local PostgreSQL/PostGIS database.
- Logistics Intelligence foundation test is being added with `npm run test:logistics-intelligence`.
- Logistics Intelligence runtime validation is being added with `npm run validate:logistics-intelligence` for an isolated local PostgreSQL/PostGIS database.
- Fleet Intelligence Scoring foundation test passes with `npm run test:fleet-intelligence-scoring`.
- Fleet Intelligence Scoring runtime validation passes with `npm run validate:fleet-intelligence-scoring` for an isolated local PostgreSQL/PostGIS database.
- Pilot Integration validator passes with `npm run validate:pilot-integration` for an isolated local PostgreSQL/PostGIS database.
- Production rollout planning validation passes with `npm run validate:production-rollout`.
- Data Lifecycle foundation test passes with `npm run test:data-lifecycle`.
- Data Lifecycle runtime validation passes with `npm run validate:data-lifecycle` for an isolated local PostgreSQL/PostGIS database.
- Enterprise Identity foundation test is being added with `npm run test:enterprise-identity`.
- Enterprise Identity runtime validation is being added with `npm run validate:enterprise-identity` for an isolated local PostgreSQL/PostGIS database.
- Secret audit passes with `npm run verify:secrets`.
- Migrations `001` through `010` are applied in production and verified by owner-completed read-only production preflight. No production migration was applied by Codex during operational blocker closure.
- Local `/health` and `/ready` passed against the isolated validation database.

## 10. Known Risks and Constraints

| Rank | Risk or Constraint | Current Basis |
| --- | --- | --- |
| Critical | Architecture documentation is ahead of implementation. | Volumes and PRS define multi-tenant platform capabilities that are not fully verified in code. |
| Critical | Single-tenant assumptions may exist. | Implementation order explicitly requires identifying single-tenant assumptions before multi-tenant migration. |
| High | Backend and mobile source are split. | Backend source is in `C:\dev\bridge-api`; active mobile source is in `C:\dev\tsr-mobile`. |
| High | Mobile repository lacks a configured remote. | `git remote -v` in `C:\dev\tsr-mobile` returned no remote during this inspection. |
| High | Existing database migration risk. | Multi-tenant migration requires adding Organization ownership to private records and rollback planning. |
| High | Google Maps configuration and key management require care. | Deployment docs require server-side Google Maps key; mobile config requires Android Maps key; audit docs identify Google terms/key risk. |
| Medium | Authoritative GitHub repository name is backend-oriented. | Governing platform docs live in `bridge-api`, which is also the backend repository. |
| Medium | Some planned modules are not yet built or not yet verified complete. | PRS and architecture describe future platform modules beyond currently verified implementation. |
| Medium | Offline/mobile field testing still required. | Mobile offline queues exist, but repository inspection does not prove field-tested reliability. |
| Low | Older local projects may confuse source-of-truth decisions. | `C:\dev\truck-safe-routing` and `C:\dev\truck-safe-routing-mobile` exist locally and appear older/experimental. |

## 11. Active Decisions

Current approved decisions reflected in governing documentation and project direction:

- Organization is the tenant boundary.
- One user may belong to only one Organization.
- Organization-private data remains isolated.
- Approved shared safety data may be shared globally after review and sanitization.
- Human approval precedes AI-driven operational changes unless a controlled automation policy is explicitly approved.
- Existing database should be used unless an audit proves it unsuitable.
- Backend and mobile remain separate for now.
- Documentation lives in the `bridge-api` repository.
- No monorepo conversion without an approved migration plan.
- No architectural change may be implemented unless reflected in architecture documentation or an approved ADR.
- Approved environments are Development, Staging, Pilot, and Production; normal releases flow Development to Staging to Pilot to Production.
- Every production deployment requires a rollback baseline before release.
- Object storage is vendor-neutral through an abstraction layer; uploaded objects are Organization-owned unless explicitly Platform Global.
- Warehouse employees must authenticate with at least two factors of knowledge or possession before warehouse operations that affect operational records.
- Phase 0 governance is complete as Architecture Baseline Version 1.0.
- Architecture Baseline Version 1.1 extends the baseline with Data Lifecycle governance (ODR-019) and Enterprise Identity governance (ODR-020); implementation work must conform to the active baseline unless a future ADR or ODR supersedes it.

## 12. Immediate Next Steps

1. Complete `operational-readiness-verification` without merging to main.
2. Do not deploy, configure real customer IdPs, or apply production migrations.
3. Obtain explicit owner approval before production database preflight or production data mutation.
4. Keep provider interoperability marked as not verified until actual provider testing occurs in a later approved phase.
5. Review and commit the AI-IEP-001 Intelligence Execution Platform foundation after validation. Do not deploy or run production migrations without separate owner approval.

## 13. Update Rules

`PROJECT_STATUS.md` must:

- Stay concise.
- Reflect verified current state.
- Avoid duplicating architecture documents.
- Avoid speculative claims.
- Be updated after major milestones.
- Include dates for significant status changes.
- Link to governing documentation rather than copying it.

## 14. References

- [Documentation README](docs/README.md)
- [Codex Start Here](docs/architecture/CODEX_START_HERE.md)
- [Architecture Index](docs/architecture/ARCHITECTURE_INDEX.md)
- [Implementation Order](docs/architecture/IMPLEMENTATION_ORDER.md)
- [Product Requirements Specification Part I](docs/product/Product-Requirements-Specification-Part-I-Platform-Foundation.md)
