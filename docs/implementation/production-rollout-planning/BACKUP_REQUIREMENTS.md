# Backup Requirements

Production backup status: OPERATIONAL_VERIFICATION_REQUIRED.

Required before production migration:

- Full logical or provider-managed PostgreSQL backup.
- PostGIS-compatible restore path.
- Encrypted backup storage.
- Access control limited to approved operators.
- Backup timestamp and recovery point recorded.
- Retention policy confirmed by provider/owner.
- Restore target available.
- Restore validation performed or formally scheduled.
- Point-in-time recovery support verified if available from provider.

Do not claim a production backup exists until the provider backup dashboard, CLI, or restore evidence is reviewed.

Object storage:

- Verify bucket/provider versioning or equivalent recovery posture.
- Verify photo object access and restore process.
- Do not migrate or delete local photos without owner approval and post-migration open checks.
