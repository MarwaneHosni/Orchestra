# Regeneration Rules

## Overview

When source inputs change (answers edited, plan regenerated), the system must determine whether a **full re-snapshot** or a **partial regeneration** is required. This document defines the rules for that determination.

---

## Escalation Table

Each phase type has a rule that determines whether changes to that phase can be handled with partial regeneration or must escalate to a full re-snapshot.

| Phase type      | Rule         | Affected downstream phases                          |
| --------------- | ------------ | --------------------------------------------------- |
| `ideation`      | **Escalate** | All other phases                                    |
| `requirements`  | **Escalate** | All phases except ideation                          |
| `architecture`  | **Escalate** | All phases except ideation and requirements         |
| `security`      | Partial      | Security only                                       |
| `database`      | Partial      | Database, backend, frontend, core-features, testing |
| `backend`       | Partial      | Backend, frontend, testing                          |
| `frontend`      | Partial      | Frontend, testing                                   |
| `core-features` | Partial      | Core-features, testing                              |
| `ai-systems`    | Partial      | AI-systems, testing                                 |
| `testing`       | Partial      | Testing only                                        |
| `deployment`    | Partial      | Deployment, monitoring                              |
| `monitoring`    | Partial      | Monitoring only                                     |

### Escalation triggers

Partial regeneration escalates to full when **any** changed phase has an `escalate` rule:

```
Input:  ["database", "ideation"]
Output: escalatedToFull = true
Reason: Phase "ideation" is cross-cutting — full re-snapshot required
```

### Multiple phase changes

When multiple phases change in the same operation, the union of their affected downstream phases determines the regeneration scope:

```
Input:  ["backend", "security"]
Output: affected = ["backend", "frontend", "testing", "security"]  (union)
        escalatedToFull = false
```

---

## What Happens During Each Type

### Full Re-snapshot

1. `generateTasks()` is called with all phases — creates a completely new task graph.
2. Prompts are assembled for **all** tasks in the new graph.
3. A new `SnapshotRecord` is created with `affectedPhaseTypes: null` (indicating full).
4. The old task graph and prompt artifacts remain unchanged in their stores.

### Partial Regeneration

1. `deriveGraph()` is called — creates a new task graph derived from the previous version. The graph's `derivedFromPlanVersion` is set to the source version.
2. Prompts are assembled **only for tasks in affected phases** (as determined by the rule table above).
3. A new `SnapshotRecord` is created with `affectedPhaseTypes` set to the list of affected phase types.
4. Tasks in unaffected phases use the same prompt artifacts as the previous version (no regeneration needed).

---

## Determinism

Regeneration is deterministic for the same inputs:

- Same phase inputs produce the same task graph structure (same tasks, same dependencies, same ordering).
- Same task context produces identical prompt text.
- Only UUIDs (snapshot ID, task IDs, prompt artifact IDs) differ between runs.

---

## Manual Escalation

Callers can force full regeneration regardless of the phase type:

```typescript
service.regenerate({
  ...,
  forceFullRegeneration: true
})
```

This is used when:

- The user explicitly requests a full re-snapshot.
- The system is recovering from an inconsistent state.
- A regeneration attempt failed and a clean slate is needed.

---

## Error Recovery

When regeneration fails (e.g., invalid phases, store error):

1. A `SnapshotRecord` is created with `status: "failed"` and `failureReason` set to the error message.
2. The `snapshot.failed` analytics event is emitted.
3. The error propagates to the caller as an exception.
4. The stores are left in a consistent state (no partial saves from the failed attempt).

---

## Source Code

The escalation rules are defined as explicit lookup tables in `lib/versioning/types.ts`:

```typescript
export const PHASE_ESCALATION_RULES: Record<string, "partial" | "escalate"> = {
  ideation: "escalate",
  requirements: "escalate",
  architecture: "escalate",
  security: "partial",
  // ...
};

export const DEPENDENT_PHASES: Record<string, string[]> = {
  ideation: [
    /* all other phases */
  ],
  database: ["database", "backend", "frontend", "core-features", "testing"],
  // ...
};
```

The `VersioningService.assessRegenerationScope()` method uses these tables to compute the scope.

---

## Testing

See `lib/versioning/versioning.service.test.ts` for tests covering:

- Scope assessment for each escalation rule
- Partial regeneration for leaf phases
- Escalation for cross-cutting phases
- Mixed phase changes
- Error recovery
