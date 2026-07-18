# Tenant And Authorization Safety

## Tenant Safety

The tool reads Organization ownership from `delivery_notes.organization_id`. It does not trust a client-supplied Organization ID in media metadata.

An optional `LEGACY_MEDIA_MIGRATION_ORGANIZATION_ID` environment variable can narrow execution to one Organization for staged migration.

## Authorization Safety

The migration tool does not grant media access. It only prepares metadata for the existing authenticated `/api/media/:mediaId` route, which enforces authentication, Organization context, tenant-scoped lookup, and permissions.

## Object-Key Safety

Unsafe object-key shapes are blocked. The tool does not accept object keys from request parameters or command-line arguments.
