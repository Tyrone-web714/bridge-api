# Security Review

Security changes:

- Removed direct provider import and execution from `services/supervisorIntelligence.js`.
- Manual supervisor report execution passes trusted request auth context into IEP.
- Scheduled background execution uses server-derived context rather than client input.
- Capability policy gates supervisor reports to Supervisor, Organization Admin, and Platform Admin roles.
- Non-supervisor roles with generic intelligence visibility are denied.
- Provider/model/premium selection cannot be supplied by callers.
- Output validation rejects malformed or prohibited autonomous employment/safety content.
- Provider bypass checker prevents reintroduction of direct provider calls in active routes/services.

No credentials, raw provider headers, full prompt payloads, or raw provider responses are exposed to business routes.