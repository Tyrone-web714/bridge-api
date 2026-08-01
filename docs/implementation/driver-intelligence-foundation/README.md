# Driver Intelligence Foundation

AI-IEP-005B.2 adds a repository-only Driver Intelligence Foundation for deterministic driver operational assessment. It covers driver profile contracts, operational state, route state, route progress, route adherence, route deviation, stop progress, arrival/departure events, speed compliance, low bridge approach, restricted road approach, no-through-truck approach, residential-area approach, hazard acknowledgement, advisories, explanations, evidence records, confidence records, and human-review flags.

This foundation does not create production APIs, call hosted AI, call providers, score employees, rank drivers, recommend discipline, deploy code, run migrations, mutate databases, mutate object storage, or change Cloudflare/R2 settings.

## Implementation

- Service: `bridge-api/services/intelligenceExecution/driverIntelligence.js`
- Generator: `bridge-api/scripts/generate-driver-intelligence-artifacts.cjs`
- Validator: `bridge-api/scripts/check-driver-intelligence.cjs`
- Generated artifacts: `docs/implementation/driver-intelligence-foundation/generated`

## Boundary

Driver Intelligence is advisory and evidence-bound. It explains what deterministic repository rules observed, what evidence was missing, and when a human review flag is required. It is not a production driver monitoring system and is not an employee performance or disciplinary system.
