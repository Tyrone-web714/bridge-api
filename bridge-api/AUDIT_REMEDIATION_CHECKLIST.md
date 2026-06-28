# Truck-Safe Routing Audit Remediation Checklist

Date: 2026-06-28

## Critical - Blocks Sale/Pilot

- [x] Create a neutral/white-label commercial demo build.
- [x] Remove or replace Coca-Cola, Coke, Arca Continental, CCSWB, branded truck, and product trade-dress assets from any external build.
- [x] Replace `C:\dev\bridge-api\bridge-api\data\route-manifest-2026-06-20-827826.csv` with fully synthetic test data or keep it out of any shared package.
- [x] Remove real-looking customer names, addresses, invoices, driver names, and company-specific route data from runtime demos and fixtures.
- [x] Resolve or formally triage mobile `npm audit` critical `shell-quote` advisory.
- [~] Google Maps Platform review in progress. Engineering storage, cache, and
  attribution controls are documented in `GOOGLE_MAPS_COMPLIANCE.md`; counsel,
  heavy-vehicle permission, route-session retention, public terms/privacy, and
  key-restriction review remain release blockers.
- [ ] Confirm Google Cloud key restrictions for Android Maps SDK and server-side APIs.
- [x] Document Google-derived data retention and purge behavior.

## High - Must Fix Before Serious Customer Review

- [x] Remove unused backend `localtunnel` dev dependency or replace/patch its vulnerable dependency chain.
- [x] Update backend dependency chain for `express`, `qs`, `form-data`, `path-to-regexp`, `minimatch`, and related advisories.
- [x] Triage mobile Expo/React Native audit advisories; critical/high transitive packages are overridden, while remaining toolchain advisories require a compatible Expo/React Native release.
- [x] Add backend rate limiting for auth, driver APIs, Places proxy, uploads, and AI endpoints.
- [x] Limit production request body size by endpoint.
- [x] Disable or restrict mobile cleartext network security in production.
- [x] Add photo upload content validation and abuse controls.
- [x] Create privacy and retention policy for driver location, photos, signatures, receipts, AI logs, and customer/account/order data.
- [x] Create customer/pilot data-processing agreement requirements. Signed customer/counsel approval remains external.
- [x] Document source/license/attribution for OSM/Overpass-generated zone datasets.
- [x] Document source/license/attribution for low-clearance bridge dataset.

## Medium - Fix Before Production

- [x] Add application `LICENSE` or proprietary/internal-use notice.
- [x] Generate a full SBOM for backend and mobile from lockfiles.
- [x] Expand third-party notices using a repeatable license generation process.
- [x] Review `node-forge@1.4.0` under BSD-3-Clause and remove backend `buffers@0.1.1` by updating its dependency chain.
- [~] Runtime truck art is neutral; external commercial use remains blocked until creator/source rights are recorded in `ASSET_PROVENANCE.md`.
- [x] Add data deletion/export procedure.
- [x] Add backup/restore documentation.
- [x] Add numbered migration/versioning discipline beyond startup schema creation.
- [x] Add persistent audit logging for successful supervisor/admin mutations.
- [x] Review per-driver/per-device authentication model beyond shared driver API token; short-lived per-device credentials remain a post-pilot architecture change.
- [x] Review AI prompt/result logging for confidential customer data.

## Low - Document/Monitor

- [x] Keep `.env` and secret scanning in CI.
- [x] Keep Google keys out of committed source.
- [x] Keep Render/EAS environment variables documented without values.
- [x] Update dependency notices on each release.
- [x] Preserve Git history, build logs, AI configuration records, and release artifacts for diligence.

## Verification Steps

- [x] Run backend `npm.cmd run test`.
- [x] Run backend `npm.cmd audit --json`.
- [x] Run backend `npm.cmd run verify:secrets`.
- [x] Run mobile `npm.cmd run verify:production`.
- [x] Run mobile `npm.cmd audit --json`.
- [x] Run mobile `npm.cmd run verify:secrets`.
- [x] Build a white-label APK and verify no branded assets/text appear.
- [ ] Verify Google Cloud API key restrictions in Google Cloud Console.
- [x] Verify Render `/health` and `/ready` after dependency/security changes.
