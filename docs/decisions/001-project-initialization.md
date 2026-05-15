# Decision 001: Project Initialization

**Date:** 2026-05-15

## Context

Initial repository setup for the AI Software Development Orchestrator. The project must support a modular monolith architecture that can later be split into separate API, worker, and frontend processes.

## Decisions

### Repository Structure
- **pnpm workspace monorepo** – enables shared packages while keeping apps separable.
- `apps/` – deployable applications (api, web, worker).
- `packages/` – internal shared libraries (shared, config).

### Package Manager
- **pnpm** – chosen for workspace support, disk efficiency, and strict dependency isolation.

### TypeScript Configuration
- **Base config** (`tsconfig.base.json`) extended by all workspaces.
- **Strict mode** enabled (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`, etc.).
- **ES2022 target** with `NodeNext` module resolution for native ESM.
- A root `tsconfig.json` exists for IDE support (it extends the base and emits nothing).

### Cross-Platform Scripts
- All package scripts must work on Windows, macOS, and Linux.
- `rimraf` is used for the `clean` script instead of `rm -rf`.
- The `dev` orchestrator (`scripts/dev.mjs`) uses `pnpm run --parallel` instead of shell background operators (`&`).

### App/Worker Separation
- API and worker live in separate `apps/` directories with their own `package.json`.
- Currently co-located in the monorepo; future extraction to separate repos is straightforward.

### Environment Variables
- Template in `.env.example` — never commit `.env` files.
- Keys follow `UPPER_SNAKE_CASE` convention.
- AI provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are expected but the app must handle their absence gracefully.

## Frozen Assumptions

- Node.js >= 20 is required.
- TypeScript is the sole language for the backend and shared packages.
- Frontend (web) framework is **not yet chosen**. The web package intentionally avoids framework-specific TypeScript settings (no jsx, no DOM lib) until a framework decision is made.
- HTTP server framework for the API (Express, Fastify, Hono, etc.) is **not yet chosen**.
- Background job queue library for the worker (BullMQ, pg-boss, etc.) is **not yet chosen**.
- Environment-variable loading library (dotenv, etc.) is **not yet chosen**.
- No testing framework or linter is configured yet — these will be added in a follow-up phase.
- The `scripts/dev.mjs` helper is a thin convenience wrapper; `pnpm run --parallel` can be used directly as an alternative.
- The `rimraf` devDependency is temporary for Phase 0; a framework-native clean mechanism may replace it later.

## Status

Accepted.
