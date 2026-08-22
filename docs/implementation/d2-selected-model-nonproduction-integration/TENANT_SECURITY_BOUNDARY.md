# Tenant And Security Boundary

Selected-D2 execution uses TSR authorization and tenant helpers.

Requirements:

- authenticated request context;
- organization context;
- `intelligence.view` permission;
- request organization matches evidence organization;
- no cross-organization evidence mixing;
- no model authority to elevate permissions or change RBAC.

The service rejects tenant mismatch with existing tenant-isolation behavior.
