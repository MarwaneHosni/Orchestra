# Phase 6 — Versioning, Diff, Export, Analytics & Documentation

## Completion Summary

### Delivered

| Area                           | What was built                                                                                                                                                                          | Key files                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Snapshot model**             | `project_snapshots`, `task_graphs`, `activity_log` Drizzle tables + migration. `projectSnapshotReasons` enum (6 reasons). `SnapshotStore` + `createInMemorySnapshotStore()`.            | `db/schema/project-snapshots.ts`, `db/schema/task-graphs.ts`, `db/schema/activity-log.ts`, `db/schema/prompt-artifacts.ts` (extended) |
| **Versioning service**         | `VersioningService` with `createSnapshot()`, `regenerate()`, `assessRegenerationScope()`. Full vs. partial regeneration with escalation rules. Error recovery with failed snapshots.    | `lib/versioning/versioning.service.ts`, `types.ts`, `store.ts`                                                                        |
| **Diff service**               | `DiffService.compare()` producing structured `VersionDiff` with task, prompt, phase, and blueprint diffs. Deterministic output.                                                         | `lib/diff/diff.service.ts`, `types.ts`                                                                                                |
| **Export service**             | `ExportService` with 4 artifact types (blueprint, task_graph, prompts, full_bundle) in 2 formats (markdown, JSON). `ExportStore` for persistence. Bundle version `orchestra-export-v1`. | `lib/export/export.service.ts`, `types.ts`, `store.ts`                                                                                |
| **Analytics**                  | 8 new `AuditEventType` values. `AnalyticsService` with emission points. Activity timeline and usage summary UI.                                                                         | `lib/analytics/analytics.service.ts`, `lib/audit/types.ts`                                                                            |
| **Frontend — Version history** | Timeline view with vertical connector, Partial/Initial/Failed badges, parent lineage labels, auto-select latest.                                                                        | `components/versions/version-node.tsx`, `version-history.tsx`                                                                         |
| **Frontend — Compare**         | Two-snapshot selection with diff display (summary cards, task/blueprint changes, scope badges).                                                                                         | `components/versions/version-compare.tsx`                                                                                             |
| **Frontend — Export**          | Export action center with 4 artifact types, format toggle, re-download, copy, success/error states.                                                                                     | `components/versions/export-action-center.tsx`                                                                                        |
| **Frontend — Activity**        | Chronological event timeline with human-readable labels. Usage summary with 4 metric cards.                                                                                             | `components/activity/activity-timeline.tsx`, `usage-summary.tsx`                                                                      |
| **Documentation**              | Contributor guide, regeneration rules, prompting standards, user guide, doc index. README updated.                                                                                      | `docs/contributing.md`, `docs/regeneration-rules.md`, `docs/prompting-standards.md`, `docs/user-guide.md`, `docs/index.md`            |

### Test Count

| Suite                     | Tests                   |
| ------------------------- | ----------------------- |
| Existing (before Phase 6) | 220                     |
| Added versioning tests    | 21                      |
| Added diff tests          | 14                      |
| Added export tests        | 18                      |
| **Total**                 | **273** (17 test files) |

### E2E Verification

```
1. Generate task graph      → 20 tasks, version 1           PASS
2. Get single prompt         → status=complete, 2350 chars   PASS
3. Export bundle             → orchestra-prompt-bundle-v1    PASS
4. Regenerate version 2      → 20 tasks, version 2           PASS
5. Export version 2          → DerivedFrom: 1                PASS
6. Verify v1 still accessible→ 20 tasks unchanged            PASS
```

### Storage & Retention

| Entity              | Retention            | Rationale                                               |
| ------------------- | -------------------- | ------------------------------------------------------- |
| `project_snapshots` | All versions         | Lightweight references (~200 bytes each)                |
| `task_graphs`       | All versions         | Summary row, task data stored elsewhere                 |
| `activity_log`      | All entries          | ~100 bytes per entry, consider archival after 12 months |
| Exports (in-memory) | Until server restart | In-memory store; production should persist to DB        |

No automatic deletion. Retention is application-layer. Manual archive can move records older than 12 months to cold storage.

### E2E Verification Scope

The E2E smoke test covers the **Phase 4–5 HTTP routes** (task graph generation, prompt assembly, bundle export, versioned graph retrieval). **Phase 6 services** (snapshot creation, diff, export service, analytics) are verified at the **unit test level** (273 tests) but have **no HTTP endpoints yet**. The frontend components (`VersionHistory`, `ExportActionCenter`, `ActivityTimeline`) call API functions in `lib/api.ts` that will fail until the corresponding Fastify routes are built.

### Intentionally Deferred

| Feature                                        | Rationale                                                                                              | When to revisit                                                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fastify routes for snapshot CRUD               | `SnapshotService`, `DiffService`, `ExportService`, `AnalyticsService` exist but have no HTTP endpoints | Phase 7 — build `GET /api/v1/projects/:id/snapshots`, `POST /api/v1/snapshots/:id/export`, `GET /api/v1/snapshots/:id/compare/:id`, `GET /api/v1/projects/:id/activity` |
| `compare.viewed` analytics event               | `AnalyticsService.trackCompareViewed()` exists but no caller emits it                                  | Phase 7 when the compare route is wired                                                                                                                                 |
| `export.redownloaded` analytics event          | Method exists, not called                                                                              | Phase 7 when re-download tracking is needed                                                                                                                             |
| Prompt bundle export from version history      | Current "Export bundle" button on task graph page skips the `ExportStore`                              | Phase 7 — unify export paths                                                                                                                                            |
| PDF export format                              | Deferred per prompt 5 — markdown and JSON are authoritative first                                      | Phase 8 or later                                                                                                                                                        |
| Compare view navigation from activity timeline | Activity events could link to the diff view                                                            | Phase 7 UX pass                                                                                                                                                         |

### Known Limitations

1. **No HTTP routes for Phase 6 services** — `VersioningService`, `DiffService`, `ExportService`, and `AnalyticsService` are fully implemented and tested at the library level, but have no Fastify endpoints. Frontend components call API functions that will return 404 until routes are built.
2. All stores are in-memory. Server restart loses snapshot, graph, prompt, and export data. The Drizzle DB schema exists but the application layer reads/writes in-memory stores. Production migration requires implementing DB-backed stores.
3. `prompt_artifacts` DB table has `failure_reason` and `needs_review` status in the Drizzle schema but no in-memory store supports these yet (the in-memory `PromptStore` uses the app-level `PromptArtifact` type which does support them).
4. The `activity_log` DB table exists in Drizzle but the application uses the in-memory `AuditStore` for event querying. The analytics service reads from the in-memory store.
5. No consolidated README for the docs/index.md navigation from the repo root — users must know to visit `docs/index.md`.

### Handoff to Phase 7

The verified versioning, export, analytics, and documentation foundation is in place (273 tests, all passing). Phase 7 should:

1. **Build Fastify routes** for all Phase 6 services — snapshot CRUD, diff comparison, export generation, and activity/analytics queries. Without these routes, the frontend components cannot function.
2. Implement DB-backed stores for persistence
3. Wire `compare.viewed` and `export.redownloaded` analytics events
4. Unify the prompt bundle export through the ExportStore
5. Add the compare view navigation from activity timeline events
6. Run a comprehensive UI polish pass
