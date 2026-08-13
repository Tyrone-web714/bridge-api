# Current Safety Functionality Audit

| Component | Classification | Decision |
| --- | --- | --- |
| `services/intelligenceExecution/routeIntelligence.js` and route safety docs/artifacts | REUSE_UNCHANGED | Authoritative for low-clearance, truck restriction, road closure, residential restriction, route safety, compatibility, and route rejection evidence. |
| `services/intelligenceExecution/driverIntelligence.js` | REUSE_UNCHANGED | Authoritative for speed, low-bridge, restricted-road, no-through-truck, residential advisory, and hazard acknowledgement evidence. |
| `services/intelligenceExecution/fleetIntelligence.js` | REUSE_UNCHANGED | Authoritative for vehicle readiness and route/vehicle safety compatibility evidence. |
| `services/intelligenceExecution/warehouseIntelligence.js` | REUSE_UNCHANGED | Authoritative for departure readiness and warehouse blockers where already safety-relevant. |
| `services/intelligenceExecution/operationsIntelligence.js` | REUSE_UNCHANGED | Authoritative for operations-level safety-related exceptions and correlations. |
| `services/sharedSafety.js`, Shared Safety routes, migrations, checks, and moderation UI | REUSE_UNCHANGED | Authoritative for shared safety governance, sanitization, moderation, and accepted/pending record handling. |
| Routing compliance, manual hazards, low-bridge data, and Google Maps compliance checks | REFERENCE_ONLY | Existing evidence sources remain separate and are not replaced. |
| BI/KPI, logistics intelligence, heatmaps, and non-safety operational analytics | REFERENCE_ONLY | They may provide future context but are not Safety authorities. |
| Generalized OSHA/DOT/insurance/computer-vision/telematics/ELD/biometric monitoring | OUT_OF_SCOPE | Not implemented or activated. |
| Safety Intelligence aggregation boundary | EXTEND | Add repository-only deterministic aggregation and preservation layer for cross-domain safety awareness. |
