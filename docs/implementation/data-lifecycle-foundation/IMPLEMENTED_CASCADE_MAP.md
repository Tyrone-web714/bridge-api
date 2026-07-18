# Implemented Cascade Map

| Entity | Parent Relationship | Classification | Personal Data | Historical Importance | Tenant Scope | Deletion Action | Retention Rule | Anonymization Rule | Legal Hold |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `driver_sessions` | `drivers.driver_id` | Authentication data | Yes | Low | Organization-private | HARD DELETE eligible | Auth artifact policy | N/A | No |
| `warehouse_employee_sessions` | `warehouse_employees.employee_id` | Authentication data | Yes | Low | Organization-private | HARD DELETE eligible | Auth artifact policy | N/A | No |
| `daily_route_manifests` | Driver assignment by company driver number | Operational historical | Employment ID | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE driver if approved | Yes |
| `daily_route_stops` | `daily_route_manifests.id` | Operational historical | Possible customer data | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | DETACH/PSEUDONYMIZE actor only | Yes |
| `delivery_settlements` | `daily_route_stops.id` | Financial/delivery history | Signatures possible | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | ANONYMIZE direct signatures only after approval | Yes |
| `delivery_documents` | Stop/order/settlement | Receipt evidence | Signatures/driver | Medium/High | Organization-private | RETAIN or HARD DELETE after expiry if eligible | POLICY_DECISION_REQUIRED | ANONYMIZE where policy permits | Yes |
| `route_closeout_documents` | `daily_route_manifests.id` | Warehouse/route closeout | Driver/staff | High | Organization-private | RETAIN or HARD DELETE after expiry if eligible | POLICY_DECISION_REQUIRED | PSEUDONYMIZE actor if approved | Yes |
| `route_inventory_closeouts` | `daily_route_manifests.id` | Warehouse inventory | Driver/staff | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE actor if approved | Yes |
| `private_hazard_submissions` | Organization/user/driver | Safety source | Possible | High | Organization-private | RETAIN/DETACH | POLICY_DECISION_REQUIRED | DETACH from contributor | Yes |
| `shared_safety_records` | Platform-global approved fact | Safety data | Sanitized only | High | Platform-global | PLATFORM-GLOBAL PRESERVE | POLICY_DECISION_REQUIRED | Source attribution detached | Yes |
| `kpi_snapshots` | KPI formula/version | Analytical | Possible employment ID | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE subject if approved | Yes |
| `logistics_*` | Organization operational events | Analytical | Possible actor IDs | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE actor if approved | Yes |
| `fleet_score_*` | Score models/snapshots | Analytical | Driver IDs possible | High | Organization-private | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE subject if approved | Yes |
| `audit_events` | Actor reference | Audit data | Actor ID | High | Organization/platform | RETAIN | POLICY_DECISION_REQUIRED | PSEUDONYMIZE actor only through approved process | Yes |
| `route_session_events` | `route_sessions.id` | Route replay evidence | Possible | High | Organization-private | RESTRICT | POLICY_DECISION_REQUIRED | PSEUDONYMIZE actor if approved | Yes |
