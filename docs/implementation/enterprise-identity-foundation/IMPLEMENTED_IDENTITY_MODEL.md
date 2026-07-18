# Implemented Identity Model

Implemented tables:

- `organization_memberships`
- `organization_identity_providers`
- `verified_organization_domains`
- `federated_identities`
- `identity_claim_mappings`
- `sso_authentication_transactions`
- `scim_configurations`
- `scim_provisioning_events`
- `enterprise_identity_break_glass_records`
- `identity_security_events`

The model keeps external identity, TSR internal user, Organization membership, role, and permission separate. Existing local authentication remains intact.

`federated_identities` uses `(identity_provider_id, external_subject)` as the stable uniqueness boundary. Email is an attribute only.

