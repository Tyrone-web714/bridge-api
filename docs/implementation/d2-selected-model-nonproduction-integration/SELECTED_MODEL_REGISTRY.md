# Selected Model Registry

The authoritative registry lives at `bridge-api/services/intelligenceExecution/selectedD2ModelRegistry.js`.

## Registry Rules

- Exactly nine D2 capabilities are allowed.
- Selection source must be `MS-004`.
- Selection commit must be `7f4ef7538a894b9ae3fd3c654c22fcbc5e558904`.
- Selection status must be `FINAL_MODEL_SELECTION_READY`.
- `productionEnabled` must remain `false`.
- `nonProductionEnabled` must remain `true`.
- OpenAI and Anthropic are not selected D2 providers.

The registry rejects unknown capabilities, unselected providers, unselected models, a tenth D2 capability, and production-enabled records.
