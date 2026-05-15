# Architecture

## High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Frontend   │────▶│  Fastify API │────▶│   Worker     │
│ (Next.js)   │     │  (apps/api)  │     │ (placeholder)│
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────▼───────┐
                    │  PostgreSQL  │
                    │    16-alpine │
                    └──────────────┘
```

## Modular Monolith

The system starts as a modular monolith with clear module boundaries:

| Module                                    | Location           | Status         |
| ----------------------------------------- | ------------------ | -------------- |
| **API** — Fastify HTTP server             | `apps/api/`        | ✅ Implemented |
| **Web** — Next.js 15 + Tailwind CSS v4    | `apps/web/`        | ✅ Implemented |
| **Worker** — Background job processor     | `apps/worker/`     | ⏳ Placeholder |
| **Shared** — Common types, utilities      | `packages/shared/` | ✅ Implemented |
| **Config** — Env config, provider routing | `packages/config/` | ⏳ Placeholder |

### API (apps/api)

Fastify 5 server with:

- 9 domain modules under `src/domains/` (users, projects, ideas, plans, phases, subphases, questions, answers, generations)
- Drizzle ORM for PostgreSQL with generated SQL migrations
- Zod schemas for request validation (shared patterns in `src/schemas/`)
- Centralized error handling (`src/lib/errors.ts`) with `AppError`, `NotFoundError`, `ValidationError`
- Pino structured logging (JSON in production, pretty-print in development)

### Web (apps/web)

Next.js 15 with App Router, statically rendered:

- 7 routes: dashboard, projects (list + new), blueprints, plans, settings, 404
- Responsive layout with mobile hamburger navigation
- Reusable UI primitives: Button, Card, Input, Skeleton, EmptyState, ErrorState
- Accessible form foundations: FormField with aria-describedby, aria-invalid wiring
- Tailwind CSS v4 with custom `orchestra` color palette and semantic tokens

### Worker (apps/worker)

Placeholder. Will handle long-running AI prompts, task decomposition, and exports in a later phase.

## Key Domains

Nine core domains are defined in `apps/api/src/domains/`:

| Domain      | Schema | Routes                               | Status         |
| ----------- | ------ | ------------------------------------ | -------------- |
| users       | ✅     | GET /api/v1/users/:id                | ⏳ 501 stub    |
| projects    | ✅     | GET/POST, GET /api/v1/projects       | ✅ Implemented |
| ideas       | ✅     | GET /api/v1/projects/:id/ideas       | ⏳ 501 stub    |
| plans       | ✅     | GET /api/v1/projects/:id/plans       | ⏳ 501 stub    |
| phases      | ✅     | GET /api/v1/plans/:id/phases         | ⏳ 501 stub    |
| subphases   | ✅     | GET /api/v1/phases/:id/subphases     | ⏳ 501 stub    |
| questions   | ✅     | GET /api/v1/questions                | ⏳ 501 stub    |
| answers     | ✅     | POST /api/v1/projects/:id/answers    | ⏳ 501 stub    |
| generations | ✅     | GET /api/v1/projects/:id/generations | ⏳ 501 stub    |

Only projects has working CRUD routes. The remaining eight domains have their database schemas, Zod types, and route stubs in place but return 501 Not Implemented.

## Not Yet Built

These features are intentionally deferred:

- **AI provider integration** — the app has no AI calls yet. Provider routing and prompt generation domains are defined but not wired.
- **Interview engine** — the structured Q&A flow that refines raw ideas is not implemented. Questions and answers tables exist but have no logic.
- **Planning engine** — the 12-phase lifecycle generation, blueprint creation, and roadmap generation are not implemented.
- **Task graph** — dependency resolution and task ordering are not implemented. The `dependency_ids` column on subphases is ready.
- **Authentication** — no user auth. The `users` table exists for future auth integration.
- **Background worker** — `apps/worker` is a placeholder. Job queues, AI prompt execution, and exports will run here later.
- **Testing** — only 3 test files covering error classes, schemas, and a shared utility. No integration tests.
- **Monitoring** — Pino logging is configured. Sentry setup is documented but not installed.

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
- Cross-app communication runs through HTTP (API) or the worker queue — never direct imports.

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

- PostgreSQL 16 via Docker Compose for local development.
- Drizzle ORM for schema management with generated SQL migrations in `apps/api/drizzle/`.
- 9 tables, all with UUID primary keys, timestamptz columns, and foreign keys.
- Migration: `pnpm --filter @orchestra/api db:migrate`.
- Schema docs: [schema.md](schema.md).

## CI/CD

- **CI**: GitHub Actions on every PR — lint, format check, typecheck, test, build.
- **Deploy**: GitHub Actions on push to `main` — builds and deploys to Railway (or equivalent PaaS).
- **Secrets**: GitHub secrets + Railway service variables. Never stored in the repository.
- **Health**: `GET /health` (liveness), `GET /ready` (readiness with DB check), `GET /api/v1/status` (version).

## Future Separation Path

When the monolith needs to scale:

1. Extract `packages/shared` to an independent npm-published package.
2. Extract `apps/worker` to a standalone deployment with its own queue (Bull/BullMQ + Redis).
3. Extract `apps/api` to scale HTTP endpoints independently.
4. The monorepo structure already supports this without restructuring.
