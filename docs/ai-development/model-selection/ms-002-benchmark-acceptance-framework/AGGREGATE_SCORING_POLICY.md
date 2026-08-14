# Aggregate Scoring Policy

Aggregate scoring cannot override mandatory gates.

Correct conceptual order:

1. Hard gates.
2. Capability acceptance.
3. Eligible candidates.
4. Cost comparison.
5. Escalation or justification if necessary.

A candidate failing a mandatory safety, tenant, schema, output-contract, or deterministic-authority gate must not win through weighted averaging.
