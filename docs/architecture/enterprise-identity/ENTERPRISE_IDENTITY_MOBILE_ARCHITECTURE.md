# Enterprise Identity Mobile Architecture

**Status:** ARCHITECTURE DESIGNED

Mobile OIDC SHOULD use Authorization Code Flow with PKCE through secure browser-based flows. The mobile app SHALL validate redirect handling, deep links or app links, state, nonce, token storage, logout, device loss behavior, and tenant-bound offline queues.

The mobile app SHALL NOT collect enterprise IdP passwords in embedded WebViews. Offline queues SHALL NOT sync into the wrong tenant after user, Organization, or identity changes.
