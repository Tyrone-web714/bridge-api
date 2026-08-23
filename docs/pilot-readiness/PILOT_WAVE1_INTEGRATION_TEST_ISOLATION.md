# Pilot Wave 1 Integration Test Isolation

Status: READY FOR ISOLATED PREFLIGHT, NOT EXECUTED

`validate:pilot-integration` remains a mutating runtime validator. Wave 1 adds fail-closed
guards and a preflight check but does not run the mutating validator.

## Database Target

The validator uses `DATABASE_URL` through the backend PostgreSQL module.

Safe execution requires:

- `NODE_ENV` is not `production`
- `PILOT_INTEGRATION_TEST=true`
- `ALLOW_MUTATING_TEST_DATA=true`
- `DATABASE_URL` targets `127.0.0.1` or `localhost`
- database port is in the `55440-55449` disposable validation range
- database name contains a test/validation/disposable marker

## Disposable Profile

| Setting | Contract |
| --- | --- |
| Host | `127.0.0.1` or `localhost` |
| Port | `55440-55449` |
| Database name | Contains `pilot_integration`, `validation`, `disposable`, or `test` |
| Environment marker | `PILOT_INTEGRATION_TEST=true` |
| Mutation marker | `ALLOW_MUTATING_TEST_DATA=true` |
| Production protection | `NODE_ENV` must not be `production` |
| Migration prerequisite | migrations through 012 applied to disposable DB |
| Cleanup strategy | recreate/drop disposable database after run |

## Mutation Manifest

| Entity area | Operation | Test identity | Cleanup behavior | Tenant identity |
| --- | --- | --- | --- | --- |
| Organizations | create/update | `demo-fleet-a`, `demo-fleet-b` | recreate/drop DB | demo org IDs |
| Drivers | create/update | `D-pilot-*`, `D-OTHER-pilot-*` | recreate/drop DB | demo org IDs |
| Warehouse employee | create/update | `WH-pilot-*` | recreate/drop DB | demo org ID |
| Route manifest | create/update | `pilot-route-*` | recreate/drop DB | demo org ID |
| Stops | create/update | `pilot-stop-*` | recreate/drop DB | demo org ID |
| Account orders | create/update | `pilot-order-*` | recreate/drop DB | route/org derived |
| Products | create/update | `PILOT-*` | recreate/drop DB | shared test product data |
| Settlements | create/update | route/stop derived | recreate/drop DB | driver/org derived |
| BI/KPI | create/update | `pilot_route_completion_*` | recreate/drop DB | demo org ID |
| Logistics Intelligence | create/update | `route-delay-*`, `delivery-exception-*` | recreate/drop DB | demo org ID |
| FISS | create/update | `pilot_route_score_*` | recreate/drop DB | demo org ID |
| Shared safety records | create/update | low bridge demo candidate | recreate/drop DB | sanitized shared record |
| Route session events | create/update | `route-session-*` | recreate/drop DB | route/session derived |

## Safe-Run Preflight

Command:

`npm.cmd run pilot-integration:preflight`

Expected result without an approved disposable DB and opt-ins:

`BLOCKED`

Expected result only when every isolation condition is met:

`SAFE_TO_RUN_MUTATING_PILOT_INTEGRATION`

This package did not run the mutating validator.
