# Supervisor Intelligence Architecture

The foundation uses deterministic rules in `supervisorOperationalIntelligence.js`.

Inputs are trusted supervisor context, route records, driver intelligence references, stop records, and route safety evidence. Outputs are normalized route portfolio state, operational exceptions, structured alerts, summaries, explanations, benchmark assessments, and generated evidence artifacts.

The module integrates with existing Route Intelligence and Driver Intelligence by consuming their repository-only synthetic outputs and recording schema references. It also verifies existing enterprise registry, orchestration, and lifecycle records without adding a new framework.
