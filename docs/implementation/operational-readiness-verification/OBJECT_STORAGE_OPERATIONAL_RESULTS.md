# Object Storage Operational Results

Status: PASSED.

## Verified Configuration

The production photo-storage integration is configured as durable S3-compatible object storage.

| Item | Verified result |
| --- | --- |
| Provider | Cloudflare R2 through the S3-compatible adapter |
| Adapter | `services/photoStorage.js` |
| Bucket | `truck-safe-routing-delivery-photos` |
| Provider mode | `s3` |
| Region | `auto` |
| Force path style | `true` |
| Public read base | Cloudflare R2 `r2.dev` public base URL |
| `/health` photo storage | provider `s3`, configured `true`, durable `true` |
| `/ready` durable photo storage | passed |

Secret access keys, secret keys, and signed credentials were not printed or documented.

## Implementation Findings

Object uploads are performed by `services/photoStorage.js` using `PutObjectCommand`.

Object keys are generated as:

```text
<folder>/<note-or-hazard-id>/<timestamp>-<index>-<random>.<extension>
```

Delivery-note photos use folder `delivery-notes`. Hazard report photos use folder `hazard-reports`. The smoke test used folder `operational-readiness-verification`.

For S3-compatible storage, the current application stores a public URL built from `PHOTO_STORAGE_PUBLIC_BASE_URL` and the object key. It does not currently use presigned URLs or an application-mediated object-read endpoint for these stored photo objects.

Deletion is performed by `DeleteObjectCommand` through `photoStorage.deleteDeliveryNotePhotos`.

## Approved Disposable Smoke Test

One synthetic non-sensitive PNG object was uploaded under the approved prefix:

```text
operational-readiness-verification/
```

Generated object key:

```text
operational-readiness-verification/storage-smoke-20260718191243614-c1a24811/1784401963616-1-7806bed0d0a8.png
```

The object contained only a 68-byte synthetic PNG test payload.

## Smoke Results

| Check | Result |
| --- | --- |
| Prefix pre-check | passed; `operational-readiness-verification/` initially contained 0 objects |
| Upload | passed |
| Object persistence/head check | passed |
| S3 read-back | passed |
| Expected SHA-256 | `4b5c5c92cec3b23e6a294fc0eea43234ef5126c5a64f4c6c531ac8430ab0b844` |
| Read-back SHA-256 | `4b5c5c92cec3b23e6a294fc0eea43234ef5126c5a64f4c6c531ac8430ab0b844` |
| Checksum match | passed |
| Public configured URL read | HTTP 200; returned same 68-byte PNG and same checksum |
| Incorrect public URL | HTTP 404 |
| Delete safety check | passed; key matched the unique smoke-test prefix before deletion |
| Delete | passed; deleted exactly the generated smoke-test key |
| Post-delete head check | passed; object no longer exists |
| Post-delete public URL | HTTP 404 |
| Post-cleanup prefix listing | passed; `operational-readiness-verification/` contains 0 objects |

## Authorization And Exposure Result

The current architecture intentionally exposes uploaded photo objects through the configured Cloudflare R2 public base URL. The smoke object was publicly retrievable by exact generated URL before deletion and not retrievable after deletion.

This means the storage path is operationally functional, but object privacy depends on unguessable object keys, application-level control of URL disclosure, and Cloudflare R2 bucket/public-domain policy. The test did not prove tenant-scoped object authorization because current S3 object reads are not application-mediated and no production database records were created for a tenant-scoped object.

No cross-tenant denial test was performed because doing so would require production business record setup or an application-mediated private object-read path that this storage adapter does not currently provide.

## ODR-019 Lifecycle Interaction

The smoke object was classified as ephemeral verification data.

No production database record, `lifecycle_object_references` row, or `lifecycle_tombstones` row was created because the existing direct storage-smoke path uses the `photoStorage` adapter only and does not persist a business object reference. Direct cleanup was appropriate because the owner explicitly approved deletion of the exact disposable test object and no operational record referenced it.

ODR-019 lifecycle controls remain relevant for production business objects that are tied to delivery notes, hazard reports, exports, or other retained operational records.

## Production Health After Test

`npm.cmd run check:deployed -- https://truck-safe-routing-api.onrender.com` passed after the test.

- `/health`: HTTP 200
- `/ready`: HTTP 200
- photo storage provider: `s3`
- configured: `true`
- durable: `true`

## Safety

Production data modified beyond the single disposable object: no.

Production database modified: no.

Production migrations applied: no.

Existing production objects read, modified, or deleted: no.

Bulk operations performed: no.

Secrets printed or committed: no.

## Result

Production Object-Storage Operational Verification is PASSED.
