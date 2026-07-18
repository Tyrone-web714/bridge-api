# Private Media Access Architecture

## Access Path

Private media is accessed through:

```text
GET /api/media/:mediaId
```

The API resolves the media ID through tenant-scoped delivery-note data before reading the exact object key from object storage.

## Controls

- Authentication is required.
- Authorization is checked through explicit permissions.
- Organization context is required.
- The client cannot pass arbitrary storage keys.
- Unsafe object keys are rejected.
- Responses are served with private cache headers.

## Compatibility

The object remains in R2. This phase changes the preferred application URL and authorization path, not the storage backend.
