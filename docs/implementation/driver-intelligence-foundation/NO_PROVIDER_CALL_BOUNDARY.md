# No Provider Call Boundary

Driver Intelligence does not call OpenAI, Anthropic, Gemini, external model providers, `fetch`, hosted AI adapters, or provider clients.

Caller-supplied provider, model, premium, or model-control fields are rejected by request validation.
