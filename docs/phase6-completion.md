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

### Intentionally Deferred

| Feature                                        | Rationale                                                                 | When to revisit                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ |
| `compare.viewed` analytics event               | `AnalyticsService.trackCompareViewed()` exists but no caller emits it     | Phase 7 when the compare route is wired to the backend |
| `export.redownloaded` analytics event          | Method exists, not called                                                 | Phase 7 when re-download tracking is needed            |
| Prompt bundle export from version history      | Current "Export bundle" button on task graph page skips the `ExportStore` | Phase 7 — unify export paths                           |
| PDF export format                              | Deferred per prompt 5 — markdown and JSON are authoritative first         | Phase 8 or later                                       |
| Compare view navigation from activity timeline | Activity events could link to the diff view                               | Phase 7 UX pass                                        |

### Known Limitations

1. All stores are in-memory. Server restart loses snapshot, graph, prompt, and export data. The Drizzle DB schema exists but the application layer reads/writes in-memory stores. Production migration requires implementing DB-backed stores.
2. `prompt_artifacts` DB table has `failure_reason` and `needs_review` status in the Drizzle schema but no in-memory store supports these yet (the in-memory `PromptStore` uses the app-level `PromptArtifact` type which does support them).
3. The `activity_log` DB table exists in Drizzle but the application uses the in-memory `AuditStore` for event querying. The analytics service reads from the in-memory store.
4. No consolidated README for the docs/index.md navigation from the repo root — users must know to visit `docs/index.md`.

### Handoff to Phase 7

The verified versioning, export, analytics, and documentation foundation is in place. Phase 7 should:

1. Implement DB-backed stores for persistence
2. Wire `compare.viewed` and `export.redownloaded` analytics events
3. Unify the prompt bundle export through the ExportStore
4. Add the compare view navigation from activity timeline events
5. Run a comprehensive UI polish pass
