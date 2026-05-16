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
| `contract/`      | Strict Zod schemas for all AI-generated artifacts        | `output-schema.ts`                              |
| `synthesis/`     | Answer aggregation, normalization, gap detection         | `synthesizer.ts`, `types.ts`                    |
| `analysis/`      | Per-phase structured analysis from answers               | `analyzer.ts`, `types.ts`                       |
| `roadmap/`       | Roadmap and dependency-aware task draft generation       | `generator.ts`, `types.ts`                      |
| `validation/`    | Schema-driven quality checks, repair/regeneration loop   | `validator.ts`, `repairer.ts`                   |
| `persistence/`   | Separate stores for raw answers and generated artifacts  | `service.ts`, `stores.ts`, `types.ts`           |

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

## AI-First Generation Pipeline

The system follows a staged pipeline from raw answers to versioned artifacts. Each stage produces structured output consumed by the next:

```
Answers → Synthesis → Analysis → Roadmap+Tasks → Prompts → Validation → Persistence
```

| Stage             | Input                          | Output                 | Key files                      |
| ----------------- | ------------------------------ | ---------------------- | ------------------------------ |
| **Synthesis**     | `AnswerRecord[]`               | `SynthesisContextPack` | `lib/synthesis/synthesizer.ts` |
| **Analysis**      | `SynthesisContextPack`         | `AnalysisPack`         | `lib/analysis/analyzer.ts`     |
| **Roadmap+Tasks** | `AnalysisPack`                 | `RoadmapAndTasks`      | `lib/roadmap/generator.ts`     |
| **Prompts**       | `DraftTask[]` + `AnalysisPack` | `PromptBundle`         | `lib/prompt/generator.ts`      |
| **Validation**    | All artifacts                  | `ValidationResult`     | `lib/validation/validator.ts`  |
| **Repair**        | `ValidationResult`             | Repaired artifacts     | `lib/validation/repairer.ts`   |
| **Persistence**   | Artifacts + metadata           | `GenerationPackage`    | `lib/persistence/service.ts`   |

### Pipeline Rules

- **Lifecycle order is fixed** — the 12-phase lifecycle is enforced at every stage via `PhaseTypeSchema` Zod enum + positional `.refine()`.
- **Content is original** — narrative, summary, description, and prompt text fields are free-form for AI authorship.
- **Source answers never merge with generated artifacts** — raw answers are stored separately by `PersistenceService.answers`, artifacts by `PersistenceService.artifacts`.
- **Validation is schema-driven** — `validateAll()` checks phase count, order, section completeness, content length, cross-artifact consistency, and dependency cycles.
- **Repair handles recoverable issues** — short summaries, missing narratives, and empty prompt sections are auto-repaired. Unrecoverable artifacts (>3 errors) are flagged for review.
- **Everything is versioned** — each persistence call captures an immutable answer snapshot and creates new artifact versions. Prior versions are never overwritten.

### E2E Verification

```typescript
// Full pipeline from raw answers to versioned persistence
// See lib/e2e/pipeline-e2e.test.ts for the complete 9-test suite

const pack = buildContextPack(projectId, name, sessionId, answers);
const analysis = analyzeAnswers(pack);
const { roadmap, taskDraft } = buildRoadmapAndTasks(analysis);
const bundle = generatePrompts(taskDraft.tasks, analysis, planVersion);
const validation = validateAll({ blueprint, roadmap, taskDraft, promptBundle: bundle });
const repaired = attemptRepair({ promptBundle: bundle }, validation);
const persisted = new PersistenceService().persistGeneration({
  /* ... */
});
```

## Testing Guidance

### Running Tests

```bash
pnpm test              # All tests (554 across 31 files)
pnpm test:watch        # Watch mode
```

### Writing Tests

- Tests are co-located with source files as `*.test.ts`.
- Use `describe`/`it`/`expect` from Vitest.
- Use the `createInMemoryXStore()` factory for each module's store.
- Create a factory function (e.g., `setupEnv()`) that returns fresh stores and a service instance.
- Pre-populate stores with seed data in `beforeEach` or within each test.

### Test Coverage Expectations (554 tests across 31 files)

| Module         | Tests | Key scenarios                                                                      |
| -------------- | ----- | ---------------------------------------------------------------------------------- |
| `contract/`    | 21    | Blueprint/roadmap/task/prompt/full-plan schemas, phase order, determinism          |
| `synthesis/`   | 16    | Answer collection, gaps, contradictions, determinism, per-phase stats              |
| `analysis/`    | 17    | Per-phase findings, missing/weak detection, dependencies, source links             |
| `roadmap/`     | 18    | 12 milestones in order, dependency integrity, cycle detection, acceptance criteria |
| `prompt/`      | 20    | 7 required sections, lineage, reproducibility, project-specific content            |
| `validation/`  | 28    | All artifact checks, cross-consistency, repair, unrecoverable, idempotent          |
| `persistence/` | 14    | Answer/artifact separation, versioning, lineage traceability, comparison           |
| `e2e/`         | 9     | Full pipeline E2E through all 8 stages                                             |

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
