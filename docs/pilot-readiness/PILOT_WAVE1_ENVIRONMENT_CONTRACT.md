# Pilot Wave 1 Environment Contract

Status: DEFINED, NOT READY

This contract distinguishes missing pilot configuration from code defects. It does not
provide credentials, create secrets, provision infrastructure, or claim the pilot
environment is ready.

## Readiness Status Model

- READY
- MISSING_CONFIGURATION
- MISSING_SECRET
- OWNER_DECISION_REQUIRED
- EXTERNAL_INFRASTRUCTURE_REQUIRED
- INVALID_CONFIGURATION
- CODE_DEFECT
- NOT_REQUIRED_FOR_SELECTED_PILOT_SCOPE

## Pilot Environment Inventory

| Key or concept | Purpose | Classification | Required for pilot? | Value source | Secret? | Validation rule | Current status | Owner | Exit criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NODE_ENV | Runtime safety mode | STATIC_SAFE_CONFIGURATION | PILOT_REQUIRED | STATIC_SAFE_CONFIGURATION | No | `production` for live pilot backend | MISSING_CONFIGURATION locally | Infrastructure | Pilot backend runs with production mode. |
| DATABASE_URL | PostgreSQL connection | DATABASE | PILOT_REQUIRED | INFRASTRUCTURE_GENERATED / SECRET | Yes | Non-placeholder PostgreSQL URL | MISSING_SECRET locally | Infrastructure | Approved pilot DB URL configured in secret store. |
| DATABASE_SSL | Hosted DB TLS posture | DATABASE | PILOT_REQUIRED | STATIC_SAFE_CONFIGURATION | No | `true` unless provider documents otherwise | MISSING_CONFIGURATION locally | Infrastructure | SSL posture approved and configured. |
| CORS_ORIGIN | Browser/admin origin allowlist | WEB_ORIGIN | PILOT_REQUIRED if supervisor web UI participates | OWNER_DECISION / DERIVED_FROM_DEPLOYMENT | No | Explicit HTTPS origins, no wildcard in production | OWNER_DECISION_REQUIRED locally | Owner + infrastructure | Approved origin list configured. |
| PUBLIC_API_BASE_URL / BACKEND_PUBLIC_URL | Canonical API URL | DEPLOYMENT | PILOT_REQUIRED | DERIVED_FROM_DEPLOYMENT | No | Approved HTTPS backend URL | OWNER_DECISION_REQUIRED locally | Owner + infrastructure | Mobile and backend agree on API URL. |
| GOOGLE_MAPS_API_KEY | Server-side Google Maps | MAPS | PILOT_REQUIRED | SECRET | Yes | Present from approved pilot Google project | MISSING_SECRET locally | Owner | Key, quota, restrictions, and legal posture approved. |
| ADMIN_DASHBOARD_PASSWORD | Admin auth | AUTH | PILOT_REQUIRED | SECRET | Yes | Present non-placeholder value | MISSING_SECRET locally | Owner + infrastructure | Named admin access configured. |
| ADMIN_DASHBOARD_SECRET | Session signing | AUTH | PILOT_REQUIRED | SECRET | Yes | Non-placeholder, 32+ chars | MISSING_SECRET locally | Infrastructure | Secret stored in managed env. |
| DRIVER_API_TOKEN / TSR_DRIVER_API_TOKEN | Driver API fallback token | AUTH | PILOT_REQUIRED until driver sessions fully replace token fallback | SECRET | Yes | Present, 32+ chars | MISSING_SECRET locally | Infrastructure | Token stored outside Git. |
| ALLOW_LEGACY_DRIVER_API_TOKEN | Legacy token safety switch | AUTH | PILOT_REQUIRED | STATIC_SAFE_CONFIGURATION | No | Must not be `true` | READY locally if unset/false | Engineering | Legacy fallback disabled. |
| PHOTO_STORAGE_PROVIDER | Durable private media | MEDIA | PILOT_REQUIRED if photos/media included | STATIC_SAFE_CONFIGURATION | No | `s3` for live pilot media | MISSING_CONFIGURATION locally | Infrastructure | Durable private storage selected. |
| PHOTO_STORAGE_BUCKET / REGION / ACCESS KEYS | Object storage target | MEDIA | PILOT_REQUIRED if photos/media included | INFRASTRUCTURE_GENERATED / SECRET | Yes | Bucket, region, paired credentials | MISSING_SECRET locally | Infrastructure | Private storage credentials configured. |
| AI provider keys | Hosted AI | AI | NOT_REQUIRED_FOR_INITIAL_PILOT | SECRET | Yes | Not needed while D1 OFF and D2 production routing OFF | NOT_REQUIRED_FOR_SELECTED_PILOT_SCOPE | Owner | Separate approval before production AI. |
| Rate limits/body limits | Operational safety | RUNTIME | PILOT_CONDITIONAL | STATIC_SAFE_CONFIGURATION | No | Defaults acceptable unless pilot traffic requires tuning | READY | Engineering | Tune only with evidence. |
| Email/notification config | Outbound alerts | OBSERVABILITY | NOT_REQUIRED unless chosen alert channel | OWNER_DECISION | Conditional | Required only if email alerting is selected | NOT_REQUIRED_FOR_SELECTED_PILOT_SCOPE | Operations | Alert channel decision recorded. |

## Database Contract

Pilot database readiness means:

- PostgreSQL compatible with the application's `pg` dependency and hosted provider.
- PostGIS enabled and verified before route/hazard pilot use.
- SSL enabled unless the approved provider documents another safe posture.
- Connection pooling configured through `PG_POOL_MAX`, `PG_CONNECTION_TIMEOUT_MS`, and
  `PG_IDLE_TIMEOUT_MS`.
- All migrations through 012 applied.
- Provider-managed backup and PITR enabled before live pilot.
- Isolated restore rehearsal completed before go/no-go.
- Pilot/demo/test data separated from production and tenant-scoped.
- Named admin user exists.

## CORS / Origin Contract

If a supervisor browser/admin UI participates, `CORS_ORIGIN` must include the approved
HTTPS origin(s) and must not include `*`.

If only the mobile app calls the API, CORS does not protect mobile traffic. It still
matters for any browser-origin supervisor/admin workflow and should remain explicit in
production-like environments.

## Mobile API Endpoint Contract

Pilot mobile builds must use an approved HTTPS API endpoint. Localhost and development
fallbacks are prohibited for standalone preview/production builds. The endpoint is supplied
by EAS/build environment as `EXPO_PUBLIC_API_BASE_URL`, and the mobile config rejects
non-HTTPS standalone endpoints.
