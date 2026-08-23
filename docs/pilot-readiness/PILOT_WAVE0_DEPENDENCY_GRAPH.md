# Pilot Wave 0 P0 Dependency Graph

Blockers should not be attacked alphabetically. The actual order is driven by owner
decisions, environment readiness, safe test isolation, then physical validation.

```text
PILOT-P0-010 pilot scope authorization
  -> PILOT-P0-004 real Organization data freeze
  -> PILOT-P0-007 Google Maps/legal/quota readiness
  -> PILOT-P0-005 backup/PITR and restore readiness
  -> PILOT-P0-006 observability/support alert readiness
  -> PILOT-P0-008 support and rollback runbook
  -> pilot backend/database/mobile endpoint configuration
  -> safe isolated validate:pilot-integration run
  -> PILOT-P0-003 current APK artifact and install evidence
  -> PILOT-P0-001 offline/reconnect/restart replay
  -> PILOT-P0-009 tenant isolation under offline/media replay
  -> PILOT-P0-002 field safety route validation
  -> live pilot go/no-go
```

## Parallel Work

Can proceed in parallel after scope authorization:

- Google Maps/legal/quota verification.
- Backup/PITR and restore rehearsal planning.
- Support/rollback runbook finalization.
- Pilot data mapping.
- APK artifact identification.
- Field test route fixture design.

Must wait for environment/data decisions:

- Safe pilot integration run.
- Pilot APK build verification.
- Device offline replay.
- Road safety validation.
