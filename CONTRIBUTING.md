# Contributing

## Prerequisites

| Tool                                                              | Minimum version |
| ----------------------------------------------------------------- | --------------- |
| [Node.js](https://nodejs.org/)                                    | 20              |
| [pnpm](https://pnpm.io/installation)                              | 9               |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | latest          |

Verify:

```bash
node --version
pnpm --version
docker info
```

## Getting Started

```bash
# Clone and enter the repo
git clone <repo-url>
cd orchestra

# One-shot bootstrap: copies .env, starts PostgreSQL, installs deps, builds
pnpm setup

# Start development servers (api + web + worker in watch mode)
pnpm dev
```

The setup script creates `.env` from `.env.example` if it doesn't exist. Edit `.env` to add AI API keys when you need AI features — the app works without them.

## Code Style

### Linting

ESLint is configured at the project root (`eslint.config.js`). Run:

```bash
pnpm lint           # Check for lint errors
```

Lint is also enforced by pre-commit hooks and CI.

### Formatting

Prettier is configured at the project root (`.prettierrc`). Run:

```bash
pnpm format         # Check formatting (read-only)
pnpm format:fix     # Auto-fix formatting
```

Formatting is automatically applied to staged files on commit.

### TypeScript

- Strict mode enabled across all packages.
- `tsc --noEmit` for type checking (separate from the build step):

```bash
pnpm typecheck      # Type-check all packages
```

### Naming Conventions

| Category                 | Convention               | Example            |
| ------------------------ | ------------------------ | ------------------ |
| Files                    | `kebab-case.ts`          | `user-service.ts`  |
| React files              | `PascalCase.tsx`         | `UserCard.tsx`     |
| Variables/functions      | `camelCase`              | `getUser()`        |
| Classes/types/interfaces | `PascalCase`             | `AppError`         |
| Constants                | `UPPER_SNAKE_CASE`       | `MAX_RETRIES`      |
| Exports                  | Named only (no defaults) | `export const foo` |

### Module Boundaries

- `packages/shared` is a leaf — it imports nothing from other workspace packages.
- `apps/*` may import from any `packages/*` but never from sibling `apps/*`.
- Cross-app communication goes through the API (HTTP) or worker queue — never direct imports.

## Testing

Tests are co-located with source files as `*.test.ts`.

```bash
pnpm test           # Run once
pnpm test:watch     # Watch mode
```

The test baseline covers:

- Error classes (`AppError`, `NotFoundError`, `ValidationError`)
- Schema utilities (`paginatedResponse`, `paginationSchema`)
- Shared utilities (`notEmpty`)

Add tests alongside the code you write. Vitest discovers them automatically via the workspace config (`vitest.workspace.ts`).

## Database

PostgreSQL runs in Docker. All management commands:

```bash
pnpm db:start       # Start PostgreSQL
pnpm db:stop        # Stop PostgreSQL
pnpm db:reset       # Drop and recreate the database
pnpm db:migrate     # Run pending migrations (api workspace)
pnpm db:generate    # Generate migration from schema changes
pnpm db:status      # Show container status
```

Migrations are managed with Drizzle ORM. Schema files live in `apps/api/src/db/schema/`. After changing a schema, generate and review the migration:

```bash
pnpm --filter @orchestra/api db:generate
```

Then apply it:

```bash
pnpm --filter @orchestra/api db:migrate
```

## Git Workflow

### Pre-commit Hooks

Husky runs `lint-staged` on every commit:

- `*.ts`, `*.tsx` → ESLint `--fix` + Prettier `--write`
- `*.json`, `*.yaml`, `*.md` → Prettier `--write`

If any check fails, the commit is blocked. To skip hooks (emergency only):

```bash
git commit --no-verify
```

### Commit Messages

No automated enforcement. Use descriptive messages prefixed by area:

```
api: add project creation validation
web: fix navigation spacing on mobile
db: add generations table indexes
docs: update deployment guide
```

### Branch Naming

```
<type>/<short-description>
```

Examples: `feat/interview-engine`, `fix/db-connection-pool`, `docs/api-readme`.

## CI/CD

### CI

Every pull request and push to `main` runs: lint → format check → typecheck → test → build.
CI must pass before merging.

### Deployment

See [docs/deployment.md](docs/deployment.md) for the full deployment guide.

## Project Structure

```
apps/api/       Fastify HTTP server with 9 domain modules, Drizzle ORM, Zod validation
apps/web/       Next.js 15 with App Router, Tailwind CSS v4, responsive layout
apps/worker/    Placeholder for background job processor
packages/shared/Shared utilities and types
packages/config/Placeholder for shared configuration helpers
docs/           Architecture, schema, decisions, deployment, development guides
```

## Getting Help

- Read the existing [architecture decision records](docs/decisions/) for design rationale.
- Check [docs/development.md](docs/development.md) for troubleshooting common issues.
- Open a GitHub issue for bugs or feature requests.
