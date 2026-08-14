# Cheapest-Sufficient Selection

The goal is not to find the most powerful model. The goal is to find the least expensive execution option that reliably satisfies the acceptance requirements of each TSR capability.

| Policy Item | Value |
| --- | --- |
| Governing rule | least_expensive_execution_option_that_reliably_satisfies_capability_acceptance_requirements |
| Highest raw quality score wins | false |
| Hard gates precede aggregate scoring | true |

## Decision Sequence

- D0 satisfies capability means no model
- D1 evaluates least-complex deterministic/statistical/lightweight methods before model escalation
- D2 evaluates eligible low-cost candidates before balanced or premium candidates
- hard gate failure disqualifies candidate before aggregate scoring
- among candidates passing mandatory gates, prefer lowest expected total operating cost
- more expensive candidate requires documented material operational advantage
- escalate only when cheaper eligible candidates fail or an explicit operational reason justifies escalation
