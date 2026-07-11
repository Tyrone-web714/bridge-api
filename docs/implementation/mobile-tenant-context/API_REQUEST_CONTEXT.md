# API Request Context

Mobile API calls continue using centralized authenticated headers from `jsonApiHeaders()`.

Protected mobile endpoints covered:

- route manifests
- stop completion
- delivery settlement
- delivery documents
- inventory and closeout
- delivery notes/photos metadata
- Places/recent destinations
- route session events
- hazard report submission
- driver copilot

The mobile client does not send arbitrary `organization_id` to select tenant context. Backend tenant context comes from authenticated session claims.