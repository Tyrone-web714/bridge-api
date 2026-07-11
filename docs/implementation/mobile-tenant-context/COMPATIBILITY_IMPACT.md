# Compatibility Impact

Expected compatibility impact is limited to local cache/queue partitioning.

Preserved:

- Company driver number login and display.
- Assigned route lookup by company driver number through existing backend compatibility.
- Stop completion workflow.
- Delivery settlement workflow.
- Delivery notes/photos metadata workflow.
- Barcode lookup workflow.
- Route event submission workflow.
- Printer selection behavior.

Changed:

- Sessions without trusted Organization context are rejected.
- Organization-private local caches now use v2 tenant-scoped keys.
- Ambiguous legacy queued work is quarantined instead of submitted under a guessed tenant.
- New delivery photos are written under tenant-specific document directories.