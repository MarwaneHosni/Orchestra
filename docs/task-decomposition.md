# Task Decomposition & Prompt Generation

## Overview

The decomposition engine transforms a structured plan (phases from a blueprint) into an ordered, dependency-aware task graph. Each task then produces a versioned prompt artifact suitable for AI coding agents. This document describes the **implemented** behavior — not aspirational design.

---

## 1. Task Graph Model

### 1.1 Core Types

```typescript
interface TaskNode {
  id: string; // UUID
  planId: string;
  phaseType: string; // One of 12 lifecycle phases
  title: string; // Short actionable title
  type: "code" | "config" | "test" | "docs" | "review" | "deploy" | "pending_input" | "other";
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "blocked" | "ready" | "in_progress" | "complete" | "needs_review";
  order: number; // Global execution order
  dependencies: { taskId: string; type: "blocks" | "triggers" | "input_from" }[];
  acceptanceCriteria: string[];
  estimatedPromptRounds: number; // 1–3
  failureReason?: string; // Present when decomposition failed
}

interface TaskGraph {
  planId: string;
  planVersion: number;
  tasks: TaskNode[];
  dependencies: DependencyEdge[];
  derivedFromPlanVersion?: number; // Lineage: which version this was regenerated from
}

interface DependencyEdge {
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: "blocks" | "triggers" | "input_from";
}
```

### 1.2 Phase-to-Task Mapping

Each of the 12 lifecycle phases produces 1–5 tasks based on `PhaseInput.status` and `TASK_COUNTS[phaseType]`:

| Phase          | Min tasks | Max tasks | Typical types      |
| -------------- | --------- | --------- | ------------------ |
| Ideation       | 1         | 2         | config, test       |
| Requirements   | 1         | 2         | config, test       |
| Architecture   | 2         | 4         | config, code, test |
| Security       | 1         | 3         | config, code, test |
| Database       | 2         | 4         | config, code, test |
| Backend        | 3         | 5         | config, code, test |
| Frontend       | 3         | 5         | config, code, test |
| Core Features  | 2         | 4         | config, code, test |
| AI Systems     | 1         | 3         | config, code, test |
| Testing        | 2         | 3         | config, code, test |
| Deployment     | 1         | 2         | config, test       |
| Monitoring     | 1         | 2         | config, test       |
| **Total (12)** | **20**    | **40**    |                    |

Within each phase, tasks follow this order:

1. **Prerequisite** (config, type=config) — "Set up {Phase} foundations"
2. **Core implementation** (code, type=code) — "Implement {Phase} core logic"
3. **Verification** (test, type=test) — "Verify {Phase} implementation"

### 1.3 Phase Status Handling

| Phase status   | Decomposition behavior                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `sufficient`   | Full decomposition — generate full task count                                                        |
| `insufficient` | Reduced task count (min − 1) + a `pending_input` task with `needs_review` status and `failureReason` |
| `missing`      | Single `review` task with `needs_review` status and `failureReason`                                  |

### 1.4 Dependency Computation

**Within-phase:** Sequential `blocks` edges — prerequisite → core → verification.

**Cross-phase:** The last task of phase N blocks the first task of phase N+1 using a `blocks` dependency.

Dependency direction: `A —blocks—► B` means "A must complete before B can start."

### 1.5 Status Computation

- **Ready:** First task in the graph, or all dependencies are `complete`.
- **Blocked:** At least one dependency is not `complete`, or any dependency is a `review`-type task.
- **Needs review:** Tasks of type `review` or `pending_input` (non-decomposable phases).
- **Pending:** Default status for newly created tasks that are not yet evaluated.

---

## 2. Prompt Assembly

### 2.1 Prompt Artifact Schema

```typescript
interface PromptArtifact {
  id: string; // UUID
  taskId: string;
  planId: string;
  planVersion: number;
  promptText: string; // Full rendered markdown
  sections: PromptSection; // Structured sections
  version: number; // Always 1 (append-only per task)
  status: "pending" | "complete" | "failed" | "needs_review";
  failureReason: string | null; // Set when status != "complete"
  createdAt: string; // ISO 8601
}

interface PromptSection {
  objective: string;
  context: string;
  constraints: string[];
  expectedOutput: string;
  validationCriteria: string[];
  architecturalAlignment: string;
  agentTips: AgentTips;
}
```

### 2.2 Prompt Rendering

`formatPrompt()` renders `PromptSection` into deterministic Markdown:

