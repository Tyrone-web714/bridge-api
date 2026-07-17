# ODR-020 - Enterprise SSO and Identity Federation Architecture

## Status

Approved Architecture Baseline Extension

## Context

Enterprise customers may require SSO, tenant-specific IdP configuration, identity federation, SCIM lifecycle management, account linking, and SSO enforcement without weakening TSR tenant isolation or authorization.

## Decision

TSR SHALL adopt the Enterprise Identity architecture in `docs/architecture/enterprise-identity/`.

1. TSR supports OIDC and SAML 2.0.
2. OIDC is preferred for new integrations where appropriate.
3. SAML 2.0 is supported for enterprise compatibility.
4. Enterprise IdP connections are tenant-scoped.
5. External IdP identity is distinct from TSR internal identity.
6. Email alone is not the permanent federated identity key.
7. External IdPs authenticate; TSR authorizes.
8. IdP groups cannot create arbitrary TSR roles.
9. Organization context is established server-side from trusted identity mappings.
10. JIT provisioning is disabled by default unless explicitly enabled under Organization policy.
11. JIT cannot grant Platform Admin privileges.
12. Account linking cannot occur solely because emails match.
13. SSO does not automatically prove MFA assurance.
14. Existing MFA requirements remain enforceable.
15. SCIM 2.0 is an approved enterprise lifecycle capability, whether implemented immediately or phased.
16. Break-glass access must be explicit, narrow, strongly authenticated, auditable, and non-universal.
17. Enterprise identity secrets must not be stored in source control or insecure plaintext configuration.
18. Tenant A cannot access or use Tenant B identity-provider configuration.
19. IdP deletion must never cascade-delete operational history.
20. Provider integration status must distinguish architecture support from actual verified interoperability.

## Rationale

This decision supports enterprise authentication while preserving TSR's internal identity, Organization membership, approved role model, explicit permissions, audit logging, and Private-by-Default API posture.

## Owner Decisions Required

- Organization-level policy choices for SSO enforcement modes are `OWNER_DECISION_REQUIRED`.
- JIT enablement defaults per customer contract are `OWNER_DECISION_REQUIRED` when enabled.

## Legal Review Required

- Enterprise customer identity-processing terms, data-processing obligations, and provider-specific contractual requirements are `LEGAL_REVIEW_REQUIRED`.

## Consequences

Implementation requires provider audit, tenant IdP model, secure secret storage, OIDC/SAML validation, SCIM lifecycle support, mobile PKCE, web callback security, account-linking controls, and extensive negative tests.

## Verification Requirements

Tests must prove cross-tenant IdP isolation, protocol validation, replay protection, secure account linking, SCIM deprovisioning, session revocation, group-mapping restrictions, secret redaction, and mobile/web SSO safety.
