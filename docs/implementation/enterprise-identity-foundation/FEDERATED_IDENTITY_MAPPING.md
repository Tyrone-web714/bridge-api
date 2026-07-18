# Federated Identity Mapping

Federated mapping links an immutable provider subject to a TSR internal user inside one Organization.

Rules implemented:

- Email-only linking is rejected.
- Cross-tenant linking is rejected.
- Disabled federated identities cannot authenticate.
- Provider subject uniqueness is enforced.
- IdP deletion is restricted and cannot delete operational history.

