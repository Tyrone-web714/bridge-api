# D1 Wave 1 Feature Manifest

Status: FEATURE_CANDIDATES_DEFINED_NO_FREEZE_APPROVAL

## Route Completion Feature Candidates

| Feature | Source | Type | Description | Availability time | Missingness in local CSV | Tenant sensitivity | Leakage status | Approved for freeze |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `route_date` | planned manifest / `daily_route_manifests.route_date` | date | Route service date | Prediction time | 0/5 rows missing | Tenant-sensitive operational data | No leakage | No, tenant/source not approved |
| `route_number` | planned manifest / `daily_route_manifests.route_number` | categorical | Route identifier | Prediction time | 0/5 rows missing | Tenant-sensitive operational data | No leakage | No, tenant/source not approved |
| `planned_start_at` | planned manifest / `daily_route_manifests.planned_start_at` | timestamp | Planned route start | Prediction time | 0/5 rows missing | Tenant-sensitive operational data | No leakage | No, tenant/source not approved |
| `planned_end_at` | planned manifest / `daily_route_manifests.planned_end_at` | timestamp | Planned route end | Prediction time | 0/5 rows missing | Tenant-sensitive operational data | No leakage | No, tenant/source not approved |
| `total_or_recorded_stop_count` | manifest/stops | numeric | Route length by stop count | Prediction time | Derivable as 5 local stops | Tenant-sensitive operational data | No leakage | No, tenant/source not approved |
| `planned_service_minutes` | planned stop records | numeric | Planned service time per stop | Prediction time | 0/5 rows missing | Tenant-sensitive operational data | No leakage | No, tenant/source not approved |
| `drive_minutes_to_next` | planned stop records | numeric | Planned drive time to next stop | Prediction time | 0/5 rows missing | Tenant-sensitive operational data | No leakage | No, tenant/source not approved |
| `assigned_driver_id` | manifest assignment | categorical | Assigned driver identifier | Prediction time if assigned before cutoff | 0/5 rows missing | Driver-identifiable | Potential leakage if assigned after cutoff | No, tenant/source not approved |

## Delivery Failure Feature Candidates

| Feature | Source | Type | Description | Availability time | Missingness in local CSV | Tenant sensitivity | Leakage status | Approved for freeze |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `account_number` | stop/order/customer records | categorical | Account identifier | Prediction time | 0/5 rows missing | Customer-identifiable | No leakage | No, tenant/source not approved |
| `route_date` | manifest | date | Route service date | Prediction time | 0/5 rows missing | Tenant-sensitive operational data | No leakage | No, tenant/source not approved |
| `route_number` | manifest | categorical | Route identifier | Prediction time | 0/5 rows missing | Tenant-sensitive operational data | No leakage | No, tenant/source not approved |
| `planned_arrival_at` | stop | timestamp | Planned stop arrival | Prediction time | 0/5 rows missing | Tenant-sensitive operational data | No leakage | No, tenant/source not approved |
| `planned_departure_at` | stop | timestamp | Planned stop departure | Prediction time | 0/5 rows missing | Tenant-sensitive operational data | No leakage | No, tenant/source not approved |
| `pallet_count` | stop | numeric | Planned pallet count | Prediction time | 0/5 rows missing | Tenant-sensitive operational data | No leakage | No, tenant/source not approved |
| `case_count` | stop | numeric | Planned case count | Prediction time | 0/5 rows missing | Tenant-sensitive operational data | No leakage | No, tenant/source not approved |
| historical prior failure rate | earlier route/stop outcomes | numeric | Account/route historical failure signal | Before prediction cutoff only | Not available locally | Tenant-sensitive operational data | No leakage if time-aware | No, source absent |

## Target Fields Not Approved As Features

- `actual_completed_at`
- route-level `completed_at`
- final stop `status`
- `non_delivery_reason`
- delivery settlement completion status
- post-delivery notes
- later deductions

These are target or post-outcome fields, not pre-outcome predictive features.
