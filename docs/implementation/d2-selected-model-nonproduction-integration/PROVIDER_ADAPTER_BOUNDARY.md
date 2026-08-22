# Provider Adapter Boundary

Google and Mistral selected-D2 execution reuses the existing benchmark provider adapter request and response normalization code.

The selected-D2 executor does not copy benchmark logic into a production path. It builds a provider request with:

- selected provider and model only;
- `adapterScope: NON_PRODUCTION_SELECTED_D2`;
- `store: false`;
- JSON response instructions derived from the selected capability output contract;
- metadata that keeps `productionRoutingEnabled: false`.

OpenAI and Anthropic remain unselected for D2 and are rejected by the registry for selected-D2 execution.
