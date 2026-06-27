# Truck-Safe Routing Commercial Readiness Audit Report

Date: 2026-06-24

Scope audited:

- Backend/API/dashboard repo: `C:\dev\bridge-api\bridge-api`
- Mobile Expo app repo: `C:\dev\tsr-mobile`

This report is a software/IP readiness review, not legal advice. Treat items marked Critical or High as blockers for sale, licensing, or a serious external pilot until addressed or reviewed by counsel.

## 1. Executive Summary

Truck-Safe Routing is not yet ready to sell or license as-is. The platform is technically functional and uses mostly permissive open-source dependencies, but commercial readiness is blocked by:

- branded Coca-Cola / Arca Continental names and assets in local mobile files, runtime documents, generated receipts, and backend defaults;
- Google Maps Platform usage that needs formal terms review, key restrictions, and caching/storage limits documented;
- bundled route/customer/product/test data containing real business names, addresses, invoices, driver name/ID, and brand/product names;
- missing full third-party notice/SBOM process for both repositories;
- npm audit findings, including a mobile critical transitive advisory and backend high advisories;
- privacy/compliance gaps around driver location, route history, customer records, photos, signatures, receipts, AI logs, and data retention.

The application is suitable for continued internal development and controlled testing. Before any sale/license/pilot with a company, create a clean white-label demo build, remove or replace branded/customer data, resolve security advisories, document Google data handling, and get attorney review.

## 2. Critical Risks

| Risk | Evidence | Why It Blocks Sale/Pilot | Required Action |
| --- | --- | --- | --- |
| Third-party branding and logos | Mobile local files include `assets\coca-cola-logo.png`, `assets\arca-continental-logo.png`, Coca-Cola truck assets, `src\app\screens\LandingScreen.js`, and `src\app\services\deliveryDocumentService.js`; backend receipt HTML uses Arca/Coca-Cola labels in `routes\routeManifests.js`. | Using a company's name, logos, product marks, or trade dress in a commercial demo/license package can create trademark/copyright and endorsement risk. | Create a neutral demo brand and remove branded assets/text from all demo builds unless you have written authorization. |
| Google Maps Platform terms risk | Backend uses Directions, Geocoding, Places New, Places Photo/Street View proxy endpoints; mobile uses Google Maps SDK through `react-native-maps`, traffic display, polylines, and offline caches. | Google terms can restrict caching, storage, attribution, derived datasets, display rules, traffic usage, and combining Google data with non-Google data. | Attorney and Google Cloud terms review before commercialization; document what is stored and for how long. |
| Sensitive/customer demo data | `data\route-manifest-2026-06-20-827826.csv` contains driver ID/name, real-looking customer names/addresses, invoice numbers, branded SKUs/products. Backend templates include account/order examples. | Customer, route, invoice, product, and driver data should not ship in a public demo or sale package. | Replace with synthetic demo data and keep customer data outside source control. |
| Mobile critical npm advisory | `npm audit` in `C:\dev\tsr-mobile` reports `shell-quote` critical via transitive chain. | A critical advisory must be triaged before external review even if exploitability is build-tool limited. | Upgrade Expo/React Native dependency chain when compatible, or document why advisory is build-time only and not shipped/runtime exploitable. |

## 3. High Risks

