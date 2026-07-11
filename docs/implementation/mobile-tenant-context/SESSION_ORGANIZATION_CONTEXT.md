# Session Organization Context

The mobile app derives tenant context only from the authenticated backend driver login response.

Trusted context fields:

- `organizationId`
- `internalDriverId`
- `companyDriverNumber`
- `role`
- `permissions`
- `sessionId` where returned
- `expiresAt`

The company driver number remains the operational driver ID shown to and entered by drivers. It is not used as the permanent tenant storage identity when `internalDriverId` is available.

Sessions that do not contain Organization ID, internal driver ID, and company driver number are rejected and removed from SecureStore.