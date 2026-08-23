# Pilot Wave 2 Disposable Environment

Status: COMPLETED

Wave 2 used a disposable local PostgreSQL environment only. No production database,
hosted pilot database, Render database, Organization operational data, deployment,
Cloudflare/R2 configuration, D1 activation, or D2 production routing was used.

## Mechanism

The repository did not contain a Docker Compose PostgreSQL fixture and Docker was not
available on PATH. The available local mechanism was PostgreSQL 17 installed on the
workstation.

Disposable environment:

| Setting | Value |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `55448` |
| Database | `tsr_pilot_integration_validation` |
| Cluster directory | `bridge-api/.tmp_pilot_wave2_pg` |
| Authentication | local disposable trust authentication |
| Runtime mode | `NODE_ENV=test` |
| Pilot integration marker | `PILOT_INTEGRATION_TEST=true` |
| Mutation marker | `ALLOW_MUTATING_TEST_DATA=true` |
| SSL | `DATABASE_SSL=false` for local-only disposable DB |

The connection URL used no password and was not written to repository configuration.

## Isolation Proof

The Wave 1 isolation guard accepted the target only after all required conditions were
true:

- non-production runtime
- explicit pilot integration opt-in
- explicit mutating test-data opt-in
- local host
- approved disposable port range `55440-55449`
- database name containing a validation/test marker

The approved preflight command returned:

`SAFE_TO_RUN_MUTATING_PILOT_INTEGRATION`

## Empty State

Before migrations, the database had zero public tables and no Organization records. The
database was created specifically for Wave 2 and was eligible for destruction and
recreation.

## PostgreSQL/PostGIS

PostgreSQL was reachable on `127.0.0.1:55448`.

PostGIS was available and enabled in the disposable database with extension version
`3.6.2`.

## Cleanup

After validation, the local PostgreSQL server was stopped, the temporary data directory
was removed after verifying it resolved under the backend workspace, and the environment
was recreated once to prove reset capability. The recreated database again started empty.
The recreated server was then stopped and the temporary directory removed.
