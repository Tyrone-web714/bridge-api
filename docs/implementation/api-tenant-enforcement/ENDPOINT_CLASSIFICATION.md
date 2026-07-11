# Endpoint Classification

## Public

- `/health`
- `/ready`
- `/api/driver-auth/login`
- `/api/routing/manual-hazards/admin/login`

## Authenticated Organization-Private

- `/api/drivers/*`
- `/api/route-manifests/*`
- `/api/data-imports/*`
- `/api/account-intelligence/*`
- `/api/operational-heatmaps/*`
- `/api/operational-geography/*`
- `/api/supervisor-intelligence/*`
- `/api/admin/*`
- `/api/ai/*`
- `/api/delivery-notes/*`
- `/api/routing/route-sessions/*`
- `/api/routing/manual-hazards/*`
- `/api/routing/hazard-verification/*`
- `/api/routing/hazard-location-backfill/*`
- `/api/places/*`

## Platform Admin Only

No new Platform Admin cross-Organization API was introduced in this phase.

## Deprecated Compatibility

- Shared admin password bootstrap.
- Legacy driver API token when explicitly enabled.
- Some local inline role checks retained behind centralized permission middleware.

## Unknown/Unclassified

Lower-risk public reference endpoints remain for future review:

- `/api/bridges/*`
- `/api/supervisors`
- selected platform-global hazard reference reads
