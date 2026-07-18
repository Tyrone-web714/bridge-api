# Implementation Threat Assessment

Implemented controls:

- Cross-tenant IdP isolation
- State and nonce validation
- Transaction replay denial
- Email-only linking denial
- Platform Admin group-mapping denial
- Secret redaction
- Lifecycle checks
- SCIM deactivation access removal

Remaining controls:

- Live OIDC token signature validation
- Live SAML assertion signature validation
- External DNS verification automation
- Provider-specific MFA assurance verification
- Production secrets manager integration

Provider verification required:

- Microsoft Entra ID
- Okta
- Google Workspace / Google Identity
- Generic OIDC
- Generic SAML

