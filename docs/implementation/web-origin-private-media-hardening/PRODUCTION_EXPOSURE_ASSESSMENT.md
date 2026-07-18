# Production Exposure Assessment

## Current Evidence

Prior Cloudflare R2 smoke testing showed direct public object retrieval is possible for exact object URLs on the configured public R2 host.

## Read-Only Assessment Status

Status: VERIFIED BY OWNER-RUN READ-ONLY PRODUCTION ASSESSMENT.

Owner approval was granted for a read-only, metadata-only production media assessment. The aggregate assessment was run manually against the verified Render production database using the actual production `DATABASE_URL` in a temporary PowerShell session.

Assessment controls:

- `ok`: true
- `readOnly`: true
- `metadataOnly`: true
- URLs and object keys redacted: true

## Production Media Findings

| Record type | Total records | Records with media | Media items | `r2.dev` references | Direct public current URLs | Legacy public URL fields | Authenticated access paths | Media classification fields | Storage key fields | Storage provider fields |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `delivery_notes.photos` | 2 | 1 | 3 | 3 | 3 | 0 | 0 | 0 | 3 | 3 |
| `private_hazard_submissions.photo_metadata` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `shared_safety_records.sanitized_media` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

`lifecycle_object_references` exists and currently has 0 references.

Aggregate result:

- Affected record types: `delivery_notes`.
- Total production `r2.dev` references: 3.
- Total direct public current URLs: 3.
- Total authenticated access paths: 0.
- Migration or compatibility plan required: true.
- Public R2 access can be disabled immediately: false.

## Risk

The 3 current delivery-note media items are Organization-private operational media but currently use direct public R2 URLs as their current persisted URL fields. Those records require migration or a safe compatibility transition before public R2 access can be disabled.

## Current Conclusion

Do not disable public R2 access yet. The code path for new private delivery-note media is hardened, but the 3 existing production delivery-note media items still require a migration or compatibility plan.
