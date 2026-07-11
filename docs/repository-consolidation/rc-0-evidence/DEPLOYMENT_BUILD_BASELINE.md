# Deployment And Build Baseline

## Backend

| Item | Value |
| --- | --- |
| Render service name | truck-safe-routing-api |
| Render config | C:\dev\bridge-api\render.yaml with rootDir: bridge-api |
| Backend Dockerfile | C:\dev\bridge-api\bridge-api\Dockerfile |
| Health-check path | /health |
| Start command | npm start from backend package; runs migrations then server.js |
| Docker build path | Render rootDir bridge-api |
| Last known Git commit | bbb312618953018d7f13f791935d9664fae7f433 |
| Existing deployment URL | https://truck-safe-routing-api.onrender.com inferred from mobile EAS config; verify in Render before cutover |
| Last known deployment ID | Not locally verifiable without Render access |

## Mobile

| Item | Value |
| --- | --- |
| Expo app name | Truck-Safe Routing |
| Slug | truck-safe-routing |
| Android package ID | com.nasih.trucksaferouting |
| Current version | 1.0.0 |
| Android versionCode | Not set in app.json |
| EAS project ID | 4b7843f4-3d14-4c64-8223-39b06601c781 |
| Build profiles | development, preview, production |
| APK/AAB paths | None found locally |
| QR evidence paths | C:\dev\tsr-mobile\truck-safe-routing-assigned-route-fix-apk-qr.png; C:\dev\tsr-mobile\truck-safe-routing-black-icon-apk-qr.png; C:\dev\tsr-mobile\truck-safe-routing-dashboard-camera-apk-qr.png; C:\dev\tsr-mobile\truck-safe-routing-driver-session-apk-qr.png; C:\dev\tsr-mobile\truck-safe-routing-employee-id-inventory-apk-qr.png; C:\dev\tsr-mobile\truck-safe-routing-final-audit-apk-qr.png; C:\dev\tsr-mobile\truck-safe-routing-global-settings-apk-qr.png; C:\dev\tsr-mobile\truck-safe-routing-hazard-report-apk-qr.png; C:\dev\tsr-mobile\truck-safe-routing-inventory-staff-apk-qr.png; C:\dev\tsr-mobile\truck-safe-routing-itemized-return-apk-qr.png; C:\dev\tsr-mobile\truck-safe-routing-latest-apk-qr.png; C:\dev\tsr-mobile\truck-safe-routing-preview-apk-qr.png; C:\dev\tsr-mobile\truck-safe-routing-unified-inventory-apk-qr.png |
| Last known EAS build identifiers | Not locally verifiable without EAS query |

No builds or deployments were triggered.
