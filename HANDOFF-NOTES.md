# Phase 3 — Handoff Notes for Phase 4

## Completed Work

### Provider Infrastructure

- **Provider adapters**: OpenAI, Anthropic, OpenRouter — each with `validate()`, `listModels()`, `generate()` with 30s timeout and typed `ProviderRequestError`
- **Credential encryption**: AES-256-GCM via `ENCRYPTION_KEY` env var, `src/lib/secrets/encryption.ts`
- **Credential CRUD**: `POST/GET/PUT/DELETE /api/v1/provider-credentials` — keys encrypted at rest, never returned in responses
- **Routing service**: 5 task types (clarification, roadmap, architecture, prompt_generation, summary) with tiered model selection + fallback chains + explainable decisions
- **Budget enforcement**: Project + user-level budget (max cost, max generations/month, max tokens/month) + `checkGeneration()` pre-validation
- **Rate limiting**: Sliding-window in-memory per-key limiter
- **Failure handling**: `classifyFailure()` — retryable (5xx, network), fallback-eligible (429), terminal (401, 400, unknown)
- **Usage accounting**: `usage_records` table + `estimateCost()` + `buildSummary()` with by-model/by-task-type/by-provider breakdowns
- **Audit logging**: 10 event types with auto-redaction + `FailureSpikeDetector` (3 failures in 5 minutes → alert)
- **Log redaction**: By field name, by regex pattern, headers, URLs — enforced in code via `createAuditEntry()`

### Frontend

- **BYOK settings page**: Add/verify/remove provider credentials, status badges (6 states), default model selector, cost estimate table
- **Cost estimate display**: Before-generation estimate on interview completion screen

### Database — 16 tables

users, projects, ideas, interview_sessions, questions, answers, plans, phases, subphases, assumptions, constraints, risks, blueprints, generations, provider_credentials, usage_records

## Test Coverage — 167 tests, 12 files

| File                                          | Tests | What it covers                                                              |
| --------------------------------------------- | ----- | --------------------------------------------------------------------------- |
| `e2e/byok-e2e.test.ts`                        | 10    | Full BYOK flow: credentials → routing → budget → usage → audit → generation |
| `provider/provider.test.ts`                   | 12    | Adapter interface, error handling                                           |
| `router/router.test.ts`                       | 16    | Routing policies, fallback, quality thresholds                              |
| `accounting/accounting.test.ts`               | 15    | Cost estimates, usage recording, summaries                                  |
| `budget/budget.test.ts`                       | 10    | Budget enforcement, rate limiting, failure classification                   |
| `audit/audit.test.ts`                         | 18    | Redaction rules, audit logging, spike detection                             |
| `encryption`                                  | 8     | AES-256-GCM roundtrip, wrong key, serialization                             |
| `orchestration/orchestration.service.test.ts` | 24    | E2E planning flow, versioning, resume                                       |
| `blueprint/generator.test.ts`                 | 16    | Phase generation, ambiguity, confidence                                     |
| `errors`, `schemas`, `shared`                 | 38    | Error classes, pagination, utilities                                        |

## Known Limitations

### 1. In-memory stores (no database persistence)

All stores (projects, sessions, credentials, usage, audit) are in-memory. Server restart loses all data. Drizzle ORM schemas exist for all 16 tables but the service layer doesn't use them yet.

### 2. Provider adapters are untested against real APIs

Adapters make real HTTP calls, but the test environment uses invalid keys (which return 401/403). No integration test verifies end-to-end against a live provider.

### 3. No worker process

`apps/worker` is a placeholder. Generation runs synchronously. Long-running AI generations will need a job queue.

### 4. No authentication

`user_id` fields exist but no auth is implemented. All data is shared. The credential routes use a hardcoded user ID.

### 5. Rate limiter is in-memory, single-process

The sliding-window rate limiter resets on server restart. Multi-process deployment would need a shared store (Redis).

### 6. Budget state resets on restart

In-memory budget state is lost when the server restarts. Monthly counters reset mid-cycle.

### 7. Audit log is in-memory

Audit entries are lost on restart. Production would need persistent audit storage.

### 8. No production monitoring

Pino logging is configured. Sentry is documented but not installed. Alerting from `FailureSpikeDetector` is log-only — no notification channel.

### 9. No CI integration tests

PR checks run unit tests only. No HTTP-level tests against the running API.

## Open Decisions for Phase 4

1. **Database persistence** — Wire all in-memory stores (orchestration, credentials, usage, budget, audit) to use Drizzle ORM + PostgreSQL.
2. **Real provider integration** — Complete the provider adapter layer with live API testing.
3. **Worker process** — Choose a queue library (BullMQ, pg-boss) for async generation.
4. **Auth** — Implement user authentication + session management.
5. **Production monitoring** — Install and configure Sentry or equivalent.
6. **Shared rate limiting** — Move from in-memory to Redis-backed for multi-process deployments.

## Documentation Map

| File                     | Audience     | Covers                                                 |
| ------------------------ | ------------ | ------------------------------------------------------ |
| `README.md`              | Everyone     | Overview, quick start, scripts                         |
| `CONTRIBUTING.md`        | Contributors | Setup, code style, testing, git workflow               |
| `docs/development.md`    | Developers   | Local setup, env config, database, troubleshooting     |
| `docs/deployment.md`     | Operators    | CI/CD, secrets, Railway setup, rollbacks               |
| `docs/architecture.md`   | Architects   | System design, domain status, planning engine workflow |
| `docs/schema.md`         | Developers   | Database tables, columns, indexes                      |
| `docs/interview-spec.md` | Developers   | Question taxonomy, flow specification                  |
| `docs/logging.md`        | Operators    | Log streams, redaction rules, spike detection          |
| `docs/runbook.md`        | Operators    | Common failures, log inspection, recovery              |
| `docs/decisions/*.md`    | Everyone     | Design rationale for all major choices                 |
