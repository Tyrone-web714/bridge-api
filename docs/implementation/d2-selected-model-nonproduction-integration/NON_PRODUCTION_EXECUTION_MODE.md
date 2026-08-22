# Non-Production Execution Mode

Selected D2 execution requires:

`NON_PRODUCTION_SELECTED_D2`

The executor rejects:

- missing or different execution mode;
- `options.production === true`;
- `NODE_ENV=production`;
- selected-D2 registry use as production routing.

This package does not add production configuration, production orchestration, deployment hooks, database migrations, or production API activation.
