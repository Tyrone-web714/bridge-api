# Truck-Safe Routing Historical Data Request

Truck-Safe Routing is requesting historical route, stop, and delivery outcome data from an authorized pilot Organization. The immediate purpose is offline validation and predictive-method evaluation. The export will not activate automated operational decisions, production routing, driver scoring, dispatch changes, or customer-facing actions.

## Intended Recipients

This request is intended for IT, data engineering, TMS administrators, ERP administrators, WMS administrators, business intelligence teams, transportation operations analysts, and authorized technical project owners.

## Requested Data Domains

| Domain | Purpose |
| --- | --- |
| Route manifest history | Validate route-level planned and actual completion patterns. |
| Route stop and delivery history | Validate stop-level timing and delivery attempt history. |
| Delivery outcome and non-delivery history | Preserve the original operational status codes needed to derive delivery outcome labels. |
| Account identifiers and operational context | Join stops to stable operational customer/account identifiers without customer contact PII. |
| Route and depot context | Evaluate coverage across route types, depots, and operating locations. |
| Driver and vehicle identifiers, only where approved | Support approved operational pattern analysis using stable IDs only. |

## Stable Identifiers

Please provide stable internal identifiers wherever possible:

- route ID or route number;
- stop ID;
- account/customer ID;
- depot/location ID;
- driver ID, only if approved and needed;
- vehicle ID, only if approved and needed;
- source-system record ID.

Identifiers should remain stable across the requested historical period. Do not include employee names, customer names, or contact names merely for convenience.

## Organization Ownership

The export does not need to include Truck-Safe Routing's internal Organization UUID unless one has already been assigned and approved. The export may include an approved Organization code, company code, or source-system tenant code. Truck-Safe Routing will map that code to its internal `organization_id` during controlled import.

Every file and export batch must have unambiguous Organization ownership. Ambiguous Organization ownership will block acceptance.

## Historical Period

Provide the broadest approved period that can be exported safely and consistently.

- Minimum useful export: enough route and stop history to test parsing, joins, timestamp handling, outcome-code mapping, and basic quality checks.
- Preferred initial evaluation period: enough consecutive operational history to evaluate route variety, depot coverage, normal and exception outcomes, and time-aware validation splits.
- Longer seasonal-validation period: additional history covering seasonal, holiday, route-mix, and operational variation when available.

No fixed number of days or months automatically makes the data representative. Truck-Safe Routing will validate actual coverage and representativeness after receipt.

## Formats

Preferred format is CSV with UTF-8 encoding, a header row, consistent delimiter, and stable date/time representation. XLSX, database extracts, or API exports are acceptable when separately coordinated.

## Timezone

All timestamps must have a known timezone. Preferred format is ISO 8601 with offset, such as `YYYY-MM-DDTHH:MM:SS-05:00`. If local timestamps are exported without offsets, include a documented timezone for the dataset, depot, or operating location.

Ambiguous timestamps must not silently enter representative datasets.

## Data Dictionary

Please include a source data dictionary when available. At minimum, document field meanings, status codes, outcome codes, units, timezone, null or sentinel conventions, whether timestamps are planned or actual, and whether records can be revised retroactively.

## Privacy and Data Minimization

Use operational identifiers instead of names or contact details. Unless separately approved, do not include driver names, home addresses, personal phone numbers, personal email, customer contact names, customer phone or email, payment card information, banking information, SSNs, free-form personnel notes, HR records, disciplinary records, medical information, images, or photos.

## Driver Data Boundary

If a driver identifier is approved for analysis, provide only a stable Organization-scoped driver ID. Do not include driver names unless separately justified and approved. Driver identity is used only for approved operational pattern analysis and is not intended to become an AI workforce scoring system.

## Account Data Boundary

Provide stable account or customer operational IDs where necessary to connect stops and outcomes. Do not include contact-person information. Address or geographic fields should remain outside this Wave-1 request unless a later approved route feature explicitly requires them.

## Secure Transfer

Use an approved secure enterprise file transfer, approved encrypted cloud storage, approved connector/import channel, or another mutually approved secure mechanism. Do not email sensitive raw operational exports as ordinary attachments unless the Organization's approved security policy specifically permits it.

Do not put credentials, API keys, passwords, access tokens, or authorization headers inside export files.

## Review Process

Truck-Safe Routing will review the export with dry-run parsing, tenant/provenance validation, schema validation, quality checks, target validation, leakage audit, and representativeness assessment before any predictive method benchmarking.
