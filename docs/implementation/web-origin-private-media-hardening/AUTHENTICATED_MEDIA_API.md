# Authenticated Media API

## Endpoint

```http
GET /api/media/:mediaId
```

## Required Context

- Authenticated driver, warehouse, supervisor, Organization admin, or platform workflow with approved support context.
- Organization context.
- One of the approved media-view permissions.

## Response

The backend streams the exact object from S3-compatible storage and sets:

- `Content-Type`
- `Content-Length`, when available
- `Cache-Control: private, max-age=60`
- `X-Content-Type-Options: nosniff`

## Rejections

The route rejects unauthenticated requests, missing Organization context, insufficient permission, unknown media IDs, unsafe media IDs, unsafe storage keys, unsupported providers, and arbitrary object-key access.
