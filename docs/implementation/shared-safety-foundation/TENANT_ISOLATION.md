# Tenant Isolation

Private submissions are scoped by authenticated `organization_id`.

Rules:

- Organization A cannot read Organization B private submissions.
- Organization A cannot nominate Organization B submissions.
- Client-supplied Organization IDs are not trusted.
- Platform-global shared reads expose only approved sanitized records.
- Source Organization identifiers are retained only in restricted publication linkage and moderation data.
- Platform Admin moderation actions are explicit and audited.

