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
- Dispatchers
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

Minimum roles:

- Platform Owner
- Platform Administrator
- Organization Administrator
- Regional Manager
- Depot/Terminal Manager
- Supervisor
- Dispatcher
- Safety Manager
- Driver
- Executive Viewer
- Auditor

## Permission model

Roles group permissions. Permissions authorize actions.

Use deny-by-default authorization.

## Shared truck safety intelligence

Safety data may be shared only after review and approval.

Shared safety data may include:

- Low-clearance bridges
- Truck restrictions
- No-through-truck zones
- Construction hazards
- Road closures
- Dangerous intersections
- Tight turns
- Low tree limbs

Shared safety data must not leak:

- Customer names
- Customer-specific account data
- Route assignments
- Driver performance
- Company notes
- Invoices
- Manifests
- Supervisor comments

## Safety review workflow

1. Driver or Organization submits safety observation.
2. Organization review may approve internally.
3. Platform Admin reviews for global safety layer.
4. Platform Admin may approve, reject, edit, merge, mark duplicate, or archive.
5. Only approved sanitized records become globally visible.

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