```
# Execution Prompt

## Objective
{objective}

## Context
{context}

## Constraints
- {constraint 1}
- {constraint 2}

## Expected Output
{expectedOutput}

## Validation Criteria
- {criterion 1}
- {criterion 2}

## Architectural Alignment
{architecturalAlignment}

## Agent Tips
### Security
- {tip}

### Edge Cases
- {tip}

### Dependency Warnings
- {tip}

### Common Bugs
- {tip}
```

Agent Tips subsections are only included when their arrays are non-empty.

### 2.3 Validation

Every prompt artifact is validated after assembly:

| Condition                                             | Result         |
| ----------------------------------------------------- | -------------- |
| All 7 required sections present with content          | `complete`     |
| Missing section, empty array, or text under 200 chars | `failed`       |
| Prompt text exceeds 5000 chars                        | `needs_review` |
| Agent tips all empty                                  | `failed`       |
| Objective under 10 chars or expectedOutput under 20   | `failed`       |

### 2.4 Agent Tips Usage

The `agentTips` section provides explicit guidance for AI coding agents:

| Subsection              | Purpose                                         | Included tips (count)     |
| ----------------------- | ----------------------------------------------- | ------------------------- |
| **Security**            | Common security pitfalls and requirements       | 4 base + task-type extras |
| **Edge Cases**          | Boundary conditions, error states, empty states | 3                         |
| **Dependency Warnings** | Import/type/config integration warnings         | 3                         |
| **Common Bugs**         | Frequently introduced defects in similar tasks  | 4 base + task-type extras |

**Task-type-specific extras:**

- `code` type: adds "Unhandled promise rejections" and "Memory leaks" to commonBugs
- `config` type: adds secret-in-config warning to security, default-value warning to commonBugs

---

## 3. Export Format

### 3.1 Bundle Format

Endpoint: `GET /api/v1/plans/:planId/prompts/export?version=N`

```json
{
  "exportFormat": "orchestra-prompt-bundle-v1",
  "exportedAt": "2026-05-15T23:30:00.000Z",
  "planId": "uuid",
  "planVersion": 1,
  "derivedFromPlanVersion": null,
  "taskCount": 20,
  "promptCount": 20,
  "warnings": ["2 task(s) have no prompt artifact"],
  "tasks": [
    {
      "order": 0,
      "phaseType": "ideation",
      "title": "Set up Ideation foundations",
      "type": "config",
      "priority": "high",
      "status": "ready",
      "dependencies": [],
      "acceptanceCriteria": ["..."],
      "promptText": "# Execution Prompt\n\n## Objective\n...",
      "promptValidationStatus": "complete",
      "promptFailureReason": null
    }
  ],
  "metadata": {
    "generatedAt": "2026-05-15T23:29:00.000Z",
    "graphVersion": 1
  }
}
```

Key properties:

- `warnings` array (omitted if empty) — includes missing/null prompt artifacts
- `promptValidationStatus` — per-task status of the prompt artifact
- `promptFailureReason` — per-task failure reason
- `derivedFromPlanVersion` — lineage of the graph version used

### 3.2 Export Flows

| Flow               | Trigger                                         | Output                                      |
| ------------------ | ----------------------------------------------- | ------------------------------------------- |
| Single prompt copy | "Copy" button in PromptPreview                  | Clipboard (`navigator.clipboard.writeText`) |
| Bundle download    | "Export bundle" button in TaskGraphView toolbar | JSON file download (`prompts-{id}.json`)    |

---

## 4. Regeneration & Version Lineage

### 4.1 Deriving a New Version

Function: `deriveGraph(planId, newPlanVersion, phases, fromGraph)`

- Creates a fresh `TaskGraph` at `newPlanVersion` with all-new UUIDs for tasks
- Sets `derivedFromPlanVersion` on the result to `fromGraph.planVersion`
- Old graph and its prompt artifacts remain untouched in the store

### 4.2 Route Behavior

`GET /api/v1/plans/:planId/tasks?version=N`

| Scenario                             | Behavior                                                            |
| ------------------------------------ | ------------------------------------------------------------------- |
| Version 1, no cache                  | `generateTasks(planId, 1, phases)`, cache, assemble prompts         |
| Version N (>1), prior version exists | `deriveGraph` from latest existing version, cache, assemble prompts |
| Version N (>1), no prior version     | `generateTasks(planId, N, phases)`, cache, assemble prompts         |
| Version N already cached             | Return cached graph (no regeneration)                               |

### 4.3 Lineage Preservation

