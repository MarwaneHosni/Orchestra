# Orchestra

AI Software Development Orchestrator — transform a raw software idea into a structured, execution-ready development plan.

## Repository Structure

```
├── apps/
│   ├── api/          HTTP API server (framework TBD)
│   ├── web/          Frontend application (framework TBD)
│   └── worker/       Background job processor (AI prompts, exports)
├── packages/
│   ├── shared/       Shared types, utilities, and domain models
│   └── config/       Shared configuration helpers (env, providers)
├── docs/
│   ├── decisions/    Architecture decision records
│   └── architecture.md  System overview and conventions
├── scripts/          Development helper scripts
├── .env.example      Template for environment variables
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json     IDE root config (extends base, no emit)
```

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9

## Getting Started

```bash
pnpm install
pnpm build
pnpm dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev`        | Start api & worker in parallel (web not yet configured) |
| `pnpm build`      | Build all workspaces |
| `pnpm lint`       | Lint all workspaces |
| `pnpm test`       | Run all tests |
| `pnpm typecheck`  | Type-check all workspaces |
| `pnpm clean`      | Remove build artifacts from all workspaces |
| `pnpm clean:all`  | Remove build artifacts and `node_modules` |

## Platform Support

All development scripts are cross-platform (Windows, macOS, Linux).

## Design Principles

- **Structured engineering** over open-ended chatting.
- **Fixed lifecycle** (12 SDLC phases) with AI-customized content.
- **Dependency-aware planning** — tasks know what they depend on.
- **Regeneratable and versioned outputs** — nothing is one-shot.
- **Optimized for autonomous AI agent reliability** — explicit assumptions, constraints, and validation in every prompt.
