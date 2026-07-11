# Recommended Target Structure

## Recommended Final Layout

```text
truck-safe-routing/
  apps/
    api/
    mobile/
  packages/
    shared-types/
    api-client/
  docs/
  scripts/
  package.json
  README.md
  PROJECT_STATUS.md
```

## Conservative Transition Layout

For the first consolidation pass, preserve the existing backend folder and Render root until validation completes:

```text
bridge-api/
  bridge-api/              # existing backend app, temporarily unchanged
  apps/
    mobile/                # imported mobile app
  docs/
  PROJECT_STATUS.md
  render.yaml              # existing root Render blueprint with rootDir: bridge-api
```

After validation, a later approved phase can rename:

- `bridge-api/bridge-api` -> `apps/api`
- `apps/mobile` remains stable
- repository `bridge-api` -> `truck-safe-routing`

## Why Backend Should Not Move First

Backend has many path-sensitive references:

- `routes/bridges.js` loads `../data/low_clearance_bridges.json`.
- `routes/routing.js` requires `../data/low_clearance_bridges.json`.
- migration runner reads `../migrations`.
- photo storage defaults to `../data/delivery_note_photos`.
- multiple scripts resolve paths from `__dirname`.
- Dockerfile assumes package files and app source in the build root.
- Render currently expects `rootDir: bridge-api`.

Immediate backend relocation is feasible but not the safest first consolidation step.

## Workspace And Package Management

Recommendation: keep npm and app-local lockfiles during consolidation.

Reasons:

- Backend already uses npm and `package-lock.json`.
- Mobile already uses npm and `package-lock.json`.
- Expo/EAS and native React Native dependencies are most predictable when the mobile app remains self-contained.
- Changing to pnpm or Yarn would add a package-manager migration on top of repository migration without a clear safety benefit.

Initial root workspace strategy:

- Do not add a root workspace manager until backend and mobile both validate in their target folders.
- If orchestration becomes necessary, use npm workspaces because both apps already use npm.
- Keep root scripts as wrappers only; do not make production backend startup depend on root scripts.

Potential later root package:

```json
{
  "private": true,
  "workspaces": [
    "apps/api",
    "apps/mobile",
    "packages/*"
  ]
}
```

Node/runtime considerations:

- Backend declares Node `>=18`; Docker uses Node 20.
- Mobile Expo 55 / React Native 0.83 should be validated with the Node version supported by Expo/EAS.
- Do not force one root Node version until both app toolchains pass validation.
