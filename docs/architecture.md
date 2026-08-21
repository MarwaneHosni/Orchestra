# Architecture

## High-Level Architecture

```
┌─────────────┐     ┌──────────────┐
│  Frontend   │────▶│  Fastify API │
│ (Next.js)   │     │  (apps/api)  │
└─────────────┘     └──────┬───────┘
                           │
                    ┌──────▼─────────────────┐
                    │  SQLite (sql.js)       │
                    │  via Drizzle ORM       │
                    │  (PostgreSQL optional) │
                    └────────────────────────┘
```

The docs/marketing landing site (`apps/landing`, Astro) is a separate static site.

## Modular Monolith

The system starts as a modular monolith with clear module boundaries:

| Module                                    | Location           | Status         |
| ----------------------------------------- | ------------------ | -------------- |
| **API** — Fastify HTTP server             | `apps/api/`        | ✅ Implemented |
| **Web** — Next.js 15 + Tailwind CSS v4    | `apps/web/`        | ✅ Implemented |
| **Landing** — Astro docs & marketing site | `apps/landing/`    | ✅ Implemented |
| **Shared** — Common types, utilities      | `packages/shared/` | ✅ Implemented |
| **Config** — Shared configuration helpers | `packages/config/` | ✅ Implemented |

### API (apps/api)

Fastify 5 server with:

- Business domains under `src/domains/` (projects, interview sessions, execution tasks, phase resolution, provider credentials)
- Drizzle ORM for SQLite (sql.js) with optional PostgreSQL via `DATABASE_URL`
- Zod schemas for request validation (shared patterns in `src/schemas/`)
- Centralized error handling (`src/lib/errors.ts`) with `AppError`, `NotFoundError`, `ValidationError`
- Pino structured logging (JSON in production, pretty-print in development)
- AI generation pipeline (blueprint → roadmap → task graph → execution prompts) with pluggable providers

### Web (apps/web)

Next.js 15 with App Router:

- Routes: dashboard, projects, new project, interview, summary, tasks, blueprints, plans, settings
- Responsive layout with mobile hamburger navigation
- Reusable UI primitives: Button, Card, Input, Skeleton, EmptyState, ErrorState
- Accessible form foundations: FormField with aria-describedby, aria-invalid wiring
- Tailwind CSS v4 with custom `orchestra` color palette and semantic tokens

### Landing (apps/landing)

Astro static site serving the marketing page plus a 17-page documentation section (`/docs/*`).

## Key Domains

Core domains are defined in `apps/api/src/domains/`:

- **Projects** — create, list, delete projects
- **Interview sessions** — guided 12-phase interview flow (start, next question, answers, generate)
- **Execution tasks** — task graph queries, status updates, prompt lookup/export
- **Phase resolution** — phase status and answer handling
- **Provider credentials** — store/validate AI provider keys (encrypted at rest)

Supporting routes (`src/routes/`) expose health, version, observability, diagnostics, usage, cache, and SSE progress endpoints.

## Planning Engine Workflow

The planning engine transforms a raw idea into a structured project blueprint through a deterministic, multi-stage pipeline:

```
Idea text
    │
    ▼
POST /api/v1/projects  ──►  Project created + draft session
    │
    ▼
POST /api/v1/interviews/:id/start  ──►  Session: draft → in_progress
    │
    ▼
GET  /api/v1/interviews/:id/next   ──►  Next question (server-driven)
    │                                        │
    ▼                                        ▼
PUT  /api/v1/interviews/:id/answers  ──►  Answer stored (normalized, versioned)
    │
    ◄── repeat until all questions answered ──►
    │
    ▼
Session: in_progress → ready_for_generation
    │
    ▼
POST /api/v1/interviews/:id/generate  ──►  BlueprintGenerator produces 12-phase output
    │                                           ├── Phase summaries
    │                                           ├── Confidence scores per phase
    │                                           ├── Ambiguity flags (missing, vague, conflicting)
    │                                           ├── Structured assumptions, constraints, risks
    │                                           └── Overall confidence metric
    │
    ▼
Session: ready_for_generation → completed
Blueprint stored as versioned artifact
```

### Key design properties

- **Server-driven flow**: The backend determines which question to serve next based on prior answers, dependency rules, and current phase.
- **Deterministic generation**: Blueprints are computed from explicit heuristics — no AI calls, no randomness.
- **Versioned outputs**: Each `generate` call creates a new plan version. Prior versions and their blueprints are preserved.
- **Answer editing**: Answers can be re-submitted. The engine normalizes text, increments the version, and marks affected plans/blueprints as stale.
- **Draft resume**: Sessions can be reopened. The `/resume` endpoint returns all answers and the next unanswered question.

### Logging

Every major step emits a structured JSON log entry:

- `project.created`, `question.served`, `answer.submitted`, `session.ready_for_generation`
- `blueprint.generation_started`, `blueprint.generated`, `blueprint.completed`, `blueprint.generation_failed`
- `ambiguity.detected` (with `byType` breakdown)

