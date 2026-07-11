# Mobile Preservation Plan

## Objective

Preserve the current mobile app exactly before consolidation. No mobile file may be deleted, moved, renamed, or normalized before backup and inventory verification.

## Required Evidence Capture

```powershell
git -C "C:\dev\tsr-mobile" status --short
git -C "C:\dev\tsr-mobile" diff > "<backup-root>\tsr-mobile.diff"
git -C "C:\dev\tsr-mobile" ls-files --others --exclude-standard > "<backup-root>\tsr-mobile-untracked.txt"
Get-ChildItem -Path "C:\dev\tsr-mobile" -Force -Recurse | Select-Object FullName,Length,LastWriteTime > "<backup-root>\tsr-mobile-file-inventory.txt"
```

## Full Filesystem Backup

```powershell
Copy-Item -LiteralPath "C:\dev\tsr-mobile" -Destination "<backup-root>\tsr-mobile-YYYYMMDD-HHMMSS" -Recurse -Force
```

Do not exclude files from the first backup. Excluding `node_modules` or `.expo` can happen only in a second lightweight archive.

## Must Commit After Review

- `App.js`, `index.js`, `src/`
- `app.json`, `app.config.js`, `eas.json`
- `package.json`, `package-lock.json`
- `.gitignore`, `.env.example`, `.github/`
- `scripts/`, `plugins/`, `compliance/`
- `assets/` used by app
- `LICENSE`, `THIRD_PARTY_NOTICES.md`, `ROAD_TEST_CHECKLIST.md`, `PROJECT_STATUS.md`

## Generated Artifacts To Exclude

- `.expo/`, `.expo-export-*`
- QR PNG files
- APK/AAB files
- preview screenshots/contact sheets
- logs and caches
- `node_modules/`
- `.env`

## Mobile Baseline Strategy

1. Preserve full backup.
2. Export status, diff, untracked inventory, and file inventory.
3. Review source vs generated classifications.
4. Update ignore rules.
5. Stage source, runtime assets, config, scripts, plugins, compliance docs, and package lock.
6. Commit on mobile repo before import.
7. Push to an approved private GitHub remote or preserve a Git bundle if remote approval is still pending.

## Rollback

If consolidation fails, restore `C:\dev\tsr-mobile` from timestamped backup or checkout the mobile baseline commit. Continue EAS builds from the preserved mobile repo.
