# Pilot Wave 2 Repeatability

Status: PASSED

## Same-Database Rerun

`validate:pilot-integration` was run twice against the same disposable database after
migrations. Both runs passed.

The validator generates a unique run ID, so repeatability is additive rather than a claim
that the exact same route/stop payload can be replayed without new records. Operation-level
idempotency is asserted inside the validator where supported, including truck inventory
addition by client operation ID.

## Cleanup / Recreate

After successful execution:

1. The local PostgreSQL server was stopped.
2. The resolved `.tmp_pilot_wave2_pg` path was verified to be under the backend workspace.
3. The disposable data directory was removed.
4. The PostgreSQL cluster was recreated.
5. The validation database was recreated.
6. The recreated database was verified empty.
7. The recreated server was stopped and the temporary data directory was removed.

## Operational Procedure

For deterministic future Wave 2 reruns:

1. Create a fresh disposable local PostgreSQL/PostGIS database on port `55440-55449`.
2. Run `pilot-integration:preflight` with explicit opt-ins.
3. Apply migrations `001` through `012`.
4. Run `validate:pilot-integration`.
5. Destroy or recreate the disposable environment before using results as clean evidence.

Do not reuse this procedure against production, hosted pilot, or real Organization data.
