# Current Customer Functionality Audit

| Component | Classification | Decision |
| --- | --- | --- |
| `customer_accounts` / `listCustomerAccounts` / `upsertCustomerAccount` | REUSE_UNCHANGED | Authoritative account identity record keyed by stable account number within Organization scope. |
| `daily_route_stops.account_number` and `daily_route_manifests` | REFERENCE_ONLY | Authoritative route/stop account relationship and service status evidence. |
| `account_orders` | REUSE_UNCHANGED | Invoice/order header source for historical invoice, spend, route, stop, and status facts. |
| `account_order_items` | REUSE_UNCHANGED | Product history, quantity, unit price, gross/net, and deduction-line evidence. |
| `delivery_deductions` | REUSE_UNCHANGED | Deduction/exception history; never implies fraud, blame, intent, or employee fault. |
| `delivery_settlements` and settlement items | REFERENCE_ONLY | Driver stop completion and final delivery quantities remain existing delivery workflow evidence. |
| `routes/accountIntelligence.js` and `account_ai_insights` | REFERENCE_ONLY | Existing supervisor/account UI and reviewed insights remain outside this deterministic foundation. |
| `services/predictionEngine.js` | DEFER | Existing forecasts are documented but not reused as authoritative Customer Intelligence evidence. |
| `services/logisticsIntelligence.js` | REFERENCE_ONLY | Existing event/signal/finding/recommendation engine remains separate operational workflow. |
| New Customer production API, CRM, payment, accounting, provider/model, or migration scope | OUT_OF_SCOPE | No runtime platform expansion is added. |
