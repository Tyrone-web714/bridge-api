# Pilot Wave 1 Owner Decisions

These decisions remain owner/infrastructure supplied. Wave 1 does not silently choose them.

| Decision | Required value | Source |
| --- | --- | --- |
| Pilot backend host | Approved HTTPS backend deployment target | Owner + infrastructure |
| Pilot database/provider | Hosted PostgreSQL provider and database URL | Infrastructure |
| Pilot DB tier | Capacity, SSL, backup/PITR tier | Infrastructure |
| Backup/PITR | Backup policy, restore point objective, restore rehearsal owner | Infrastructure |
| Frontend/supervisor origin | Approved HTTPS origin for browser/admin UI if included | Owner + infrastructure |
| Mobile API endpoint | HTTPS URL embedded in pilot APK | Owner + mobile build owner |
| Object storage | Private durable media bucket/region/endpoint | Infrastructure |
| Secret storage | Hosted env/EAS/vault mechanism | Infrastructure |
| Google Maps | Pilot project, billing/quota, key restrictions, legal/terms posture | Owner |
| D2 posture | OFF or SHADOW_ONLY; no production routing | Owner |
| D1 posture | OFF | Owner |
| Photos/media | Include or exclude in first pilot | Owner + operations |
| Pilot integration execution | Approval to run only against disposable local/staging DB | Owner + engineering |

No production credential values are recorded in repository documentation.
