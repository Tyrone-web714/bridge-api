# Delivery Notes Navigation Contract Audit

Status: SOURCE REPAIR COMPLETE; PREVIEW APK AND PHYSICAL ACCEPTANCE REQUIRED.

Scope: Delivery Notes navigation/context only. Driver Copilot, public R2 access, backend deployment, and production data were not changed.

## Entry Point Matrix

| Entry path | Parameters before repair | Required context present before repair | Return destination before repair | Save target risk |
| --- | --- | --- | --- | --- |
| Home destination search -> Delivery Notes | destination address, place ID, destination details | Account scope present only when place ID/account number existed; no explicit source/return route | implicit navigator back stack | could continue with weak account context |
| Today Route stop -> Notes & Photos | account number, driver ID/name, route stop ID, route date, nested destination details | stop/account present; route manifest ID missing from the Delivery Notes params | implicit navigator back stack | route-stop note could miss manifest identity |
| Today Route Account Knowledge -> Add Note | delegated to same stop opener but did not identify Account Knowledge as the source | account/stop present; source was indistinguishable from route-stop button | implicit navigator back stack | no way to return specifically to same Account Knowledge panel |
| Map arrival -> Notes & Photos | destination, place ID, account number, route stop ID/date, nested destination details | route stop present; route manifest ID depended on nested params and was not top-level canonical | implicit navigator back stack | route-created note could be missing manifest identity |
| Map Account Knowledge -> Add Note | delegated to same map opener but did not identify Account Knowledge as the source | account/stop present when current route stop existed; source was indistinguishable | implicit navigator back stack | Account Knowledge Add Note could behave like route button |
| Delivery Settlement -> Account Notes & Photos | account number, driver ID/name, route stop ID/date, nested destination details | route stop present; route manifest ID was not passed to Delivery Notes | implicit navigator back stack | settlement note could miss manifest identity |
| Delivery Settlement Account Knowledge -> Add Note | delegated to same settlement opener but did not identify Account Knowledge as the source | account/stop present; source was indistinguishable | implicit navigator back stack | no deterministic return to settlement Account Knowledge |
| Android pending camera recovery -> Delivery Notes | restored draft route params | depended on whatever caller originally stored | root reset directly to Delivery Notes after prior camera repair | failed if original params were inconsistent |

## Root Cause

`DeliveryNotesScreen` accepted several caller-specific parameter shapes instead of one route contract. Route-stop callers often placed important identifiers inside `destinationDetails`, some omitted route manifest ID, and Account Knowledge opened Delivery Notes through parent callbacks without marking the entry source. That made route-stop context, account context, and return behavior depend on how the screen was opened.

The Home/Login fallback was not caused by the Delivery Notes save function intentionally navigating to Home. It came from inconsistent screen entry and recovery ownership: when context was incomplete or Android recreated the app during camera capture, navigation could fall back to parent/root restoration paths instead of returning to a stable Delivery Notes route with explicit account, stop, manifest, and return metadata.

The one successful Account Knowledge camera attempt likely succeeded because that entry path happened to provide enough account context and did not immediately collide with route-stop restoration. It was not repeatable because the entry source and return destination were still implicit and the screen accepted missing route/manifest context.

## Canonical Contract

All callers now use `openDeliveryNotes(navigation, input)` from `apps/mobile/src/app/navigation/deliveryNotesNavigation.js`.

The canonical params include:

- `deliveryNotesContractVersion`
- `source`
- `returnRoute`
- `returnParams`
- `accountNumber` / `accountId`
- `destinationPlaceId`
- `accountName`
- `destinationAddress`
- `routeManifestId` / `manifestId`
- `routeStopId` / `stopId`
- `routeDate`
- `routeNumber`
- `driverId`
- `driverName`
- compatible `destinationDetails`

## Account Scope vs Route Scope

Durable Account Knowledge requires account identity:

- account number when available;
- otherwise place ID.

Route-stop Delivery Notes additionally require:

- route stop ID;
- route manifest ID;
- route date/number where available.

The code does not infer account identity from display name alone.

## Return Navigation

`DeliveryNotesScreen` now has an explicit Back control.

Return behavior:

- Home destination search returns to `Home`.
- Today Route entries return to `TodayRoute`.
- Map entries return to `Map`.
- Delivery Settlement entries return to `DeliverySettlement`.
- Account Knowledge entries preserve `source: account-knowledge` and return to the parent route/screen for the same account context.

Save behavior:

- successful save remains on Delivery Notes after authoritative refresh;
- failed save remains on Delivery Notes and preserves the draft;
- Delivery Notes does not navigate to Home or reset the root navigator after save.

## Safe Failure Behavior

`DeliveryNotesScreen` validates context before loading, picking photos, or saving. Missing account/place identity, missing route stop context for route entries, missing manifest ID with a stop ID, or missing return route now produce a visible context diagnostic. The screen does not save against an undefined account and does not default to Home.

## Files Changed

- `apps/mobile/src/app/navigation/deliveryNotesNavigation.js`
- `apps/mobile/src/app/components/AccountKnowledgePanel.js`
- `apps/mobile/src/app/screens/HomeScreen.js`
- `apps/mobile/src/app/screens/TodayRouteScreen.js`
- `apps/mobile/src/app/screens/MapScreen.js`
- `apps/mobile/src/app/screens/DeliverySettlementScreen.js`
- `apps/mobile/src/app/screens/DeliveryNotesScreen.js`
- `apps/mobile/scripts/check-mobile-private-media.cjs`
- `bridge-api/scripts/check-driver-route-notes-photo-workflow.cjs`

## Validation

Passed:

- `npm.cmd run test:mobile-private-media`
- `npm.cmd run test:driver-route-notes-photo`
- `git diff --check`

Required physical validation remains open:

- route entry camera save;
- Account Knowledge Add Note camera save;
- repeatability from both entry paths;
- Account Knowledge refresh after save;
- failure path remains on Delivery Notes without Home/Login redirect.
