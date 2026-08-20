# Screened-Out Candidates

| Capability | Candidate | Reason Considered | Reason Excluded |
| --- | --- | --- | --- |
| ALL_D2 | OpenAI GPT-5.6 Luna/Terra | Current OpenAI family is relevant and now has official API documentation/pricing. | Reference-only for this MS-003 baseline: adding Luna/Terra would inflate benchmark scope beyond the already bounded GPT-5 nano/mini/GPT-5 ladder without owner-approved candidate substitution. |
| ALL_D2 | OpenAI GPT-5.6 Sol | Current flagship upper-bound candidate. | Too expensive for current TSR candidate discipline except future owner-approved upper-bound tests; not needed while GPT-5 provides a cheaper upper-bound reference. |
| ALL_D2 | Anthropic Claude Opus 4.7 | Current high-capability Claude candidate. | Premium cost and capability are disproportionate to MS-002 presentation/explanation contracts before cheaper candidates fail. |
| ALL_D2 | Mistral Medium 3.5 | Mistral higher-capability candidate. | Substantially higher output cost than Mistral Small without a current capability-specific need. |
| ALL_D2 | Qwen3-32B self-hosted | Apache 2.0 open-weight reference. | Reference only; no TSR serving stack, hardware sizing, monitoring, or integration exists yet. |
| ALL_D2 | Llama 4 Scout self-hosted | Open-weight long-context reference. | Reference only; custom license and single-H100 serving burden are disproportionate before hosted candidates are tested. |
| ALL_D1 | General-purpose hosted LLM prediction | Could transform predictive facts into prose. | Prediction contracts require statistical accuracy/calibration first; generative output has no strong technical reason for D1 benchmark entry. |
