# Decision 005: Database Schema and Migrations

**Date:** 2026-05-15

## Context

Phase 5 required provisioning PostgreSQL support and creating the initial normalized schema for the platform's core entities.

## Decisions

### ORM / Migration Tool

- **Drizzle ORM** with `drizzle-kit` for schema management and migrations.
- TypeScript-native schema definitions that mirror the Zod schemas in the domain layer.
- Generated SQL migrations (not ORM-managed automatic migrations) for repeatability and deterministic deployments.

### Schema Design Principles

- **UUID primary keys** throughout, generated via `gen_random_uuid()`. Not auto-increment integers — UUIDs are safer for distributed systems and future API exposure.
- **Timestamptz** (timestamp with time zone) for all timestamp columns. Default to `now()`.
- **JSON as text** — columns like `interview_data`, `generation_parameters`, `content`, `options`, `acceptance_criteria`, and `dependency_ids` store structured data as text. This avoids JSONB overhead at this stage while maintaining flexibility. If querying these fields becomes a bottleneck, the type can be migrated to JSONB later.
- **`no action` on delete** for all foreign keys. The application layer handles referential integrity. Cascade deletes are deliberately avoided to prevent accidental data loss.

### Indexing Strategy

- Indexes on every foreign key column (the most common query path).
- Composite indexes on `(fk, order)` for ordered child relationships (phases, subphases, questions).
- Unique constraint on `plans(project_id, version)` to enforce one version number per project.

### Migration Workflow

- `drizzle-kit generate` produces versioned SQL files in `apps/api/drizzle/`.
- `tsx src/db/migrate.ts` applies pending migrations programmatically.
- Migration files and the `meta/` directory are committed to version control.
- The `dotenv-cli` helper loads the root `.env` file before running migration commands.

## Frozen Assumptions

- PostgreSQL 16 is the only supported database. No other database adapters will be introduced.
- The `drizzle/` migration directory lives inside `apps/api/`, sibling to `src/`.
- Migrations are run manually via `pnpm db:migrate` (or programmatically during CI). No automatic migration on server start.
- The `ready` endpoint attempts a database connection and reports `connected`, `disconnected`, or `not_configured`. The application does not require a database to start.

## Status

Accepted.
