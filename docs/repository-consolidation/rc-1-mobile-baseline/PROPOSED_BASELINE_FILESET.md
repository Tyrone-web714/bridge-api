# Proposed Baseline Fileset

This is the proposed first mobile source-control baseline for `C:\dev\tsr-mobile`.

## Proposed Commit Message

`Establish active mobile application baseline`

## Tracked Modified Files Proposed For Staging

- `.gitignore`
- `App.js`
- `app.json`
- `assets/android-icon-background.png`
- `assets/android-icon-foreground.png`
- `assets/android-icon-monochrome.png`
- `assets/icon.png`
- `eas.json`
- `package-lock.json`
- `package.json`

## New Source And Configuration Files Proposed For Staging

- `.env.example`
- `.github/workflows/security.yml`
- `LICENSE`
- `PROJECT_STATUS.md`
- `ROAD_TEST_CHECKLIST.md`
- `THIRD_PARTY_NOTICES.md`
- `app.config.js`
- `plugins/withTruckSafeNetworkSecurity.js`
- `scripts/`
- `src/app/`

## Runtime Assets Proposed For Staging

- `assets/landing-truck-hero.png`
- `assets/truck-marker-3d.png`
- `src/assets/truck-sprites-approved/`
- `src/assets/truck-sprites-native/`
- `src/assets/voice-off-speaker.png`
- `src/assets/voice-on-speaker.png`

## Compliance Files Proposed For Staging

- `compliance/tsr-mobile-licenses.json`
- `compliance/tsr-mobile-sbom.cdx.json`
- `compliance/tsr-mobile-third-party-notices.md`

## Files Proposed For Exclusion

- `.env` and all non-example environment files.
- `node_modules/`, `.expo/`, `.expo-export-*`, `dist/`, `web-build/`.
- `*.apk`, `*.aab`, generated QR-code install images, generated preview images, contact sheets, and logs.
- Signing credentials and private key material.
- Legacy brand reference assets excluded by `.gitignore`.

## Unknown Files Requiring Review

None identified outside Git internals and local generated/build state.

## Current Staged Files

```text
(none)
```
