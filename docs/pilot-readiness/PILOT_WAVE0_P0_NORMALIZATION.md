# Pilot Wave 0 P0 Normalization

Original P0 count: 10

Normalized true P0 count: 10

Downgraded P0s: none

Every original P0 remains pilot-blocking because each condition can make the limited
one-depot, two-to-three-driver pilot unsafe, insecure, operationally unrecoverable, or
unable to produce useful evidence.

## Classification Counts

| Primary classification | Count |
| --- | ---: |
| ENGINEERING_DEFECT | 0 |
| ENVIRONMENT_CONFIGURATION | 1 |
| STALE_VALIDATOR_OR_TOOLING | 0 |
| FIELD_VERIFICATION_REQUIRED | 3 |
| EXTERNAL_DEPENDENCY | 2 |
| OPERATIONAL_PROCESS_REQUIRED | 3 |
| GOVERNANCE_OWNER_DECISION | 1 |

## P0 Details

| Gap | Title | Primary classification | Secondary classification | Code change? | Config? | Owner/external? | Field test? | Exit criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PILOT-P0-001 | Physical offline/reconnect/restart replay unverified | FIELD_VERIFICATION_REQUIRED | OPERATIONAL_PROCESS_REQUIRED | No defect proven | No | Device access required | Yes | Physical-device replay passes with no duplicate mutation or tenant violation. |
| PILOT-P0-002 | Field safety behavior unverified | FIELD_VERIFICATION_REQUIRED | EXTERNAL_DEPENDENCY | No defect proven | Maps/data may be required | Route and observer needed | Yes | Representative route validates low bridge, no-truck, residential, hazard, deviation, and stale-route behavior. |
| PILOT-P0-003 | Current APK/build artifact unverified | OPERATIONAL_PROCESS_REQUIRED | ENVIRONMENT_CONFIGURATION | No defect proven | Mobile build env required | Device/install owner required | Parking-lot install test | Approved APK identifier, backend target, install, and device evidence captured. |
| PILOT-P0-004 | Real pilot Organization data not frozen | EXTERNAL_DEPENDENCY | GOVERNANCE_OWNER_DECISION | No | No | Yes | No | Organization, users, drivers, devices, routes, stops, and contacts approved and dry-run imported. |
| PILOT-P0-005 | Backup/PITR and restore rehearsal missing | ENVIRONMENT_CONFIGURATION | OPERATIONAL_PROCESS_REQUIRED | No | Yes | Backup tier owner required | No | Backup/PITR confirmed and isolated restore rehearsal passes. |
| PILOT-P0-006 | Alert delivery and dashboard walkthrough missing | OPERATIONAL_PROCESS_REQUIRED | ENVIRONMENT_CONFIGURATION | No defect proven | Alert endpoints/recipients required | Support owners required | No | Named recipients and operational walkthrough evidence recorded. |
| PILOT-P0-007 | Google Maps account/legal/quota unconfirmed | EXTERNAL_DEPENDENCY | GOVERNANCE_OWNER_DECISION | No | Maps keys/restrictions required | Yes | No | Owner confirms account, quota, restrictions, attribution, and legal/compliance readiness. |
| PILOT-P0-008 | Support and rollback procedure incomplete | OPERATIONAL_PROCESS_REQUIRED | GOVERNANCE_OWNER_DECISION | No | No | Support owner required | No | Support owner, escalation path, rollback tree, communication plan, and evidence capture approved. |
| PILOT-P0-009 | Tenant isolation under offline/media replay unproven | FIELD_VERIFICATION_REQUIRED | OPERATIONAL_PROCESS_REQUIRED | No defect proven | No | Pilot-equivalent devices/data required | Yes | Tenant isolation passes across API, mobile, queue, media, and supervisor workflows. |
| PILOT-P0-010 | Pilot scope authorization missing | GOVERNANCE_OWNER_DECISION | EXTERNAL_DEPENDENCY | No | No | Yes | No | Pilot scope packet approved before live route execution. |

## Known Non-P0 Validator Finding

`validate:production-rollout` is classified as VALIDATOR_STALE_ONLY. It is a quick win
but not one of the original ten P0 pilot blockers because it does not by itself make a
limited field pilot unsafe. It can block release confidence if left unreconciled.

## Known Non-P0 Local Environment Finding

Backend `verify:production` currently fails in local development because `DATABASE_URL` is
placeholder-like and `CORS_ORIGIN` is missing. This is expected locally and becomes a P0
pilot environment gate only when validating the actual pilot backend environment.
