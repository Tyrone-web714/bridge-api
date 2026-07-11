# Truck-Safe Routing Project Status

Last updated: 2026-05-11

## What Truck-Safe Routing Is

Truck-Safe Routing is a mobile routing app for commercial trucks. The driver enters a destination and truck profile, the app requests a route from the backend, and the backend asks Google Directions for route alternatives while checking truck-specific hazards such as low bridges, no-truck zones, and residential restrictions. The mobile app then shows the chosen truck-safe route, alternatives, hazards, live truck position, and audible/vibration warnings.

## Project Folders

- Mobile app: `C:\dev\tsr-mobile`
- Backend API: `C:\dev\bridge-api\bridge-api`

## Architecture

- Mobile: React Native with Expo Dev Client, not Expo Go.
- Map: `react-native-maps` using Google Maps SDK for Android.
- Backend: Node.js + Express on port `5000`.
- Main backend endpoint: `POST /api/routing/safe-route`.
- Backend routing file: `C:\dev\bridge-api\bridge-api\routes\routing.js`.
- Main mobile map file: `C:\dev\tsr-mobile\src\app\screens\MapScreen.js`.

## Confirmed Working

- Fresh EAS development build installed on physical Android device.
- Google map tiles render.
- Neutral truck marker renders on the map.
- Truck marker uses centered anchoring and image sizing for map display.
- Phone connects to Metro.
- Phone reaches backend.
- Backend reaches Google Directions API.
- Backend returns multiple routes and hazard structures.
- Mobile sends live GPS origin plus typed destination.
- Mobile renders selected route as a blue polyline.
- Mobile renders alternate routes in gray.
- Mobile allows selecting alternate routes from both the gray route polyline and the route choice cards.
- Mobile shows route distance, duration, summary, truck profile, and hazard counts.
- Mobile shows hazard detail cards for low-bridge hazards.
- Mobile watches live phone location after route loads.
- Truck marker updates from live location.
- Truck marker rotates to match the route direction near the current truck location.
- Follow-camera mode zooms close to the truck and rotates/pitches with the route heading.
- App detects route deviation and shows on-route/off-route status.
- Voice/vibration alert wiring is present for off-route warnings and low-clearance route hazards.

## Latest Mobile Work

Main file:

```text
C:\dev\tsr-mobile\src\app\screens\MapScreen.js
```

Recent behavior added or updated:

- Neutral truck marker:
  - Runtime marker is rendered in `C:\dev\tsr-mobile\src\app\components\VehicleLayer.jsx`.
  - Branded local marker assets are legacy reference files only and should not be used in a white-label build.

- Marker sizing:
  - The custom marker is rendered through `TruckMarker`.
  - The `Marker` anchor is centered with `anchor={{ x: 0.5, y: 0.5 }}`.
  - The image uses `resizeMode="contain"` and map-specific marker styles.
  - If it looks too large/small on-device, tune `styles.truckMarkerWrap` and `styles.truckMarkerImage` in `MapScreen.js`.

- Follow-camera zoom behavior:
  - Initial route load fits the whole route with `fitToCoordinates`.
  - After a short delay, the app enters follow mode and calls `animateCamera`.
  - Follow mode uses `zoom: 18`, `pitch: 55`, and `heading: truckHeading`.
  - Live location updates re-center the camera on the truck with the same close follow zoom.

- Truck heading / route direction rotation:
  - `getRouteHeading(point, routePoints)` finds the nearest route point and looks ahead several points.
  - The truck image rotates with `transform: [{ rotate: `${heading}deg` }]`.
  - Heading is updated when the route loads, when live GPS updates arrive, and when an alternate route is selected.

- Route alternatives:
  - Backend returns multiple routes.
  - Mobile builds route options with `buildRouteOptions`.
  - Selected route is blue with a white casing stroke.
  - Alternate routes are gray, tappable polylines.
  - Route cards show Route number, distance, duration, and hazard count.

- Hazard detail cards:
  - Hazards are normalized into `lowBridges`, `noTruckZones`, and `residentialZones`.
  - Hazard severity is summarized as clear / medium / high / critical.
  - Low-bridge map markers show warning symbols.
  - The info card shows up to three low-bridge detail cards with clearance, required clearance, clearance gap, and distance from route.

- Live tracking:
  - The app requests foreground location permission after a route is loaded.
  - `Location.watchPositionAsync` uses balanced accuracy, `distanceInterval: 15`, and `timeInterval: 5000`.
  - Live GPS updates set the truck coordinate, nearest-route distance, and truck heading.
  - Off-route threshold is currently above 120 meters; reset threshold is 80 meters.

