# Task Decomposition Specification

## Overview

The decomposition engine transforms a structured plan (phases + subphases + blueprints) into an ordered, dependency-aware task graph suitable for AI coding agents. This document defines the deterministic rules for that transformation.

---

## 1. Derivation Rules

### 1.1 Phase-to-Task Mapping

Each of the 12 lifecycle phases produces 1–5 tasks based on its phase summary (`PhaseBlueprint.summary`, `PhaseBlueprint.status`).

| Phase         | Typical task count | Derivation logic                                       |
| ------------- | ------------------ | ------------------------------------------------------ |
| Ideation      | 1–2                | Project scaffold, environment setup                    |
| Requirements  | 1–2                | User stories, acceptance criteria                      |
| Architecture  | 2–4                | Service definitions, API contracts, data flow diagrams |
| Security      | 1–3                | Auth middleware, encryption setup, compliance checks   |
| Database      | 2–4                | Schema definition, migration creation, seed data       |
| Backend       | 3–5                | Route handlers, business logic, background jobs        |
| Frontend      | 3–5                | Component tree, page routing, API integration          |
| Core Features | 2–4                | Feature modules, integration wiring                    |
| AI / Advanced | 1–3                | Model integration, prompt templates                    |
| Testing       | 2–3                | Unit tests, integration tests, E2E tests               |
| Deployment    | 1–2                | CI/CD pipeline, Docker config                          |
| Monitoring    | 1–2                | Health checks, logging, alert setup                    |
| **Total**     | **20–40**          |                                                        |

### 1.2 Phase Status Handling

| Phase status   | Decomposition behavior                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `sufficient`   | Full decomposition — generate tasks from summary                                                            |
| `insufficient` | Partial decomposition — generate tasks for answered questions only; remaining fields marked `pending_input` |
| `missing`      | No tasks generated. Marked as `manual_review`. The entire phase is a single `manual_review` task.           |

### 1.3 Subphase-to-Task Mapping

When a phase has subphases (from the existing `subphases` table), each subphase generates 1–2 tasks:

- If subphase has `ai_prompt` → 1 task using that prompt
- If subphase has `acceptance_criteria` → 1 task per criterion (up to 3)
- If subphase has `dependency_ids` → tasks inherit those dependency references

---

## 2. Granularity Rules

### 2.1 Right-Sizing Heuristics

A task is at the right granularity when it satisfies ALL of:

- **Single output**: Task produces one coherent output (one file, one config, one test suite)
- **1–3 prompt rounds**: An AI agent can complete the task in 1–3 interactions
- **Independent verification**: The task's acceptance criteria can be checked without running other tasks
- **Clear boundary**: Task does not span multiple architectural layers (e.g., "build the API and frontend" should be split)

### 2.2 When to Split

Split a task when it has:

- Multiple distinct output files (split by file)
- Cross-layer concerns (split by layer: API, DB, frontend)
- Sequential dependency within (split by dependency ordering)
- Estimated > 3 prompt rounds (split into smaller units)

### 2.3 When to Merge

Merge adjacent tasks when they:

