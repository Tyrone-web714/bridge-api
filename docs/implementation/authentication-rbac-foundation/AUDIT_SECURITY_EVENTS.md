# Audit and Security Events

Mutation audit events now include, where available:

- Organization ID
- event type
- outcome
- session ID
- approved role metadata

Sensitive values such as passwords, PINs, tokens, and request bodies are not written by the mutation audit middleware.

Further event-specific audit records remain future work for login failure detail, failed authorization, and Platform Admin support workflows.
