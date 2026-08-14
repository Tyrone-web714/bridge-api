# Benchmark Dataset Governance

Benchmark ground truth must come from deterministic TSR evidence or owner-approved expected records. Provider/model output must not become ground truth merely because a model produced it.

| Requirement | State |
| --- | --- |
| benchmarkRunMustIdentifyDatasetVersion | true |
| datasetVersionHashTraceable | true |
| deterministicExpectedEvidenceRequired | true |
| edgeCasesRequired | true |
| expectedResultsVersionable | true |
| knownAnswerCasesRequired | true |
| missingConflictingStaleMalformedEvidenceCasesRequired | true |
| normalNoExceptionCasesRequired | true |
| providerOutputMayBecomeGroundTruth | false |
| safetyCriticalCasesRequiredWhereRelevant | true |
| syntheticOrOfflineCasesRequired | true |
| tenantMismatchCasesRequired | true |
