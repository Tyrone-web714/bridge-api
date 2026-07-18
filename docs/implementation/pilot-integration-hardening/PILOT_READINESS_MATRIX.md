# Pilot Readiness Matrix

| Capability | Status | Evidence | Blocker | Required Before Pilot |
| --- | --- | --- | --- | --- |
| Driver authentication | READY WITH LIMITATION | Prior device validation/source review | No | Repeat invalid/revoked edge tests. |
| Driver route execution | READY | Local runtime | No | None for controlled pilot. |
| Offline queue | READY WITH LIMITATION | Source review | No | Physical offline/reconnect test. |
| Map/navigation | READY WITH LIMITATION | Prior device validation | No | Reconfirm current APK before pilot route. |
| Warehouse workflow | READY | Local runtime | No | Browser/mobile UI walkthrough. |
| Route closeout | READY | Local runtime | No | None. |
| Supervisor dashboard | READY WITH LIMITATION | Source review | No | Browser walkthrough. |
| Route management | READY WITH LIMITATION | Source review/local runtime | No | Upload/assignment smoke test on target deployment. |
| Shared Safety | READY | Local runtime | No | None for controlled pilot. |
| BI/KPI | READY | Local runtime | No | None for controlled pilot. |
| Logistics Intelligence | READY | Local runtime | No | None for controlled pilot. |
| FISS | READY | Local runtime | No | None for controlled pilot. |
| Tenant isolation | READY | Local runtime | No | Continue regression coverage. |
| RBAC | READY | Automated/local runtime | No | Continue regression coverage. |
| Audit | READY WITH LIMITATION | Source review | No | Extract audit sample during deployment smoke. |
| Backup/restore readiness | READY WITH LIMITATION | Documentation | No | Owner must verify provider restore drill. |
| Deployment readiness | READY WITH LIMITATION | Config review/planned health checks | No | Target Render smoke before pilot. |
| Production migration readiness | READY WITH LIMITATION | Isolated migrations | No | Production backup and release approval. |

Pilot recommendation: CONDITIONAL GO for a controlled pilot after device offline/reconnect and deployment smoke are completed.

