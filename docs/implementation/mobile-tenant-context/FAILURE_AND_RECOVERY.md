# Failure And Recovery

Handled conditions:

- Missing Organization context: session is rejected or offline storage operation fails closed.
- Expired session: SecureStore session is cleared by initialization validation.
- Malformed legacy cache: ignored or quarantined; original legacy key is preserved.
- Ambiguous legacy queue: quarantined with reason and timestamp.
- Queue item with wrong tenant: filtered out and not submitted under current session.
- Connectivity loss: existing retry behavior remains; failed operations retain retry metadata.
- Backend tenant rejection: operation is marked failed and preserved for review/retry.

Recovery path:

- Legacy data remains in original v1 keys.
- Quarantine records are stored under feature-specific quarantine keys.
- Tenant-scoped queues preserve operation IDs and retry metadata.