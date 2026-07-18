# Session Lifecycle

Existing admin, driver, and warehouse session behavior remains in place.

Enterprise identity adds:

- Federated login transaction consumption
- IdP disablement session-version invalidation for mapped admin users
- SCIM deactivation disabling federated identities
- Organization lifecycle checks during federated authentication
- Internal user lifecycle checks during federated authentication

Stale federated sessions are not allowed to bypass TSR authorization.

