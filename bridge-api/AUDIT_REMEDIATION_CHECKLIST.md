# Truck-Safe Routing Audit Remediation Checklist

Date: 2026-06-24

## Critical - Blocks Sale/Pilot

- [ ] Create a neutral/white-label commercial demo build.
- [ ] Remove or replace Coca-Cola, Coke, Arca Continental, CCSWB, branded truck, and product trade-dress assets from any external build.
- [ ] Replace `C:\dev\bridge-api\bridge-api\data\route-manifest-2026-06-20-827826.csv` with fully synthetic test data or keep it out of any shared package.
- [ ] Remove real-looking customer names, addresses, invoices, driver names, and company-specific route data from demos and docs.
- [ ] Resolve or formally triage mobile `npm audit` critical `shell-quote` advisory.
- [~] Google Maps Platform review in progress. Engineering storage, cache, and
  attribution controls are documented in `GOOGLE_MAPS_COMPLIANCE.md`; counsel,
  heavy-vehicle permission, route-session retention, public terms/privacy, and
  key-restriction review remain release blockers.
- [ ] Confirm Google Cloud key restrictions for Android Maps SDK and server-side APIs.
- [ ] Document Google-derived data retention and purge behavior.

## High - Must Fix Before Serious Customer Review

- [ ] Remove unused backend `localtunnel` dev dependency or replace/patch its vulnerable dependency chain.
- [ ] Update backend dependency chain for `express`, `qs`, `form-data`, `path-to-regexp`, `minimatch`, and related advisories.
- [ ] Triage mobile Expo/React Native audit advisories and schedule compatible upgrades.
- [ ] Add backend rate limiting for auth, driver APIs, Places proxy, uploads, and AI endpoints.
- [ ] Limit production request body size by endpoint.
- [ ] Disable or restrict mobile cleartext network security in production.
- [ ] Add photo upload content validation and abuse controls.
- [ ] Create privacy and retention policy for driver location, photos, signatures, receipts, AI logs, and customer/account/order data.
- [ ] Create customer/pilot data-processing agreement requirements.
- [ ] Document source/license/attribution for OSM/Overpass-generated zone datasets.
- [ ] Document source/license/attribution for low-clearance bridge dataset.

## Medium - Fix Before Production

- [ ] Add application `LICENSE` or proprietary/internal-use notice.
- [ ] Generate a full SBOM for backend and mobile from lockfiles.
- [ ] Expand `THIRD_PARTY_NOTICES.md` using a repeatable license generation process.
- [ ] Review `node-forge@1.4.0` dual license and backend `buffers@0.1.1` unknown license metadata.
- [ ] Replace generated/uploaded truck art with original neutral assets.
- [ ] Add data deletion/export procedure.
- [ ] Add backup/restore documentation.
- [ ] Add migration/versioning discipline beyond startup schema creation.
- [ ] Add audit logging for supervisor/admin changes.
- [ ] Review per-driver/per-device authentication model beyond shared driver API token.
- [ ] Review AI prompt/result logging for confidential customer data.

## Low - Document/Monitor

- [ ] Keep `.env` and secret scanning in CI.
- [ ] Keep Google keys out of committed source.
- [ ] Keep Render/EAS environment variables documented without values.
- [ ] Update dependency notices on each release.
- [ ] Preserve Git history, build logs, AI prompt history, and release artifacts for diligence.

## Verification Steps

- [ ] Run backend `npm.cmd run test`.
- [ ] Run backend `npm.cmd audit --json`.
- [ ] Run backend `npm.cmd run verify:secrets`.
- [ ] Run mobile `npm.cmd run verify:production`.
- [ ] Run mobile `npm.cmd audit --json`.
- [ ] Run mobile `npm.cmd run verify:secrets`.
- [ ] Build a white-label APK and verify no branded assets/text appear.
- [ ] Verify Google Cloud API key restrictions in Google Cloud Console.
- [ ] Verify Render `/health` and `/ready` after dependency/security changes.
