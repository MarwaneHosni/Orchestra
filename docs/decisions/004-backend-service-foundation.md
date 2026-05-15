# Decision 004: Backend Service Foundation

**Date:** 2026-05-15

## Context

Phase 4 required implementing the backend service scaffold: domain boundaries, minimal API routes, validation, and centralized error handling to support the frontend shell and future business logic.

## Decisions

### HTTP Framework

- **Fastify 5** — chosen for built-in schema validation, plugin-based architecture (clean domain boundaries), integrated Pino logging, and strong TypeScript support. The plugin system maps naturally to domain modules.

### Domain Boundaries

- Nine core domains defined as co-located modules under `src/domains/`:
  - `users`, `projects`, `ideas`, `plans`, `phases`, `subphases`, `questions`, `answers`, `generations`
- Each domain file exports:
  - Entity type definitions (Zod schemas + TypeScript inference)
  - A `register*Routes(app)` function that mounts its routes on the Fastify instance
- Only `projects` has real route implementations (list, get by id, create). The other eight domains export stub route handlers that return 501 Not Implemented.

### API Surface

| Method              | Path                   | Status                                                  |
| ------------------- | ---------------------- | ------------------------------------------------------- |
| GET                 | `/health`              | ✅ Returns `{ status: "ok" }`                           |
| GET                 | `/ready`               | ✅ Returns `{ status: "ok", database: "disconnected" }` |
| GET                 | `/api/v1/status`       | ✅ Returns service name, version, environment           |
| GET                 | `/api/v1/projects`     | ✅ Returns paginated project list                       |
| GET                 | `/api/v1/projects/:id` | ✅ Returns project or 404                               |
| POST                | `/api/v1/projects`     | ✅ Validates input, returns 201                         |
| Other domain routes | —                      | ⏳ 501 Not Implemented                                  |

### Validation

- **Zod v4** for runtime validation and TypeScript type inference.
- Fastify's native JSON Schema validation is used for response serialization on health/ready/status endpoints.
- Request body validation uses `CreateProjectSchema.safeParse()` with explicit `ValidationError` throw on failure.
- Shared schemas (`paginationSchema`, `uuidSchema`, `timestampSchema`) in `src/schemas/`.

### Error Handling

- Custom `AppError` base class with `code`, `message`, and `statusCode`.
- `NotFoundError` and `ValidationError` subclasses for common cases.
- Fastify global `errorHandler` that:
  - `AppError` → structured JSON with the error's status code.
  - `ZodError` → 400 with field-level `details`.
  - Unexpected errors → logged via `request.log.error`, returned as 500.

### Logging

- Fastify's built-in Pino logger configured via `LOG_LEVEL` env var.
- Pretty-print (`pino-pretty`) enabled automatically in `development` environment.
- `silent` log level supported for test runs.

### Configuration

- Typed config loader (`loadConfig()`) validates all env vars at startup using Zod.
- Strict enumeration for `NODE_ENV`, `LOG_LEVEL`.
- `DATABASE_URL` is optional (database connection will be added later).
- Exits with clear messages on missing or invalid vars.

## Frozen Assumptions

- The API runs on port 3000 (configurable via `PORT` env var).
- All domain data is currently stored in-memory (no database yet). The `projects` array will be replaced with database queries when migrations are implemented.
- CORS is wide-open (`origin: true`) for local development. This will be locked down before production.
- The `/ready` endpoint reports `database: "disconnected"` until a database connection pool is added.
- Stub domain routes return `501 Not Implemented` with a consistent error format. They will be implemented in later phases.
- Zod v4 is used. Critical API: `z.object`, `z.string`, `z.enum`, `.safeParse`, `.parse`. No Zod v3-specific features are used, so upgrading/downgrading is straightforward.

## Status

Accepted.
