# Deployment Guide

## Architecture Overview

```
                        ┌──────────────┐
                        │  SQLite      │
                        │ (orchestra.db│
                        │  on volume)  │
                        └──────┬───────┘
                               │
  Internet ──► Frontend ──► API ──┘
  (landing path) │       (port 3000)
                 │
            Next.js web + Astro landing
```

The platform has these deployable units:

- **API** — Fastify HTTP server (`apps/api`), stateful (in-memory + SQLite snapshot)
- **Web** — Next.js frontend (`apps/web`)
- **Landing & Docs** — Astro static site (`apps/landing`)

SQLite is the default store. A persistent volume must back `orchestra.db` so data survives restarts; PostgreSQL is optional via `DATABASE_URL`.

---

## CI Pipeline

Every pull request and push to `main` runs the CI workflow (`.github/workflows/ci.yml`):

```yaml
1. Lint        (ESLint)
2. Format      (Prettier)
3. Type check  (tsc --noEmit in all packages)
4. Test        (Vitest)
5. Build       (All workspace packages)
```

CI must pass before a pull request can merge.

---

## Deployment Pipeline

The deploy workflow (`.github/workflows/deploy.yml`) runs on:

- Push to `main` → deploys to **preview** environment
- Manual trigger (`workflow_dispatch`) → deploy to **preview** or **production**

### Prerequisites

1. A [Railway](https://railway.app) account (or equivalent PaaS).
2. A Railway project with two services (`api` and `web`) and a PostgreSQL add-on.
3. The following secrets configured in your GitHub repository:

| Secret          | Purpose                                            |
| --------------- | -------------------------------------------------- |
| `RAILWAY_TOKEN` | Railway API token for automated deploys            |
| `DATABASE_URL`  | PostgreSQL connection string (injected by Railway) |

### Railway Setup (Recommended for API)

1. Create a new Railway project.
2. Add a service for the API rooted at the **repository root** (so the `Dockerfile` and `pnpm-workspace.yaml` are visible):

   **API service:**
   | Setting | Value |
   |---------|-------|
   | Root Directory | repo root (`/`) |
   | Build Type | Dockerfile (repo-root `Dockerfile`) |
   | Start Command | `node apps/api/dist/index.js` (from Dockerfile `CMD`) |

3. Add a **Volume** mounted at a writable path and set `SQLITE_DB_PATH` to a file on it (e.g. `/data/orchestra.db`) for durable persistence.
4. **Web** and **Landing** can be deployed on Vercel (static/Next.js friendly) or Railway:

   **Web service** (`apps/web`): build `pnpm --filter @orchestra/web build`, start `pnpm --filter @orchestra/web start`.
   **Landing service** (`apps/landing`): build `pnpm --filter @orchestra/landing build`, output `dist/`.

5. Generate a Railway token from **Dashboard → Settings → Tokens**.
6. Add the token as `RAILWAY_TOKEN` in your GitHub repository secrets.

### Deploying Manually

```bash
# Trigger a preview deploy from the default branch
gh workflow run deploy.yml --field environment=preview

# Trigger a production deploy
gh workflow run deploy.yml --field environment=production
```

---

## Environment Configuration

All environment variables are injected by the deployment platform — never stored in the repository.

### Required Variables (all environments)

```ini
NODE_ENV=production
SQLITE_DB_PATH=/data/orchestra.db   # SQLite file on a persistent volume
```

### Optional Variables

```ini
LOG_LEVEL=info
PORT=3000           # API port (default 3000)
DATABASE_URL=postgresql://user:pass@host:5432/orchestra   # alternative to SQLite
```

### Frontend Variables (web / landing)

```ini
NEXT_PUBLIC_API_URL=https://api.example.com   # dashboard → API base URL
ORCHESTRA_API_URL=https://api.example.com     # Next.js rewrite target
NEXT_PUBLIC_DOCS_URL=https://docs.example.com # Docs button target
```

### AI Provider Keys (optional in preview)

```ini
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

AI features degrade gracefully when keys are absent, so preview environments can omit them.

---

## Health & Readiness

Every deployed API instance exposes:

| Endpoint             | Purpose         | Expected Response                                                          |
| -------------------- | --------------- | -------------------------------------------------------------------------- |
| `GET /health`        | Liveness check  | `{"status":"ok"}`                                                          |
| `GET /ready`         | Readiness check | `{"status":"ok","database":"connected"}`                                   |
| `GET /api/v1/status` | Version info    | `{"service":"orchestra-api","version":"0.1.0","environment":"production"}` |

These endpoints are used by the deployment platform's health checks and by load balancers.

---

## Secrets Management

### Principles

1. **Never commit secrets.** The `.gitignore` excludes `.env` files. All secrets enter the process through environment variables.
2. **Least privilege.** Each environment (preview, production) has its own set of credentials. Preview environments use isolated databases.
3. **Rotation.** Secrets are rotated through the deployment platform's dashboard:
   - Railway: **Dashboard → Service → Variables**
   - Regenerate the value, update the variable, and redeploy.
4. **No hardcoded fallbacks.** The application validates required variables at startup and exits with a clear message if they are missing.

### Environment-Specific Secrets

| Secret              | Preview                  | Production    |
| ------------------- | ------------------------ | ------------- |
| `DATABASE_URL`      | Preview DB (isolated)    | Production DB |
| `RAILWAY_TOKEN`     | Same (scoped to project) | Same          |
| `OPENAI_API_KEY`    | Optional                 | Required      |
| `ANTHROPIC_API_KEY` | Optional                 | Required      |

---

## Observability

### Structured Logging

The API uses **Pino** (configured via `LOG_LEVEL`):

- Development: human-readable pretty-print (`pino-pretty`)
- Production: JSON output (parsed by the platform's log aggregator)

Log levels: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`.

### Health Checks

The deployment platform automatically polls `/health` and `/ready` to determine service health. A non-2xx response triggers a restart.

### Error Reporting (Recommended)

For production error tracking, add [Sentry](https://sentry.io) to the API:

```bash
pnpm --filter @orchestra/api add @sentry/node
```

Then configure `SENTRY_DSN` in the environment and initialize Sentry in `apps/api/src/index.ts`:

```typescript
import * as Sentry from "@sentry/node";
Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV });
```

---

## Rollbacks

To roll back a deployment:

```bash
# Railway: list deployments and pick a previous version
railway deployment list
railway deployment revert <id>
```

Or via Git:

```bash
git revert HEAD
git push origin main
```

The CI + deploy pipeline will re-run and deploy the reverted version.
