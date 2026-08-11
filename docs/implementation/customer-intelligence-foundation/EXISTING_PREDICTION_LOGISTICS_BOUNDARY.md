# Existing Prediction and Logistics Boundary

`services/predictionEngine.js` already contains account forecast, product demand forecast, delivery failure prediction, and route completion prediction helpers. This foundation documents that code as existing predictive/logistics functionality and does not remove, expand, call, or make it authoritative for Customer Intelligence.

`services/logisticsIntelligence.js` contains PostgreSQL-backed logistics events, signals, findings, recommendations, decisions, and outcomes. Customer Intelligence references it only as an existing operational intelligence boundary.

Future spend prediction, product-demand prediction, churn prediction, customer value prediction, sales propensity, and model-generated recommendations remain deferred to later model-selection work.
