# Test Plan

Required validation:

- Required files exist.
- Roadmap JSON parses.
- Package IDs are unique.
- Duplicate package ID fails.
- Unknown status fails.
- Unknown category fails.
- Unknown dependency fails.
- Missing required field fails.
- More than one current package fails.
- Missing current package fails.
- Current package not in roadmap fails.
- Markdown and JSON current package mismatch fails.
- Missing approved scope fails.
- Missing prohibited scope fails.
- Missing acceptance criteria fails.
- Unapproved Milestone 1 domain fails.
- False `PUSHED` state fails.
- False `DEPLOYED` state fails.
- Model-selection gate exists.
- Production-orchestration gate exists.
- Scope-control policy is complete.
- Scope-change template is complete.
- Completion-report template is complete.
- Shared GitHub workflow is documented.
- Automatic live ChatGPT-Codex connection is not claimed.
- Generated summaries are deterministic.
- Stale generated summary is detected.
- Existing Route Intelligence tests pass.
- Existing Driver Intelligence tests pass.
- Security tests pass.
- Full npm test passes using the established long-running test method.
