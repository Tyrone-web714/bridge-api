# Capability Schema

The canonical schema is implemented in `enterpriseCapabilityRegistry.js`. It includes identity, ownership, lifecycle, implementation status, risk and impact, authoritative data boundaries, execution eligibility, validation, policy, benchmark readiness, cost governance, provider independence, dependencies, audit governance, decision-history placeholders, and source evidence.

Unknown values are explicit through `null`, `UNKNOWN`, `PENDING`, or `OWNER_DEFINED`. Unknown cost is never represented as zero.
