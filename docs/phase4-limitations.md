# Phase 4 — Known Limitations & Rough Edges

## Scope

This document records issues discovered during Phase 4 that should be addressed in Phase 5 or later. Items are grouped by severity.

---

## P0 — Must Fix Before Production

### 1. PromptPreview uses hardcoded session ID

**File:** `apps/web/src/components/task-graph/prompt-preview.tsx`

The `fetch` URL hardcodes `dummy` instead of the actual `sessionId`:

```typescript
const res = await fetch(`http://localhost:3000/api/v1/plans/dummy/tasks/${taskId}/prompt`);
```

The `sessionId` is available in the parent `TaskGraphView` (used for the task fetch and export) but is never passed to `PromptPreview`. Single-prompt preview will fail in any real deployment.

---

## P1 — Should Fix This Phase

### 2. No route-level integration tests

The three Fastify endpoints (`GET /tasks`, `GET /tasks/:id/prompt`, `GET /prompts/export`) have zero HTTP-level tests. All coverage is at the lib unit level. This means:

- Error serialization (HTTP status codes, error shapes) is untested
- The `version must be a positive integer` error throws bare `Error` instead of a typed Fastify `HttpError`
- The 12-phase `defaultPhases()` in the route is never validated by a test

### 3. Module-scoped stores prevent route isolation

`graphStore` and `promptStore` are module-level singletons in `execution-tasks.ts`. This makes writing isolated route tests impossible without module mocking or dependency injection.

### 4. Export depends on prior `/tasks` call

`GET /api/v1/plans/:planId/prompts/export` throws `NotFoundError` if no graph exists for the plan. It never triggers generation itself. The UI always calls `/tasks` before `/export`, but the API contract is undocumented and brittle.

### 5. No concurrent-safety for graph generation

Two simultaneous `GET /tasks` for the same unseen plan could both attempt to generate and save. The store rejects duplicate `(planId, planVersion)` but the route has no locking or retry logic.

### 6. No visual DAG rendering

Dependencies are shown textually (label on card + list in detail panel) but never rendered as visual edges/arrows between task nodes. A true DAG visualization library (e.g., react-flow, dagre) would improve comprehension.

---

## P2 — Fix When Convenient

### 7. `dependencyType` ignored in UI

The API returns `dependencyType` (`blocks`, `triggers`, `input_from`) for each edge, but the UI only surfaces the existence of dependencies, not their type. Blocked-by edges are shown in red regardless of type.

### 8. No blueprint/summary export

The task graph has an "Export bundle" button, but the blueprint/summary view has no export capability. Users cannot download the blueprint phases or interview results.

### 9. Regeneration edge case: version gap

If a user requests `?version=3` with no prior versions, the route calls `generateTasks()` directly (not `deriveGraph`), so the resulting graph has no `derivedFromPlanVersion`. This is correct behavior but potentially confusing — the version number implies a predecessor.

### 10. `getByTask` lacks version filter

`PromptStore.getByTask(taskId)` returns the first match regardless of version. Since `deriveGraph` creates new task UUIDs, collisions don't occur in practice, but this is fragile.

### 11. No cycle detection

The `computeDependencies` logic creates a guaranteed DAG (phases are ordered, edges go forward), but there is no explicit cycle detection. A future phase with custom edges could introduce cycles.

### 12. Hardcoded 12 phases in route

`execution-tasks.ts` hardcodes all 12 phase inputs in `defaultPhases()`. In production these should come from the blueprint generator's output, not be embedded in the route.

---

## Summary of Test Gaps

| Area                          | Tests exist | What's missing                                                            |
| ----------------------------- | ----------- | ------------------------------------------------------------------------- |
| Graph generation unit tests   | Full        | —                                                                         |
| Prompt assembly unit tests    | Full        | —                                                                         |
| Validation (phases + prompts) | Full        | —                                                                         |
| Derive/regenerate lib tests   | Full        | —                                                                         |
| Export lib tests              | Full        | —                                                                         |
| Snapshot stability tests      | Full        | —                                                                         |
| Route-level integration tests | ❌ None     | HTTP status codes, error shapes, version parameter, export-graph coupling |
| UI component tests            | ❌ None     | Button states, panel rendering, clipboard API, download trigger           |
