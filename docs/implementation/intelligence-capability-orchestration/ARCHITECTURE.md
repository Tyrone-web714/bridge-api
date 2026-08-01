# Architecture

AI-IEP-005A.1 Intelligence Capability Orchestration is repository-only, deterministic, metadata-only, provider-neutral, advisory, and test-only. It does not implement predictive models, LLM prompts, runtime APIs, provider routing changes, production activation, deployments, commits, pushes, or migrations.

The orchestration layer is a repository service under bridge-api/services/intelligenceExecution. It consumes metadata and existing IEP constants, then emits deterministic catalogs and plan templates. No route, provider adapter, planner runtime, database, or public endpoint imports it.
