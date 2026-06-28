# Environment Variable Inventory

Values must be stored in Render/EAS secret stores and never committed.

## Backend Required

- `DATABASE_URL`, `DATABASE_SSL`
- `ADMIN_DASHBOARD_PASSWORD`, `ADMIN_DASHBOARD_SECRET`
- `DRIVER_API_TOKEN`
- `GOOGLE_MAPS_API_KEY`
- `PHOTO_STORAGE_PROVIDER`, bucket/region/endpoint credentials
- `OPENAI_API_KEY` only when AI is enabled

## Backend Security Tuning

- `REQUEST_BODY_LIMIT` default `1mb`
- `DELIVERY_BODY_LIMIT` default `30mb`
- `MANIFEST_BODY_LIMIT` default `12mb`
- `IMPORT_BODY_LIMIT` default `15mb`
- `RATE_LIMIT_WINDOW_MS` default 15 minutes
- `RATE_LIMIT_GLOBAL_MAX`, `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_DRIVER_MAX`
- `RATE_LIMIT_PLACES_MAX`, `RATE_LIMIT_AI_MAX`, `RATE_LIMIT_UPLOAD_MAX`
- `AUDIT_LOG_HASH_SECRET`

## Mobile Build

- `EXPO_PUBLIC_API_BASE_URL` must be HTTPS for preview/production.
- `EXPO_PUBLIC_ANDROID_MAPS_API_KEY` must be Android-app restricted.
- `EXPO_PUBLIC_DRIVER_API_TOKEN` must match the backend pilot token.
- `EXPO_PUBLIC_APP_ENV` is set by EAS profile.

Use `.env.example` files as names-only templates. Release evidence must list
which variables are configured, never their values.
