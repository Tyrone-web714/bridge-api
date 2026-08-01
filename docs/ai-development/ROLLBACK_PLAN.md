# Rollback Plan

Rollback is source-control only.

Remove:

- `docs/ai-development/`
- `bridge-api/scripts/check-ai-development-roadmap.cjs`
- `bridge-api/scripts/generate-ai-development-roadmap-artifacts.cjs`
- AI roadmap scripts from `bridge-api/package.json`
- the narrow `PROJECT_STATUS.md` workflow update

No database, object storage, Cloudflare/R2, provider, deployment, migration, or production rollback is required.
