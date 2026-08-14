# Safety And Governance Gates

Safety, legal, tenant, privacy, and authorization gates are blocking gates. Cost and model quality cannot waive them.

| Gate | Requirement |
| --- | --- |
| Safety authority | Model output must not override deterministic safety, legal, physical, route, or policy controls. |
| Tenant isolation | Future benchmark inputs and outputs must preserve organization/user boundaries. |
| Privacy | Future evidence must avoid unapproved production data and minimize sensitive content. |
| Human review | Human-review requirements must be recorded before any advisory use. |
| Fallback | A deterministic fallback or safe non-response must be defined. |
| Auditability | Input lineage, output contract, observations, and decision rationale must be reproducible. |

## Hard Disqualification Examples

- changing vehicle/route compatibility facts
- changing warehouse readiness facts
- contradicting authoritative route restriction
- converting insufficient evidence into certainty
- cross-Organization leakage
- fabricating customer/account facts
- fabricating driver operational evidence
- fabricating source evidence
- inventing safe clearance
- malformed required output contract
- presenting unknown evidence as known
- provider or model selection asserted by benchmark evidence
- suppressing known safety blocker

A severe deterministic-authority violation disqualifies the candidate regardless of aggregate quality score.
