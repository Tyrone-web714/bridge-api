# Test Results

Validation executed on 2026-07-25 after AI-IEP-004A.1 implementation.

Commands and results:

- `npm run capability-registry:generate` - passed; generated 4 artifacts under `docs\implementation\enterprise-intelligence-capability-registry\generated`.
- `npm run test:capability-registry` - passed; enterprise registry validation, queries, lifecycle transitions, artifacts, and IEP compatibility verified.
- `npm run capability-registry:check` - passed; generated artifacts are current and deterministic.
- `npm run test:intelligence-execution` - passed; foundation contracts, planner, policy, deterministic execution, security, and docs verified.
- `npm run test:ai` - passed; 22 AI route contracts, provider timeout/failure classification, cost estimation, supervisor interface coverage, legacy AI migration through IEP, and supervisor recommendation review contracts verified.
- `npm run test:ai-architecture` - passed; provider bypass enforcement verified.
- `npm run test:supervisor-intelligence` - passed; alerts, schedules, reports, runner, deterministic report, and IEP migration contracts verified.
- `npm run test:api-tenant` - passed; API tenant-enforcement checks passed.
- `npm run test:security` - passed; authentication, headers, CORS, limits, photo validation, and audit logging verified.
- `npm test` - passed; full backend test chain completed with `test:capability-registry` included first.
- Controlled stale-artifact check - passed; temporarily appending to generated `CAPABILITY_REGISTRY.md` caused `npm run capability-registry:check` to fail with stale artifact detection, and `npm run capability-registry:generate` restored the artifact.
- `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json valid')"` - passed; `package.json` parses successfully.
- `node -e` package no-BOM validation - passed; `package.json` contains no UTF-8 BOM.
- Generated artifact parse/header verification - passed; JSON artifacts parse, CSV header is stable, Markdown generated header is present.

Failed during development and fixed:

- Staged whitespace validation initially found an extra blank line at EOF in generated `CAPABILITY_REGISTRY.md`; fixed the generator and regenerated the artifact. Final `git diff --cached --check` passed.

- Initial `test:capability-registry` failed because alias collision validation checked only IDs visited earlier in iteration. Fixed by validating aliases after collecting the full ID set.
- Initial `test:intelligence-execution` failed because a PowerShell JSON write introduced a UTF-8 BOM in `package.json`. Fixed by rewriting `package.json` as UTF-8 without BOM.

No live provider calls, production database writes, migrations, deployments, object-storage mutations, Cloudflare configuration changes, credential rotations, or pushes were performed.