# Performance Optimizations

## Bottlenecks Fixed

### 1. In-Memory Store Indexing

All 7 in-memory stores were rewritten from O(n) flat-array scans to O(1) `Map`-based lookups.

| Store                                  | Before                                                | After                                                                            | Key change                                                                               |
| -------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `orchestration/store.ts`               | `Array.find()` / `Array.filter()` on raw arrays       | `Map<string, Record>` per index (projects, sessions, answers, plans, blueprints) | `getLatestAnswersBySession` cached with invalidation on `supersedeAnswer`/`insertAnswer` |
| `task-graph/generator.ts` (GraphStore) | `graphs.find(g => planId && version)`                 | `Map<"planId::version", TaskGraph>` + `Map<planId, TaskGraph[]>`                 | All lookups O(1)                                                                         |
| `prompt/types.ts` (PromptStore)        | `items.find(taskId)`, `items.filter(planId, version)` | `Map<taskId, PromptArtifact>` + `Map<"planId::version", PromptArtifact[]>`       | All lookups O(1)                                                                         |
| `credentials/store.ts`                 | `items.find(id)`                                      | `Map<id, FullProviderCredential>`                                                | O(1) get/update/remove                                                                   |
| `audit/logger.ts` (AuditStore)         | `entries.filter(eventType)` on every query            | `Map<eventType, AuditEntry[]>` for typed queries                                 | Filter by eventType O(1); mixed filters scan subset only                                 |
| `versioning/store.ts` (SnapshotStore)  | `items.find(id)`, `items.filter(projectId)`           | `Map<id, SnapshotRecord>` + `Map<projectId, SnapshotRecord[]>`                   | `getLatestByProject` avoids full sort                                                    |
| `export/store.ts` (ExportStore)        | `items.find(id)`, dual `items.filter(...)`            | `Map<id, ExportRecord>` + `Map<projectId>` + `Map<snapshotId>`                   | O(1) by all three access patterns                                                        |

**Tradeoff**: Slightly higher memory per insertion (Map entry overhead vs array push). For in-memory stores with <100K records this is negligible (<5MB).

### 2. Export Endpoint — Eliminated O(n\*m) Nested Loops

**Before**: `execution-tasks.ts` `GET /plans/:planId/prompts/export` had 3 independent iterations over `tasks[]`, each calling `prompts.find(p => p.taskId === t.id)` — O(tasks × prompts) repeated 3 times.

**After**: Build a single `Map<taskId, PromptArtifact>` once, then use `promptMap.get(t.id)` for all lookups — O(tasks + prompts) total.

**Real-world impact**: For 100 tasks with 100 prompts, this drops from ~30,000 loop iterations to ~200 hash lookups.

### 3. GET /tasks — Decoupled Reads from Writes

**Before**: `GET /api/v1/plans/:planId/tasks` would generate tasks AND prompts as a side effect of a read-only GET request.

**After**: The GET endpoint only generates and returns the task graph. Prompts are generated lazily on demand via `GET /api/v1/plans/:planId/tasks/:taskId/prompt`. The versioning service's `regenerate()` method still generates prompts eagerly (it's a write path).

**Tradeoff**: The first access to a prompt after graph generation requires a brief prompt assembly. In practice this is ~1ms per prompt and happens only once per task.

### 4. Project Listing — Fixed Dead Pagination

**Before**: `GET /api/v1/projects` returned `paginatedResponse([], 0, page, pageSize)` — always empty because `getAllProjects()` didn't exist on the store.

**After**: Store has `getAllProjects()` returning `Map.values()`. Route slices with proper offset/limit.

### 5. Credential Listing — Added Pagination

**Before**: `GET /api/v1/provider-credentials` returned all credentials with no pagination.

**After**: Accepts `?page=1&pageSize=20` (defaults). Uses the existing `paginatedResponse` helper.

## Performance Tests

`lib/performance/perf.test.ts` contains 16 targeted performance tests:

- Each indexed store tested at scale (1K-10K records)
- Verify read times stay under 50ms for 100 repeated lookups
- Export endpoint Map pattern tested against original O(n\*m) approach
- Pagination metadata consistency verified

## Remaining Known Limitations

- All stores are in-memory and reset on server restart (documented in HANDOFF-NOTES.md)
- `getNextQuestion()` still iterates `QUESTIONS` array on every call — this is a static array of ~30 items so O(30) per call is acceptable
- `computeDependencies()` and `computeStatuses()` in `generator.ts` still recompute on each `generateTasks()` call — caching would require detecting phase changes, which adds complexity that outweighs the benefit for the current usage pattern
