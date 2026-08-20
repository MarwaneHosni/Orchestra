<img width="1983" height="793" alt="orchestra-logo" src="https://github.com/user-attachments/assets/4e00e158-2952-40fc-a444-7c0d8f4627f2" />

<h1 align="center">Orchestra</h1>

<p align="center">
  AI Software Development Orchestrator. Transforms raw ideas into structured, execution-ready plans, 12-phase SDLC blueprints, and dependency-aware task graphs.
</p>

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
│   ├── decisions/    9 architecture decision records
│   ├── architecture.md  System overview and conventions
│   ├── deployment.md    CI/CD, secrets, production config
│   ├── development.md   Local setup and configuration guide
│   ├── contributing.md  Code organization, versioning, testing
│   ├── user-guide.md    Version history, compare, export, activity
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
| `pnpm db:seed`    | Seed question definitions into the database          |
| `pnpm demo:seed`  | Load demo project ("TeamSync") into in-memory store  |

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
- **20 Drizzle ORM tables** — users, projects, plans, blueprints, execution_tasks, task_graphs, project_snapshots, activity_log, and more.
- **12-phase SDLC lifecycle** — the platform maps projects through fixed phases (ideation → requirements → architecture → ... → monitoring).
- **Dependency-aware task graph** — tasks are decomposed from blueprint phases with automatic dependency computation.
- **Versioned snapshots** — every project state is captured as an immutable snapshot with full lineage tracking.
- **Regeneration with scope rules** — changing upstream phases triggers full re-snapshot; leaf phases trigger partial regeneration.
- **Structured diffs** — compare any two snapshots to see task, prompt, and blueprint changes.
- **Export in Markdown/JSON** — export blueprints, task graphs, or prompt bundles with version metadata.
- **Activity timeline + analytics** — lifecycle events are tracked and surfaced in the UI.
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

- **New to the project?** Read [docs/development.md](docs/development.md) for setup, [docs/contributing.md](docs/contributing.md) for contribution workflow.
- **Using the product?** See [docs/user-guide.md](docs/user-guide.md) for version history, compare, export, and activity timeline.
- **Deploying?** See [docs/deployment.md](docs/deployment.md) for CI/CD and secrets management.
- **Architecture?** See [docs/architecture.md](docs/architecture.md) for conventions and design decisions.
- **Full documentation index:** [docs/index.md](docs/index.md)
