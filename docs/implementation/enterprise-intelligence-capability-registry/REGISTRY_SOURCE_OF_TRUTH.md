# Registry Source Of Truth

`bridge-api/services/intelligenceExecution/enterpriseCapabilityRegistry.js` is the single authoritative source for capability metadata.

`capabilityRegistry.js` is now a compatibility adapter that exposes the existing runtime lookup shape from the enterprise registry. Generated JSON, CSV, Markdown, and dependency files are derived artifacts, not independent registries.