| Risk | Evidence | Required Action |
| --- | --- | --- |
| Backend high npm advisories | `npm audit` in backend reports 5 high and 5 moderate vulnerabilities, including `localtunnel`, `axios`, `form-data`, `minimatch`, `path-to-regexp`. | Remove unused `localtunnel` or pin/replace it; update `express` and transitive packages; rerun audit. |
| Mobile app embeds a public Android Maps key at build time | `app.config.js` loads `EXPO_PUBLIC_ANDROID_MAPS_API_KEY`; Expo config resolves a real key from local `.env`. | Ensure Android app restriction by package name and SHA-1 certificate, API restriction to Maps SDK for Android, and separate server key restrictions. Rotate if it was ever exposed outside trusted logs/builds. |
| Local untracked branded/generated assets | Many branded assets are untracked in `C:\dev\tsr-mobile`, but local EAS builds can include them. | Do not treat Git tracked files alone as the sale package. Audit the local build inputs and remove/replace untracked branded assets before demo builds. |
| Driver/location/customer privacy | Schema stores drivers, route sessions/events, stop GPS, delivery notes/photos, signatures, receipts, invoice/order data, AI logs. | Add privacy notice, data retention schedule, access controls, export/delete procedure, and customer data segregation before pilot. |
| Google data caching/storage uncertainty | Backend persists recent destinations, place IDs, photo URLs, Street View URLs, route session data, route geometry/options, nearby addresses, and geocoded metadata. Mobile caches assigned routes, delivery notes, product barcode lookup, and stop delivery data offline. | Separate Google-derived data from operational/customer-owned data; limit retention; confirm allowed storage under applicable Google terms. |

## 4. Medium Risks

| Risk | Evidence | Required Action |
| --- | --- | --- |
| Missing formal license file for this application | No project `LICENSE` file was found in either repo inventory. | Add a proprietary/internal license notice or chosen commercial license terms before sharing code. |
| Incomplete third-party notices | No existing `THIRD_PARTY_NOTICES.md` was found before this audit. | Maintain notices and generate a full SBOM before sale/license. |
| Source-origin uncertainty for generated assets | Truck marker scripts and image assets reference uploaded/generated Coca-Cola truck images. | Preserve provenance notes; replace with original neutral assets or licensed artwork. |
| Cleartext network security plugin | Mobile `plugins\withTruckSafeNetworkSecurity.js` allows cleartext traffic. | Limit to development only or remove for production builds. |
| Broad request body limit | Backend defaults `REQUEST_BODY_LIMIT` to `60mb`; photo upload accepts base64 images. | Add endpoint-specific limits/rate limiting and stronger upload validation. |
| No visible rate limiting middleware | Backend uses Express/CORS/auth but no rate limiter was found. | Add rate limiting for auth, driver APIs, Places proxy, uploads, and AI endpoints. |
| AI logs and generated insights may include customer data | `ai_interaction_logs` and account intelligence tables store prompts/results and account identifiers. | Add retention/redaction rules and avoid sending confidential data to AI without customer approval. |

## 5. Low Risks

| Risk | Evidence | Required Action |
| --- | --- | --- |
| Mostly permissive open-source dependencies | Direct dependencies are mainly MIT, Apache-2.0, BSD, ISC. | Keep notices and license inventory current. |
| Local `.env` files exist | `.env` exists in both repos but `.gitignore` excludes it; scanners passed. | Keep secrets out of source control; rotate any key shown in shared logs. |
| Backend production verify fails locally | Local backend `.env` has placeholder `DATABASE_URL` and missing `CORS_ORIGIN`; deployed Render readiness passed earlier. | Keep local `.env` non-production; verify Render env separately before each pilot. |

## 6. Dependency License Findings

### Backend Direct Dependencies

| Package | Version | License | Commercial Status | Risk | Required Action |
| --- | --- | --- | --- | --- | --- |
| `@aws-sdk/client-s3` | 3.1048.0 | Apache-2.0 | Generally commercial-use permitted with notice/license terms. | Low | Include notices. |
| `@googlemaps/google-maps-services-js` | 3.4.2 | Apache-2.0 | Library license is permissive; Google API service terms still apply. | Medium | Include notices; review Google terms. |
| `cors` | 2.8.6 | MIT | Commercial-use permitted with notice. | Low | Include notices. |
| `csv-parse` | 5.6.0 | MIT | Commercial-use permitted with notice. | Low | Include notices; evaluate major upgrade separately. |
| `dotenv` | 16.6.1 | BSD-2-Clause | Commercial-use permitted with notice. | Low | Include notices. |
| `express` | 4.22.1 | MIT | Commercial-use permitted with notice. | Medium | Update patch/transitives due audit findings. |
| `pg` | 8.20.0 | MIT | Commercial-use permitted with notice. | Low | Include notices. |
| `unzipper` | 0.10.14 | MIT | Commercial-use permitted with notice. | Medium | Review maintenance; latest is 0.12.5. |
| `localtunnel` | 2.0.2 | MIT | Dev-only, commercial-use permitted with notice. | High | Remove if unused; it pulls vulnerable axios chain. |

