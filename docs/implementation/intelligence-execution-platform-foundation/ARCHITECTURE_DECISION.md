# Architecture Decision

## Decision

Create a provider-neutral Intelligence Execution Platform foundation that selects execution strategy by capability, policy, profile, and cost-first planning.

## Rationale

The platform must support deterministic rules, SQL analytics, geospatial engines, conventional ML, local models, hosted models, and human review without business modules selecting providers or model names.

## Implemented Boundary

- Business input is normalized by contracts.js.
- Capabilities are defined in capabilityRegistry.js.
- Policy is evaluated before planning in policyEngine.js.
- Planning is deterministic and cost-first in planner.js.
- Execution is coordinated by index.js.
- Hosted model access is deferred behind providerAdapters.js.

## Non-Decision

No owner decision was made for provider selection, retention, cross-Organization learning, regional residency, billing, local infrastructure, vector database, or autonomous actions.
