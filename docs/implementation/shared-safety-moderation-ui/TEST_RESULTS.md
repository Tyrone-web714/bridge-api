# Test Results

Status: Passed on `shared-safety-moderation-ui`.

Validation date: 2026-07-12.

Validation environment:

- Local branch: `shared-safety-moderation-ui`
- Database: isolated local PostgreSQL/PostGIS validation database on `127.0.0.1:55443`
- Validation database name: `tsr_shared_safety_ui_validation`
- Backend smoke port: `5075`
- Production data modified: no
- Production migration applied: no

Automated checks passed:

- `npm.cmd ci --dry-run`
- `npm.cmd test`
- `npm.cmd run test:auth-rbac`
- `npm.cmd run test:api-tenant`
- `npm.cmd run test:mobile-tenant`
- `npm.cmd run test:shared-safety`
- `npm.cmd run test:shared-safety-ui`
- `npm.cmd run validate:shared-safety`
- `npm.cmd run verify:secrets`
- `git diff --check`

Runtime smoke checks passed:

- `/health` returned `200`
- `/ready` returned `200`
- Platform Admin queue page rendered and contained `Shared Safety Moderation`
- Platform Admin candidate detail page rendered and contained `PRIVATE SOURCE`
- Missing CSRF token on correction action returned `403`
- Supervisor access to `/api/shared-safety/admin` returned `403`

Coverage notes:

- Moderation queue, filters, candidate detail, sanitization preview, moderation actions, audit trail, and Platform Admin navigation are covered by source-level contract checks.
- Runtime Shared Safety validation covers private submission isolation, sanitization controls, approval/rejection, correction request, duplicate marking, merge/link, supersede, retire, and sanitized shared-read privacy.
- The UI uses coordinate preview cards only; it does not cache or embed third-party map tiles.
