# Data Operations Runbook

## Export

1. Confirm the requester, customer scope, legal basis, and date range.
2. Export only the required driver, route, delivery, receipt, photo metadata,
   GPS event, and audit records.
3. Store the export in an encrypted, access-controlled temporary location.
4. Record requester, operator, filters, row counts, checksums, and expiration.

## Deletion

1. Confirm identity, authority, customer scope, legal holds, and dependent data.
2. Export a pre-deletion manifest containing IDs and counts, not secret content.
3. Delete object-storage photos before deleting their database metadata.
4. Delete or anonymize route events, notes, signatures, receipts, and identities
   according to the approved request.
5. Verify zero remaining records and record completion in the audit log.

## Backup and Restore

- Use provider-managed encrypted PostgreSQL backups with point-in-time recovery
  enabled for production.
- Enable object-storage versioning or an equivalent recovery policy.
- Test restoration into an isolated non-production environment quarterly.
- Never restore production personal data into developer laptops.
- Record recovery point, recovery time, checksum verification, and approver.

## Database Migrations

- Startup schema creation remains a compatibility safeguard, not the production
  migration process.
- Every schema change must receive a numbered, idempotent migration under
  `migrations/`, review, backup confirmation, and rollback notes.
- Apply migrations to staging first, then production as a discrete release step.
- Do not make destructive column/table changes without a tested data migration.