- Voice alert wiring:
  - `speakAlert` dynamically requires `expo-speech`, stops any current speech, then speaks the new warning.
  - Off-route alert vibrates and says: `Warning. You are off the selected truck safe route.`
  - Low-clearance route alert vibrates and says: `Critical warning. Low clearance hazard detected on the selected route.`
  - If speech does not play in the installed development build, rebuild/reinstall the EAS dev client because `expo-speech` is native.

## API Key Rules

Use separate Google Cloud API keys:

- Mobile Android Maps key:
  - Used in `C:\dev\tsr-mobile\app.json`
  - Restriction: Android apps
  - Package: `com.nasih.trucksaferouting`
  - SHA-1: EAS Android signing fingerprint
  - API restriction: Maps SDK for Android

- Backend server key:
  - Used in `C:\dev\bridge-api\bridge-api\.env`
  - Restriction: IP addresses or production server restriction
  - API restriction: Directions API

Do not paste private API keys in chat.

## Local Dev Commands

Backend:

```powershell
cd "C:\dev\bridge-api\bridge-api"
npm start
```

Mobile Metro:

```powershell
cd "C:\dev\tsr-mobile"
npx.cmd expo start --dev-client --port 8081 --clear --lan
```

ADB path:

```powershell
C:\Android\platform-tools\adb.exe
```

## Mobile Backend URL

The mobile app uses:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.86.24:5000
```

Local file:

```text
C:\dev\tsr-mobile\.env
```

This IP may change if the PC network changes. If the route stops loading and the app shows the wrong API host, update `.env` and restart Metro.

## Truck Marker

Current marker code:

```text
C:\dev\tsr-mobile\src\app\screens\MapScreen.js
```

Current marker asset:

```text
C:\dev\tsr-mobile\src\app\components\VehicleLayer.jsx
```

Source/full-size extracted asset:

```text
C:\dev\tsr-mobile\src\app\components\VehicleLayer.jsx
```

Extraction script:

```text
C:\dev\tsr-mobile\scripts\extract_uploaded_truck_marker.py
```

Known issue addressed:

- The large marker image disappeared in React Native Maps.
- A neutral in-code marker replaced the branded marker asset for white-label builds.
- Current marker can still need final on-device visual tuning for exact size and anchor feel.

## Backend Deployment Prep

Added to backend:

- `Dockerfile`
- `render.yaml`
- `.env.example`
- `.gitignore`
- `.dockerignore`
- `DEPLOYMENT.md`
- `/health` endpoint
- environment-based CORS
- 404 handler

Important: restart backend after backend code changes.

## Current Production Next Steps

1. Verify the neutral truck marker renders correctly on the physical Android device.
2. Tune truck marker size/anchor in `MapScreen.js` if it appears too tall, small, or offset.
3. Drive a real route or simulated movement to confirm follow-camera zoom, heading rotation, and off-route threshold behavior.
4. Test route alternatives on-device:
   - tap gray alternate polylines
   - tap route cards
   - confirm selected route hazards and details update
5. Test low-clearance and off-route voice/vibration alerts on the installed dev client.
6. Rebuild EAS dev client if `expo-speech` does not play audio, because it is a native module.
7. Add persistence layer:
   - drivers
   - truck profiles
   - routes
   - hazard events
   - trip logs
   - fleet/supervisor records
8. Deploy backend to a real hosting provider.
9. Update mobile `EXPO_PUBLIC_API_BASE_URL` to deployed backend URL.
10. Add supervisor/admin dashboard after persistence exists.

## Current Bugs / Open Issues

- Git status from the Codex sandbox may fail with a `dubious ownership` warning for `C:\dev\tsr-mobile`; this is a sandbox user identity issue, not necessarily a repo problem.
- Physical device testing is still needed for final truck marker scale/anchor, camera feel, route rotation, and voice playback.
- `expo-speech` may require a fresh EAS dev-client rebuild before audio works.
- The backend URL in `.env` uses the PC LAN IP and may break when the network changes.
- Hazard detail cards currently focus on low bridges; no-truck and residential zones are counted but do not yet have equally rich detail cards.

## Important Debugging Lessons

- `app.json` Google Maps config is build-time native config. API key changes require EAS rebuild and reinstall.
- `localhost` from a physical phone means the phone, not the PC.
- `10.0.2.2` is for Android emulator, not physical phone.
- If map marker or route disappears, inspect:
  - Metro bundle freshness
  - `.env` API base URL
  - backend running state
  - route point count
  - marker asset size
