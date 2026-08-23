# Pilot Wave 0 Remediation Order

This order is based on dependency reduction, not file order.

| Rank | Gap or cluster | Why this comes next | Dependencies | Engineering complexity | External complexity | Parallel? |
| --- | --- | --- | --- | --- | --- | --- |
| P0-1 | PILOT-P0-010 pilot scope authorization | All later work depends on knowing who, where, what, and success criteria. | None | SMALL | HIGH | No |
| P0-2 | PILOT-P0-004 pilot Organization data freeze | Data drives import rehearsal, tenant checks, routes, and field fixtures. | P0-010 | MEDIUM | HIGH | Partial |
| P0-3 | Pilot environment decisions | Required to resolve `DATABASE_URL`, `CORS_ORIGIN`, mobile endpoint, storage, backup, and secrets. | P0-010 | SMALL | HIGH | Yes |
| P0-4 | PILOT-P0-007 Google Maps/legal/quota | Must be approved before map/routing evidence can support a live pilot. | P0-010 | SMALL | HIGH | Yes |
| P0-5 | PILOT-P0-005 backup/PITR restore readiness | Recoverability must exist before live data. | Environment decisions | MEDIUM | MEDIUM | Yes |
| P0-6 | PILOT-P0-006 observability and alert delivery | Pilot incidents need named recipients and evidence capture. | Environment/support owners | MEDIUM | MEDIUM | Yes |
| P0-7 | PILOT-P0-008 support and rollback runbook | Needed before field or live operations. | P0-010 | SMALL | MEDIUM | Yes |
| P0-8 | PILOT-P0-003 APK artifact/install evidence | Device validation depends on approved backend endpoint and maps key. | Environment/mobile decisions | MEDIUM | MEDIUM | Partial |
| P0-9 | PILOT-P0-001 and PILOT-P0-009 offline/tenant replay | Core integrity and tenant evidence before road testing. | APK, data fixture, isolated env | MEDIUM | LOW | No |
| P0-10 | PILOT-P0-002 field safety validation | Final field proof after controlled lab/device evidence. | APK, route fixture, maps approval, observer | LARGE | HIGH | No |

## Quick Wins

| Quick win | Why it helps | Pilot impact |
| --- | --- | --- |
| Update stale `validate:production-rollout` migration expectation in a separate package | Removes false release-confidence failure caused by valid migrations 011 and 012. | Shortens Wave 1 validation path. |
| Document pilot environment variables and owner-provided values | Turns `DATABASE_URL` and `CORS_ORIGIN` from vague failures into a setup checklist. | Shortens configuration readiness. |
| Add or document an isolated pilot integration safe-run profile | Makes seeding requirements explicit before running `validate:pilot-integration`. | Reduces risk of accidental data mutation. |
| Finalize support/rollback runbook template | Internally controllable once owners are named. | Improves go/no-go readiness. |

Do not implement these quick wins inside Wave 0.
