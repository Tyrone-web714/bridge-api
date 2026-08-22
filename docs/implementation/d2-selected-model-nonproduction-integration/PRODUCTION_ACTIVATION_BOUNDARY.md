# Production Activation Boundary

Production model routing remains `NOT_ACTIVATED`.

Production orchestration remains `DEFERRED`, incomplete, inactive, and owner-approval gated.

This package does not:

- mount a production API;
- deploy code;
- run migrations;
- write production data;
- modify provider credentials;
- modify Cloudflare/R2;
- route customer traffic to selected D2 models.

A separate owner-approved production orchestration package is required before production use.
