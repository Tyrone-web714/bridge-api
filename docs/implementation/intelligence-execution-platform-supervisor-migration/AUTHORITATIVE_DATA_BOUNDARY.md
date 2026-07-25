# Authoritative Data Boundary

Canonical calculations remain deterministic:

- route completion signals from repositories
- delivery-failure signals from repositories
- product demand signals from repositories
- undelivered stops from repositories
- route completion prediction from `predictionEngine`
- delivery failure prediction from `predictionEngine`
- product demand forecast from `predictionEngine`
- alert severity from deterministic service logic
- alert persistence through repository methods

Hosted AI may only:

- summarize supplied facts
- format supervisor-readable narrative
- identify operational priorities from supplied verified data
- identify missing/insufficient evidence
- recommend review actions that remain advisory

Hosted AI must not:

- invent metrics or facts
- recalculate canonical values differently
- override safety or routing rules
- make employment, disciplinary, compensation, termination, or autonomous safety decisions
- become the source of truth for route, delivery, product, driver, or customer records