# Prompt Migration

Implementation: `bridge-api/services/intelligenceExecution/promptRegistry.js`.

Prompt: `supervisor.daily_operations_report.prompt`

Version: `supervisor-daily-operations-report.v1`

Owning capability: `supervisor.daily_operations_report`

Required variables:

- `sourceContext`

Safety instructions require the model to:

- use only supplied source-of-truth predictions and exceptions
- distinguish facts from interpretation
- avoid fabricating traffic, weather, inventory, customer behavior, or driver behavior
- preserve deterministic predictions as calculated facts
- avoid disciplinary, compensation, termination, or employment decisions
- avoid overriding safety, routing, warehouse, customer, or backend rules
- return structured JSON matching the schema

The prompt body no longer lives in `services/supervisorIntelligence.js`.