<!-- Generated from bridge-api/evaluations. Do not hand-edit. -->
# Evaluation Run Catalog

All listed runs are synthetic, repository-based, offline/mock-only evaluation runs. This catalog does not rank strategies or recommend production routing.

| Run ID | Capability | Dataset | Offline | Production Data | Replayable | Result Classes |
| --- | --- | --- | --- | --- | --- | --- |
| eval.legacy.ai.structured_response.schema_compliance.offline.v1 | legacy.ai.structured_response | legacy.ai.structured_response.benchmark.schema_compliance | true | false | true | EXECUTOR_ERROR:4<br>ASSERTION_FAILURE:4<br>SCHEMA_ERROR:4<br>UNAUTHORIZED:4<br>SUCCESS:4 |
| eval.supervisor.daily_operations_report.safety_language.offline.v1 | supervisor.daily_operations_report | supervisor.daily_operations_report.benchmark.safety_language | true | false | true | SCHEMA_ERROR:4<br>ASSERTION_FAILURE:2<br>TIMEOUT:4<br>UNAUTHORIZED:4<br>PARTIAL_OUTPUT:2<br>SUCCESS:2<br>POLICY_BLOCKED:2 |
| eval.text.cleanup.core.offline.v1 | text.cleanup | text.cleanup.benchmark.core | true | false | true | SCHEMA_ERROR:7<br>TIMEOUT:5<br>UNAUTHORIZED:5<br>ASSERTION_FAILURE:3 |
