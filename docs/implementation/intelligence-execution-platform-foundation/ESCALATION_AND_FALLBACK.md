# Escalation and Fallback

Escalation and fallback are separate plan fields.

- Escalation means a stronger or more expensive strategy after validation failure.
- Fallback means an approved alternative when a provider or executor is unavailable.

AI-IEP-001 keeps escalation finite through profile limits. 	ext.cleanup has no escalation path. Premium escalation is denied by default.
