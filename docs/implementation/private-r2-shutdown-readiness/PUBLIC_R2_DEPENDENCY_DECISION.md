# Public R2 Dependency Decision

## Classification

Public R2 shutdown readiness: BLOCKED.

## Dependencies

| Category | Result |
| --- | --- |
| Private Organization media dependencies | BLOCKED by mobile image rendering compatibility. |
| Shared Safety/public media dependencies | READY WITH LIMITATION. Sanitized Shared Safety media may require a separate explicit public-media architecture. |
| Legacy compatibility dependencies | READY WITH LIMITATION. The 3 known legacy references are migrated, but `legacyPublicUrl` remains compatibility/audit metadata. |
| Mobile dependencies | BLOCKED. React Native image loads do not attach auth headers to private media URLs. |
| Dashboard dependencies | UNKNOWN / REQUIRES MANUAL VERIFICATION. Same-origin cookie path suggests compatibility, but not operationally verified. |
| External/integration dependencies | UNKNOWN. No external consumer inventory was available. |

## Decision

Do not disable public R2 access yet.

The private bucket should not remain public as a long-term design, but current mobile behavior must be corrected or proven compatible before public access is disabled.

If Shared Safety requires public image delivery, use a separate explicitly public and sanitized media path rather than keeping the private delivery-photo bucket public.
