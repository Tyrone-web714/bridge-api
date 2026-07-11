# Current Auth Mapping

| Current path | Classification | Target handling |
| --- | --- | --- |
| Admin dashboard cookie session | Preserve and adapt | Adds approved role, permissions, Organization claims, and session version validation. |
| Legacy shared admin password | Deprecate | Retained only as bootstrap compatibility. Platform Admin claims are explicit. |
| Driver `/api/driver-auth/login` | Preserve and adapt | Resolves company driver number to trusted driver identity and session claims. |
| Driver bearer token | Preserve | Adds Organization, internal driver ID, company driver number, approved DRIVER role, and permissions. |
| Legacy driver API token | Deprecate | Allowed only when `ALLOW_LEGACY_DRIVER_API_TOKEN=true`; uses bootstrap Organization compatibility. |
| Warehouse employee ID-only confirmation | Unsafe and blocking | Replaced with employee ID plus PIN validation. |
| Inline route role checks | Adapt later | Central middleware exists; existing inline checks remain for compatibility where broader rewiring is not yet safe. |
| Mutation audit middleware | Preserve and adapt | Adds Organization/session/outcome metadata where available. |
