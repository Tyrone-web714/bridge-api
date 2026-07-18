# Current Data Lifecycle Audit

The audit found existing tenant-owned records across users, drivers, warehouse employees, sessions, route manifests, route stops, delivery settlements/documents, inventory confirmations, delivery notes/photos, route replay, private hazard submissions, shared-safety moderation candidates, BI/KPI, Logistics Intelligence, Fleet Intelligence Scoring, supervisor alerts, imports, AI logs, and audit events.

Confirmed historical records must survive user lifecycle actions. Confirmed ephemeral records include driver sessions, warehouse employee sessions, expired delivery documents, and expired route closeout documents.

Confirmed dangerous lifecycle gap corrected: `route_session_events.route_session_id` previously cascaded when a route session was deleted. Migration `009` changes this relationship to `ON DELETE RESTRICT` to preserve route replay evidence.
