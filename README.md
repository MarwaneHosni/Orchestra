<img width="1983" height="793" alt="orchestra-logo" src="https://github.com/user-attachments/assets/4e00e158-2952-40fc-a444-7c0d8f4627f2" />

<h1 align="center">Orchestra</h1>

<p align="center">
   ⚙️ AI Software Development Orchestrator. Transforms raw ideas into structured, execution-ready plans, 12-phase SDLC blueprints, and dependency-aware task graphs.
</p>

<p align="center">
   🔗 https://orchestradev.vercel.app/
</p>

## What is Orchestra?

Orchestra replaces unstructured AI chat with system-level engineering workflows, turning abstract software ideas into actionable execution plans.

- **12-Phase SDLC Engine:** Structured lifecycle progression from ideation and requirements through architecture, task decomposition, and deployment monitoring.
- **Dependency-Aware Task Graphing:** Automatically generates actionable task trees with explicit upstream and downstream dependency computation.
- **Immutable Versioning & Diffs:** Tracks project evolutions through immutable snapshots, allowing side-by-side comparison of blueprints, prompts, and tasks.
- **Agent-Optimized Exports:** Exports execution plans in Markdown or JSON formatted specifically with explicit constraints and validation for autonomous AI agents.
- **Bring-Your-Own-Key AI:** Pluggable providers (OpenAI, Anthropic, OpenRouter, custom OpenAI-compatible endpoints). Provider keys are encrypted at rest with AES-256-GCM.

## Repository Structure

```
├── apps/
│   ├── api/          Fastify HTTP API server (port 3000)
│   ├── web/          Next.js + React + Tailwind CSS frontend (port 3001)
│   └── landing/      Astro docs & marketing site
├── packages/
│   ├── shared/       Shared types, utilities, and domain models
│   └── config/       Shared configuration helpers
├── docs/
│   ├── decisions/    10 architecture decision records
│   ├── architecture.md  System overview and conventions
│   ├── deployment.md    CI/CD, secrets, production config
│   ├── development.md   Local setup and configuration guide
│   ├── contributing.md  Code organization, versioning, testing
│   ├── user-guide.md    Version history, compare, export, activity
│   └── schema.md        Database schema documentation
├── .github/workflows/  CI (ci.yml) and deploy (deploy.yml) pipelines
├── scripts/            Development helper scripts
├── .env.example        Template for environment variables
├── Dockerfile          API container image (used by Railway)
├── docker-compose.yml  Local optional Database service
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json       IDE root config (extends base, no emit)
```

## Tech Stack

| Layer              | Technology                  | Why                                                              |
| ------------------ | --------------------------- | ---------------------------------------------------------------- |
| **Frontend**       | Next.js 15 + React 19       | App Router, server components, dashboard UI                      |
| **Landing & Docs** | Astro 5                     | Static marketing site + 17-page docs                             |
| **API**            | Fastify 5                   | High-performance Node.js framework                               |
| **Database**       | SQLite via sql.js (default) | Zero-config, local-first. Optional PostgreSQL via `DATABASE_URL` |
| **ORM**            | Drizzle ORM                 | Type-safe queries, lightweight, migration support                |
| **Validation**     | Zod v4                      | Runtime type checking and schema validation                      |
| **AI Providers**   | Pluggable                   | OpenAI, Anthropic, OpenRouter, custom OpenAI-compatible          |
| **Encryption**     | AES-256-GCM                 | API keys encrypted at rest                                       |
| **Monorepo**       | pnpm workspaces             | Fast, strict dependency resolution                               |
| **Testing**        | Vitest + Playwright         | Unit/integration + E2E browser tests                             |

## Quick Start

Requires **Node.js >= 20** and **pnpm >= 9**. Docker is optional — it is only needed if you want the local PostgreSQL service (SQLite works out of the box).

```bash
pnpm setup        # copies .env, installs deps, builds
pnpm dev          # start api & web in watch mode (port 3000 + 3001)
```

