# Orchestra

AI Software Development Orchestrator — transform a raw software idea into a structured, execution-ready development plan.

## Repository Structure

```
├── apps/
│   ├── api/          HTTP API server (framework TBD)
│   ├── web/          Next.js frontend (port 3001)
│   └── worker/       Background job processor (AI prompts, exports)
├── packages/
│   ├── shared/       Shared types, utilities, and domain models
│   └── config/       Shared configuration helpers (env, providers)
├── docs/
│   ├── decisions/    Architecture decision records
│   ├── architecture.md  System overview and conventions
│   └── development.md   Local setup & configuration guide
├── .github/
│   └── workflows/    CI (ci.yml) and deployment (deploy.yml) pipelines
├── scripts/          Development helper scripts
├── .env.example      Template for environment variables
├── docker-compose.yml  Local PostgreSQL service
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json     IDE root config (extends base, no emit)
```

## Quick Start

Requires **Node.js >= 20**, **pnpm >= 9**, and **Docker**.

```bash
pnpm setup        # copies .env, starts DB, installs deps, builds
pnpm dev          # start api, web & worker in watch mode
```

Open [http://localhost:3001](http://localhost:3001) for the frontend.

See [docs/development.md](docs/development.md) for a detailed walkthrough, environment configuration, database management, and troubleshooting.

See [docs/deployment.md](docs/deployment.md) for CI/CD, secrets management, and production deployment.

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

## Platform Support

All development scripts are cross-platform (Windows, macOS, Linux).

## Design Principles

- **Structured engineering** over open-ended chatting.
- **Fixed lifecycle** (12 SDLC phases) with AI-customized content.
- **Dependency-aware planning** — tasks know what they depend on.
- **Regeneratable and versioned outputs** — nothing is one-shot.
- **Optimized for autonomous AI agent reliability** — explicit assumptions, constraints, and validation in every prompt.
