# Test Plan

Required local verification:

- `node --check services/intelligenceExecution/legacyAiAdapter.js`
- `node --check services/intelligenceExecution/providerAdapters.js`
- `node --check routes/ai.js`
- `node --check scripts/check-ai-contracts.cjs`
- `npm run test:ai`
- `npm run test:intelligence-execution`
- `npm run test:api-tenant`
- `npm run test:security`
- `npm test`

Regression coverage added in `scripts/check-ai-contracts.cjs`:

- legacy route list compatibility
- route no longer imports or calls `aiProvider`
- server readiness uses the legacy IEP status adapter
- OpenAI calls occur through provider adapter only
- capability registration and hosted policy approval
- trusted organization/user/role context
- client provider/model/model-class spoofing does not control execution selection
- premium escalation remains disabled
- mocked provider output is normalized
- usage is captured
- unknown cost remains null
