# CORS Architecture

## Production Rule

Production CORS uses an explicit allowlist from `CORS_ORIGIN`. Wildcard browser access is rejected when `NODE_ENV=production`.

## Current Production Behavior

The deployed backend currently serves the supervisor/admin dashboard from the same Render origin. Same-origin browser traffic is preserved. React Native mobile traffic is not governed by browser CORS.

## Future Web Frontend

If the dashboard is later hosted separately, its exact origin must be added to `CORS_ORIGIN`, comma-separated if more than one origin is approved.

Status for future frontend domain: OWNER_CONFIGURATION_REQUIRED.

Examples:

```text
https://truck-safe-routing-api.onrender.com
https://dashboard.example.com
```

## Validation

`npm.cmd run test:web-origin` verifies:

- explicit production origins are accepted;
- unapproved origins are denied;
- malformed origins are rejected;
- wildcard production CORS is rejected;
- no-origin service requests remain allowed.
