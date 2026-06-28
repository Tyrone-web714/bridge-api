# Privacy and Retention Policy

Status: production-pilot engineering baseline; counsel and customer approval required before external production use.

## Principles

- Collect only data needed to execute, verify, settle, and audit deliveries.
- Company driver ID is the route-assignment source of truth. Driver names are display metadata.
- Do not use customer or driver data to train general-purpose AI models.
- Restrict data by supervisor role, territory, route assignment, and operational need.
- Log administrative mutations without storing request bodies, secrets, signatures, photos, or precise IP addresses.

## Retention Schedule

| Data class | Default pilot retention | Disposal |
| --- | ---: | --- |
| Driver GPS trail and route events | 90 days after route closeout | Delete database events and derived replay records |
| Delivery notes and failure reasons | 1 year | Delete or anonymize by customer contract |
| Delivery photos | 90 days after route closeout | Delete object and metadata |
| Customer and driver signatures | 1 year | Delete signature payload and receipt copy |
| Receipts and settlement documents | 7 years, unless customer policy is shorter | Secure deletion after legal/accounting hold |
| Route manifests and inventory records | 1 year | Delete or archive under customer instructions |
| AI prompts/results and usage telemetry | 30 days | Delete prompt/result content; retain aggregate cost metrics |
| Audit events | 1 year | Delete expired rows, except active investigations |
| Authentication/session records | 90 days | Delete expired sessions and login telemetry |
| Google Places/Directions transient content | Request/session only | Do not persist; Place IDs may be retained |

Legal holds and signed customer requirements override these defaults. The data
owner must record every override with scope, approver, and expiration date.

## Sensitive Data Controls

- Secrets belong only in Render/EAS secret stores or local ignored `.env` files.
- Photos, signatures, receipts, and GPS data must use encrypted transport and
  access-controlled durable storage.
- Production exports must be encrypted, access logged, time limited, and
  deleted after their approved purpose.
- Incidents involving unauthorized access must be escalated to the designated
  customer and company contacts under the pilot agreement.