## Not Yet Built

These features are intentionally deferred:

- **Multi-user authentication** — no user auth. The app is single-user/self-hosted.
- **Background worker** — generation runs synchronously today; a background worker could be extracted later if it becomes a bottleneck.
- **Integration tests** — some API endpoints lack automated tests against the database.
- **Sentry / error reporting** — Pino logging is configured. Sentry setup is documented but not installed.

**Recently built:**

- **AI generation pipeline** — pluggable providers (OpenAI, Anthropic, OpenRouter, custom), blueprint/roadmap/task-graph/prompt generation, usage accounting, budget guardrails, rate limiting, AI cache.
- **Task graph** — `generateTasks()` decomposes 12 phases into 20–40 tasks with sequential + cross-phase dependencies, status computation (ready/blocked/needs_review), and failure states for missing/insufficient phases. See `apps/api/src/lib/task-graph/` and [task-decomposition.md](task-decomposition.md).
- **Prompt generation** — `assemblePrompt()` builds versioned prompt artifacts from task context with deterministic Markdown rendering, validation, and failureReason propagation. See `apps/api/src/lib/prompt/`.
- **Export pipeline** — bundle exports via `GET /api/v1/plans/:planId/prompts/export` produce `orchestra-prompt-bundle-v1` JSON with full lineage metadata.
- **Regeneration** — `deriveGraph()` creates new versioned task graphs from existing ones, preserving old versions and tracking `derivedFromPlanVersion`.
- **Persistence** — SQLite-backed stores for sessions, credentials, prompts, and task graphs, with atomic snapshot sync (`queueSyncDb()`).

## Conventions

### Error Handling

- Business errors extend `AppError` (`apps/api/src/lib/errors.ts`) with a machine-readable `code`, user-facing `message`, and `statusCode`.
- Unexpected errors are caught by Fastify's global `errorHandler`, logged, and returned as 500.
- Zod validation errors are caught and returned as 400 with field-level `details`.

### Naming

| Category                 | Convention         | Example            |
| ------------------------ | ------------------ | ------------------ |
| Files                    | `kebab-case.ts`    | `user-service.ts`  |
| React components         | `PascalCase.tsx`   | `UserCard.tsx`     |
| Variables/functions      | `camelCase`        | `getUser()`        |
| Classes/types/interfaces | `PascalCase`       | `AppError`         |
| Constants                | `UPPER_SNAKE_CASE` | `MAX_RETRIES`      |
| Exports                  | Named only         | `export const foo` |

### Module Boundaries

- `packages/shared` imports nothing from other workspace packages (leaf dependency).
- `apps/*` may import from `packages/*` but never from sibling `apps/*`.
- Cross-app communication runs through HTTP (API) — never direct imports.

### Environment Variables

- Accessed through `loadConfig()` — a typed, validated config per domain. Never `process.env` directly.
- Required variables validated at startup; missing variables exit with a clear message.
- Follow `UPPER_SNAKE_CASE`.
- `.env` files are gitignored. `.env.example` is the template.

### Cross-Platform

- All scripts work on Windows, macOS, and Linux.
- `rimraf` replaces `rm -rf` in package scripts.
- Dev launcher uses `pnpm run --parallel` (not shell `&`).

## Database

- **SQLite (sql.js)** is the default store (`SQLITE_DB_PATH`, default `./orchestra.db`) — no server required, local-first. Optional PostgreSQL via `DATABASE_URL`.
- Drizzle ORM manages the schema, with generated SQL migrations in `apps/api/drizzle/`.
- 18 tables in the SQLite schema (projects, ideas, interview_sessions, questions, answers, plans, blueprints, provider_credentials, task_graphs, execution_tasks, task_dependencies, prompt_artifacts, usage_records, activity_log, analysis_results, workflow_runs, ai_cache_entries, ai_cache_invalidation_markers).
- Migration: `pnpm --filter @orchestra/api db:migrate`.
- Schema docs: [schema.md](schema.md).

## CI/CD

- **CI**: GitHub Actions on every push/PR — lint, format check, typecheck, test, build.
- **Deploy**: `api` deploys to Railway (or equivalent PaaS) via the repo-root `Dockerfile`; `web` and `landing` can deploy to Vercel or Railway.
- **Secrets**: GitHub secrets + platform service variables. Never stored in the repository.
- **Health**: `GET /health` (liveness), `GET /ready` (readiness with DB check), `GET /api/v1/status` (version).

## Future Separation Path

When the monolith needs to scale:

1. Extract `packages/shared` to an independent npm-published package.
2. Extract heavy generation work into a background worker with its own queue (Bull/BullMQ + Redis).
3. Extract `apps/api` to scale HTTP endpoints independently.
4. The monorepo structure already supports this without restructuring.
