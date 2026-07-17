# Enterprise IdP Capability Matrix

**Status:** ARCHITECTURE DESIGNED

| Provider | OIDC | SAML 2.0 | SCIM 2.0 | MFA Assurance | Status |
| --- | --- | --- | --- | --- | --- |
| Microsoft Entra ID | Architecturally supported | Architecturally supported | Requires provider verification | Requires provider verification | Not yet tested |
| Okta | Architecturally supported | Architecturally supported | Requires provider verification | Requires provider verification | Not yet tested |
| Google Workspace / Google Identity | Architecturally supported | Requires provider verification | Requires provider verification | Requires provider verification | Not yet tested |
| Generic OIDC | Architecturally supported | Not applicable | Provider-specific | Requires provider verification | Not yet tested |
| Generic SAML 2.0 | Not applicable | Architecturally supported | Provider-specific | Requires provider verification | Not yet tested |

Provider behavior SHALL NOT be marked tested or production ready until verified against actual provider configuration or an approved test environment.
