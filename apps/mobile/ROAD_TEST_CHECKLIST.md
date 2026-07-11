# Truck-Safe Routing Road Test Checklist

Use this checklist after restarting Metro and opening the current development build.

## Before Driving

- Backend is running at `C:\dev\bridge-api\bridge-api` with `npm start`.
- Metro is running from `C:\dev\tsr-mobile` with `npx expo start --dev-client --host lan --port 8081 --clear`.
- Phone is on the same Wi-Fi network as the PC.
- Route setup page shows the light blue, light red, and white theme.
- Destination autocomplete shows address suggestions.
- Destination preview appears when a suggested destination is selected.
- Truck profile values are correct for the test vehicle.
- Voice is set to `Voice on` in the map controls.

## Route Start

- Blue route line appears.
- Neutral truck marker appears.
- Destination marker appears.
- Route details card shows distance, time, hazards, and route options.
- Route details card collapses after a few seconds.
- Follow mode turns on automatically after the route loads.

## Motion Test

- Truck marker stays visible while moving.
- Truck marker points in the direction of travel.
- Truck marker movement is smooth enough for city speeds.
- Recenter button returns the camera to the truck.
- Follow on/off button toggles camera follow correctly.
- Manual map drag turns follow mode off.
- Camera heading follows truck direction when follow mode is on.
- Speed display increases beyond parking-lot speed and does not freeze at 3 mph.

## Voice Test

- Route start prompt is spoken.
- Upcoming turn prompts are spoken at the far and near trigger distances.
- Voice off mutes future spoken alerts.
- Voice on restores spoken alerts.
- Test voice button speaks only when voice is on.

## Warning Test

- At 60 mph, app speaks the approaching-speed warning.
- Above 65 mph, app speaks the over-speed warning.
- Above 65 mph, speed panel turns red and blinks.
- If the driver leaves the selected route, off-route warning is spoken.
- If off-route long enough, reroute request starts automatically.
- If low-clearance hazards are present, the hazard card shows clearance, required clearance, and distance.
- No-truck and residential restrictions appear in the hazard card when returned by the backend.

## Notes To Record

- Test route:
- Phone model:
- Android version:
- Weather/visibility:
- Speed behavior:
- Marker heading behavior:
- Voice timing:
- Any missed turn prompt:
- Any false warning:
- Any app freeze or blank screen:
