# Production Backup Verification

Status: READY WITH LIMITATION.

## Result

The actual production database provider is verified as Render PostgreSQL.

Production database resource observed in the Render dashboard:

- Provider: Render PostgreSQL
- Resource name: `truck-safe-routing-db`
- Render service/resource ID: `dpg-d88mpah9rddc738jl2tg-a`
- Plan: `Basic-1gb`
- Region: Oregon (US West)
- PostgreSQL major version shown by Render: `18`
- Current status shown by Render: `available`

## Backup And Recovery Evidence

The Render dashboard Recovery page for `truck-safe-routing-db` showed Point-in-Time Recovery with the ability to restore from any timestamp in the past 3 days.

Render's current PostgreSQL documentation states that paid Render PostgreSQL databases are continuously backed up for point-in-time recovery, with a recovery window determined by workspace plan. It also states that PITR restores create a new database instance for validation before applications are pointed at the recovery instance.

Current dashboard evidence:

| Item | Verified result |
| --- | --- |
| Actual provider | Render PostgreSQL |
| Automated backups | Enabled through Render PostgreSQL PITR for this paid database plan |
| Most recent successful backup | Not shown as a discrete timestamp in the dashboard; PITR window is available |
| Backup frequency | Continuous PITR / write-ahead-log based recovery, not a visible daily backup row |
| PITR window | Past 3 days |
| Logical exports | Available on demand from the Recovery page |
| Existing logical exports | 0 export files visible |
| Logical export retention | At least 7 days after export creation |
| Restore option | Restore database from PITR into a new Render PostgreSQL instance |
| Restore into separate non-production database | Supported by PITR restore workflow; not executed in this phase |
| Encryption | Render documentation states PostgreSQL databases, replicas, and backups are encrypted at rest with AES-256; external connections use Render-managed TLS |
| Plan limitation | Current dashboard prompts that a Pro workspace increases the recovery window to 7 days; current available window is 3 days |

## Limitations

Restore readiness is not fully proven yet because no production backup or PITR point was restored into a separate non-production target during this phase.

The dashboard did not expose a discrete latest-backup timestamp. The available evidence is the active PITR recovery window and provider documentation for continuous paid Render PostgreSQL backups.

No logical export currently exists in the Recovery page export table. A logical export can be created separately if the owner approves a non-destructive export action and a secure storage destination.

## Required Next Action

Before production rollout GO, perform a separately approved restore rehearsal:

1. Select a recent PITR timestamp outside Render's minimum restore delay window.
2. Restore into a separate non-production Render PostgreSQL instance.
3. Validate PostgreSQL, PostGIS, schema migrations, representative counts, and application readiness against the restored target.
4. Do not restore over production.
5. Record restore duration, validation evidence, and rollback instructions.
