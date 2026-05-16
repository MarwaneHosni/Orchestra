# Version Lineage & Snapshot Rules

## Overview

Every project plan, task graph, blueprint, and generated output is versioned. Versions are append-only — no record is ever modified in place. This document defines the lineage rules that govern how versions relate to each other.

---

## 1. Entity Versioning Model

### 1.1 Versioned Entities

| Entity              | Version key                | Parent lineage                            | Immutable |
| ------------------- | -------------------------- | ----------------------------------------- | --------- |
| `plans`             | `(project_id, version)`    | —                                         | Yes       |
| `blueprints`        | `(plan_id, version)`       | `plans.version`                           | Yes       |
| `task_graphs`       | `(plan_id, graph_version)` | `plans.version` + `derived_from_graph_id` | Yes       |
| `project_snapshots` | `(project_id, version)`    | `parent_snapshot_id`                      | Yes       |
| `execution_tasks`   | `version` field            | `superseded_by_task_id`                   | Yes       |
| `prompt_artifacts`  | `version` field            | `execution_tasks.version`                 | Yes       |
| `activity_log`      | Append-only sequence       | —                                         | Always    |

### 1.2 Non-Versioned (Single State)

| Entity               | Rationale                                                          |
| -------------------- | ------------------------------------------------------------------ |
| `projects`           | Metadata-only. Historical states captured via `project_snapshots`. |
| `interview_sessions` | Lifecycle captured by status transitions in `activity_log`.        |
| `answers`            | Individual answers carry `version` + `isLatest` for edit history.  |

---

## 2. Version Lineage Rules

### 2.1 Plan → Blueprint → Task Graph → Prompts

```
Project created
  │
  ├── Plan v1 ── Blueprint v1 ── TaskGraph v1 ── Prompts v1
  │
  └── Plan v2 (derived) ── Blueprint v2 ── TaskGraph v2 (derived_from=v1) ── Prompts v2
```

- `task_graphs.derived_from_graph_id` points to the previous task graph version when regenerated
- `project_snapshots.parent_snapshot_id` points to the previous snapshot when a new one is taken
- `execution_tasks.superseded_by_task_id` points to the replacement task when an individual task is superseded

### 2.2 Snapshot Creation Triggers

| Trigger                      | New entities created                                                     | Lineage                    |
| ---------------------------- | ------------------------------------------------------------------------ | -------------------------- |
| Project created              | `project_snapshots v1`                                                   | No parent                  |
| Interview completed          | `project_snapshots v2`                                                   | parent=v1                  |
| Plan generated               | `plans v1` + `blueprints v1` + `project_snapshots v3`                    | parent=v2                  |
| Plan regenerated             | `plans v2` + `blueprints v2` + `task_graphs v2` + `project_snapshots v4` | parent=v3, derived_from=v1 |
| Task graph regenerated alone | `task_graphs v2` + `project_snapshots v5`                                | derived_from=v1            |

### 2.3 Version Immutability

Once created with status `complete` or `failed`, a versioned record's content must not change:

- `plans.content` is immutable after `complete`
- `blueprints.content` is immutable after `complete`
- `task_graphs.taskCount`, `dependencyCount`, `failureReason` are immutable after `complete` or `failed`
- `project_snapshots` are always immutable (append-only)
- `activity_log` is always append-only (never deleted)

The `updatedAt` timestamp may change only for metadata transitions (e.g., `generating` → `complete`).

---

## 3. Snapshot Semantics

### 3.1 Full vs. Partial Snapshots

`project_snapshots` can represent both:

- **Full snapshot**: All reference fields populated (planId, blueprintId, taskGraphId, interviewSessionId, answerCount). Created after interview completion or plan generation.
- **Partial snapshot**: Only some reference fields populated. Created mid-interview or after phase edits when not all artifacts exist yet.

The `reason` field distinguishes the two cases:

- `initial`, `interview_complete`, `plan_regenerated` → likely full
- `phase_edited`, `manual` → may be partial

### 3.2 Affected Phase Tracking

For partial/incremental snapshots, `affected_phase_types` stores a JSON array of phase type strings identifying exactly which phases were modified:

```
["architecture", "security"]    → only Architecture and Security phases changed
["backend", "frontend"]         → Backend and Frontend phases were re-answered
null                              → full snapshot, all phases potentially affected
```

This enables downstream queries like "find all snapshots that modified the Database phase" without parsing free-text descriptions.

### 3.2 Change Summary

The `change_summary` field is a human-readable description of what changed between the current snapshot and its parent. Examples:

```
"Plan regenerated from v1 to v2: 3 answers edited in Architecture phase"
"Task graph regenerated: 20 tasks, 19 dependencies (was 18 tasks, 17 deps)"
"Interview completed: 48 answers across 12 phases"
```

---

## 4. Retention Policy

### 4.1 Default Retention

| Entity              | Retention                 | Rationale                                                                                        |
| ------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| `project_snapshots` | All versions kept         | Lightweight (references only, ~200 bytes each)                                                   |
| `plans`             | All versions kept         | Unique constraint prevents overwrite                                                             |
| `blueprints`        | All versions kept         | Unique constraint per plan version                                                               |
| `task_graphs`       | All versions kept         | Lightweight (summary row, tasks stored elsewhere)                                                |
| `activity_log`      | All entries kept          | Append-only, ~100 bytes per entry. Consider archival after 12 months for high-activity projects. |
| `execution_tasks`   | Last 10 versions per task | Older versions can be archived                                                                   |
| `prompt_artifacts`  | Last 10 versions per task | Older versions can be archived                                                                   |

### 4.2 Cleanup Rules

- No automatic deletion. Retention is enforced at the application layer, not via cascading deletes.
- A manual archive operation can move records older than 12 months to a `_archived` schema or cold storage.
- Snapshot records are never deleted — they form the immutable project timeline.

---

## 5. Compare & Export Support

The version model supports future compare/export features through these patterns:

| Operation                         | Query pattern                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| Compare two snapshots             | `SELECT * FROM project_snapshots WHERE project_id = $1 AND version IN (v1, v2)`        |
| List all versions of a task graph | `SELECT * FROM task_graphs WHERE plan_id = $1 ORDER BY graph_version`                  |
| Get full state at snapshot        | Follow references: snapshot → plan → blueprint → task_graph                            |
| Export version bundle             | Snapshot + plan + blueprint + task_graph + prompts for a given `(project_id, version)` |
| Timeline query                    | `SELECT * FROM activity_log WHERE project_id = $1 ORDER BY created_at DESC LIMIT 50`   |
