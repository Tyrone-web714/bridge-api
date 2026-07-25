# Provider Bypass Enforcement

Implementation: `bridge-api/scripts/check-ai-provider-boundaries.cjs`.

Script: `npm run test:ai-architecture`.

The checker scans active `routes` and `services` JavaScript sources for:

- direct `aiProvider` imports
- direct `aiProvider.createStructuredResponse` calls
- direct OpenAI SDK imports
- direct OpenAI API URL usage

Minimal allowlist:

- `services/aiProvider.js`: provider implementation
- `services/intelligenceExecution/providerAdapters.js`: approved provider adapter boundary

The check includes an in-memory prohibited fixture to verify that direct import and direct execution patterns fail when present. Actual repository violations cause nonzero exit with exact file, line, pattern, and match.