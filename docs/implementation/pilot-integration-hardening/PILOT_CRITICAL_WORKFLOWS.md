# Pilot-Critical Workflows

| Workflow | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Driver login/session | READY WITH LIMITATION | Prior physical validation, source review | Cold restart was previously physically validated; invalid/revoked edge cases remain follow-up device tests. |
| Assigned route delivery | READY | Local runtime | Driver route lookup resolves assigned route by Organization and driver identifiers. |
| Route cache | READY WITH LIMITATION | Source review | Cache tenant/driver checks exist; full physical offline replay not rerun here. |
| Offline stop completion | READY WITH LIMITATION | Source review | Mobile queues exist; physical offline mutation test deferred. |
| Offline delivery operations | READY WITH LIMITATION | Source review | Queues and backend idempotency paths exist. |
| Notes/photos | READY WITH LIMITATION | Source review | Metadata and object storage paths exist; failed upload retry not physically injected. |
| Route events | READY | Local runtime | Route event persisted and counted. |
| Navigation/map/truck marker | READY WITH LIMITATION | Prior physical validation | Map and marker were previously validated on device; not rerun here. |
| Warehouse departure | READY | Local runtime | Employee ID alone rejected; authenticated warehouse print confirmation passed. |
| Warehouse return | READY | Local runtime | Final inventory closeout and print confirmation passed. |
| Inventory reconciliation | READY | Local runtime | Added inventory, returns, damaged/missing accounting validated. |
| Route closeout | READY | Local runtime | Completed-with-exceptions route closeout passed. |
| Supervisor route visibility | READY WITH LIMITATION | Source review | Protected pages/API exist; live browser validation deferred. |
| Supervisor exception visibility | READY WITH LIMITATION | Source review | Operational review routes exist. |
| Driver management | READY WITH LIMITATION | Source review | Registry/team management exists; live browser validation deferred. |
| Route assignment | READY | Source review/local runtime | Manifest assignment remains driver-ID based and Organization-scoped. |
| Shared Safety submission | READY | Local runtime | Private hazard created candidate. |
| Shared Safety moderation | READY | Local runtime | Sanitization and approval passed. |
| KPI calculation | READY | Local runtime | KPI formula and snapshot calculated. |
| Logistics Intelligence | READY | Local runtime | Events generated signals/findings/recommendations. |
| FISS scoring | READY | Local runtime | Score snapshot created from Logistics lineage. |
| Audit trail | READY WITH LIMITATION | Source review | Audit-relevant writes exist; full audit log extraction deferred. |

