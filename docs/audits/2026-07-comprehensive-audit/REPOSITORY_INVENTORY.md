# Repository Inventory

## Backend / Documentation Repository

- Root: `C:\dev\bridge-api`
- Branch: `main`
- Remote: `https://github.com/Tyrone-web714/bridge-api.git`
- Backend app: `bridge-api/`
- Documentation: `docs/`
- Current audit-time status: pre-existing modified architecture docs, untracked `PROJECT_STATUS.md`, and new audit docs.

## Major Backend Folders

| Folder | Purpose | Risk |
| --- | --- | --- |
| `bridge-api/routes` | Express route handlers and server-rendered pages. | Large files, mixed API/UI/business logic. |
| `bridge-api/services` | Auth, AI, audit log, storage, prediction/intelligence helpers. | Needs tenant context propagation. |
| `bridge-api/db` | Postgres initialization and repositories. | Central migration risk; no org keys verified. |
| `bridge-api/migrations` | SQL migrations. | Tenant migration missing. |
| `bridge-api/data` | Static/reference datasets. | Licensing, freshness, size review needed. |
| `bridge-api/scripts` | Verification, migration, compliance helpers. | Useful gates; production check fails locally. |
| `docs` | Governing docs and audit output. | Must remain aligned with implementation. |

## Mobile Repository

- Root: `C:\dev\tsr-mobile`
- Branch: `master`
- Remote: none configured.
- Dirty state: many modified/untracked files and APK QR artifacts.
- Not contained in `bridge-api` GitHub repository.

## Older/Experimental Local Projects

- `C:\dev\truck-safe-routing`: Vite/React folder; no active source-of-truth evidence.
- `C:\dev\truck-safe-routing-mobile`: older Expo project; no visible remote; not active source of truth.
