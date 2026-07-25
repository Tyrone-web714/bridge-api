# Rollback Plan

Rollback is source-only:

1. Restore the prior `services/intelligenceExecution/capabilityRegistry.js` implementation.
2. Remove `services/intelligenceExecution/enterpriseCapabilityRegistry.js`.
3. Remove capability registry generator and check scripts.
4. Remove generated registry artifacts.
5. Remove this documentation package.
6. Restore package-script changes.
7. Run existing IEP, AI, supervisor, tenant, and security tests.

No database, cloud, object-storage, provider, or production rollback is required because none is changed by this package.
