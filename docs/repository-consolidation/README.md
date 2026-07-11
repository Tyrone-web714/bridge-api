# Repository Consolidation Planning Package

## Status

Planning only. Do not execute consolidation from this package without owner approval.

## Objective

Design the safest path to one authoritative Truck-Safe Routing monorepo containing backend/API, server-rendered supervisor/admin dashboard, active Expo mobile app, governing documentation, tests, scripts, deployment configuration, and only those shared packages that provide clear value.

## Current Authoritative Sources

| Area | Current location | Status |
| --- | --- | --- |
| Backend/API/dashboard/database/deployment/docs | `C:\dev\bridge-api` | Git repo on `main`, remote `https://github.com/Tyrone-web714/bridge-api.git`, clean at inspection time. |
| Backend app folder | `C:\dev\bridge-api\bridge-api` | Active Node/Express app. |
| Mobile app | `C:\dev\tsr-mobile` | Active Expo app, dirty working tree, no remote configured. |
| Older folders | `C:\dev\truck-safe-routing`, `C:\dev\truck-safe-routing-mobile` | Not authoritative unless later evidence proves otherwise. |

## Recommended Model

Use the existing `bridge-api` repository history as the base monorepo and transition it into a `truck-safe-routing` repository after validation. Import mobile only after full backup and a clean mobile baseline commit.

## Recommended Long-Term Structure

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

The initial execution should be conservative: keep backend deployment working from its current root until all deployment paths are proven.
