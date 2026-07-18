# Mobile Private Media Architecture

## Selected Pattern

The selected architecture is authenticated React Native image requests using the existing driver session header source.

`AuthenticatedMediaImage` builds the image source as follows:

1. Classify media as Organization-private when it has `mediaClassification = ORGANIZATION_PRIVATE`, an `accessPath` under `/api/media/`, or a URL under `/api/media/`.
2. Resolve relative `/api/media/:mediaId` paths against `API_BASE_URL`.
3. Attach headers from `getDriverSessionHeaders()` only for private TSR media.
4. Render local file/content/data URIs and public/provider images without driver auth headers.
5. Never use `legacyPublicUrl` as a fallback for private media.

## Why This Pattern

This is the smallest architecture-compatible fix because it preserves the existing TSR driver session model and backend authorization boundary. It does not issue signed URLs, expose R2 credentials, expose storage keys, embed long-lived secrets in URLs, or make the private bucket public.

## Files Changed

- `apps/mobile/src/app/components/AuthenticatedMediaImage.js`
- `apps/mobile/src/app/screens/DeliveryNotesScreen.js`
- `apps/mobile/src/app/components/AccountKnowledgePanel.js`
- `apps/mobile/src/app/screens/HomeScreen.js`
- `apps/mobile/scripts/check-mobile-private-media.cjs`
- `apps/mobile/package.json`
