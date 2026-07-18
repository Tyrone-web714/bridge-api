# Production Environment Inventory

| Variable | Subsystem | Required | Visibility | Secret | Validation |
| --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | runtime | required | server | no | Render/env inspection |
| `PORT` | runtime | optional on Render | server | no | health check |
| `DATABASE_URL` | database | required | server | yes | `verify:production`, preflight |
| `DATABASE_SSL` | database | required for hosted DB | server | no | `verify:production` |
| `GOOGLE_MAPS_API_KEY` | maps | required | server | yes | `verify:production`; Google console restriction review |
| `ADMIN_DASHBOARD_PASSWORD` | admin bootstrap | required fallback | server | yes | `verify:production` |
| `ADMIN_DASHBOARD_SECRET` | admin session | required | server | yes | `verify:production` |
| `ADMIN_DASHBOARD_ADMINS` | admin | optional | server | no | env inspection |
| `ADMIN_DASHBOARD_ROLE` | admin | optional | server | no | env inspection |
| `DRIVER_API_TOKEN` | legacy driver compatibility | optional but deployed docs list it | server/mobile public counterpart | yes | ensure strong if enabled |
| `ALLOW_LEGACY_DRIVER_API_TOKEN` | auth compatibility | required false | server | no | `verify:production` |
| `CORS_ORIGIN` | web/API | required | server | no | `verify:production` |
| `BACKEND_PUBLIC_URL` | links/deployed checks | required | server | no | deployed smoke |
| `OPENAI_API_KEY` | AI | optional | server | yes | secret audit |
| `OPENAI_MODEL` | AI | optional | server | no | env inspection |
| `PHOTO_STORAGE_PROVIDER` | files | required | server | no | `verify:production` |
| `PHOTO_STORAGE_BUCKET` | files | required for s3 | server | no | `verify:production` |
| `PHOTO_STORAGE_REGION` | files | required for s3 | server | no | `verify:production` |
| `PHOTO_STORAGE_ENDPOINT` | files | provider-specific | server | no | storage smoke |
| `PHOTO_STORAGE_ACCESS_KEY_ID` | files | provider-specific | server | yes | storage smoke |
| `PHOTO_STORAGE_SECRET_ACCESS_KEY` | files | provider-specific | server | yes | storage smoke |
| `PHOTO_STORAGE_PUBLIC_BASE_URL` | files | required for s3 | server | no | upload/open smoke |

Legacy warning:

- `ALLOW_LEGACY_DRIVER_API_TOKEN=true` must not be enabled in production rollout without explicit security approval.
