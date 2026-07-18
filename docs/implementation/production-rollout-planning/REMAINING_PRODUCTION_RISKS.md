# Remaining Production Risks

Blocking for actual deployment:

- Production database schema state is not verified.
- Production backup existence is not verified.
- Production restore procedure is not verified.
- Actual Render environment values are not verified.
- Production object storage upload/read smoke is not verified.

Controlled-pilot limitations:

- Physical mobile offline/reconnect replay on current production-target APK.
- Browser walkthrough of authenticated dashboards.
- Deployment smoke against the actual Render backend.

Deferred architecture implementation:

- ODR-019 Data Lifecycle.
- ODR-020 Enterprise Identity.

Lower-risk follow-up:

- Additional source adapters.
- Endpoint-by-endpoint public/reference review.
- External monitoring/alerting configuration.
