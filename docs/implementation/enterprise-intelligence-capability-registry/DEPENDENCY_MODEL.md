# Dependency Model

Capabilities may declare upstream capabilities, downstream capabilities, required services, required data sources, required policies, required executors, and optional dependencies.

Validation rejects unknown capability references, self-dependencies, direct cycles, indirect cycles, and retired dependencies without an approved exception.

No visual graph or full impact-analysis tooling was added in this package.
