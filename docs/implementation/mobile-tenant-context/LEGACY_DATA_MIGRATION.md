# Legacy Data Migration

Legacy local data is handled additively.

Rules:

- Preserve original v1 keys.
- Record a tenant-scoped migration marker after migration/quarantine.
- Migrate only records that clearly match the authenticated company driver number.
- Quarantine ambiguous or mismatched records.
- Do not silently discard queued work.
- Do not assign ambiguous data to a real customer Organization.

Current handling:

- Route cache: matching company-driver route cache is copied to v2 tenant key on read.
- Stop queue: matching driver operations migrate; mismatches quarantine.
- Delivery queue: matching driver operations migrate; ambiguous/mismatched records quarantine.
- Route event queue: legacy events quarantine because the v1 queue lacks trusted Organization/internal-driver identity.
- Notes/barcode caches: copied on authenticated read into tenant-scoped cache.