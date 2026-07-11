# Remaining Auth Security Work

Remaining work before merge or broader rollout:

- Expand permission middleware route-by-route across every Critical and High API path.
- Add full database-backed login success/failure security events.
- Add lockout counters for warehouse PIN failures.
- Add integration tests using an isolated PostgreSQL/PostGIS cluster.
- Add explicit Platform Admin support workflow audit events.
- Remove or disable legacy shared admin and driver token fallbacks in production.
- Verify mobile APK compatibility with the additive driver auth response fields.
