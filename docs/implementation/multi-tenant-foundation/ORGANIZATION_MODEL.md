# Organization Model

The Organization is the tenant boundary for customer-owned operational data.

Minimum fields implemented:

- id
- name
- slug
- status
- created_at
- updated_at
- deleted_at

The bootstrap Organization is created idempotently as `Truck-Safe Routing Development`.

Platform-global reference data, including legally usable low-clearance bridge reference data and truck restriction reference data, is not owned by this bootstrap Organization.

Real companies such as Arca Continental, Sysco, Sigma, or any other customer must not be created until formal onboarding or pilot approval occurs.