- Web dashboard: [http://localhost:3001](http://localhost:3001)
- API health: [http://localhost:3000/health](http://localhost:3000/health)
- API status: [http://localhost:3000/api/v1/status](http://localhost:3000/api/v1/status)

Run the Astro docs/landing site separately:

```bash
pnpm --filter @orchestra/landing dev   # http://localhost:4321
```

## Scripts

| Command           | Description                                      |
| ----------------- | ------------------------------------------------ |
| `pnpm setup`      | Bootstrap a fresh clone: .env → install → build  |
| `pnpm dev`        | Start api & web in parallel (watch mode)         |
| `pnpm build`      | Build all workspaces                             |
| `pnpm typecheck`  | Type-check all workspace packages (tsc --noEmit) |
| `pnpm lint`       | Lint all files (ESLint)                          |
| `pnpm format`     | Check formatting (Prettier)                      |
| `pnpm format:fix` | Auto-fix formatting                              |
| `pnpm test`       | Run all tests (Vitest)                           |
| `pnpm test:watch` | Run tests in watch mode                          |
| `pnpm clean`      | Remove build artifacts from all workspaces       |
| `pnpm clean:all`  | Remove build artifacts and `node_modules`        |
| `pnpm db:start`   | Start the local database via Docker Compose      |
| `pnpm db:stop`    | Stop the local database                          |
| `pnpm db:reset`   | Drop and recreate the local database             |
| `pnpm db:status`  | Show Docker Compose service status               |

API-package scripts (`pnpm --filter @orchestra/api <script>`):

| Command                                    | Description                        |
| ------------------------------------------ | ---------------------------------- |
| `db:generate`                              | Generate Drizzle migrations        |
| `db:migrate`                               | Apply migrations                   |
| `db:seed`                                  | Seed question definitions          |
| `db:studio`                                | Open Drizzle Studio                |
| `db:sqlite:generate` / `db:sqlite:migrate` | SQLite-specific migration commands |

Load the demo project ("TeamSync") into the in-memory store:

```bash
pnpm --filter @orchestra/api exec tsx src/db/demo-seed.ts
```

## Architecture

```
┌─────────────┐     ┌──────────────┐
│  Frontend   │────▶│  Fastify API │
│ (Next.js)   │     │  (apps/api)  │
└─────────────┘     └──────┬───────┘
                           │
                    ┌──────▼──────────────┐
                    │  SQLite (sql.js)    │
                    │   via Drizzle ORM   │
                    └─────────────────────┘
```

- **Modular monolith** — the API, web frontend, and Astro landing/docs site are separate apps in one workspace; they can be deployed independently.
- **18 SQLite tables** — projects, ideas, interview_sessions, questions, answers, plans, blueprints, provider_credentials, task_graphs, execution_tasks, task_dependencies, prompt_artifacts, usage_records, activity_log, analysis_results, workflow_runs, ai_cache_entries, ai_cache_invalidation_markers.
- **12-phase SDLC lifecycle** — the platform maps projects through fixed phases (ideation → requirements → architecture → ... → monitoring).
- **Dependency-aware task graph** — tasks are decomposed from blueprint phases with automatic dependency computation.
- **Versioned snapshots** — every project state is captured as an immutable snapshot with full lineage tracking.
- **Regeneration with scope rules** — changing upstream phases triggers full re-snapshot; leaf phases trigger partial regeneration.
- **Structured diffs** — compare any two snapshots to see task, prompt, and blueprint changes.
- **Export in Markdown/JSON** — export blueprints, task graphs, or prompt bundles with version metadata.
- **Activity timeline + analytics** — lifecycle events are tracked and surfaced in the UI.
- **Bring-your-own-key** — AI providers are configured via env vars or in-app credentials; provider keys are encrypted at rest.

## Deployment

- **API (`apps/api`)** — long-running Fastify server (stateful, in-memory + SQLite snapshot). Recommended host: Railway (or any persistent container host). Built via the repo-root `Dockerfile`.
- **Web (`apps/web`)** — Next.js dashboard. Deploy on Vercel or Railway.
- **Landing & Docs (`apps/landing`)** — static Astro site. Deploy on Vercel or Railway.

See [docs/deployment.md](docs/deployment.md) for CI/CD, environment variables, health checks, and secrets management.

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
