# TSR Data Lifecycle Architecture

**Status:** ARCHITECTURE DESIGNED
**Governance:** ODR-019
**Implementation State:** Not implemented by this documentation package.

This package governs Truck-Safe Routing data lifecycle, deletion, retention, anonymization, legal hold, object-storage lifecycle, and referential-integrity behavior.

Read first:

1. [TSR Data Lifecycle Architecture](TSR_DATA_LIFECYCLE_ARCHITECTURE.md)
2. [Cascade Map](TSR_DATA_LIFECYCLE_AND_CASCADE_MAP.md)
3. [Retention Policy](TSR_DATA_RETENTION_POLICY.md)
4. [Implementation Plan](TSR_DATA_LIFECYCLE_IMPLEMENTATION_PLAN.md)
5. [Test Plan](TSR_DATA_LIFECYCLE_TEST_PLAN.md)

Cross-workstream dependency: Enterprise Identity lifecycle events must follow this package. SSO or SCIM deactivation removes access; it does not erase operational history.
