# Third-Party Notices

Date: 2026-06-24

This notice file covers the audited Truck-Safe Routing repositories:

- Backend/API/dashboard: `C:\dev\bridge-api\bridge-api`
- Mobile Expo app: `C:\dev\tsr-mobile`

This is an initial commercial-readiness notice inventory. Before sale, licensing, or external pilot, generate a full SBOM from `package-lock.json` in both repositories and attach complete upstream license texts where required.

## Notice Requirements

Permissive packages such as MIT, BSD, ISC, Apache-2.0, 0BSD, Unlicense, BlueOak-1.0.0, CC0, and similar licenses generally allow commercial use, but many require preservation of copyright and license notices. Apache-2.0 also includes patent/license text requirements. MPL-2.0 has file-level source disclosure obligations for modified MPL-covered files.

## Backend Direct Dependencies

| Package | Version | License | Notice / Action |
| --- | --- | --- | --- |
| `@aws-sdk/client-s3` | 3.1048.0 | Apache-2.0 | Include Apache-2.0 notice/license. |
| `@googlemaps/google-maps-services-js` | 3.4.2 | Apache-2.0 | Include Apache-2.0 notice/license; Google API terms also apply. |
| `cors` | 2.8.6 | MIT | Include MIT notice/license. |
| `csv-parse` | 5.6.0 | MIT | Include MIT notice/license. |
| `dotenv` | 16.6.1 | BSD-2-Clause | Include BSD-2-Clause notice/license. |
| `express` | 4.22.2 | MIT | Include MIT notice/license. |
| `pg` | 8.20.0 | MIT | Include MIT notice/license. |
| `unzipper` | 0.10.14 | MIT | Include MIT notice/license. |

Backend transitive license summary from lockfile:

- Apache-2.0: 43 packages
- MIT: 140 packages
- ISC: 18 packages
- BSD-2-Clause: 1 package
- BSD-3-Clause: 2 packages
- MIT/X11: 2 packages
- 0BSD: 1 package
- Unlicense: 1 package
- Unknown metadata: `buffers@0.1.1`

## Mobile Direct Dependencies

| Package | Version | License | Notice / Action |
| --- | --- | --- | --- |
| `@react-native-async-storage/async-storage` | 2.2.0 | MIT | Include MIT notice/license. |
| `@react-navigation/native` | 7.2.1 | MIT | Include MIT notice/license. |
| `@react-navigation/native-stack` | 7.14.9 | MIT | Include MIT notice/license. |
| `expo` | 55.0.26 | MIT | Include MIT notice/license; review Expo/EAS service terms. |
| `expo-camera` | 55.0.19 | MIT | Include MIT notice/license. |
| `expo-dev-client` | 55.0.35 | MIT | Include MIT notice/license; confirm production distribution need. |
| `expo-file-system` | 55.0.22 | MIT | Include MIT notice/license. |
| `expo-image-picker` | 55.0.20 | MIT | Include MIT notice/license. |
| `expo-location` | 55.1.10 | MIT | Include MIT notice/license; location privacy obligations apply. |
| `expo-speech` | 55.0.14 | MIT | Include MIT notice/license. |
| `expo-status-bar` | 55.0.6 | MIT | Include MIT notice/license. |
| `react` | 19.2.0 | MIT | Include MIT notice/license. |
| `react-dom` | 19.2.0 | MIT | Include MIT notice/license. |
| `react-native` | 0.83.6 | MIT | Include MIT notice/license. |
| `react-native-bluetooth-classic` | 1.73.0-rc.17 | MIT | Include MIT notice/license; validate support before pilot. |
| `react-native-maps` | 1.27.2 | MIT | Include MIT notice/license; Google Maps terms also apply. |
| `react-native-safe-area-context` | 5.6.2 | MIT | Include MIT notice/license. |
| `react-native-screens` | 4.23.0 | MIT | Include MIT notice/license. |
| `react-native-signature-canvas` | 5.0.2 | MIT | Include MIT notice/license. |
| `react-native-web` | 0.21.2 | MIT | Include MIT notice/license. |
| `react-native-webview` | 13.16.0 | MIT | Include MIT notice/license. |

Mobile transitive license summary from lockfile:

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
- `(BSD-3-Clause OR GPL-2.0)`: `node-forge@1.4.0`

## Required Follow-Up

- Generate full backend and mobile SBOMs before any sale/license package.
- Include full upstream license texts and copyright notices.
- Review `buffers@0.1.1` unknown license metadata.
- Review `node-forge@1.4.0` dual license and document BSD-3-Clause use path if acceptable.
- Review MPL-2.0 transitive packages and confirm no modified MPL source files are distributed without obligations met.
- Review Google Maps Platform, Expo/EAS, Render, AWS/Cloudflare R2, and OpenAI service terms separately from open-source package licenses.
