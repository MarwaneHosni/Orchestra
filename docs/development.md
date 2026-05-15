# Development Guide

## Prerequisites

| Tool                                                              | Version | Why                |
| ----------------------------------------------------------------- | ------- | ------------------ |
| [Node.js](https://nodejs.org/)                                    | >= 20   | Runtime            |
| [pnpm](https://pnpm.io/installation)                              | >= 9    | Package manager    |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | latest  | PostgreSQL service |

Verify everything is installed:

```bash
node --version     # v20.x or later
pnpm --version     # 9.x
docker info        # must not error
```

---

## Quick Start

```bash
# One-shot: copies .env, starts Docker, installs deps, builds
pnpm setup

# Start the app
pnpm dev
```

The `pnpm setup` script:

1. Creates `.env` from `.env.example` if it doesn't exist yet.
2. Verifies Docker is running.
3. Starts PostgreSQL via Docker Compose.
4. Polls the container health check until PostgreSQL is ready.
5. Runs `pnpm install` and `pnpm build`.

To run the steps individually instead:

```bash
# macOS / Linux
cp .env.example .env
# Windows
copy .env.example .env

docker compose up -d
pnpm install
pnpm build
pnpm dev
```

Open `http://localhost:3000` once the API server is wired (not yet implemented).

---

## Environment Configuration

### File layout

| File              | Purpose                                             | Git-committed?      |
| ----------------- | --------------------------------------------------- | ------------------- |
| `.env.example`    | Template with all known keys and dev defaults       | Yes                 |
| `.env`            | Actual values for local development                 | **No** (gitignored) |
| CI / deployed env | Values injected via secrets manager or CI variables | N/A                 |

### Required local variables

```ini
# .env  (auto-created by `pnpm setup` from .env.example)
DATABASE_URL=postgresql://orchestra:orchestra_dev@localhost:5432/orchestra
```

The `.env` values in the example are safe for local development because:

- PostgreSQL is only exposed on `localhost:5432` (Docker port mapping).
- The user/password are scoped to the local Docker volume.
- No production data ever touches the local database.

### Adding a new variable

1. Add it to `.env.example` with a sensible dev default or empty placeholder.
2. Add it to `.env` locally.
3. If the variable is required at startup, add a validation call in the package that consumes it (see "Environment Variables" in `docs/architecture.md`).

---

## Secrets Handling

| Environment       | Approach                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local**         | `.env` file (gitignored). API keys are optional; AI features gracefully degrade when keys are missing.                                                                |
| **Deployed / CI** | Environment variables injected by the deployment platform (e.g., GitHub Actions secrets, Docker secrets, cloud provider env vars). Never checked into the repository. |

**Principle:** The application never hardcodes secrets. Every secret enters the process through environment variables — either a `.env` file (local) or the platform's native secrets mechanism (deployed).

For local development, the `POSTGRES_PASSWORD` in `.env.example` is a low-value dev password. You may change it, but the only consequence is that `docker-compose.yml` uses your `.env` value via `${POSTGRES_PASSWORD}` substitution.

---

## Database Management

### Starting / stopping

```bash
pnpm db:start    # docker compose up -d
pnpm db:stop     # docker compose down
pnpm db:status   # docker compose ps
```

### Resetting

Drops and recreates the `orchestra` database inside the running container. Data in the `postgres_data` Docker volume is preserved (only the logical database is dropped).

```bash
pnpm db:reset
```

To wipe the volume entirely (destroys all data):

```bash
docker compose down -v
docker compose up -d
```

### Connecting manually

```bash
docker compose exec postgres psql -U orchestra -d orchestra
```

Or use any PostgreSQL client with `DATABASE_URL` from your `.env`.

---

## Health Checks

### Docker services

```bash
docker compose ps
```

Expected output for a healthy PostgreSQL:

```
NAME                IMAGE               ... STATUS
orchestra-postgres  postgres:16-alpine  ... Up (healthy)
```

The `pnpm setup` script polls this automatically — it waits until the health status reads `healthy` before proceeding.

### Application health

Once the API server is implemented, it will expose a `GET /health` endpoint. The worker will expose its own health via the job queue connection status.

---

## Quality Toolchain

### Linting (ESLint)

```bash
pnpm lint          # Check all files for lint errors
```

Configured in `eslint.config.js` with TypeScript strict rules. Runs automatically on staged files via `lint-staged` before every commit.

### Formatting (Prettier)

```bash
pnpm format        # Check formatting (CI)
pnpm format:fix    # Auto-fix formatting (local)
```

Configured in `.prettierrc` with project-wide conventions. Applied automatically by `lint-staged` on commit.

### Type Checking

```bash
pnpm typecheck     # Type-check all workspace packages
```

Uses `tsc --noEmit` in each workspace. Separate from the build step.

### Testing (Vitest)

```bash
pnpm test          # Run all tests once
pnpm test:watch    # Run tests in watch mode
```

Tests are co-located with source files as `*.test.ts`. Vitest discovers them automatically via workspace config.

### Pre-commit Hooks (Husky + lint-staged)

Pre-commit hooks run automatically on `git commit`:

1. `lint-staged` lints and formats only the staged files
2. If any check fails, the commit is blocked

To skip hooks (emergency only):

```bash
git commit --no-verify
```

## Common Tasks

```bash
pnpm dev          # Start api, web & worker in watch mode
pnpm build        # Compile TypeScript for all packages
pnpm typecheck    # Type-check without emitting files
pnpm test         # Run tests
pnpm lint         # Lint all files
pnpm format       # Check formatting
pnpm format:fix   # Auto-fix formatting
pnpm clean        # Remove dist/ directories
pnpm clean:all    # Remove dist/ and node_modules/
```

---

## Troubleshooting

| Symptom                               | Likely cause              | Fix                                                                       |
| ------------------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| `docker: command not found`           | Docker not installed      | Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| `Cannot connect to the Docker daemon` | Docker not running        | Start Docker Desktop                                                      |
| `port is already allocated`           | Another Postgres on :5432 | Stop the other service or change `POSTGRES_PORT` in `.env`                |
| `ECONNREFUSED` on database            | PostgreSQL not ready yet  | Wait a few seconds, then run `pnpm db:status`                             |
| `relation "..." does not exist`       | Database not migrated     | Run migrations after they are implemented                                 |
| `.env` values not picked up           | File not in project root  | Verify `.env` exists at the repository root                               |
