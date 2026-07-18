# Authentication And Session Security

## Session Model

The mobile app continues to use the existing driver session model:

- driver login stores the active session through `expo-secure-store`;
- `getDriverSessionHeaders()` returns `Authorization: Bearer <token>` only when the active session is usable;
- media rendering reuses that header source for private TSR media requests.

## Security Results

- Token is not persisted into media metadata.
- Token is not embedded into the media URL.
- Token is not logged by the new component or test.
- Mobile does not receive R2 credentials.
- Mobile does not receive arbitrary R2 object keys for retrieval.
- Mobile does not supply Organization IDs for media access.
- Server-side `/api/media/:mediaId` remains responsible for authentication, Organization context, permission checks, tenant-scoped lookup, and stored object-key use.
- Expired or invalid sessions fail through the private media request; the mobile component shows a failure state rather than falling back to public R2.

## Non-Goals

This phase does not change backend media authorization, issue signed URLs, enable public media fallback for Organization-private data, or implement Enterprise Identity provider verification.