- Old `TaskGraph` objects remain in the `GraphStore` — accessible by `getGraph(planId, version)`
- Old `PromptArtifact` objects remain in the `PromptStore` — accessible by `getByPlan(planId, planVersion)`
- Bundle export includes `derivedFromPlanVersion` for auditability
- Each graph version is uniquely identified by `(planId, planVersion)` — the store rejects duplicate saves

---

## 5. Failure States

### 5.1 Non-Decomposable Tasks

| Scenario                    | Task type       | Status         | failureReason                                                                 |
| --------------------------- | --------------- | -------------- | ----------------------------------------------------------------------------- |
| Phase status = missing      | `review`        | `needs_review` | `Phase "{name}" has status "missing" — cannot decompose into tasks`           |
| Phase status = insufficient | `pending_input` | `needs_review` | `Phase "{name}" has status "insufficient" — some tasks may lack full context` |

### 5.2 Prompt Validation Failures

| Scenario                 | Artifact status | failureReason                         |
| ------------------------ | --------------- | ------------------------------------- |
| Missing required section | `failed`        | `Missing required section: {section}` |
| Section empty            | `failed`        | `Section "{section}" is empty`        |
| Prompt too short (<200)  | `failed`        | `Prompt is too short ({n} chars)`     |
| No agent tips            | `failed`        | `Agent tips section is empty`         |
| Prompt too long (>5000)  | `needs_review`  | `Prompt is very long ({n} chars)`     |

### 5.3 Phase Validation

`validatePhases(phases)` checks:

| Check                          | Error/Warning |
| ------------------------------ | ------------- |
| Unknown phase type             | Error         |
| Duplicate phase type           | Error         |
| Empty phase name               | Error         |
| Confidence out of [0, 1] range | Error         |
| Summary < 5 characters         | Error         |
| Sufficient + low confidence    | Warning       |

---

## 6. GraphStore & PromptStore

Both are in-memory stores (not persisted to database):

| Store       | Key                                   | Operations                                 |
| ----------- | ------------------------------------- | ------------------------------------------ |
| GraphStore  | `(planId, planVersion)`               | `saveGraph`, `getGraph`, `getGraphsByPlan` |
| PromptStore | `(taskId)` or `(planId, planVersion)` | `save`, `getByTask`, `getByPlan`           |

Constraints:

- `saveGraph` rejects duplicate `(planId, planVersion)` with an error
- `save` always appends to the prompt list

---

## 7. UI Surface

### 7.1 Task Graph Display

Tasks are grouped by phase and rendered as cards in a grid. Each card shows:

- Title, type badge, priority badge
- Status dot + border color (red=blocked, amber=needs_review, green=ready, gray=pending, blue=in_progress)
- Dependency count label

### 7.2 Task Detail Panel

Right-side slide-over showing:

- Task metadata (title, phase, type, priority, order)
- Status badge
- Dependencies list (linked task titles)
- Blocked-by section (upstream blockers in red)
- Acceptance criteria
- "View Prompt" button

### 7.3 Prompt Preview Panel

Right-side slide-over showing:

- Full prompt text in monospace `<pre>` block
- "Copy" button with "Copied!" confirmation

### 7.4 Export Button

"Export bundle" in the task graph toolbar:

- Fetches `GET /api/v1/plans/:planId/prompts/export`
- Downloads as `prompts-{sessionId[:8]}.json`
- "Exporting..." loading state
- Error banner on failure

---

## 8. API Routes Summary

| Method | Path                                             | Description                          |
| ------ | ------------------------------------------------ | ------------------------------------ |
| GET    | `/api/v1/plans/:planId/tasks`                    | Get task graph (generates if needed) |
| GET    | `/api/v1/plans/:planId/tasks?version=N`          | Get specific version of task graph   |
| GET    | `/api/v1/plans/:planId/tasks/:taskId/prompt`     | Get single prompt artifact           |
| GET    | `/api/v1/plans/:planId/prompts/export`           | Export full prompt bundle            |
| GET    | `/api/v1/plans/:planId/prompts/export?version=N` | Export prompts for specific version  |

---

## 9. Snapshot Tests

Three snapshot families guard against accidental regressions:

1. **Graph structure** — phase counts, type counts, status counts, dependency types (no UUIDs)
2. **Missing/insufficient shape** — structural summary of non-decomposable task outputs
3. **Prompt output** — heading structure, section lengths, total text length, raw sections object

Snapshots are intentionally structural (counts, lengths, headings) rather than raw text to avoid brittleness from formatting shifts.
