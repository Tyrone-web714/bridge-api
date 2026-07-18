# Database Migration

Migration: `010_enterprise_identity_foundation.sql`.

The migration is additive. It creates tenant-scoped identity provider, federated identity, verified domain, claim mapping, transaction, SCIM, break-glass, audit, and membership foundation tables.

Foreign keys use restrictive or history-preserving behavior. IdP deletion cannot cascade-delete operational history.

Validation result: migration 010 applied cleanly after migrations 001 through 009 on an isolated local PostgreSQL database.

Production migration 010 has not been applied.
