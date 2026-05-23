# Durable Delivery-Note Photo Storage

Truck-Safe Routing supports local photo storage for development and S3-compatible storage for production pilot.

Local storage is not pilot-safe because photos live on the backend machine. If that machine is replaced, redeployed, or damaged, delivery-note photos can be lost.

## Production Provider

Use one S3-compatible bucket:

- AWS S3
- Cloudflare R2
- Backblaze B2 S3-compatible
- DigitalOcean Spaces

## Required Environment Variables

Set these in the backend production environment:

```env
PHOTO_STORAGE_PROVIDER=s3
PHOTO_STORAGE_BUCKET=truck-safe-routing-delivery-photos
PHOTO_STORAGE_REGION=us-east-1
PHOTO_STORAGE_ENDPOINT=
PHOTO_STORAGE_FORCE_PATH_STYLE=false
PHOTO_STORAGE_ACCESS_KEY_ID=replace-with-object-storage-access-key
PHOTO_STORAGE_SECRET_ACCESS_KEY=replace-with-object-storage-secret-key
PHOTO_STORAGE_PUBLIC_BASE_URL=https://your-photo-public-url.example
```

For Cloudflare R2 or another S3-compatible provider, set `PHOTO_STORAGE_ENDPOINT` to the provider endpoint and usually set:

```env
PHOTO_STORAGE_FORCE_PATH_STYLE=true
```

## Verify Storage Before Pilot

After setting the environment variables, run:

```powershell
cd "C:\dev\bridge-api\bridge-api"
npm.cmd run photos:verify-storage
```

Expected result:

```text
[photos] provider=s3
[photos] configured=true
[photos] durable=true
[photos] uploaded=s3:...
[photos] cleanup=deleted test object
[photos] storage verification passed.
```

## Migrate Existing Local Photos

First dry-run the migration:

```powershell
cd "C:\dev\bridge-api\bridge-api"
$env:PHOTO_STORAGE_PROVIDER="s3"
$env:PHOTO_MIGRATION_DRY_RUN="true"
npm.cmd run photos:migrate
```

Then run the actual migration:

```powershell
cd "C:\dev\bridge-api\bridge-api"
Remove-Item Env:\PHOTO_MIGRATION_DRY_RUN -ErrorAction SilentlyContinue
$env:PHOTO_STORAGE_PROVIDER="s3"
npm.cmd run photos:migrate
```

Keep local photo files until the pilot storage has been verified. Only delete local files during migration after a successful backup:

```powershell
$env:PHOTO_MIGRATION_DELETE_LOCAL="true"
```

## Production Readiness Check

Run:

```powershell
npm.cmd run verify:production
npm.cmd run check:runtime
```

Both commands must pass before pilot.
