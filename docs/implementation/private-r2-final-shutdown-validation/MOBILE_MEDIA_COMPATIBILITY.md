# Mobile Media Compatibility

## Result

Mobile private-media compatibility is source-verified and physically validated for delivery-note/account media workflows. Final public R2 shutdown is no longer blocked by mobile display behavior or legacy metadata cleanup; it is awaiting owner-approved Cloudflare R2 Public Development URL shutdown and final production smoke validation.

## Active Mobile Paths

| Path | Result |
| --- | --- |
| `apps/mobile/src/app/components/AuthenticatedMediaImage.js` | Uses authenticated private-media paths for media classified as Organization-private or under `/api/media`. Does not read `legacyPublicUrl`. |
| Delivery Notes media display | Uses authenticated media component for saved media. |
| Account Knowledge media display | Uses authenticated media component and tenant/account context. |
| Home/recent note media display | Uses authenticated media component where media is rendered. |
| Mobile validation script | `apps/mobile/scripts/check-mobile-private-media.cjs` asserts no `legacyPublicUrl` fallback and no mobile knowledge of `PHOTO_STORAGE_PUBLIC_BASE_URL`. |

## Conclusion

Mobile display does not require direct public R2 URLs for the current private delivery-note media workflow. Backend writer remediation is complete, obsolete legacy public metadata cleanup is complete, and the remaining mobile obligation is post-shutdown smoke validation.

## Final Smoke Validation

After owner-approved public R2 shutdown:

1. Open an existing delivery note with migrated media.
2. Verify authenticated photos load.
3. Capture a new in-app camera photo only if the owner approves an upload smoke step during the shutdown window.
4. Save and verify any new owner-approved test media loads through `/api/media`.
5. Confirm no new public URL metadata is persisted if an upload smoke step is performed.
6. Force close and reopen the app and verify media still loads.
