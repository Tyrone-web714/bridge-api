# Physical Device Test Plan

Do not disable public R2 before this test is completed and accepted.

Use a non-production preview APK built from the `mobile-authenticated-private-media` branch and a controlled test driver/route.

## Steps

1. Install the preview APK on the Android test device.
2. Launch the app.
3. Sign in as the approved test driver.
4. Load the assigned route.
5. Open a stop/account with a delivery note containing one migrated private media photo.
6. Confirm the photo thumbnail renders.
7. Open the photo detail/preview.
8. Confirm the larger photo renders.
9. Confirm the workflow does not require opening a direct public R2 URL.
10. Force-stop the app.
11. Relaunch the app and confirm the authenticated session restores.
12. Reopen the same delivery-note photo.
13. Turn off network temporarily.
14. Confirm the app fails safely or shows cached/local state without exposing public R2 credentials or object keys.
15. Reconnect network.
16. Confirm route data and media workflow recover.
17. Complete one safe queued stop/delivery-note sync test if an approved test route is available.
18. Confirm no obvious regression to route loading, navigation map, truck marker, route line, printer settings, or stop completion.

## Expected Result

- Login succeeds.
- Assigned route loads.
- Delivery-note private media renders through authenticated TSR media access.
- Public R2 URL is not required by the workflow.
- Expired/invalid session behavior fails closed where safely testable.
- Existing route/navigation workflow remains usable.
