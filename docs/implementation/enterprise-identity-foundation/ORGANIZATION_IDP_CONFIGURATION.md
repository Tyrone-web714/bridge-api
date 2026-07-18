# Organization IdP Configuration

Tenant-scoped IdP records are stored in `organization_identity_providers`.

Supported protocol classifications:

- OIDC
- SAML

Supported provider classifications:

- MICROSOFT_ENTRA
- OKTA
- GOOGLE
- GENERIC_OIDC
- GENERIC_SAML

Provider records store secret references, certificate references, metadata references, and configuration metadata. Raw provider secrets are not returned through normal APIs.

