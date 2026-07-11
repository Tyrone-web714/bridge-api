# Mobile Architecture Audit

## Stack

Expo/React Native app at `C:\dev\tsr-mobile` using React Navigation, React Native Maps, Location, Camera, Image Picker, AsyncStorage, SecureStore, Speech, WebView, Signature Canvas, and Bluetooth Classic.

## Strengths

Driver login, assigned-route cache, stop-sync queue, delivery operation queue, delivery notes cache, route event queue, barcode scanner, signatures, route inventory, warehouse inventory, final inventory closeout, hazard reporting, Zebra printer service, and map/truck marker UI exist in source.

## Findings

- TSR-AUD-003 High: offline queues lack Organization context. Phase 8.
- High: mobile source has no remote and many untracked files; build reproducibility risk. Phase 0.
- Medium: large screens such as `MapScreen.js` and `DeliverySettlementScreen.js` carry regression/performance risk.
- Medium: background sync is timer/app-state based; OS background guarantees are limited.
- Medium: Zebra print confirmation must be tested on real device/printer.
- Low: QR/build artifacts and sprite assets should be separated from source governance or documented.

## Required Mobile Tenant Data

Driver session, route cache, stop updates, delivery operations, notes/photos/signatures, route events, inventory closeouts, printer closeout confirmations, and hazard reports must include Organization context after migration.
