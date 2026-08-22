# D1 Source Mapping Spec

Status: SOURCE_NEUTRAL_MAPPING_DEFINED

Future Organization exports may arrive as CSV, XLSX, database export, API export, ERP, WMS, or TMS output. Source-specific adapters must translate into the canonical Wave-1 schema before validation and import.

## Mapping Layers

1. Raw source file/export metadata.
2. Source-specific column mapping.
3. Canonical historical route/stop/outcome records.
4. Validation/quarantine report.
5. Approved import batch.
6. Representative-data readiness check.

## Source Mapping Requirements

- Map stable source IDs to `source_record_id`.
- Preserve original source outcome code and mapped canonical outcome.
- Record `source_system`, `source_export_id`, `schema_version`, and `mapping_version`.
- Normalize timestamps using declared timezone.
- Never infer Organization from customer name alone.
- Never map free-form notes into predictive features by default.

## Supported Input Formats

| Format | Readiness |
| --- | --- |
| CSV | Preferred first format for controlled dry-run. |
| XLSX | Acceptable if converted through controlled parser with sheet names recorded. |
| Database export | Acceptable if exported files include data dictionary and checksums. |
| API export | Future adapter may use same canonical boundary. |
| ERP/WMS/TMS export | Acceptable after source-code mapping and data dictionary review. |
