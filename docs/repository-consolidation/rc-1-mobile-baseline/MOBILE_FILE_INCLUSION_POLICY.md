# Mobile File Inclusion Policy

This policy defines what should be included in the initial mobile source-control baseline for `C:\dev\tsr-mobile`.

## Include

- Application source files under `src/app/`.
- Runtime assets required by the application, including icons, landing image, approved truck marker, truck sprite sets, and voice speaker assets.
- Expo and EAS source configuration: `app.json`, `app.config.js`, `eas.json`, `package.json`, and `package-lock.json`.
- Source-control support files: `.gitignore`, `.env.example`, `.github/workflows/security.yml`.
- Compliance and project documentation: `LICENSE`, `PROJECT_STATUS.md`, `ROAD_TEST_CHECKLIST.md`, `THIRD_PARTY_NOTICES.md`, and `compliance/` outputs.
- Build/config scripts and Expo plugins under `scripts/` and `plugins/`.

## Exclude

- `node_modules/` and other dependency caches.
- Expo local state and exports: `.expo/`, `.expo-export-*`, `dist/`, `web-build/`.
- Native generated folders: `/android`, `/ios`.
- Generated install/build artifacts: `*.apk`, `*.aab`, QR-code install images, preview images, contact sheets, and logs.
- Local environment files: `.env`, `.env.*`, and `.env*.local`, except `.env.example`.
- Signing credentials and private keys: `*.jks`, `*.p8`, `*.p12`, `*.key`, `*.mobileprovision`, `*.pem`.
- Legacy brand reference assets such as Arca/Coca-Cola images that are no longer part of the white-label baseline.

## Runtime Asset Boundary

Runtime PNGs must not be ignored broadly. The mobile app intentionally uses committed PNG runtime assets for icons, landing imagery, truck marker imagery, truck sprites, and voice-status controls.

## Unknown Files

RC-0 unknown-file findings were Git internals or local generated state, not source files proposed for staging. New unclassified source files should be reviewed before any baseline commit.
