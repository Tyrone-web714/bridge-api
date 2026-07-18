# Secrets and Key Management

The foundation stores secret references, not raw secrets.

Normal provider API responses redact secret and certificate references. Identity audit events redact sensitive metadata keys.

Production still requires an approved secrets manager integration for tenant IdP secrets, SAML private keys, certificates, and SCIM credentials.

