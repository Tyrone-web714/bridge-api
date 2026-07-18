# Model Versioning

Scoring formulas are represented by `fleet_score_model_versions`.

Each active version is immutable. Historical score snapshots retain the exact `score_model_version_id` used during calculation so old scores remain reproducible.

The foundation uses structured weighted components only. It does not evaluate arbitrary scripts or model-generated code.
