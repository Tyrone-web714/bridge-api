# Volume II — Multi-Tenant SaaS & Enterprise Security

## Purpose

This volume defines the mandatory architecture for multi-tenant operation, Organization isolation, authentication, authorization, RBAC, claims, shared safety intelligence, audit logs, and billing-ready SaaS structure.

## Organization model

Organization is the tenant boundary.

Every private business record belongs to exactly one Organization.

No user may belong to more than one Organization.

## Organization-private data

The following must be Organization-private:

- Users
- Drivers
- Supervisors
- Warehouse employees
- Dispatching responsibility assignments and permission records
- Vehicles
- Routes
- Stops
- Customers/accounts
- Driver notes
- Photos
- Delivery history
- Invoices/manifests
- KPIs
- Reports
- Dashboards
- AI predictions
- Audit logs
- Operational settings
- Billing metadata

## Server-side enforcement

Frontend filtering is not security.

Every private API endpoint must enforce `organization_id` server-side.

## Roles

Approved platform roles:

- Platform Admin
- Organization Admin
- Supervisor
- Driver
- Warehouse Employee

Do not model Dispatcher, Regional Manager, Depot Manager, Safety Manager, Executive Viewer, Auditor, Maintenance Staff, Customer Service, or External Inspector as independent roles. Reclassify those historical titles as functional responsibilities or permission sets assigned to one of the approved roles.

Functional responsibilities may include:

- Dispatching
- Safety Management
- Regional Oversight
- Depot Operations

Permission sets may include:

- Executive Dashboard Access
- Audit Access
- Hazard Review
- KPI Management
- Route Dispatch
- Report Export
- Fleet Analytics
- Read-Only Executive Reporting

## Permission model

Roles group permissions. Permissions authorize actions.

Use deny-by-default authorization.

Roles answer "Who is the user?" Permissions answer "What is the user allowed to do?"

Authorization shall follow least privilege. Backend access decisions must be enforced through explicit permissions and Organization context, not role names alone.

No Organization-level role may access another Organization's private data.

## Warehouse authentication

Warehouse employees shall authenticate using at least two factors of knowledge or possession before performing warehouse operations that affect operational records.

Approved examples include Employee ID + PIN, Employee ID + Badge, Employee ID + Password, Badge + PIN, or another equivalent multi-factor workflow appropriate for the customer's operational environment.

The specific authentication technology may vary by Organization. Truck-Safe Routing shall support multiple warehouse authentication mechanisms without changing the core authorization model.

Warehouse employees may perform only warehouse-authorized operational workflows, including truck loading confirmation, inventory confirmation, manifest confirmation, return verification, warehouse documentation, and authorized printing operations.

Warehouse employees shall not receive administrative privileges.

Authentication confirms identity. Authorization determines what actions the authenticated user may perform.

All warehouse actions shall execute within the authenticated user's Organization context. All significant warehouse operations shall be audit logged.

## Shared truck safety intelligence

Guiding principle: "The platform shares knowledge, not customer operations."

Safety data may be shared only after review, approval, and sanitization.

Shared safety data may include:

- Low-clearance bridges
- Truck restrictions
- Weight restrictions
- Height restrictions
- No-through-truck zones
- Road closures affecting commercial vehicles
- Construction affecting truck routing
- Hazardous intersections
- Dangerous turns
- Unsafe loading entrances
- Unsafe parking locations for commercial vehicles
- Verified GPS coordinates of truck hazards
- Approved hazard photos stripped of Organization-identifying information
- Other approved truck-safety intelligence determined to benefit all Organizations

Shared safety data must not leak:

- Driver names
- Driver identifiers
- User accounts
- Customer names
- Customer addresses unless already public reference data
- Customer-specific account data
- Delivery manifests
- Route assignments
- Company-specific routes
- Delivery notes
- Driver performance
- Company notes
- Sales information
- Receipts
- Photos
- Videos
- Internal comments
- Organization KPIs
- Operational metrics
- Private AI recommendations
- Invoices
- Manifests
- Supervisor comments
- Any Organization-specific operational data

## Safety review workflow

1. Driver or Organization submits safety observation.
2. Organization review may approve internally.
3. Platform Admin reviews for global safety layer.
4. Platform Admin may approve, reject, edit, merge, mark duplicate, or archive.
5. Only approved sanitized records become globally visible.
6. No Organization receives direct access to another Organization's private operational data.

## Billing-ready Organization fields

- organization_id
- organization_name
- plan_type
- subscription_status
- billing_contact_name
- billing_contact_email
- max_users
- max_drivers
- max_vehicles
- enabled_features
- trial_status
- trial_end_date
- renewal_date
- external_billing_customer_id
- status
- created_at
- updated_at

## Security rules

- Zero Trust
- Least Privilege
- Defense in Depth
- Immutable audit logs
- Encryption in transit
- Secrets never committed to source control
- Tenant isolation cannot be weakened for convenience

## Retention governance

Truck-Safe Routing shall use category-based retention, not a single global retention setting.

Retention categories:

- Operational Retention
- Analytical Retention
- Backup Retention

Platform-controlled retention applies to platform audit logs, security logs, Shared Safety Intelligence, platform-global reference data, low-clearance bridge data, and truck restriction reference data.

Organization-configurable retention applies to route history, delivery history, driver performance history, delivery photos, Organization operational reports, Organization analytics, and Organization-generated documents.

Organizations may choose different retention periods for Organization-owned operational data. Platform-wide reference data and platform audit/security records remain under Platform Admin control.

AI-related retention shall preserve explainability while avoiding unnecessary long-term storage of intermediate inference artifacts.

Retention policy must support future legal, regulatory, contractual, and customer-specific requirements without schema redesign.
