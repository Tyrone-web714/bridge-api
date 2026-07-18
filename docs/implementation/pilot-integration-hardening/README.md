# Pilot Integration and End-to-End Hardening

Branch: `pilot-integration-hardening`

Baseline: `630288e` (`Complete Fleet Intelligence Scoring merge gate validation`)

Purpose: validate Truck-Safe Routing as one integrated pilot platform after the merged multi-tenant, auth/RBAC, API tenant enforcement, mobile tenant context, Shared Safety, BI/KPI, Logistics Intelligence, and Fleet Intelligence Scoring foundations.

This phase did not implement ODR-019 Data Lifecycle or ODR-020 Enterprise Identity. It did not apply migrations to production and did not modify production data.

Evidence types used in this package:

- Automated: npm/package validation scripts and source-level validators.
- Local runtime: isolated PostgreSQL/PostGIS database with neutral test Organizations.
- Source-reviewed: code path reviewed but not executed through a physical device or browser in this phase.
- Not tested: intentionally deferred or unavailable in this environment.

Primary runtime validator:

- `npm.cmd run validate:pilot-integration`

Primary code changes:

- Added pilot integration runtime validator.
- Hardened assigned-route warehouse/inventory joins so company driver number, legacy driver ID, and internal driver ID resolve consistently under Organization scope.

