# ChatGPT Handoff Protocol

1. The owner and ChatGPT identify the approved package.
2. ChatGPT prepares the scoped Codex prompt.
3. The owner submits the prompt to Codex.
4. Codex implements only the approved package.
5. Codex validates the work.
6. Codex produces the standardized completion report.
7. Codex commits or pushes only when separately authorized.
8. The owner provides the completion report to ChatGPT.
9. ChatGPT compares the report against `TSR_AI_MASTER_ROADMAP.md`, `TSR_AI_MASTER_ROADMAP.json`, `CURRENT_AI_WORK_PACKAGE.md`, `SCOPE_CONTROL_POLICY.md`, `AI_MODEL_SELECTION_GATE.md`, and `PRODUCTION_ORCHESTRATION_GATE.md`.
10. ChatGPT approves controlled review/commit, requests corrections, or prepares the next already-approved package.
11. Any new idea is handled through the scope-change proposal process.
12. The owner remains the approval authority.

There is no automatic live connection, notification, shared memory, or direct prompt delivery between this ChatGPT conversation and the Codex desktop application.

GitHub and the standardized completion report are the approved handoff mechanism.
