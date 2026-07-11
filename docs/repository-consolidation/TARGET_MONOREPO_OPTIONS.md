# Target Monorepo Options

## Option A: Convert Existing Backend Repository Into Monorepo

Use `C:\dev\bridge-api` / `Tyrone-web714/bridge-api` as the base repository, then reorganize into monorepo form.

Benefits:

- Preserves backend Git history naturally.
- Keeps current GitHub remote and permissions during transition.
- Minimizes Render disruption because existing root `render.yaml` already supports `rootDir: bridge-api`.
- Governing docs are already in this repo.
- Lowest operational risk for backend deployment.

Risks:

- Repository name remains backend-oriented until rename.
- Backend folder relocation can break `__dirname` and package-script assumptions if done too early.
- Mobile history preservation requires careful import.

## Option B: Create New Clean Monorepo

Create a new `truck-safe-routing` repository and import backend plus mobile.

Benefits: clean name and structure from day one.

Risks: more complex history import, new remote, Render reconnection, and higher cutover risk.

## Option C: Coordinated Repositories With Separate Platform Repository

Keep backend and mobile separate; create a platform/docs repo to coordinate architecture, shared contracts, and releases.

Benefits: least code disruption.

Risks: does not satisfy consolidation preference and raises drift risk during tenant work.

## Recommendation

Choose Option A with a staged transition:

1. Preserve mobile and create a mobile baseline.
2. Keep existing backend repository as source-of-truth history.
3. Add mobile under the same repository only after backup and validation.
4. Rename GitHub repository to `truck-safe-routing` only after Render, local paths, and mobile build paths are proven.

## Target Repository Decision

Recommended GitHub repository name:

- Transition: keep `Tyrone-web714/bridge-api`.
- Final: rename to `Tyrone-web714/truck-safe-routing` after validation.

Recommended visibility:

- Private during consolidation and pilot preparation unless the owner explicitly approves public release.

Recommended local root:

- Transition: `C:\dev\bridge-api`.
- Final optional rename: `C:\dev\truck-safe-routing` only after remote rename, Render validation, and fresh clone verification.

Default branch:

- `main`.

Remote strategy:

1. Keep `origin` pointing to `https://github.com/Tyrone-web714/bridge-api.git` during implementation.
2. Validate monorepo layout and deployment.
3. Rename GitHub repository to `truck-safe-routing` or create redirect after validation.
4. Update local `origin` only after GitHub rename succeeds.
5. Archive or redirect temporary mobile repository after monorepo cutover.
