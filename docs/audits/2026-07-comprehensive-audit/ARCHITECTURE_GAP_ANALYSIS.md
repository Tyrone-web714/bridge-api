# Architecture Gap Analysis

See `architecture-gaps.csv`.

| Requirement | Governing Document | Status | Evidence | Risk | Action |
| --- | --- | --- | --- | --- | --- |
| Organization tenant boundary | Volume II / ADR-0001 | Conflicting implementation | No org keys in schema inventory. | Critical | Add Organization model and tenant keys. |
| Versioned APIs | Volume V | Not implemented | Routes under `/api/*`. | High | Add `/api/v1` strategy. |
| Offline field execution | Volume III | Partially implemented | Mobile queues exist. | High | Add org/idempotency/conflict model. |
| KPI formula versioning | Volume IV | Not implemented/unknown | No full KPI formula model verified. | Medium | Defer until BI foundation. |
| Logistics Intelligence Engine | Volume VI | Partially implemented | AI/intelligence endpoints exist; full event/decision model missing. | High | Build after event model. |
| FISS | Volume VII | Not implemented | No full scoring engine verified. | Medium | Defer until BI/LIE foundation. |
