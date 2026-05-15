# Phase 2 — Handoff Notes for Phase 3

## Completed Work

The core planning engine is implemented and tested:

- **14 database tables** covering users, projects, ideas, interview_sessions, questions, answers, plans, phases, subphases, assumptions, constraints, risks, blueprints, generations
- **44 structured questions** across 12 lifecycle phases with dependency rules and validation
- **Orchestration service** managing project creation, session lifecycle, answer submission, and blueprint generation
- **Blueprint generator** producing 12-phase output with confidence scores, ambiguity flags, and structured items
- **Answer versioning** — edits create new versions, old versions preserved, plans marked stale
- **Draft resume** — sessions reopen with prior answers intact
- **Demo seed** — "TeamSync" project with 44 pre-populated answers
- **Frontend** — idea intake, interview flow with progress bar, answer editing, draft summary
- **Quality toolchain** — ESLint, Prettier, Vitest, Husky, lint-staged
- **CI/CD** — GitHub Actions workflows for PR checks and deployment

## Test Coverage

- **60 tests** across 5 test files
- E2E flow: create → answer all → generate → verify blueprint structure
- Retry versioning: each generation creates a new plan version
- Resume: answers persist across session reopens
- Store replacement: demo seed integrates with server store
- Individual unit tests for errors, schemas, normalization, ambiguity, confidence

## Known Limitations

### 1. In-memory store (no database persistence)

All project, session, answer, and blueprint data lives in an in-memory store. Restarting the server loses all data. The database schema and Drizzle ORM are configured, but the orchestration service doesn't use them yet.

**Impact:** Demo data must be re-seeded after every server restart.

### 2. No AI provider integration

The blueprint generator uses deterministic heuristics only. There are no AI calls to OpenAI, Anthropic, or any LLM. The prompt generation domain is defined but not wired.

**Impact:** Blueprints are summaries and confidence scores, not AI-generated architecture documents.

### 3. No task graph / dependency resolution

The `subphases.dependency_ids` column exists but is never populated. Subphases are listed in order but have no automated dependency resolution.

### 4. No authentication

The `users` table exists but no auth is implemented. The `user_id` on projects is auto-assigned. All data is shared.

### 5. No worker process

`apps/worker` is a placeholder. Generation runs synchronously in the request-response cycle. Long-running AI generations will need a job queue.

### 6. No integration tests

API endpoints are tested only through unit tests of the orchestration service. No HTTP-level integration tests exist.

### 7. Frontend state on hard refresh

The interview UI relies on client-side history state for back-navigation. A hard page refresh loses the in-session edit history (answers are preserved on the backend, but the back button state is reset).

### 8. No monitoring in production

Pino logging is configured for structured output. Sentry is documented but not installed. No production alerting.

### 9. Blueprint content is text-only

The `blueprints.content` column stores JSON text. Blueprints are not rendered in a structured UI — the summary page shows raw JSON-derived data.

## Open Decisions for Phase 3

1. **Database integration** — Wire the orchestration service's `SessionStore` to use Drizzle ORM + PostgreSQL instead of the in-memory store.
2. **AI provider** — Choose and integrate an AI provider (OpenAI, Anthropic) for the prompt generation and planning engine.
3. **Job queue** — Choose a queue library (BullMQ, pg-boss) for asynchronous blueprint generation.
4. **Auth strategy** — Choose an authentication approach (session-based, JWT, OAuth).
5. **Integration test framework** — Choose an approach for HTTP-level API tests (Supertest, Vitest with Fastify injection).

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
| `docs/runbook.md`        | Operators    | Common failures, log inspection, recovery              |
| `docs/decisions/*.md`    | Everyone     | Design rationale for all major choices                 |
