# Lifecycle Reference Reconciliation

## Status

READ-ONLY TOOL CREATED. PRODUCTION RECONCILIATION RUN NOT EXECUTED BY CODEX IN THIS PHASE.

Production evidence supplied by the owner shows 20 `delivery_note_photo` / `s3` lifecycle references while 5 current delivery-note media items exist.

## Tool

`npm.cmd run media:lifecycle:reconcile`

This runs:

`node scripts/reconcile-lifecycle-object-references.cjs`

## Safety Properties

The tool:

- requires `DATABASE_URL`;
- opens `BEGIN READ ONLY`;
- rolls back after reading;
- reports aggregate counts only;
- redacts URLs and object keys;
- does not print storage keys, media IDs, URLs, tokens, or credentials;
- does not update, delete, or insert rows.

## Reported Aggregate Fields

- total references;
- unique storage objects;
- unique delivery-note/media identities;
- exact duplicate reference groups;
- duplicate storage-object groups;
- references tied to current media;
- references not tied to current media;
- references with missing owner delivery notes;
- ownership mismatch references;
- classification.

## Interpretation Rules

| Classification | Meaning |
| --- | --- |
| `EXPECTED_CURRENT_REFERENCES` | References align with current media. |
| `EXPECTED_HISTORICAL_RETENTION_PENDING_OWNER_REVIEW` | Extra references appear historical/orphaned and need owner retention review before cleanup. |
| `DUPLICATION_DEFECT_OR_OWNERSHIP_DEFECT` | Exact duplicate reference groups or ownership mismatches exist. Cleanup must not proceed without a separate approved repair plan. |

## Current Finding

The code uses deterministic lifecycle reference IDs and `ON CONFLICT (id) DO UPDATE`, so exact duplicate ID creation is guarded. The production count of 20 may be historical retention from previous media saves/replacements, but that is not proven until the read-only reconciliation tool is run against production.

No lifecycle records were modified or deleted during this phase.
