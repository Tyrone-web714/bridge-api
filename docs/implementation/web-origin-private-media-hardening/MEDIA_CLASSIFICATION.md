# Media Classification

## Organization-Private Media

Delivery photos, receipts, signatures, notes, route evidence, and Organization-specific operational attachments are Organization-private.

Organization-private media must not be treated as platform-global and must not be exposed through unauthenticated object URLs as the target access pattern.

## Platform-Global Media

Only reviewed, sanitized, approved Shared Safety media may become platform-global. Shared media must not include driver, customer, route, manifest, receipt, sales, KPI, or private operational references.

## Compatibility Metadata

Existing public object URLs may remain in records temporarily as `legacyPublicUrl` so old records can be audited and migrated safely. New API responses should prefer authenticated application media URLs.
