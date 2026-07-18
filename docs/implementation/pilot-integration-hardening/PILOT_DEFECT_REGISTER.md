# Pilot Defect Register

| ID | Severity | Workflow | Symptom | Root Cause | Affected Files | Impact | Fix Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PIH-001 | High | Warehouse inventory | Driver could have assigned route while warehouse inventory workflow could fail to find it when assignment used company driver number. | Some warehouse/inventory joins matched only `driver.driver_id = manifest.assigned_driver_id`. | `bridge-api/db/repositories.js` | Pilot blocker for driver-ID source-of-truth route assignment and warehouse departure/return. | Fixed | `npm.cmd run validate:pilot-integration` passes. |
| PIH-002 | Low | Validator | Logistics pilot validator expected recommendations from a success-only route completion event. | Validator used event outside Logistics catalog. | `bridge-api/scripts/validate-pilot-integration-runtime.cjs` | Validation false negative only. | Fixed | Validator uses `route_delay` and `delivery_exception`. |
| PIH-003 | Low | Validator | Shared Safety validator expected candidate return shape from approval. | Approval service returns published shared record. | `bridge-api/scripts/validate-pilot-integration-runtime.cjs` | Validation false negative only. | Fixed | Shared Safety publication assertion passes. |
| PIH-004 | Medium | Dashboard verification | Server-rendered supervisor pages not browser-click tested in this phase. | Environment/time limitation. | N/A | Possible UI issue could remain. | Open limitation | Documented as pre-pilot walkthrough item. |
| PIH-005 | Medium | Offline sync | Physical offline/reconnect queue replay not rerun in this phase. | Requires physical-device procedure. | Mobile source `C:\dev\tsr-mobile` | Field sync edge case may remain. | Open limitation | Prior source/physical validation exists for related session flow. |

Unresolved Critical defects: none.

Unresolved High defects: none after PIH-001 fix.

