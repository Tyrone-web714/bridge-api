# Authentication Transaction Security

SSO transactions are server-side, short-lived, tenant-bound, provider-bound, and one-time use.

Implemented controls:

- State hashing
- Nonce hashing
- PKCE challenge foundation for OIDC
- Expiration
- Replay denial
- Provider and Organization binding
- Allowlisted redirect references

Raw provider tokens and SAML assertions are not stored.

