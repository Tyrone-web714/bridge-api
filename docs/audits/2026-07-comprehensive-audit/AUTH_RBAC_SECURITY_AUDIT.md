# Authentication, Authorization, RBAC, and Security Audit

## Current Mechanisms

- Admin sessions in `bridge-api/services/adminAuth.js`.
- Driver sessions/token in `bridge-api/services/driverAuth.js` and `routes/driverSessions.js`.
- Admin and admin-role checks in selected routes.
- Mutation audit middleware in `server.js`.
- Rate limiting in `middleware/securityControls.js`.

## Findings

- TSR-AUD-004 High: no verified Organization claim in admin/driver session context. Related requirement: Volume II claims and tenant isolation. Phase 3.
- High: current roles are not yet the target permission model with Organization-scoped RBAC.
- Medium: CSRF protection for server-rendered admin forms was not verified.
- Medium: MFA, SSO, account lockout, password reset, and device trust are unknown.
- Medium: public Places/bridge/hazard endpoints need abuse and terms review.

## Command Results

Backend secret audit passed. Mobile secret audit passed. Backend npm audit found 0 vulnerabilities. Mobile npm audit found 1 low and 11 moderate advisories.
