# Pilot External Dependencies

Status: BLOCKED until owner-managed dependencies are confirmed.

External blockers:

| Dependency | Owner action required | Pilot impact |
| --- | --- | --- |
| Pilot Organization | Approve Organization, routes, dates, users, drivers, devices, support contacts, and success metrics. | Blocks any live pilot. |
| Google Maps | Confirm account, billing/quota, key restrictions, attribution, terms/legal review, and approved data-use posture. | Blocks compliant routing and map use. |
| Hosted backend environment | Confirm production secrets, CORS, database, PostGIS, durable media storage, driver token, and named admins. | Blocks trustworthy live execution. |
| Backup provider | Confirm backup/PITR and isolated restore rehearsal. | Blocks recoverability. |
| Pilot devices/support | Provide devices, device ownership, install path, support contacts, and incident communications. | Blocks field execution. |

Optional external dependencies:

- SSO/identity provider, if required by the pilot Organization.
- Mobile device management, if required for device distribution.
- Customer data export provider, if route/order/customer data cannot be supplied in the expected pilot format.
