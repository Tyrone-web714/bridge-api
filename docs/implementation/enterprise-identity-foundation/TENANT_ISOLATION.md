# Tenant Isolation

Tenant isolation is enforced by Organization-scoped provider configuration and server-side Organization resolution.

Implemented checks reject:

- Org A listing or modifying Org B IdP configuration
- Org A initiating against Org B provider
- Cross-tenant account linking
- Unverified-domain discovery
- Provider mix-up through mismatched Organization/provider context

