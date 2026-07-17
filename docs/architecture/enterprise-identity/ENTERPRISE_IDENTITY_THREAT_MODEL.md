# Enterprise Identity Threat Model

**Status:** ARCHITECTURE DESIGNED

| Threat | Attack Path | Existing Control | Required Control | Residual Risk | Verification Method |
| --- | --- | --- | --- | --- | --- |
| Cross-tenant authentication | Tenant A IdP token used for Tenant B | Organization boundary governance | Server-side IdP-to-Organization mapping | Provider misconfiguration | Tenant isolation tests |
| IdP mix-up | Callback uses wrong issuer/config | Private-by-default governance | Per-tenant issuer and state binding | Misconfigured metadata | OIDC/SAML negative tests |
| Token substitution | Attacker swaps token/assertion | Auth/RBAC foundation | Signature, audience, nonce/state validation | Provider library defects | Automated protocol tests |
| SAML replay | Reuse valid assertion | None verified | Replay cache and request correlation | Clock skew | SAML replay tests |
| Insecure account linking | Email-only merge | ODR-020 | Controlled linking proof | Admin error | Account-linking tests |
| Stale employee access | IdP/SCIM deactivation not reflected | Session governance | Forced logout and revalidation | Provider outage | Deprovisioning tests |
| Group privilege escalation | IdP group maps to privileged TSR role | Five-role model | Governed role mappings; no arbitrary roles | Misconfigured mapping | RBAC tests |
| Secret leakage | IdP secret appears in logs/source | Secrets policy | Encrypted storage and redaction | Operational error | Secret audit |
| Break-glass abuse | Emergency access used routinely | No universal bypass rule | Narrow, audited, alerted access | Insider misuse | Audit review |
| Offline replay after deactivation | Mobile queue syncs stale mutations | Mobile tenant context | Revalidate status at sync | Network races | Mobile/offline tests |
