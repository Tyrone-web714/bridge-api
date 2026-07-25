# Policy Engine

The policy engine is conservative by default:

- tenant-scoped execution requires trusted Organization context;
- caller must have intelligence.view;
- disabled capabilities are rejected;
- hosted inference is denied by default;
- premium models are denied by default;
- safety/compliance/employment/financial critical requests require human review.

Persisted per-Organization policies are deferred. The resolver boundary is implemented for future policy storage.
