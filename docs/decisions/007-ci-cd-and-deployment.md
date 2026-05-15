# Decision 007: CI/CD and Deployment

**Date:** 2026-05-15

## Context

Phase 7 required creating the automated delivery pipeline and minimal production-shaped operational setup: CI checks, preview deployments, secrets management, and observability.

## Decisions

### CI Pipeline

- **GitHub Actions** with a single `ci.yml` workflow triggered on pull requests and pushes to `main`.
- Runs five gates in order: lint (ESLint), format check (Prettier), type check (tsc), test (Vitest), build (all packages).
- Uses `pnpm/action-setup` for consistent pnpm version and `actions/setup-node` with caching.

### Deployment Platform

- **Railway** is the recommended platform for its simplicity: one project with multiple services, PostgreSQL add-on, and GitHub integration.
- The deploy workflow (`.github/workflows/deploy.yml`) is generic enough to adapt to other platforms (Render, Fly.io, etc.) by changing the deployment commands.
- Deploys automatically on push to `main` (preview environment).
- Supports manual `workflow_dispatch` triggers for production deployments.

### Preview Environments

- Every push to `main` creates a preview deployment with its own isolated PostgreSQL database.
- Preview environments use the same build artifacts as production but with potentially different environment variable values.

### Secrets Management

- All secrets are stored as **GitHub Actions secrets** and **Railway service variables**.
- Never committed to the repository.
- Environment-specific secrets (preview vs production) are isolated at the platform level.
- AI provider API keys are optional in preview environments; the application degrades gracefully.

### Observability

- **Structured logging** via Pino (already configured in the API). JSON output in production for platform log aggregation.
- **Health endpoints** (`GET /health`, `GET /ready`, `GET /api/v1/status`) are used by the deployment platform for liveness and readiness checks.
- **Sentry** is recommended for production error tracking but is not a hard dependency. The deployment docs include setup instructions.

### Deployment Documentation

- `docs/deployment.md` covers architecture, CI pipeline, Railway setup, environment variables, health checks, secrets management, observability, and rollbacks.

## Frozen Assumptions

- The project uses Railway for hosting. If a different platform is chosen, only the deploy step in `.github/workflows/deploy.yml` needs to change.
- The worker (`apps/worker`) is not deployed in this phase. It will be added as a third Railway service when job processing is implemented.
- PostgreSQL is managed by the deployment platform (Railway add-on). Self-managed PostgreSQL requires a separate `DATABASE_URL` configuration.
- The frontend is built as static Next.js output. If server-side rendering is needed later, the web service configuration will need updating.

## Status

Accepted.
