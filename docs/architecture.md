# Architecture Notes

## High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Frontend   │────▶│     API      │────▶│   Worker     │
│  (apps/web) │     │  (apps/api)  │     │ (apps/worker)│
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────▼───────┐
                    │   Shared     │
                    │  (packages/) │
                    └──────────────┘
```

## Modular Monolith

The system starts as a modular monolith with clear module boundaries:

- **API** – HTTP server handling user-facing requests (interview engine, blueprint generation, etc.).
- **Worker** – Background job processor for long-running AI prompts, task decomposition, and exports.
- **Web** – Frontend application (framework TBD).
- **Shared** – Common types, utilities, and domain models used across all apps.
- **Config** – Shared configuration helpers for environment variables and provider routing.

## Key Domains (future)

These will be implemented as modules within `apps/api` and `apps/worker`:

- **Interview Engine** – structured Q&A to refine raw ideas.
- **Planning Engine** – transforms refined requirements into lifecycle phases.
- **Task Decomposition** – splits phases into dependency-aware tasks.
- **Prompt Generation** – builds AI-ready execution prompts for each task.
- **AI Provider Routing** – abstracts multiple LLM providers behind a unified interface.
- **Usage Tracking** – records token usage and cost per request.
- **Versioning** – snapshots of blueprints, roadmaps, and task graphs.
- **Export System** – renders plans as markdown, JSON, or other formats.
- **Monitoring** – health checks, job queue visibility, and alerting.

## Conventions

### Error Handling

- All errors are typed. Business errors extend a base `AppError` class with a machine-readable `code` and a user-facing `message`.
- Unexpected errors (network failures, assertion violations) are caught by a global error boundary at each app boundary and logged before returning a generic error to the caller.
- The `AppError` base class and associated utilities live in `packages/shared/src/errors.ts`.

### Naming

- **Files:** `kebab-case.ts` (except React components → `PascalCase.tsx` — once the frontend framework is chosen).
- **Exports:** Named exports only (no default exports).
- **Variables/functions:** `camelCase`.
- **Classes/types/interfaces:** `PascalCase`.
- **Constants:** `UPPER_SNAKE_CASE`.

### Module Boundaries

- `packages/shared` must never import from `apps/` or from other `packages/` — it is the leaf dependency.
- `packages/config` depends only on `packages/shared` and Node built-ins.
- `apps/*` may import from any `packages/*` but never from sibling `apps/*`.
- Cross-app communication happens exclusively through the API layer (HTTP) or the worker queue — never through direct imports.

### Environment Variables

- Accessed through a typed config helper per domain, never `process.env` directly.
- Required variables are validated at startup; missing required variables throw immediately with a clear message.
- Variables follow `UPPER_SNAKE_CASE`.
- Convention: each `apps/*` or `packages/*` that needs configuration exposes a `loadConfig()` function that returns a typed config object.

### Cross-Platform

- All scripts and tooling must work on Windows, macOS, and Linux.
- `rimraf` replaces `rm -rf` in package scripts.
- The dev launcher uses `pnpm run --parallel` rather than shell `&` for process concurrency.

## Future Separation Path

When the monolith needs to scale:

1. Extract `packages/shared` to an independent npm-published package.
2. Extract `apps/worker` to a standalone deployment with its own queue (Bull/BullMQ + Redis).
3. Extract `apps/api` to scale HTTP endpoints independently.
4. The monorepo structure already supports this without restructuring.
