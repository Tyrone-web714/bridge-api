# TSR User Deletion and Anonymization Policy

**Status:** ARCHITECTURE DESIGNED

User deletion SHALL be an orchestrated workflow, not raw database deletion.

The workflow SHALL evaluate requester authority, Organization ownership, current user status, historical records, retention requirements, legal holds, platform-global contributions, anonymization options, and recovery-window status.

User deletion SHALL NOT erase completed routes, deliveries, safety events, KPI history, BI snapshots, audit events, warehouse confirmations, route replay evidence, or validated safety submissions when retention applies.

Where direct personal identity is no longer necessary, TSR SHALL use nullable actor references, archived identity references, pseudonymous identifiers, immutable historical snapshots, anonymized actor labels, or detached attribution.
