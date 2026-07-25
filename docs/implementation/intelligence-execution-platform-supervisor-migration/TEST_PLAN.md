# Test Plan

Required local verification:

- Syntax checks for changed files.
- `npm run test:supervisor-intelligence`
- `npm run test:ai-architecture`
- `npm run test:ai`
- `npm run test:intelligence-execution`
- `npm run test:api-tenant`
- `npm run test:security`
- `npm test`

Coverage added:

- supervisor service no longer imports or invokes `aiProvider`
- manual route passes trusted auth context
- supervisor capability registered and active
- prompt registry contains guardrails
- policy allows supervisor/admin roles and denies non-supervisor roles
- caller cannot choose provider/model/model class/premium
- mocked provider response flows through IEP
- usage propagates and unknown cost remains null
- invalid employment/safety language fails validation
- missing provider configuration fails safely without a live call
- architecture checker detects controlled prohibited fixture and passes repository scan