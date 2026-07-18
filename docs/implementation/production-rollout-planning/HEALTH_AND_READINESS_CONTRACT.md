# Health And Readiness Contract

## `/health`

Proves:

- Process is alive.
- Service can respond.
- Reports configured database mode, PostGIS status, photo storage status, AI status, driver auth configuration, and uptime.

Does not prove:

- Full dependency readiness.
- Authentication works.
- Tenant isolation works.

## `/ready`

Proves:

- Google Maps key present.
- Admin password/secret present.
- Database configured and reachable.
- PostGIS enabled.
- Photo storage configured and durable.
- Driver authentication configured.

Does not prove:

- Production backup exists.
- Actual object upload/read works.
- Supervisor login succeeds.
- Mobile route execution succeeds.

Sensitive details:

- `/ready` masks database errors as a generic readiness failure. Continue avoiding credential or host leakage.
