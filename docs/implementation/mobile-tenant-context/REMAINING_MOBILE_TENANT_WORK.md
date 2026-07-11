# Remaining Mobile Tenant Work

Remaining before merge/pilot release:

- Run device-level Expo smoke tests with a real authenticated driver session.
- Verify legacy migration/quarantine on a device with existing unscoped queued work.
- Confirm route-event queue behavior during offline navigation.
- Confirm delivery photos persist and upload from tenant-scoped directories.
- Add deeper unit tests with mocked AsyncStorage/SecureStore when a mobile test runner is introduced.
- Review whether the device-level printer selection should be cleared on logout for customer policy reasons.