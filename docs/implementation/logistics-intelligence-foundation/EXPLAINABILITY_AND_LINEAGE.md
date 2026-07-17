# Explainability and Lineage

Every derived layer stores lineage.

Lineage includes engine version, source event IDs, source signal IDs, source finding IDs, BI/KPI source metadata when the source is a KPI snapshot, and Shared Safety source metadata when the source is an approved shared safety record.

The first engine version is `logistics-foundation-v1`.

This foundation is deterministic and rule-based. It does not use arbitrary code execution, model-generated commands, or autonomous action.
