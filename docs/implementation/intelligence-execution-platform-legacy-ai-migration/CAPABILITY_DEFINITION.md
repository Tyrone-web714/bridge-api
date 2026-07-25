# Capability Definition

Capability ID: `legacy.ai.structured_response`

Version: `legacy.ai.structured_response.v1`

Description: compatibility capability for existing `/api/ai` structured logistics intelligence responses.

Owner domain: `logistics_intelligence`

Input schema reference: `schemas/intelligence/legacy-ai-structured-response-input.v1`

Output schema reference: `schemas/intelligence/legacy-ai-structured-response-output.v1`

Permitted model classes:

- `HOSTED_BALANCED`

Default execution profile: `BALANCED`

Safety classification: `MEDIUM`

Latency target: 30000 ms, aligned with the existing OpenAI timeout default and existing `OPENAI_TIMEOUT_MS` compatibility.

Maximum input size: IEP foundation request limit of 24 KiB.

Maximum output size: governed by existing provider structured output and route schemas; no new larger output limit was introduced.

Cache policy: not eligible.

Batch eligibility: false.

Human review policy: not required for compatibility response; AI remains advisory and backend records remain source of truth.

Fallback sequence: none.

Active: true.
