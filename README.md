# Orchestra

AI Software Development Orchestrator — transform a raw software idea into a structured, execution-ready development plan.

## Repository Structure

```
├── apps/
│   ├── api/          Fastify HTTP API server (port 3000)
│   ├── web/          Next.js + Tailwind CSS frontend (port 3001)
│   └── worker/       Background job processor (placeholder)
├── packages/
│   ├── shared/       Shared types, utilities, and domain models
│   └── config/       Shared configuration helpers (placeholder)
├── docs/
│   ├── decisions/    7 architecture decision records
│   ├── architecture.md  System overview and conventions
│   ├── deployment.md    CI/CD, secrets, production config
│   ├── development.md   Local setup and configuration guide
│   └── schema.md        Database schema documentation
├── .github/workflows/  CI (ci.yml) and deploy (deploy.yml) pipelines
├── scripts/            Development helper scripts
├── .env.example        Template for environment variables
├── docker-compose.yml  Local PostgreSQL 16 service
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json       IDE root config (extends base, no emit)
```

## Quick Start

Requires **Node.js >= 20**, **pnpm >= 9**, and **Docker**.

```bash
pnpm setup        # copies .env, starts DB, installs deps, builds
pnpm dev          # start api, web & worker in watch mode
```

- Frontend: [http://localhost:3001](http://localhost:3001)
- API health: [http://localhost:3000/health](http://localhost:3000/health)
- API status: [http://localhost:3000/api/v1/status](http://localhost:3000/api/v1/status)

## Scripts

| Command           | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `pnpm setup`      | Bootstrap a fresh clone: .env → DB → install → build |
| `pnpm dev`        | Start api, web & worker in parallel                  |
| `pnpm build`      | Build all workspaces                                 |
| `pnpm typecheck`  | Type-check all workspace packages (tsc --noEmit)     |
| `pnpm lint`       | Lint all files (ESLint)                              |
| `pnpm format`     | Check formatting (Prettier)                          |
| `pnpm format:fix` | Auto-fix formatting                                  |
| `pnpm test`       | Run all tests (Vitest)                               |
| `pnpm test:watch` | Run tests in watch mode                              |
| `pnpm clean`      | Remove build artifacts from all workspaces           |
| `pnpm clean:all`  | Remove build artifacts and `node_modules`            |
| `pnpm db:start`   | Start PostgreSQL via Docker Compose                  |
| `pnpm db:stop`    | Stop PostgreSQL                                      |
| `pnpm db:reset`   | Drop and recreate the local database                 |
| `pnpm db:status`  | Show Docker Compose service status                   |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Frontend   │────▶│  Fastify API │────▶│   Worker     │
│ (Next.js)   │     │  (apps/api)  │     │ (placeholder)│
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────▼───────┐
                    │  PostgreSQL  │
                    │   (Docker)   │
                    └──────────────┘
```

- **Modular monolith** — API, worker, and frontend are separate processes that can be deployed independently when needed.
- **9 domain modules** — users, projects, ideas, plans, phases, subphases, questions, answers, generations — each with Drizzle ORM schema, Zod validation, and route stubs.
- **12-phase SDLC lifecycle** — the platform maps projects through fixed phases (ideation → requirements → architecture → ... → monitoring), with AI-generated content per phase.
- **Dependency-aware task graph** — subphases store dependency IDs for ordered execution.
- **Bring-your-own-key** — AI providers are configured via env vars; no API keys are stored in the application.

## Platform Support

All development scripts are cross-platform (Windows, macOS, Linux).

## Design Principles

- **Structured engineering** over open-ended chatting.
- **Fixed lifecycle** (12 SDLC phases) with AI-customized content.
- **Dependency-aware planning** — tasks know what they depend on.
- **Regeneratable and versioned outputs** — nothing is one-shot.
- **Optimized for autonomous AI agent reliability** — explicit assumptions, constraints, and validation in every prompt.

## Next Steps

- **New to the project?** Read [docs/development.md](docs/development.md) for setup, [CONTRIBUTING.md](CONTRIBUTING.md) for contribution workflow.
- **Deploying?** See [docs/deployment.md](docs/deployment.md) for CI/CD and secrets management.
- **Architecture?** See [docs/architecture.md](docs/architecture.md) for conventions and design decisions.
