# D1 Data Source Inventory

Status: DISCOVERY_COMPLETE_REPRESENTATIVE_DATA_NOT_FROZEN

This inventory distinguishes repository-supported source records from representative historical benchmark data. The repository contains ingestion and operational-data support, but the inspected evidence does not prove that an approved representative historical D1 dataset has been frozen.

| Source area | Repository support found | D1 relevance | Readiness for D1 selection |
| --- | --- | --- | --- |
| Customer accounts | `bridge-api/services/bulkImport.js` supports customer CSV imports with account number, name, address, territory, route group, distribution center, and active status. Multi-tenant migration adds `organization_id` to `customer_accounts`. | Required for account reorder and account-level demand/failure grouping. | SOURCE_SCHEMA_PRESENT_DATASET_NOT_PROVEN_REPRESENTATIVE |
| Products | `bridge-api/services/bulkImport.js` supports product CSV imports with SKU, product name, brand, package size, category, unit price, and active status. Multi-tenant migration adds `organization_id` to `products` and `product_barcodes`. | Required for product demand features and product trend grouping. | SOURCE_SCHEMA_PRESENT_DATASET_NOT_PROVEN_REPRESENTATIVE |
| Orders and order items | `bridge-api/services/bulkImport.js` supports order imports with account number, invoice number, order date, delivery date, quantity, gross amount, deduction amount, status, and item rows. Multi-tenant migration adds `organization_id` to `account_orders` and `account_order_items`. | Required for reorder intervals, demand history, revenue/quantity trend features, and deduction features. | SOURCE_SCHEMA_PRESENT_DATASET_NOT_PROVEN_REPRESENTATIVE |
| Route manifests and stops | `bridge-api/routes/routeManifests.js` supports route manifest imports with route date, route number, planned times, stop sequence, account, invoice, product, quantity, and planned service/drive timing fields. Multi-tenant migration adds `organization_id` to `daily_route_manifests` and `daily_route_stops`. | Required for route completion, finished/undelivered stop counts, planned/actual timing, and route-level outcome labels. | SOURCE_SCHEMA_PRESENT_DATASET_NOT_PROVEN_REPRESENTATIVE |
| Delivery notes/settlements/documents | Multi-tenant migration tracks delivery notes, settlements, settlement items, documents, closeout documents, and route inventory closeouts with `organization_id`. | Potentially useful for delivery failure reasons, proof-of-delivery outcomes, deductions, and closeout labels. | SOURCE_SCHEMA_PRESENT_DATASET_NOT_PROVEN_REPRESENTATIVE |
| KPI snapshots | `bridge-api/services/biKpi.js` and migration 006 define tenant-scoped KPI definitions, immutable KPI snapshots, alert rules, and calculation jobs. | Potential secondary features or evaluation overlays, not primary D1 ground truth by itself. | SUPPORTING_DATA_ONLY |
| Logistics events/signals/findings/outcomes | Migration 007 defines tenant-scoped logistics events, signals, findings, recommendations, decisions, and outcomes. | Potential future features or outcome feedback after governance review. | SUPPORTING_DATA_ONLY |
| Synthetic MS-004 fixtures | MS-004 contains frozen synthetic pipeline-validation datasets with four cases per D1 capability. | Validates contracts and local execution paths. | NOT_REPRESENTATIVE_FOR_METHOD_SELECTION |

## Data Not Proven By Repository Evidence

The repository evidence inspected does not establish:

- production row counts by tenant;
- date coverage by tenant;
- target-label completeness;
- historical backtesting windows;
- minimum sample sufficiency;
- data freshness or missingness rates;
- legal approval to use production records as benchmark data;
- a frozen representative D1 benchmark dataset hash.

Those gaps block D1 method selection, even though ingestion and deterministic prediction code exist.
