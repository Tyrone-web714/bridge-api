# Pilot Wave 1 Environment Readiness

Status: BLOCKED BY OWNER/INFRASTRUCTURE INPUTS

Wave 1 adds a non-secret environment readiness checker:

`npm.cmd run pilot-env:check`

The checker validates configuration presence and shape only. It does not print secret
values, create database records, deploy infrastructure, migrate, or activate AI providers.

## Current Local Meaning

Local development may remain blocked because pilot-specific values are intentionally absent.
That is not a code defect.

Expected local blockers include:

- `DATABASE_URL` missing or placeholder-like
- `CORS_ORIGIN` missing until an approved browser/admin origin exists
- missing HTTPS pilot API URL
- missing Google Maps pilot key
- missing admin/session/driver secrets
- missing durable media settings if photos/media are in pilot scope

## Closed Wave 0 Finding

The stale production-rollout validator finding is closed for repository validation because
the validator now recognizes legitimate migrations 011 and 012 and has regression coverage.

## Still Open

- Actual pilot environment configuration.
- Owner decisions for backend host, database provider/tier, CORS origin, mobile API endpoint,
  object storage, maps project/quota, and secret storage.
- Backup/PITR and restore rehearsal.
- Safe disposable execution of `validate:pilot-integration`.
- APK and field verification.
