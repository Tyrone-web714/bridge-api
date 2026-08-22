# Test Strategy

Validation is offline and deterministic.

The selected-D2 test harness verifies:

- all nine selected mappings;
- wrong provider rejection;
- wrong model rejection;
- unknown capability rejection;
- D1 capability rejection;
- D0 capability rejection;
- production activation rejection;
- tenant mismatch rejection;
- runtime hard-gate rejection;
- provider failure fallback;
- secret-like input rejection;
- provider distribution of Google 5, Mistral 4, OpenAI 0, Anthropic 0.

Codex does not execute hosted calls in this package. Optional external smoke testing must be owner-executed in a non-production environment.

External smoke command prepared for owner execution:

`npm.cmd run d2-selected:smoke:external -- --non-production --owner-executed`
