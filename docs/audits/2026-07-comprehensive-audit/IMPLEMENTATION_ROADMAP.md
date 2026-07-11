# Prioritized Implementation Roadmap

## Must Do Before Any Multi-Tenant Coding

1. Resolve source-control hygiene.
2. Verify backups and restore procedure.
3. Approve data classification matrix.
4. Review endpoint protection matrix.
5. Decide Organization bootstrap/backfill strategy.

## Must Do Before Pilot

Backend `/health` and `/ready` pass in target environment; mobile build comes from controlled source; Google key restrictions and terms posture are confirmed; offline field workflows are road-tested; real admin/driver sessions verified.

## Must Do Before Production

Tenant isolation implemented/tested; DR/monitoring verified; dependency/license review complete; load tests complete; privacy and retention controls operational.

## Can Defer

KPI formula builder, FISS scoring engine, advanced AI recommendations, dashboard-builder UI.

## Should Not Build Yet

Cross-Organization benchmarking, automated AI-driven operational changes, new major services before tenant model stability.