- Operate on the same file or tightly coupled files
- Have sequential dependencies with no other work in between
- Cannot be independently verified (one's output is meaningless without the other)
- Together produce a single coherent feature

**Hard limit**: No single task should require more than 5 prompt rounds or produce more than 3 files.

---

## 3. Dependency Types

### 3.1 Edge Types

| Type         | Symbol  | Meaning                            | Example                                                 |
| ------------ | ------- | ---------------------------------- | ------------------------------------------------------- |
| `blocks`     | A →→ B  | A must complete before B can start | Schema must be created before writing queries           |
| `triggers`   | A ──▶ B | B becomes ready when A starts      | CI pipeline triggers deployment                         |
| `input_from` | A ──▶ B | B uses A's output as input         | API spec from architecture feeds backend implementation |

### 3.2 Direction

Dependencies are always directional:

```
A ──blocks──► B   (A blocks B)
A ──blocks──► C   (A also blocks C)
B ──input_from──► D  (D needs B's output)
```

The graph is a DAG (Directed Acyclic Graph). Cycle detection is a mandatory preprocessing step.

---

## 4. Ordering & Priority Logic

### 4.1 Phase Ordering

Tasks are ordered first by phase index (0–11):

```
Ideation (0) → Requirements (1) → Architecture (2) → Security (3) → ... → Monitoring (11)
```

Within each phase, tasks follow this order:

1. **Prerequisites** (config, setup, scaffolding)
2. **Core implementation** (business logic, features)
3. **Verification** (tests, validation, documentation)

### 4.2 Priority Assignment

| Condition                                               | Priority   |
| ------------------------------------------------------- | ---------- |
| Task is on the critical path (longest dependency chain) | `critical` |
| Task blocks 3+ other tasks                              | `high`     |
| Task is a prerequisite for the next phase               | `high`     |
| Standard task                                           | `medium`   |
| Optional enhancement, documentation                     | `low`      |

### 4.3 Parallelization

Tasks with no dependency path between them are parallelizable:

```
A ──blocks──► B
C             (C has no relationship to A or B → runs in parallel)
```

The decomposition engine marks parallelizable tasks so the execution engine can run them concurrently.

---

## 5. Graph Representation

### 5.1 Minimum Task Metadata

Every task in the graph must have:

```typescript
interface ExecutionTask {
  id: string;
  planId: string;
  phaseType: string; // Which lifecycle phase
  title: string; // Short actionable title
  type: TaskType; // code, config, test, docs, review, deploy, other
  priority: Priority; // low, medium, high, critical
  status: TaskStatus; // pending, blocked, ready, in_progress, complete
  order: number; // Display/execution order within phase
  dependencies: {
    // Resolved dependency list
    taskId: string;
    type: DependencyType; // blocks, triggers, input_from
  }[];
  acceptanceCriteria: string[]; // Verifiable conditions
  estimatedPromptRounds: number; // 1–5
}
```

### 5.2 Cross-Phase References

A task in phase N can depend on a task in phase M (M < N):

```
Architecture phase ──► produce API spec ──input_from──► Backend phase ──► implement endpoint
```

Cross-phase dependencies use the `input_from` type and reference the upstream task's output artifact.

### 5.3 Output Artifacts

Each completed task produces an output artifact reference:

```typescript
interface TaskOutput {
  taskId: string;
  description: string; // What was produced
  artifactType: string; // file, config, test, doc, deploy
  downstreamTaskIds: string[]; // Tasks that use this as input
}
```

Output artifacts are stored in `prompt_artifacts.result_text` and referenced by `task_dependencies.dependency_type = 'input_from'`.

---

## 6. Fallback Rules

### 6.1 Insufficient Input

When a phase summary has insufficient content (confidence < 0.3 or status = `missing`):

1. Create a single `manual_review` task with `type: "review"` and `priority: "high"`
2. Include the phase name and available context in the task description
3. Set `status: "blocked"` — waiting for human input
4. Downstream tasks that depend on this phase's output are also blocked

### 6.2 Cycle Detection

Before finalizing the graph, run cycle detection:

1. Build adjacency list from `blocks` and `input_from` edges
2. Run DFS-based cycle detection
3. If a cycle is found, break it by:
   a. Identify the lowest-priority task in the cycle
   b. Remove its outgoing dependency edge
   c. Mark that task as `manual_review` with a note explaining the conflict

### 6.3 Overly Broad Task

If a phase would produce more than 5 tasks, apply merge rules (section 2.3) until ≤ 5. If merging cannot reduce the count below 5:

1. Group tasks into sub-groups by concern
2. Create a parent task (`parent_task_id`) for each group
3. Set child task count to 3–5 per group

### 6.4 Unknown Task Type

If a task's type cannot be determined from its content:

1. Default to `type: "other"`
2. Set `priority: "medium"`
3. Flag with an ambiguity flag so the UI can prompt for clarification

---

## 7. Deterministic Ordering Summary

```
1. Order phases by lifecycle index (0–11)
2. Within each phase:
   a. Prerequisites → core → verification
   b. Sort by dependency count (most depended-on first)
3. Assign priorities:
   - critical path → critical
   - blocks 3+ tasks → high
   - prerequisite for next phase → high
   - default → medium
   - optional → low
4. Mark blocked tasks:
   - Any task with unresolved `blocks` dependencies → status = blocked
   - Any task with all dependencies resolved → status = ready
5. Parallelize: tasks with no dependency path between them are parallelizable
6. Validate: check for cycles, overly broad phases, unknown types
```

The resulting graph is a DAG where every task has a clear reason for existence, explicit dependencies, and an unambiguous status.
