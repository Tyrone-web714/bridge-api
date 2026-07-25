# Dataset Validation Rules

Validation rejects duplicate IDs and versions, invalid IDs, provider/model names in IDs, production identity markers in IDs, duplicate case IDs, alias collisions, unknown capabilities, incompatible schema references, invalid lifecycle states, benchmark-ready datasets without owner approval, frozen datasets without integrity metadata, privacy/provenance gaps, secret-like content, case assertion contradictions, and stale generated artifacts.

Errors report dataset ID, dataset version, case ID when applicable, field, rule, and corrective guidance.
