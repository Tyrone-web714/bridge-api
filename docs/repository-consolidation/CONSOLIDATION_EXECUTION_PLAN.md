# Consolidation Execution Plan

## Phase RC-0 - Backups And Evidence Capture

- Objective: capture backend/mobile/deployment state.
- Files affected: none.
- Commands: `git status`, `rev-parse HEAD`, mobile diff/untracked inventory, filesystem backup.
- Risks: incomplete evidence.
- Rollback: no changes.
- Tests: verify backup files exist.
- Exit criteria: backend commit, mobile inventory, Render deploy ID, and EAS build ID recorded.
- Owner approval: required.

## Phase RC-1 - Mobile Source-Control Baseline

- Objective: preserve mobile source and create clean baseline.
- Files affected: mobile repo after backup.
- Commands: update ignore rules, stage source/assets/config, commit, push to temporary private remote.
- Risks: losing untracked work or committing artifacts.
- Rollback: restore mobile backup.
- Tests: `npm ci`, `npm run verify:production`.
- Exit criteria: mobile clean baseline commit and backup verified.
- Owner approval: required.

## Phase RC-2 - Target Repository Preparation

- Objective: create consolidation branch in backend repo.
- Files affected: none initially.
- Commands: `git switch -c repo-consolidation/monorepo`.
- Risks: branch confusion.
- Rollback: switch back to `main`.
- Tests: `git status --short`.
- Exit criteria: branch from clean baseline.
- Owner approval: required.

## Phase RC-3 - Backend Relocation, If Required

- Objective: decide whether to keep `bridge-api/` temporarily or move to `apps/api`.
- Files affected: backend paths only if approved.
- Commands: `git mv bridge-api apps/api` only in later approved implementation.
- Risks: Docker, Render, scripts, data, migrations, static paths break.
- Rollback: revert branch.
- Tests: backend full validation.
- Exit criteria: backend passes before mobile import.
- Owner approval: required.

## Phase RC-4 - Mobile Import

- Objective: import mobile under monorepo.
- Files affected: `apps/mobile/`.
- Commands: copy from mobile baseline or subtree import after decision.
- Risks: generated artifacts, secrets, broken Expo paths.
- Rollback: remove import commit or revert branch.
- Tests: mobile full validation.
- Exit criteria: mobile app starts and EAS config validates from new path.
- Owner approval: required.

## Phase RC-5 - Workspace Configuration

- Objective: add minimal root orchestration.
- Files affected: root `package.json`, possibly `.gitignore`.
- Commands: create root package with npm workspaces only if needed.
- Risks: package manager conflicts.
- Rollback: remove root workspace changes.
- Tests: app-local installs and scripts still pass.
- Exit criteria: backend/mobile independently buildable.
- Owner approval: required.

## Phase RC-6 - Path And Deployment Corrections

- Objective: correct only paths proven broken.
- Files affected: Render root, Dockerfile, scripts, docs only as needed.
- Commands: targeted patches.
- Risks: deployment regression.
- Rollback: restore previous Render root and app paths.
- Tests: Docker/Render/backend/mobile validation.
- Exit criteria: deployment path works.
- Owner approval: required.

## Phase RC-7 - Validation

- Objective: run all validation gates.
- Files affected: none unless fixing approved issues.
- Commands: backend/mobile validation commands.
- Risks: false confidence without deployed checks.
- Rollback: stop before cutover.
- Tests: all gates in `VALIDATION_PLAN.md`.
- Exit criteria: all required checks pass.
- Owner approval: required.

## Phase RC-8 - Documentation Updates

- Objective: update docs for final repo structure.
- Files affected: docs and project status.
- Commands: documentation patches.
- Risks: docs ahead of implementation.
- Rollback: revert docs commit.
- Tests: link validation and repo inventory.
- Exit criteria: docs match actual repo state.
- Owner approval: required.

## Phase RC-9 - Cutover And Archive Strategy

- Objective: rename repo or redirect/archive old repos after validation.
- Files affected: GitHub repo settings, remotes, Render connection, docs.
- Commands: GitHub rename/update remote after owner approval.
- Risks: broken Render/GitHub links and mobile build references.
- Rollback: restore old remote/name or keep redirect.
- Tests: fresh clone, deploy, EAS build.
- Exit criteria: new repo is authoritative and old repos archived/read-only or redirected.
- Owner approval: required.
