# Contributor Guide

## Code Organization

### Workspace Layout

```
orchestra/
  apps/
    api/          # Fastify HTTP server (backend)
    web/          # Next.js 15 frontend
    worker/       # Background job processor (placeholder)
  packages/
    shared/       # Shared types and utilities
    config/       # Environment config, provider routing
  docs/           # Documentation
```

### API Module Layout (`apps/api/src/lib/`)

| Module           | Responsibility                                           | Key files                                       |
| ---------------- | -------------------------------------------------------- | ----------------------------------------------- |
| `orchestration/` | Session management, interview flow, blueprint generation | `orchestration.service.ts`, `store.ts`          |
| `task-graph/`    | Task decomposition from blueprint phases                 | `generator.ts`, `types.ts`                      |
| `prompt/`        | Prompt assembly, formatting, validation                  | `assembler.ts`, `validator.ts`, `templates.ts`  |
| `versioning/`    | Snapshot creation, regeneration                          | `versioning.service.ts`, `types.ts`, `store.ts` |
| `diff/`          | Version comparison                                       | `diff.service.ts`, `types.ts`                   |
| `export/`        | Markdown/JSON export generation                          | `export.service.ts`, `types.ts`, `store.ts`     |
| `analytics/`     | Event emission and project activity                      | `analytics.service.ts`                          |
| `audit/`         | Structured audit logging                                 | `logger.ts`, `types.ts`                         |
| `blueprint/`     | Blueprint output generation from answers                 | `generator.ts`                                  |

### Store Pattern

Every module that needs persistence defines:

- An **interface** (e.g., `SnapshotStore`, `GraphStore`, `PromptStore`)
- An **in-memory implementation** (`createInMemoryXStore()`)
- A **factory function** that creates fresh stores for each test

Stores are injected via **constructor dependency injection** into services:

```
VersioningService(snapshotStore, graphStore, promptStore)
DiffService(snapshotStore, graphStore, promptStore)
ExportService(snapshotStore, graphStore, promptStore, exportStore)
```

Never import a store singleton directly from a service — always inject it.

**Exception:** The audit logger (`logAudit()` from `lib/audit/logger.ts`) is a global utility, not a store. It is called directly from services for fire-and-forget event emission. Audit events never block the caller and are not part of the core domain logic. See the Analytics Events section below.

### Domain Routes (`apps/api/src/domains/`)

Each domain file exports a `registerXRoutes(app: FastifyInstance)` function.
They are registered in `domains/index.ts` and called during server startup.

---

## Versioning Rules

### Snapshot Creation

- `VersioningService.createSnapshot()` creates an immutable `SnapshotRecord` at the next version number.
- Each snapshot stores references to its source artifacts (planId, blueprintId, taskGraphId, interviewSessionId).
- `parentSnapshotId` points to the previous snapshot, forming a linked chain.
- Snapshots are always append-only. Old snapshots are never modified.

### Regeneration

- `VersioningService.regenerate()` handles both full and partial regeneration.
- Scope assessment is done by `assessRegenerationScope(changedPhaseTypes)`.
- **Full regeneration**: Cross-cutting phases (ideation, requirements, architecture) trigger a complete re-generation of the task graph and all prompts.
- **Partial regeneration**: Leaf/middle phases (backend, testing, etc.) regenerate only the task graph structure and prompts for directly affected phases and their dependents.
- The caller can force full regeneration with `forceFullRegeneration: true`.

See [docs/regeneration-rules.md](regeneration-rules.md) for the complete phase escalation table.

---

## Export Conventions

### Available Formats

| Format   | Content type       | File extension |
| -------- | ------------------ | -------------- |
| Markdown | `text/markdown`    | `.md`          |
| JSON     | `application/json` | `.json`        |

### Artifact Types

| Type          | Content                                                      |
| ------------- | ------------------------------------------------------------ |
| `blueprint`   | Plan version, phase summary, assumptions, constraints, risks |
| `task_graph`  | All tasks grouped by phase with status and dependencies      |
| `prompts`     | AI execution prompts in task order                           |
| `full_bundle` | Combined blueprint + task graph + prompts                    |

### Bundle Version

All exports carry `"bundleVersion": "orchestra-export-v1"` in JSON format or a header line in Markdown.

### Filename Convention

```
orchestra-v{snapshotVersion}-{artifactType}.{ext}
```

Example: `orchestra-v3-blueprint.json`

---

## Analytics Events

Events are emitted via `logAudit()` from `lib/audit/logger.ts`. All events use the `system` actor and carry only IDs, version numbers, and format strings — no sensitive content.

| Event                          | Triggered by                                                                 | Payload                                  |
| ------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------- |
| `snapshot.created`             | `VersioningService.createSnapshot()`                                         | snapshotId, version, reason, planVersion |
| `snapshot.partial_regenerated` | `VersioningService.createSnapshot()` (when `affectedPhaseTypes` is non-null) | same as created                          |
| `snapshot.failed`              | `VersioningService.regenerate()` catch block                                 | snapshotId, reason, error                |
| `export.generated`             | `ExportService.saveExport()`                                                 | exportId, snapshotId, format, type       |

---

## Testing Guidance

### Running Tests

```bash
pnpm test              # All tests
pnpm test:watch        # Watch mode
```

### Writing Tests

- Tests are co-located with source files as `*.test.ts`.
- Use `describe`/`it`/`expect` from Vitest.
- Use the `createInMemoryXStore()` factory for each module's store.
- Create a factory function (e.g., `setupEnv()`) that returns fresh stores and a service instance.
- Pre-populate stores with seed data in `beforeEach` or within each test.

### Test Coverage Expectations

| Module        | Tests                      | Key scenarios                                                                           |
| ------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| `task-graph/` | generator.test.ts          | Phase decomposition, dependencies, status, validation, deriveGraph                      |
| `prompt/`     | prompt.test.ts             | Assembly, validation, format, store                                                     |
| `versioning/` | versioning.service.test.ts | Snapshot creation, scope assessment, full/partial regeneration, lineage, error handling |
| `diff/`       | diff.service.test.ts       | Same-version, task/prompt/blueprint diffs, determinism                                  |
| `export/`     | export.service.test.ts     | All formats, artifact types, determinism, export store                                  |

### Pre-commit Checks

Pre-commit hooks run automatically via Husky + lint-staged:

1. ESLint on staged files
2. Prettier formatting
3. If any check fails, the commit is blocked

To skip hooks (emergency only): `git commit --no-verify`

---

## Architecture Decisions

See [docs/decisions/](decisions/) for the full ADR series:

- `008-planning-engine-data-model.md` — Phase decomposition and dependency model
- `006-quality-toolchain.md` — TypeScript strictness, linting, formatting choices
