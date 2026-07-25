# Cost And Usage Attribution

The OpenAI provider adapter preserves existing usage and cost behavior:

- usage is captured when provider usage is returned
- estimated cost is calculated only when both token-cost environment variables are configured
- unknown cost remains `null`
- known zero cost is not assumed
- actual cost remains `null` because no provider billing ledger integration exists

IEP completion audit metadata includes:

- capability
- selected strategy
- provider
- model
- model class
- prompt version
- usage
- latency
- estimated cost
- actual cost

Legacy `repositories.saveAiInteractionLog` calls remain in place to preserve existing operations reporting.
