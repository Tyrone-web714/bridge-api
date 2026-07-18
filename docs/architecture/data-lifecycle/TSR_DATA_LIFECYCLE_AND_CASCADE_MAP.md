# TSR Data Lifecycle and Cascade Map

**Status:** ARCHITECTURE DESIGNED / FOUNDATION CLASSIFICATION IMPLEMENTED
**Implementation State:** Updated from implementation audit for ODR-019 foundation. See `docs/implementation/data-lifecycle-foundation/IMPLEMENTED_CASCADE_MAP.md`.

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
| `driver_sessions` | `drivers.driver_id` | Authentication data | Yes | Low | Organization-private | HARD DELETE eligible | Authentication artifact policy | N/A | No |
| `warehouse_employee_sessions` | `warehouse_employees.employee_id` | Authentication data | Yes | Low | Organization-private | HARD DELETE eligible | Authentication artifact policy | N/A | No |
| `admin_users` | `organizations.id` | Direct personal identifiers / authentication user | Yes | Medium | Organization-private or Platform Admin | SOFT DELETE / DEACTIVATE / ANONYMIZE | Account recovery 30 days; history retention POLICY_DECISION_REQUIRED | PSEUDONYMIZE or ANONYMIZE direct identifiers after approval | Yes |
| `drivers` | `organizations.id` | Employment identifiers / operational actor | Yes | High | Organization-private | DEACTIVATE / SOFT DELETE / ANONYMIZE | Account recovery 30 days; operational retention POLICY_DECISION_REQUIRED | PSEUDONYMIZE driver identity while retaining route history | Yes |
| `warehouse_employees` | `organizations.id` | Employment identifiers / warehouse actor | Yes | High | Organization-private | DEACTIVATE / SOFT DELETE / ANONYMIZE | Account recovery 30 days; operational retention POLICY_DECISION_REQUIRED | PSEUDONYMIZE warehouse identity while retaining confirmations | Yes |
| `daily_route_manifests` | Driver assignment by company driver number | Operational historical data | Employment ID | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE driver if approved | Yes |
| `daily_route_stops` | `daily_route_manifests.id` | Operational historical data | Customer data possible | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | DETACH/PSEUDONYMIZE actor only | Yes |
| `delivery_settlements` | `daily_route_stops.id` | Delivery/financial history | Signatures possible | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | ANONYMIZE direct identifiers only after approval | Yes |
| `delivery_documents` | Stop/order/settlement | Receipt evidence | Driver/customer signatures possible | Medium/High | Organization-private | RETAIN or HARD DELETE after expiry if eligible | POLICY_DECISION_REQUIRED | ANONYMIZE where policy permits | Yes |
| `route_closeout_documents` | `daily_route_manifests.id` | Route closeout evidence | Driver identity | High | Organization-private | RETAIN or HARD DELETE after expiry if eligible | POLICY_DECISION_REQUIRED | PSEUDONYMIZE driver if approved | Yes |
| `route_inventory_closeouts` | `daily_route_manifests.id` | Warehouse inventory evidence | Driver/staff identity | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE actor if approved | Yes |
| `route_session_events` | `route_sessions.id` | Route replay evidence | Possible | High | Organization-private | RESTRICT | POLICY_DECISION_REQUIRED | PSEUDONYMIZE actor if approved | Yes |
| `private_hazard_submissions` | Organization/user/driver source | Safety source evidence | Possible | High | Organization-private | RETAIN / DETACH | POLICY_DECISION_REQUIRED | DETACH or PSEUDONYMIZE contributor | Yes |
| `shared_safety_records` | Platform-global approved safety fact | Safety intelligence | Sanitized only | High | Platform-global | PLATFORM-GLOBAL PRESERVE | POLICY_DECISION_REQUIRED | Source attribution detached | Yes |
| `kpi_snapshots` | KPI definitions/formulas | Analytical data | Possible employment ID | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE subject if approved | Yes |
| `logistics_*` | Organization operational events | Analytical/intelligence data | Possible actor IDs | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE actor if approved | Yes |
| `fleet_score_*` | Score models/snapshots | Analytical/scoring data | Driver IDs possible | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE subject if approved | Yes |
| `audit_events` | Actor reference | Audit data | Actor ID | High | Organization/platform | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE actor only through approved process | Yes |
| `lifecycle_object_references` | Object owner table/id | Object-storage metadata | Possible | Variable | Organization-private or platform | POLICY_DECISION_REQUIRED / LEGAL HOLD | POLICY_DECISION_REQUIRED | Depends on object class | Yes |
| `organization_memberships` | `organizations.id` / TSR identity records | Authorization membership | User identifiers | High | Organization-private | RESTRICT / DEACTIVATE | POLICY_DECISION_REQUIRED | PSEUDONYMIZE or detach actor where approved | Yes |
| `organization_identity_providers` | `organizations.id` | Enterprise IdP configuration | Admin/config metadata possible | Medium/High | Organization-private | RESTRICT / ARCHIVE | POLICY_DECISION_REQUIRED | Remove direct administrator identifiers where approved | Yes |
| `verified_organization_domains` | `organizations.id` | Domain verification evidence | Low | Medium | Organization-private | RESTRICT / ARCHIVE | POLICY_DECISION_REQUIRED | N/A unless contact metadata added | Yes |
| `federated_identities` | IdP connection / TSR internal user | Federated identity mapping | Yes | High | Organization-private | DEACTIVATE / PSEUDONYMIZE / RETAIN | POLICY_DECISION_REQUIRED | External subject may be pseudonymized under approved deletion workflow | Yes |
| `identity_claim_mappings` | IdP connection | Authorization mapping configuration | Low | Medium | Organization-private | ARCHIVE / RESTRICT | POLICY_DECISION_REQUIRED | N/A | Yes |
| `sso_authentication_transactions` | IdP connection | Authentication transaction artifact | Yes | Low | Organization-private | HARD DELETE eligible | Authentication artifact policy | N/A | No |
| `scim_configurations` | Organization / IdP connection | Enterprise lifecycle configuration | Credential reference | Medium | Organization-private | ARCHIVE / RESTRICT | POLICY_DECISION_REQUIRED | Remove administrator identifiers where approved | Yes |
| `scim_provisioning_events` | SCIM configuration / identity | Enterprise lifecycle audit | Yes | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE subject where approved | Yes |
| `enterprise_identity_break_glass_records` | Organization / actor | Emergency access governance | Yes | High | Organization-private or Platform | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE actor only through approved process | Yes |
| `identity_security_events` | Organization / IdP / federated identity | Security audit data | Possible | High | Organization-private or Platform | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE actor only through approved process | Yes |

## Rules

- Blanket destructive `ON DELETE CASCADE` MUST NOT be used for historically significant records.
- Correct cascade behavior MAY exist for dependent ephemeral records, but it MUST be justified.
- Audit logs, KPI snapshots, historical route records, delivery history, safety evidence, and validated shared safety intelligence SHOULD default to retain, restrict, detach, anonymize, or pseudonymize rather than destructive cascade.
- Platform-global safety intelligence MUST be evaluated independently from the originating Organization lifecycle.