Backend lockfile license scan:

- Apache-2.0: 43 packages
- MIT: 140 packages
- ISC: 18 packages
- BSD-2-Clause: 1 package
- BSD-3-Clause: 2 packages
- MIT/X11: 2 packages
- 0BSD: 1 package
- Unlicense: 1 package
- Unknown: `buffers@0.1.1`

### Mobile Direct Dependencies

| Package | Version | License | Commercial Status | Risk | Required Action |
| --- | --- | --- | --- | --- | --- |
| `@react-native-async-storage/async-storage` | 2.2.0 | MIT | Commercial-use permitted with notice. | Low | Include notices. |
| `@react-navigation/native` | 7.2.1 | MIT | Commercial-use permitted with notice. | Low | Include notices; update patch if stable. |
| `@react-navigation/native-stack` | 7.14.9 | MIT | Commercial-use permitted with notice. | Low | Include notices; update patch if stable. |
| `expo` | 55.0.26 | MIT | Commercial-use permitted with notice; Expo service/build terms also apply. | Medium | Review Expo/EAS terms and audit advisories. |
| `expo-camera` | 55.0.19 | MIT | Commercial-use permitted with notice. | Low | Include notices. |
| `expo-dev-client` | 55.0.35 | MIT | Commercial-use permitted with notice; dev-client should not ship in production if not needed. | Medium | Confirm production build profile behavior. |
| `expo-file-system` | 55.0.22 | MIT | Commercial-use permitted with notice. | Low | Include notices. |
| `expo-image-picker` | 55.0.20 | MIT | Commercial-use permitted with notice. | Low | Include notices. |
| `expo-location` | 55.1.10 | MIT | Commercial-use permitted with notice; location privacy obligations apply. | Medium | Add location privacy/retention disclosures. |
| `expo-speech` | 55.0.14 | MIT | Commercial-use permitted with notice. | Low | Include notices. |
| `expo-status-bar` | 55.0.6 | MIT | Commercial-use permitted with notice. | Low | Include notices. |
| `react` | 19.2.0 | MIT | Commercial-use permitted with notice. | Low | Include notices. |
| `react-dom` | 19.2.0 | MIT | Commercial-use permitted with notice. | Low | Include notices. |
| `react-native` | 0.83.6 | MIT | Commercial-use permitted with notice; audit advisories need triage. | Medium | Upgrade when Expo-compatible. |
| `react-native-bluetooth-classic` | 1.73.0-rc.17 | MIT | Commercial-use permitted with notice; release-candidate dependency. | Medium | Validate maintenance/support before pilot. |
| `react-native-maps` | 1.27.2 | MIT | Commercial-use permitted with notice; Google Maps terms apply. | Medium | Include notices; review Google terms. |
| `react-native-safe-area-context` | 5.6.2 | MIT | Commercial-use permitted with notice. | Low | Include notices. |
| `react-native-screens` | 4.23.0 | MIT | Commercial-use permitted with notice. | Low | Include notices. |
| `react-native-signature-canvas` | 5.0.2 | MIT | Commercial-use permitted with notice; uses WebView/signature data. | Medium | Include notices; privacy review for signatures. |
| `react-native-web` | 0.21.2 | MIT | Commercial-use permitted with notice. | Low | Include notices. |
| `react-native-webview` | 13.16.0 | MIT | Commercial-use permitted with notice; web content security must be reviewed. | Medium | Include notices; review WebView use. |

Mobile lockfile license scan:

- MIT: 548 packages
- ISC: 47 packages
- BSD-3-Clause: 15 packages
- Apache-2.0: 11 packages
- MPL-2.0: 12 packages
- BSD-2-Clause: 5 packages
- BlueOak-1.0.0: 6 packages
- Unlicense: 2 packages
- 0BSD: 1 package
- Python-2.0: 1 package
- CC-BY-4.0: 1 package
- `(MIT OR CC0-1.0)`: 3 packages
- `(MIT OR Apache-2.0)`: 1 package
- `(BSD-3-Clause OR GPL-2.0)`: `node-forge@1.4.0`, choose/use BSD-3-Clause path and confirm notice requirements.

No AGPL, SSPL, BUSL, Commons Clause, or Polyform direct dependency was found from the lockfile scan. The mobile `node-forge` dual-license entry and backend unknown `buffers` metadata require legal/SBOM review.

## 7. Copied-Code / Source-Origin Findings

No obvious Stack Overflow/GitHub copied-code banners were found in source files. Findings:

- `C:\dev\bridge-api\bridge-api\scripts\build-zones-regions.cjs` identifies source as OpenStreetMap via Overpass API. Treat generated no-truck/residential zone data as subject to OSM/ODbL review before commercial use.
- `C:\dev\tsr-mobile\scripts\extract_uploaded_truck_marker.py` and `scripts\extract-uploaded-truck-marker.ps1` state coordinates are tailored to an uploaded Coca-Cola tractor-trailer photo. This is not safe for a public commercial demo without provenance/license proof.
- Many mobile truck sprite assets appear generated from local truck artwork. If derived from a third-party photo or branded truck, replace with original neutral art.
- Backend and dashboard code appears project-specific/AI-assisted rather than copied from external templates, but preserve Git history and AI records for ownership diligence.

## 8. Google Maps / API Terms Findings

Appearing Google APIs/services:

- Backend `routes\routing.js`: Google Maps Services client and Directions API routing.
- Backend `routes\places.js`: Places API New autocomplete/details/searchNearby/searchText, Geocoding API, Places Photo, Street View URL/photo proxy behavior.
- Backend scripts: reverse geocoding in `scripts\backfill-static-hazard-locations.cjs` and `scripts\process-location-backfill-queue.cjs`.
- Mobile `react-native-maps`: Google Maps SDK for Android, `MapView`, `Polyline`, `Marker`, `showsTraffic={true}`.
- Mobile `HomeScreen.js`: autocomplete result caching in memory and Google destination photo display through backend-provided URLs.
- Mobile `routeManifestOfflineStore.js` and `deliveryOfflineStore.js`: offline storage of route/customer/delivery information.

Key findings:

- Server Google key is environment-based in `.env.example`, not hardcoded.
- Android Maps key is environment-based in `app.config.js`, but public Expo config resolves a real key at build time. This is normal for Android Maps SDK, but it must be restricted in Google Cloud.
- Backend stores `recent_destinations` with `place_id`, `photo_url`, `place_photo_url`, `street_view_url`, and related metadata.
- Backend stores route sessions/options/events that may include route geometry, addresses, hazard metadata, and driver location.
- Mobile displays traffic data and route polylines; terms review should confirm allowed use and no impermissible derived/cached routing dataset.
- The app may combine Google results with Census, OSM, low-bridge, manual hazard, and customer data. That needs careful review to ensure Google data is not used to create prohibited derivative datasets.

Required corrections:

- Document exactly which Google response fields are persisted and why.
- Restrict Android key by package name/SHA-1 and API to Maps SDK for Android.
- Restrict server key by backend service origin/IP where feasible and API to only server-used APIs.
- Add retention/cleanup for `recent_destinations`, route sessions, place photo references, and geocode backfill data.
- Ensure Google attribution is displayed wherever required by SDK/API terms.
- Get counsel/Google terms review before selling, licensing, or allowing external pilot use.

## 9. Dataset and Data Rights Findings

