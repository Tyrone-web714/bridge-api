# Cost And Usage Attribution

The migrated supervisor path records safe attribution when available:

- organization
- user
- role
- feature
- capability
- workflow metadata
- provider
- configured model
- model class
- prompt version
- usage
- latency
- estimated cost
- actual cost
- trace ID

Unknown provider cost remains `null`. It is not converted to zero, free, or `$0.00`.

No customer billing, markup, subscription tier, or chargeback behavior was added.