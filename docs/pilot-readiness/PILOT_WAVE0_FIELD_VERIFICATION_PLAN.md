# Pilot Wave 0 Field Verification Plan

Repository tests cannot prove physical mobile, vehicle-motion, network, and safety-warning
behavior. These gates require lab, parking-lot, or road evidence.

## Field-Verification P0s

| Gap | Lab test possible? | Parking-lot test? | Road test? | Actual truck? | Second observer? | Network throttling? | Fixture needed? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PILOT-P0-001 offline/reconnect/restart replay | Yes | Yes | Optional | No | Recommended | Yes | Route/stop fixture with queued completions |
| PILOT-P0-002 field safety behavior | Partial | Partial | Yes | Preferred for final evidence | Yes | Optional | Route/hazard fixture with low-clearance/no-truck/residential cases |
| PILOT-P0-003 APK artifact/install | Yes | Yes | No | No | No | No | Approved APK and device list |
| PILOT-P0-009 tenant isolation under offline/media replay | Yes | Yes | Optional | No | Recommended | Yes | Two-tenant fixture with driver, route, stop, and media records |

## Required Observations

- GPS heading accuracy.
- Route snapping.
- Camera/route smoothing.
- Speed accuracy.
- Real network loss.
- Background/foreground lifecycle.
- Device restart/reconnect.
- Long-route stability.
- Hazard warning timing.
- Actual vehicle-motion behavior.
- Offline queued action replay.
- Duplicate suppression.
- Tenant and driver identity retention.

## Test Order

1. Lab: install APK, login, route assignment, stop completion, route cache.
2. Lab: airplane mode or network throttling, queue stop completion, restart app, reconnect.
3. Lab: two-tenant replay fixture, verify no cross-tenant route, stop, media, or supervisor visibility.
4. Parking lot: GPS, background/foreground, route tracking, speed warning, reconnect.
5. Road: representative low-clearance/no-truck/residential/hazard warning route.
6. Closeout: supervisor evidence review, incident log capture, rollback readiness confirmation.

No field test may begin until Pilot Wave 0 owner decisions identify devices, drivers,
support owners, route fixtures, and safety controls.
