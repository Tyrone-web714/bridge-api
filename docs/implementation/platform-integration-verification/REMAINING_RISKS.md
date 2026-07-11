# Remaining Risks

## High Priority Operational Risks

1. Physical-device offline/online sync validation is not complete.
   Impact: A pilot driver could expose defects that automated tenant-context tests do not catch.
   Mitigation: Execute the full phone scenario before starting a new major subsystem.

2. Authenticated supervisor/admin page-by-page smoke testing is incomplete.
   Impact: Admin pages may have role/session/runtime regressions that unauthenticated checks cannot detect.
   Mitigation: Use approved supervisor credentials to verify each page with test data.

3. Warehouse inventory workflows require credentialed runtime verification.
   Impact: Departure and return inventory checks may not be fully proven end-to-end.
   Mitigation: Test with warehouse employee credentials using non-production or approved pilot test data.

## Medium Priority Risks

4. Render deployed commit SHA was not confirmed through provider metadata.
5. Legacy mobile local data may exist on prior test devices and must be quarantined or migrated.
6. Places, Street View, photo proxy, and recent destination runtime behavior still depends on configured provider keys and quotas.

## Accepted Non-Blocking Findings

Ignored local artifacts exist, including `.env`, logs, `node_modules`, temporary PostgreSQL validation folders, and generated data folders. They are not staged and should remain ignored.
