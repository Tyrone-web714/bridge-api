# Enterprise SSO and Identity Federation Architecture

**Status:** GOVERNANCE APPROVED / ARCHITECTURE DESIGNED
**ODR:** ODR-020
**Implementation State:** FOUNDATION NOT IMPLEMENTED

## Normative Identity Chain

TSR SHALL preserve this identity chain:

EXTERNAL IDENTITY -> INTERNAL TSR USER -> ORGANIZATION MEMBERSHIP -> APPROVED TSR ROLE -> EXPLICIT PERMISSIONS -> AUTHORIZED RESOURCE ACCESS

## Identity Federation Model

TSR SHALL support tenant-scoped enterprise identity federation. External IdPs authenticate users. TSR authorizes resource access.

## OIDC

TSR SHALL support OIDC. OIDC SHOULD be preferred for new integrations where appropriate. OIDC flows SHALL validate issuer, audience, signature, nonce, state, expiration, replay protection, and Organization mapping.

## SAML 2.0

TSR SHALL support SAML 2.0 for enterprise compatibility. SAML flows SHALL validate issuer, audience, destination, signature, assertion lifetime, replay protection, and request correlation.

## Tenant-Specific IdP Configuration

Every enterprise IdP configuration SHALL be Organization-scoped. Tenant A SHALL NOT access, use, or modify Tenant B IdP configuration.

## External Identity Mapping

External identity is distinct from TSR internal identity. Email alone SHALL NOT be the permanent federated identity key.

## Internal TSR User Identity

TSR internal user identity SHALL remain the stable authorization and audit identity inside the platform.

## Organization Membership

Organization context SHALL be established server-side from trusted identity mappings. Clients SHALL NOT choose arbitrary Organization IDs during SSO.

## TSR Authorization Boundary

IdP groups SHALL NOT create arbitrary TSR roles. Group or claim mappings MAY inform approved permission assignment only through governed TSR policy.

## SSO Discovery and Domain Verification

SSO discovery MAY use verified domains, invitations, or Organization-specific login identifiers. Domain verification SHALL be controlled and auditable.

## MFA Assurance

TSR SHALL NOT assume SSO proves MFA occurred. Provider assurance claims require provider verification. Where assurance is insufficient, TSR SHALL require additional approved controls.

## JIT Provisioning

JIT provisioning SHALL be disabled by default. If enabled by Organization policy, JIT SHALL grant only minimum approved initial access and SHALL NOT grant Platform Admin privileges.

## SCIM 2.0

SCIM 2.0 is an approved enterprise lifecycle capability. SCIM events SHALL be tenant-scoped, audited, and governed by TSR authorization rules.

## Account Linking

Account linking SHALL NOT occur solely because emails match. Linking SHALL require sufficient proof of identity and authorization.

## SSO Enforcement

Organizations MAY configure local authentication allowed, SSO optional, or SSO required. Enforcement SHALL include safe, audited exceptions.

## Break-Glass Access

Break-glass access SHALL be explicit, narrow, strongly authenticated, auditable, protected from routine use, and non-universal.

## Session Lifecycle and Deprovisioning

TSR sessions SHALL NOT rely indefinitely on stale IdP information. Deprovisioning, membership revocation, Organization suspension, role changes, and compromised IdP configuration SHALL support forced logout or authorization revalidation.

## Mobile SSO

Mobile OIDC SHOULD use Authorization Code Flow with PKCE through secure browser-based flows. TSR SHALL NOT embed enterprise IdP passwords or collect them in insecure WebViews.

## Web SSO

Web SSO SHALL protect callback handling, CSRF, secure cookies, tenant-safe redirects, open-redirect prevention, token leakage, and logout behavior.

## Provider Compatibility

TSR architecture SHALL accommodate Microsoft Entra ID, Okta, Google Workspace/Google Identity, generic OIDC, and generic SAML 2.0. Provider behavior SHALL NOT be marked verified until tested.

## Secrets and Certificate Management

Client secrets, private keys, signing keys, and sensitive SAML materials SHALL NOT be stored in source control or insecure plaintext configuration. Architecture SHALL support encryption at rest, restricted access, rotation, certificate expiration monitoring, rollover, revocation, audit logging, log redaction, and secure backup/restore.

## Audit Logging

Security-relevant identity events SHALL be audited without storing sensitive tokens, passwords, raw secrets, full SAML assertions, or unnecessary personally identifiable information.

## Tenant Isolation

Enterprise identity SHALL NOT weaken Private-by-Default APIs, Organization isolation, RBAC, audit logging, or permission checks.
