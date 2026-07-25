# Capability ID Standard

Capability IDs are stable, provider-neutral, model-neutral, lowercase, machine-readable, and immutable after production use.

Format: dot-separated or underscore-separated lowercase words matching `^[a-z][a-z0-9]*(?:[._][a-z0-9]+)*$`, up to 120 characters.

IDs must not include provider or model names such as OpenAI, GPT, Anthropic, Claude, Gemini, Llama, Mistral, or Cohere. Retired IDs must not be reused. Display names may change without changing the ID.
