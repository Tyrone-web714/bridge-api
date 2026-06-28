# Security Architecture Review

## Driver Authentication

The mobile application currently uses a shared backend API token plus company
driver ID and device ID headers. Driver ID remains the route-assignment source
of truth. The shared token protects the API from unauthenticated public access
but does not prove an individual driver's identity.

Pilot requirements:

- Keep the shared token only in EAS/Render secrets and rotate it on exposure.
- Require active driver status before returning assigned routes.
- Register pilot devices and investigate requests with missing device IDs.
- Move to short-lived, per-driver/per-device credentials before broad
  production rollout. This requires an additive authentication contract and
  must not replace driver ID with driver name.

## Supervisor Changes

Successful POST, PUT, PATCH, and DELETE requests are written to `audit_events`
with request ID, actor type/ID, method, path, status, timestamp, and a salted
network hash. Request bodies and secrets are intentionally excluded.

## AI Data

- AI is advisory and never the operational source of truth.
- The provider is configured with storage disabled.
- Prompts must exclude raw images, signatures, access codes, secrets, and
  unnecessary personal data.
- Current AI routes send structured operational excerpts and photo metadata,
  not photo bytes. Retain prompt/result content for no more than 30 days.
- Supervisor verification remains required for operational decisions.

## Remaining External Decisions

Google Cloud key restrictions, Google heavy-vehicle use permission, legal
privacy terms, and signed customer data-processing terms require account-owner
or counsel action and cannot be certified by source-code changes.
