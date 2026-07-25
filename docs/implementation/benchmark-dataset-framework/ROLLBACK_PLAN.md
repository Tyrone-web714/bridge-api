# Rollback Plan

Rollback is repository-only: remove benchmark dataset source files, loaders, validators, generator/check tooling, templates, generated artifacts, documentation, package scripts, and any minimal status or registry documentation updates. Then rerun capability registry, IEP, AI, supervisor, tenant, security, and full test suites.

No database, cloud, object-storage, provider, credential, production-data, or migration rollback is required because this package does not change those systems.
