# Mobile Media Compatibility

## Result

Mobile private-media compatibility is source-verified and previously physically validated for delivery-note/account media workflows, but final public R2 shutdown remains blocked by backend metadata dependencies rather than mobile display behavior.

## Active Mobile Paths

| Path | Result |
| --- | --- |
| `apps/mobile/src/app/components/AuthenticatedMediaImage.js` | Uses authenticated private-media paths for media classified as Organization-private or under `/api/media`. Does not read `legacyPublicUrl`. |
| Delivery Notes media display | Uses authenticated media component for saved media. |
| Account Knowledge media display | Uses authenticated media component and tenant/account context. |
| Home/recent note media display | Uses authenticated media component where media is rendered. |
| Mobile validation script | `apps/mobile/scripts/check-mobile-private-media.cjs` asserts no `legacyPublicUrl` fallback and no mobile knowledge of `PHOTO_STORAGE_PUBLIC_BASE_URL`. |

## Conclusion

Mobile display does not require direct public R2 URLs for the current private delivery-note media workflow. The remaining shutdown blocker is backend metadata generation/preservation, not a mobile image-rendering dependency.

## Remaining Mobile Follow-up

Before actual public R2 shutdown, repeat a physical phone test after metadata writer remediation and cleanup:

1. Open an existing delivery note with migrated media.
2. Verify authenticated photos load.
3. Capture a new in-app camera photo.
4. Save and verify the new media loads through `/api/media`.
5. Confirm no new public URL metadata is persisted.
6. Force close and reopen the app and verify media still loads.
