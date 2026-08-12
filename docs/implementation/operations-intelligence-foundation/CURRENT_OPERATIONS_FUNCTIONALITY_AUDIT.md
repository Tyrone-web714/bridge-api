# Current Operations Functionality Audit

| Component | Classification | Decision |
| --- | --- | --- |
| `services/intelligenceExecution/routeIntelligence.js` | REUSE_UNCHANGED | Authoritative route safety, eligibility, restrictions, and hazard evidence. |
| `services/intelligenceExecution/driverIntelligence.js` | REUSE_UNCHANGED | Authoritative driver operational state, route adherence, stop progress, and driver advisories. |
| `services/intelligenceExecution/supervisorOperationalIntelligence.js` | REUSE_UNCHANGED | Authoritative supervisor portfolio, exceptions, alert priority, and summaries. |
| `services/intelligenceExecution/warehouseIntelligence.js` | REUSE_UNCHANGED | Authoritative staging, loading, completeness, discrepancy, and departure-readiness evidence. |
| `services/intelligenceExecution/fleetIntelligence.js` | REUSE_UNCHANGED | Authoritative vehicle availability, readiness, route compatibility, and vehicle-caused route impact. |
| `services/intelligenceExecution/customerIntelligence.js` | REUSE_UNCHANGED | Authoritative customer/account operational context and history evidence. |
| `services/logisticsIntelligence.js` | REFERENCE_ONLY | Existing PostgreSQL-backed logistics event/signal/finding/recommendation workflow remains separate. |
| `services/biKpi.js` and `routes/biKpi.js` | REFERENCE_ONLY | Existing BI/KPI foundation remains separate reporting evidence. |
| `routes/operationalHeatmaps.js` and `routes/operationalGeography.js` | REFERENCE_ONLY | Existing operational geography/heatmap routes remain UI/reporting evidence. |
| `routes/routeManifests.js`, `routes/deliveryNotes.js`, settlement/import routes | REFERENCE_ONLY | Existing operational workflows remain authoritative future runtime evidence. |
| Operations aggregation boundary | EXTEND | Add repository-only deterministic aggregation service because no existing clean organization-level cross-domain boundary exists. |
| ERP/TMS/WMS/CRM/fleet-management platform scope | OUT_OF_SCOPE | No product-suite expansion is implemented. |
