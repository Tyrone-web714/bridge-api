# Web SSO Integration

Implemented route contracts:

- `/api/enterprise-identity/discover`
- `/api/enterprise-identity/oidc/initiate`
- `/api/enterprise-identity/oidc/callback`
- `/api/enterprise-identity/saml/acs`
- protected provider, domain, mapping, account-link, policy, SCIM, and break-glass APIs

Public SSO entry routes are isolated from business-data APIs.

Admin mutations require JSON and admin CSRF validation for cookie sessions.

