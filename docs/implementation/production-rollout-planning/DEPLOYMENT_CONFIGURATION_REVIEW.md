# Deployment Configuration Review

Render:

- `render.yaml` defines a Docker web service named `truck-safe-routing-api`.
- `healthCheckPath` is `/health`.
- Secret env vars use `sync: false`.
- Production DB SSL is configured as `"true"`.

Docker:

- `Dockerfile` uses `node:20-alpine`.
- Workdir is `/app`.
- Production dependencies installed with `npm ci --omit=dev`.
- Command is `npm start`.

Repository path risk:

- Source is in a backend subdirectory inside repository root. Render must build the backend app directory correctly.
- Current Dockerfile lives in `bridge-api/`; deployment must target that directory or use the correct rootDir setting in Render.

Do not deploy during this phase.
