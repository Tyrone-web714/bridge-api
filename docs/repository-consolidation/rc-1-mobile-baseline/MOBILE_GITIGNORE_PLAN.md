# Mobile Gitignore Plan

The mobile `.gitignore` should support a clean source baseline while preserving required runtime assets.

## Required Ignore Rules

- Dependencies: `node_modules/`
- Expo local state and exports: `.expo/`, `.expo-export-*`, `dist/`, `web-build/`
- Generated native folders: `/android`, `/ios`
- Build artifacts: `*.apk`, `*.aab`
- Generated install and preview assets: `truck-safe-routing-*-apk-qr.png`, `truck-marker-current-preview.png`, `truck-sprite-contact-sheet.png`
- Logs: `*.log`, `npm-debug.*`, `yarn-debug.*`, `yarn-error.*`
- Local environment files: `.env`, `.env.*`, `.env*.local`, with `!.env.example`
- Signing credentials and key material: `*.jks`, `*.p8`, `*.p12`, `*.key`, `*.mobileprovision`, `*.pem`
- Legacy brand reference assets: `assets/arca-continental-logo.png`, `assets/coca-cola-*`, `src/assets/truck-coca-cola-*`

## Current Status

The working tree contains a `.gitignore` update that implements the RC-1 protection rules. This is a source-control support change only and does not alter app runtime behavior.

## Important Constraint

Do not ignore all PNG files. The mobile app intentionally uses committed PNG runtime assets for icons, landing imagery, truck marker imagery, truck sprites, and voice-status controls.
