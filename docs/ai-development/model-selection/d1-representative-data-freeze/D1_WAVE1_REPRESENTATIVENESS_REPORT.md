# D1 Wave 1 Representativeness Report

Status: NOT_REPRESENTATIVE

## Dimensions Evaluated

| Dimension | Local evidence | Route completion result | Delivery failure result |
| --- | --- | --- | --- |
| Date coverage | One route date: 2026-06-20 | Insufficient | Insufficient |
| Weekday/weekend coverage | One date only | Insufficient | Insufficient |
| Seasonality | No seasonal range | Insufficient | Insufficient |
| Route diversity | One route | Insufficient | Insufficient |
| Stop-count distribution | One 5-stop route | Insufficient | Insufficient |
| Depot diversity | One start-location field in one file; provenance not approved | Insufficient | Insufficient |
| Geographic diversity | Customer/address fields present but raw values not reproduced; one route only | Insufficient | Insufficient |
| Customer/account diversity | Five account numbers in one planned manifest; no approved tenant provenance | Insufficient | Insufficient |
| Delivery-outcome diversity | No outcome fields | Not applicable | Blocked |
| Exception/failure coverage | No failure fields | Not applicable | Blocked |
| Vehicle diversity | No approved vehicle context | Not applicable | Not applicable |
| Normal vs abnormal operations | No actual operational outcomes | Blocked | Blocked |

## Historical Depth

| Measure | Value |
| --- | --- |
| Days | 1 |
| Weeks | 0.14 |
| Months | 0.03 |
| Seasonal coverage | None |

## Representativeness Decision

The local route manifest is not representative historical data. It can at most support import/fixture mechanics. It cannot support method selection, calibration, failure-event evaluation, time-aware splits, or tenant-isolated predictive benchmarking.
