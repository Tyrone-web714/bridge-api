# Mobile Validation Results

## Backup Re-Verification

- RC-0 backup root: `C:\dev\truck-safe-routing-rc0-backups\20260710-205740`
- Mobile Git bundle: verified during RC-0 and rechecked during RC-1 context review.
- Full mobile filesystem backup: recorded by RC-0 Robocopy log with 27,751 files and 344.73 MB copied.

## Safe Validation Commands

Direct `npm run` execution is blocked by local PowerShell script execution policy for `npm.ps1`. Equivalent `npm.cmd` commands were used.

| Check | Result |
|---|---|
| `npm.cmd run verify:production` | Passed |
| `npm.cmd run verify:secrets` | Passed |
| `npm.cmd ls --depth=0` | Passed |
| JSON parse for `package.json`, `app.json`, and `eas.json` | Passed |
| `app.config.js` resolution | Passed |
| Required runtime assets present | Passed |
| Staged files check | Passed: none staged |

## Configuration Values Verified

- Android package: `com.nasih.trucksaferouting`
- EAS project ID: `4b7843f4-3d14-4c64-8223-39b06601c781`
- EAS build profiles: `development`, `preview`, `production`
- Preview/production backend URL: `https://truck-safe-routing-api.onrender.com`

## Not Performed

- No APK or AAB build was run.
- No deployment was performed.

## Post-Push Validation

| Check | Result |
|---|---|
| Mobile baseline commit | `d4ba8f3c090395765236d59e295ff642ef65cde1` |
| Branch | `master` |
| Upstream tracking | `master...origin/master` |
| Remote branch | `origin/master` verified |
| Recovery tag | `mobile-baseline-v1.0` verified remotely |
| Secret scan after commit | Passed |
| Generated artifacts | Excluded by `.gitignore` |
| Runtime assets | Preserved in Git index |
| Staged deletes | None |
| APK/AAB build | Not run |
| Deployment | Not run |
