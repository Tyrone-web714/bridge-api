# D1 Historical Data Import Architecture

Status: IMPORT_READINESS_DEFINED_NO_IMPORT_EXECUTED

This package defines the controlled path for acquiring historical operational data for the Wave-1 D1 capabilities:

- `prediction.route_completion_forecast`
- `prediction.delivery_failure_risk`

It does not import production data, mutate databases, train models, benchmark D1 methods, modify D2, deploy, migrate, or activate production routing.

## Existing Import Infrastructure

| Area | Existing support | Assessment | Gap for Wave 1 |
| --- | --- | --- | --- |
| Customer/accounts | `services/bulkImport.js` supports `customers` CSV preview/commit through `/api/data-imports`. | PARTIAL | Existing importer is production master-data oriented; future historical import must require explicit `organization_id` and source provenance. |
| Products | `services/bulkImport.js` supports `products` CSV preview/commit through `/api/data-imports`. | PARTIAL | Useful for optional context only; not enough for Wave-1 route/outcome history. |
| Orders/invoices | `services/bulkImport.js` supports `orders` CSV preview/commit through `/api/data-imports`. | PARTIAL | Captures invoice/sales lines, not actual delivery outcomes or route completion labels. |
| Daily route manifests | `routes/routeManifests.js` supports planned route-manifest CSV import through `/api/route-manifests/import`. | PARTIAL | Existing route import writes immediately, uses planned route data, defaults tenant context in development, replaces stops for a manifest, and does not support historical dry-run readiness. |
| Route stops | Route manifest import builds stops with planned timing and pending status. | PARTIAL | Historical actual timestamps, status transitions, outcome labels, and source-neutral validation are missing. |
| Delivery settlements/outcomes | Repository has settlement/outcome tables and service logic. | MISSING_FOR_IMPORT | No source-neutral historical outcome importer or dry-run validator exists. |
| Driver assignment | Route manifest import can assign a registered driver. | PARTIAL | Future historical import must preserve assignment provenance and avoid driver PII where stable IDs suffice. |
| Vehicle context | Fleet/route schemas exist elsewhere. | MISSING_FOR_WAVE1_IMPORT | Vehicle context is optional and must be separately justified. |
| Quarantine/error handling | Current preview returns warnings for bulk imports. | PARTIAL | Wave-1 needs accepted/rejected/quarantined/warning records with machine-readable reason codes. |
| Idempotency | Some upserts use natural keys such as route date/number, SKU, account number, invoice. | PARTIAL | Historical imports require deterministic `organization_id + source_system + source_record_id` identity and conflict policy. |

## Architecture Decision

Extend existing import concepts rather than creating a separate import universe:

1. Source-specific files or exports map into canonical historical entities.
2. Dry-run parses, maps, validates, classifies, and reports with zero writes.
3. Invalid records are rejected or quarantined before any production import.
4. Accepted historical records preserve tenant ownership and provenance.
5. Representative dataset freeze runs only after import reconciliation and readiness checks.

No raw export may proceed directly to training or D1 method benchmarking.