| Dataset/File | Likely Origin | Risk | Required Action |
| --- | --- | --- | --- |
| `data\low_clearance_bridges.json` | Low-clearance bridge dataset, likely public/NBI-derived but source/license not embedded in file. | Medium | Add source, date, license/terms, attribution, and transform notes. |
| `data\census_service_area_places.json` | U.S. Census TIGER/Line PLACE, generated 2026-06-05. | Low/Medium | Public data likely usable, but document Census source and no warranty. |
| `data\no_truck_zones.json`, `data\residential_zones.json` local files | OSM/Overpass generated per scripts. | High | ODbL/commercial-use/attribution/share-alike review; these are local and ignored but may be used operationally. |
| `data\low_bridge_verification_candidates.csv` local file | Exported candidates. | Medium | Keep out of public demo unless source/rights documented. |
| `data\route-manifest-2026-06-20-827826.csv` local untracked test route | User/test-generated manifest with real-looking businesses/addresses/products/invoices. | Critical | Replace with fully synthetic data before sharing. |
| Delivery notes/photos local directories | Driver/customer photos and notes. | High | Keep ignored; apply privacy/retention/security controls. |
| Database production data | Drivers, routes, account orders, invoices, receipts, signatures, photos, GPS events, AI logs. | High | Customer agreement, privacy notice, retention, access controls, backup/deletion policy. |

## 10. Trademark / Branding Findings

Branding appears in:

- `C:\dev\tsr-mobile\assets\coca-cola-logo.png`
- `C:\dev\tsr-mobile\assets\arca-continental-logo.png`
- `C:\dev\tsr-mobile\assets\coca-cola-*`
- `C:\dev\tsr-mobile\src\assets\truck-coca-cola-top*.png`
- `C:\dev\tsr-mobile\src\app\screens\LandingScreen.js`
- `C:\dev\tsr-mobile\src\app\services\deliveryDocumentService.js`
- `C:\dev\bridge-api\bridge-api\routes\routeManifests.js`
- `C:\dev\bridge-api\bridge-api\db\repositories.js`
- `C:\dev\bridge-api\bridge-api\scripts\build-zones-regions.cjs`
- test/template data containing Coca-Cola, Coke, Dasani, Sprite, Powerade, Arca, Valero, HTeaO, EControls, and other names.

Commercial demo recommendation:

- Replace with neutral brand: `Pilot Beverage Logistics`
- Replace product names with: `Cola 12 Pack`, `Lemon-Lime 12 Pack`, `Bottled Water 24 Pack`, `Sports Drink Variety`
- Replace driver/customer names and addresses with synthetic data.
- Replace truck art with original neutral truck artwork.

## 11. Security and Secrets Findings

Positive findings:

- Secret audit scripts passed in both repos.
- `.env` files are ignored by Git in both repos.
- Backend server key and mobile Android Maps key are loaded from environment/config, not hardcoded in committed source.
- Backend deployed health/readiness was previously verified on Render.

Risks:

- Local `.env` files exist and should never be shared.
- Mobile Android Maps key is public in built app and must be restricted/rotated if exposed.
- Backend lacks visible rate limiting.
- Backend request body limit is broad.
- Mobile cleartext traffic plugin should not be active in production unless strictly necessary.
- Photo upload accepts base64 and stores files/S3 objects; malware/content scanning is not present.
- Driver API token model should be reviewed for per-driver/per-device authentication before pilot.
- RBAC exists for admin sessions and roles, but fine-grained authorization and audit logging need a formal review.

## 12. Database / Privacy Findings

Tables/entities include:

- `admin_users`, `drivers`, `warehouse_employees`
- `delivery_notes`, `recent_destinations`
- `low_clearance_bridges`, `truck_restricted_zones`, hazard backfill queue
- `route_sessions`, `route_session_events`
- `daily_route_manifests`, `daily_route_stops`
- `customer_accounts`, `products`, `product_barcodes`
- `account_orders`, `account_order_items`, `delivery_deductions`
- `delivery_settlements`, `delivery_settlement_items`, `delivery_documents`
- `route_closeout_documents`, `route_inventory_closeouts`, `route_departure_inventory_confirmations`
- `account_ai_insights`, `ai_interaction_logs`
- `prediction_runs`, `supervisor_alerts`, scheduled reports

