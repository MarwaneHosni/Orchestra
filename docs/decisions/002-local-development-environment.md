# Decision 002: Local Development Environment

**Date:** 2026-05-15

## Context

Phase 1 of the project requires a repeatable local environment so a developer can run the platform with minimal setup friction. This covers database service provisioning, environment variable conventions, and bootstrap scripts.

## Decisions

### Database
- **PostgreSQL 16** via Docker Compose. The only external service for now.
- Named Docker volume (`orchestra-postgres-data`) so data survives container restarts.
- Health check via `pg_isready` with 3s polling and 10 retries.
- Port `5432` on the host, configurable via `POSTGRES_PORT` in `.env`.

### Docker Compose
- Single `docker-compose.yml` at the repository root.
- No production services (no Redis, no worker queues) — those are added in later phases only when needed.
- The `docker-compose.yml` reads environment variable substitutions from `.env` (Compose v2 auto-loads `.env` from the project root).

### Bootstrap Script (`scripts/setup.mjs`)
- Uses `fs.copyFileSync` (cross-platform) instead of a shell `copy`/`cp` command.
- Polls `docker compose ps postgres --format json` for `"Health": "healthy"` in a loop with 60s timeout.
- Does NOT use `docker compose wait` — that command blocks until a container *exits*, which never happens for a long-running database.

### Reset Script (`scripts/reset-db.mjs`)
- Connects to the `postgres` maintenance database (not the target database) before issuing `DROP DATABASE`. PostgreSQL forbids dropping the database you're currently connected to.
- Preserves the Docker volume; only the logical database is dropped and recreated.

### Secrets
- **Local:** `.env` file (gitignored), copied from `.env.example` by the setup script.
- **Deployed:** Environment variables injected by the deployment platform. Never file-based.
- Dev database credentials (`orchestra / orchestra_dev`) are low-value and scoped to localhost; they are documented as safe defaults.

### Environment Variables
- `.env.example` now has all currently known variables uncommented, including `DATABASE_URL` and its component parts (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`).
- The `DATABASE_URL` is constructed from component vars in the template (`${POSTGRES_USER}:${POSTGRES_PASSWORD}@...`) so changing one value propagates.

### .dockerignore
- Added to avoid sending `node_modules`, `dist`, and `.git` into the Docker build context (prepares for future Docker-based builds).

## Frozen Assumptions

- Docker is required for local development. Developers who cannot run Docker must provision PostgreSQL manually and configure `DATABASE_URL` to point at their instance.
- No automatic database migration tool is configured yet; this will be added when the first schema is needed.
- The setup script assumes Docker Compose V2 (`docker compose` not `docker-compose`).
- The `reset-db` script uses `docker compose exec` which requires the container to be running.
- AI provider API keys are optional in development; the app must not crash when they are absent.

## Status

Accepted.
