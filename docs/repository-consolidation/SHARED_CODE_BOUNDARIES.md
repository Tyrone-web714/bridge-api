# Shared Code Boundaries

## Guiding Rule

Create shared packages only when they reduce real drift or duplication. Do not add packages just to make the architecture look more sophisticated.

## Safe Candidates

### `packages/shared-types`

Potential content:

- Organization model types
- Driver identity types
- route manifest DTOs
- stop completion DTOs
- delivery settlement DTOs
- warehouse confirmation DTOs
- Shared Safety Intelligence DTOs
- API response envelope types
- error-code constants

### `packages/api-client`

Potential content:

- typed API wrappers for mobile and future web clients
- auth/session request helpers
- retry/idempotency header helpers
- error normalization

## Do Not Share

- backend secrets
- environment files
- database repositories
- SQL migration logic
- Express route handlers
- object-storage credentials or server adapters
- mobile-native Bluetooth/Zebra modules
- Expo config plugins
- generated QR/APK/build artifacts

## Initial Recommendation

Start with no shared packages during physical consolidation. Add `packages/shared-types` only when tenant migration creates concrete shared DTOs. Defer `api-client` until endpoint versioning and auth/session contracts are implemented.
