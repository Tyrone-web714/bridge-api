# Audit Events

The API records audit/security events for key Logistics Intelligence mutations:

- Logistics event ingestion.
- Intelligence pipeline processing.
- Recommendation decisions.
- Outcome recording.
- Admin CSRF denial.

Audit records are written through the existing audit log service and inherit existing request, actor, and Organization context.
