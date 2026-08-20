# Provider Adapter Compatibility

| Provider | Already Supported | Requires Extension | Complexity | Notes |
| --- | --- | --- | --- | --- |
| Anthropic | false | true | MEDIUM | No MS-003 implementation authorized; future adapter extension would be required before hosted benchmarking. |
| Google | false | true | MEDIUM | No MS-003 implementation authorized; future adapter extension would be required before hosted benchmarking. |
| Mistral | false | true | MEDIUM | No MS-003 implementation authorized; future adapter extension would be required before hosted benchmarking. |
| OpenAI | true | false | LOW | Existing providerAdapters.js wraps OpenAI structured response path; model allowlisting/config remains future work. |