Privacy/commercial readiness gaps:

- No formal retention policy found.
- No subject/data deletion process found.
- No customer data classification document found.
- No backup/restore policy found.
- No production migration framework beyond startup `CREATE TABLE IF NOT EXISTS` style schema management.
- GPS/location events and customer delivery records can be sensitive and should be contractually controlled.
- Signatures and receipt documents may have legal/financial retention requirements.

## 13. Fixes Applied

Documentation-only fixes applied:

- Created `AUDIT_REPORT.md`.
- Created `AUDIT_REMEDIATION_CHECKLIST.md`.
- Created `THIRD_PARTY_NOTICES.md`.
- Created `AI_ASSISTED_DEVELOPMENT_RECORD.md`.

No code or runtime behavior was changed in this audit pass.

## 14. Fixes Not Applied and Why

- Did not remove branded files because they may still be used for the current private test build and removal could break assets/screens. Recommended next step is a planned white-label cleanup.
- Did not run `npm audit fix` because it can make dependency changes and break Expo/backend compatibility.
- Did not remove `localtunnel` automatically because dev tooling usage was not confirmed.
- Did not rotate keys because actual secret rotation must be done in Google Cloud, Render, and EAS accounts.
- Did not rewrite Google caching/data behavior because terms decisions require legal/product input.

## 15. Attorney Review Items

- Google Maps Platform API terms, including caching, storage, route geometry, traffic, Places photos, Street View, attribution, and derivative data.
- Coca-Cola, Arca Continental, product/truck trade dress, customer logos/names, and branded demo materials.
- OSM/Overpass-generated zone data and ODbL obligations.
- Low-clearance/NBI/public bridge data licensing, attribution, no-warranty language, and commercial use.
- AI-assisted development ownership/assignment and disclosure.
- Pilot/license contract data-processing terms, confidentiality, retention, deletion, liability, and safety disclaimers.
- Open-source license notices and dual-license transitive packages.

## 16. Recommended Next Steps Before Selling or Licensing

1. Create a neutral white-label demo profile and remove all Coca-Cola/Arca/customer-specific assets/text from that build.
2. Replace all route/customer/invoice/product sample data with synthetic data.
3. Resolve npm audit findings, starting with mobile critical `shell-quote` and backend `localtunnel`/Express-related advisories.
4. Add a formal license/proprietary notice for the application code.
5. Generate a full SBOM from both lockfiles and archive it with the release.
6. Confirm Google Cloud key restrictions and rotate any key exposed in shared logs.
7. Add privacy/retention/security documentation for driver location, photos, signatures, receipts, AI logs, and customer records.
8. Add rate limiting and production upload hardening.
9. Document all dataset sources, terms, and attribution.
10. Have counsel review Google, trademarks, data rights, AI ownership, and pilot contract terms.

## 17. Files Created or Modified

Created:

- `C:\dev\bridge-api\bridge-api\AUDIT_REPORT.md`
- `C:\dev\bridge-api\bridge-api\AUDIT_REMEDIATION_CHECKLIST.md`
- `C:\dev\bridge-api\bridge-api\THIRD_PARTY_NOTICES.md`
- `C:\dev\bridge-api\bridge-api\AI_ASSISTED_DEVELOPMENT_RECORD.md`

Evidence commands run:

- Backend: `npm.cmd audit --json`
- Mobile: `npm.cmd audit --json`
- Backend: `npm.cmd outdated --json`
- Mobile: `npm.cmd outdated --json`
- Backend: `npm.cmd run verify:secrets`
- Mobile: `npm.cmd run verify:secrets`
- Backend: `npm.cmd run test`
- Mobile: `npm.cmd run verify:production`
- Backend: `npm.cmd run verify:production` failed locally due placeholder/missing local production env values.
- Mobile: `npx.cmd expo config --type public`

