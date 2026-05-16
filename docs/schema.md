# Database Schema

## Entity-Relationship Overview

```
users ──< projects ──< ideas
                  │──< plans ──< phases ──< subphases
                  │             │
                  │             ├──< execution_tasks ──< task_dependencies
                  │             │         │
                  │             │         ├──< prompt_artifacts
                  │             │         └──< generation_versions
                  │──< interview_sessions ──< answers >── questions
                  │──< assumptions
                  │──< constraints
                  │──< risks
                  │──< blueprints >── plans
                  └──< generations
```

## Tables — 14 total

### users

| Column       | Type           | Constraints             |
| ------------ | -------------- | ----------------------- |
| id           | `uuid`         | PK, `gen_random_uuid()` |
| email        | `varchar(255)` | NOT NULL, UNIQUE        |
| display_name | `varchar(100)` | NOT NULL                |
| created_at   | `timestamptz`  | NOT NULL, `now()`       |
| updated_at   | `timestamptz`  | NOT NULL, `now()`       |

### projects

| Column      | Type           | Constraints               |
| ----------- | -------------- | ------------------------- |
| id          | `uuid`         | PK, `gen_random_uuid()`   |
| user_id     | `uuid`         | NOT NULL → users.id       |
| name        | `varchar(200)` | NOT NULL                  |
| description | `text`         | NOT NULL, DEFAULT ''      |
| status      | `varchar(20)`  | NOT NULL, DEFAULT 'draft' |
| created_at  | `timestamptz`  | NOT NULL, `now()`         |
| updated_at  | `timestamptz`  | NOT NULL, `now()`         |

Indexes: `user_id`, `status`

### ideas

| Column              | Type          | Constraints                  |
| ------------------- | ------------- | ---------------------------- |
| id                  | `uuid`        | PK, `gen_random_uuid()`      |
| project_id          | `uuid`        | NOT NULL → projects.id       |
| raw_description     | `text`        | NOT NULL                     |
| refined_description | `text`        |                              |
| status              | `varchar(20)` | NOT NULL, DEFAULT 'raw'      |
| interview_data      | `text`        | JSON string for regeneration |
| provenance          | `varchar(20)` | NOT NULL, DEFAULT 'user'     |
| created_at          | `timestamptz` | NOT NULL, `now()`            |
| updated_at          | `timestamptz` | NOT NULL, `now()`            |

Indexes: `project_id`

### interview_sessions

Groups answers into a structured interview flow for a project. Supports draft status for reopening.
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| project_id | `uuid` | NOT NULL → projects.id |
| status | `varchar(20)` | NOT NULL, DEFAULT 'draft' |
| started_at | `timestamptz` | NOT NULL, `now()` |
| completed_at | `timestamptz` | |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |
Indexes: `project_id`

### questions

| Column     | Type          | Constraints                 |
| ---------- | ------------- | --------------------------- |
| id         | `uuid`        | PK, `gen_random_uuid()`     |
| phase_type | `varchar(30)` | NOT NULL                    |
| order      | `integer`     | NOT NULL                    |
| text       | `text`        | NOT NULL                    |
| type       | `varchar(20)` | NOT NULL                    |
| options    | `text`        | JSON array for select types |
| created_at | `timestamptz` | NOT NULL, `now()`           |

Indexes: `(phase_type, order)`

### answers

Includes provenance and confidence metadata for later replay and ambiguity tracking.
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| question_id | `uuid` | NOT NULL → questions.id |
| project_id | `uuid` | NOT NULL → projects.id |
| interview_session_id | `uuid` | → interview_sessions.id |
| value | `text` | NOT NULL |
| confidence | `varchar(10)` | NOT NULL, DEFAULT 'medium' |
| provenance | `varchar(15)` | NOT NULL, DEFAULT 'user' |
| created_at | `timestamptz` | NOT NULL, `now()` |
Indexes: `(question_id, project_id)`, `interview_session_id`

### plans

Versioned plan per project. Supports multiple generations.
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| project_id | `uuid` | NOT NULL → projects.id |
| version | `integer` | NOT NULL, DEFAULT 1 |
| status | `varchar(20)` | NOT NULL, DEFAULT 'generating' |
| generation_parameters | `text` | JSON for reproducibility |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |
Indexes: `project_id`
Unique: `(project_id, version)`

### phases

| Column     | Type           | Constraints                 |
| ---------- | -------------- | --------------------------- |
| id         | `uuid`         | PK, `gen_random_uuid()`     |
| plan_id    | `uuid`         | NOT NULL → plans.id         |
| type       | `varchar(30)`  | NOT NULL                    |
| order      | `integer`      | NOT NULL                    |
| title      | `varchar(200)` | NOT NULL                    |
| status     | `varchar(20)`  | NOT NULL, DEFAULT 'pending' |
| content    | `text`         | JSON for regeneration       |
| created_at | `timestamptz`  | NOT NULL, `now()`           |
| updated_at | `timestamptz`  | NOT NULL, `now()`           |

Indexes: `(plan_id, order)`

### subphases

| Column              | Type           | Constraints                 |
| ------------------- | -------------- | --------------------------- |
| id                  | `uuid`         | PK, `gen_random_uuid()`     |
| phase_id            | `uuid`         | NOT NULL → phases.id        |
| order               | `integer`      | NOT NULL                    |
| title               | `varchar(200)` | NOT NULL                    |
| status              | `varchar(20)`  | NOT NULL, DEFAULT 'pending' |
| ai_prompt           | `text`         | Prompt for AI execution     |
| acceptance_criteria | `text`         | JSON array of criteria      |
| dependency_ids      | `text`         | JSON array of UUIDs         |
| created_at          | `timestamptz`  | NOT NULL, `now()`           |
| updated_at          | `timestamptz`  | NOT NULL, `now()`           |

Indexes: `(phase_id, order)`

### blueprints

Generated plan output artifact, linked to a specific plan version. Supports versioned regeneration and multiple formats.
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| plan_id | `uuid` | NOT NULL → plans.id |
| project_id | `uuid` | NOT NULL → projects.id |
| content | `text` | NOT NULL |
| format | `varchar(10)` | NOT NULL, DEFAULT 'markdown' |
| version | `integer` | NOT NULL, DEFAULT 1 |
| status | `varchar(15)` | NOT NULL, DEFAULT 'generating' |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |
Indexes: `plan_id`, `project_id`
Unique: `(plan_id, version)`

### assumptions

Captured assumptions during planning, tagged to lifecycle phases.
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| project_id | `uuid` | NOT NULL → projects.id |
| phase_type | `varchar(30)` | NOT NULL |
| description | `text` | NOT NULL |
| confidence | `varchar(10)` | NOT NULL, DEFAULT 'medium' |
| status | `varchar(15)` | NOT NULL, DEFAULT 'active' |
| provenance | `varchar(20)` | NOT NULL, DEFAULT 'user' |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |
Indexes: `project_id`

### constraints

Identified constraints across technical, business, time, resource, and legal categories.
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| project_id | `uuid` | NOT NULL → projects.id |
| phase_type | `varchar(30)` | NOT NULL |
| description | `text` | NOT NULL |
| type | `varchar(15)` | NOT NULL, DEFAULT 'technical' |
| severity | `varchar(10)` | NOT NULL, DEFAULT 'major' |
| provenance | `varchar(20)` | NOT NULL, DEFAULT 'user' |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |
Indexes: `project_id`

### risks

Identified risks with likelihood, impact, and mitigation strategy.
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| project_id | `uuid` | NOT NULL → projects.id |
| phase_type | `varchar(30)` | NOT NULL |
| description | `text` | NOT NULL |
| likelihood | `varchar(10)` | NOT NULL, DEFAULT 'medium' |
| impact | `varchar(10)` | NOT NULL, DEFAULT 'medium' |
| mitigation | `text` | |
| status | `varchar(15)` | NOT NULL, DEFAULT 'identified' |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |
Indexes: `project_id`

### generations

Audit trail for every AI generation call. Tracks provider, model, token usage, prompt, and result.
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| project_id | `uuid` | NOT NULL → projects.id |
| subphase_id | `uuid` | → subphases.id |
| type | `varchar(20)` | NOT NULL |
| provider | `varchar(50)` | NOT NULL |
| model | `varchar(100)` | NOT NULL |
| input_tokens | `integer` | NOT NULL, DEFAULT 0 |
| output_tokens | `integer` | NOT NULL, DEFAULT 0 |
| status | `varchar(20)` | NOT NULL |
| prompt_text | `text` | Sent to the AI |
| result_text | `text` | Response from the AI |
| created_at | `timestamptz` | NOT NULL, `now()` |
Indexes: `project_id`, `type`

### provider_credentials

Stores encrypted AI provider API keys and metadata. The `encrypted_api_key` and `key_reference` fields are
never returned by standard API responses — only the metadata fields are exposed.
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| user_id | `uuid` | NOT NULL → users.id |
| project_id | `uuid` | → projects.id (nullable — null = user-level) |
| provider | `varchar(50)` | NOT NULL |
| display_name | `varchar(100)` | NOT NULL |
| status | `varchar(20)` | NOT NULL, DEFAULT 'unverified' |
| encrypted_api_key | `text` | AES-256-GCM encrypted blob (nullable) |
| key_reference | `text` | External vault reference (nullable) |
| default_model | `varchar(100)` | Preferred model ID |
| models_available | `text` | JSON array of available model IDs |
| last_verified_at | `timestamptz` | Last successful validation |
| error_message | `text` | Last validation error |
| metadata | `text` | Provider-specific JSON config |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |
Indexes: `user_id`, `project_id`, `provider`

### execution_tasks

Individual units of work within a plan. Linked to phases and subphases. Supports versioned regeneration via `superseded_by_task_id`.
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| plan_id | `uuid` | NOT NULL → plans.id |
| phase_id | `uuid` | → phases.id |
| subphase_id | `uuid` | → subphases.id |
| parent_task_id | `uuid` | → execution_tasks.id (task grouping) |
| title | `varchar(200)` | NOT NULL |
| description | `text` | |
| type | `varchar(20)` | NOT NULL, DEFAULT 'other' |
| priority | `varchar(10)` | NOT NULL, DEFAULT 'medium' |
| status | `varchar(15)` | NOT NULL, DEFAULT 'pending' |
| order | `integer` | NOT NULL, DEFAULT 0 |
| version | `integer` | NOT NULL, DEFAULT 1 |
| superseded_by_task_id | `uuid` | Regeneration lineage |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |
Indexes: `plan_id`, `phase_id`, `status`

### task_dependencies

First-class dependency edges between tasks. Never flattened into JSON — always stored as individual records.
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| task_id | `uuid` | NOT NULL → execution_tasks.id |
| depends_on_task_id | `uuid` | NOT NULL → execution_tasks.id |
| dependency_type | `varchar(15)` | NOT NULL, DEFAULT 'blocks' |
| created_at | `timestamptz` | NOT NULL, `now()` |
Indexes: `task_id`, `depends_on_task_id`

### prompt_artifacts

The prompt sent to an AI provider for a task and the result received. Versioned for regeneration tracking.
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| task_id | `uuid` | NOT NULL → execution_tasks.id |
| prompt_text | `text` | NOT NULL |
| result_text | `text` | |
| version | `integer` | NOT NULL, DEFAULT 1 |
| status | `varchar(10)` | NOT NULL, DEFAULT 'pending' |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |
Indexes: `task_id`

### generation_versions

Audit trail for task regeneration events. Links new versions back to the plan context.
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| task_id | `uuid` | NOT NULL → execution_tasks.id |
| plan_id | `uuid` | NOT NULL → plans.id |
| version | `integer` | NOT NULL, DEFAULT 1 |
| changes_summary | `text` | |
| created_at | `timestamptz` | NOT NULL, `now()` |
Indexes: `task_id`, `plan_id`

## Domain Model Summary

### Task Lineage & Regeneration

```
Plan v1 ──< execution_tasks (version=1)
                │
                ├── If task is regenerated:
                │   task.version = 2
                │   task.superseded_by_task_id → new task row
                │   generation_versions records the event
                │
                ├── Dependency edges → task_dependencies
                ├── AI prompts/results → prompt_artifacts
                └── Dependent tasks check status before starting

Regeneration preserves version history:
  execution_tasks (v1, id=A) ──superseded_by──► execution_tasks (v2, id=B)
                                                      │
                                                      └── prompt_artifacts (v2)
                                                      └── generation_versions (v2)
```

### Planning Workflow

```
User enters idea
       │
       ▼
  Projects.created ───► Ideas.raw_description
       │
       ▼
  InterviewSessions.created (status: draft)
       │  Questions presented in order by phase_type
       │  Answers recorded with provenance + confidence
       ▼
  InterviewSessions.status → complete
       │
       ├──► Plans created (versioned)
       │       │
       │       ├──► Phases generated (12 lifecycle steps)
       │       │       │
       │       │       └──► SubPhases with dependency_ids, ai_prompt
       │       │
       │       └──► Blueprints generated (per plan version)
       │
       ├──► Assumptions captured (per phase_type)
       ├──► Constraints captured (per phase_type)
       └──► Risks captured (per phase_type)

  Each AI call → Generations row (provider, model, tokens, prompt, result)
```

### Draft & Reopening

- **interview_sessions.status**: `draft` → an interview can be resumed. `in_progress` → actively being answered. `complete` → finished and used for plan generation.
- **plans.version**: incremented each time a plan is regenerated. Prior versions and their blueprints are preserved.
- **answers.provenance**: tracks whether the answer came from the user directly, was AI-suggested and confirmed, or was AI-generated autonomously.
- **answers.confidence**: allows the user to mark their certainty about an answer, supporting ambiguity-aware planning.

### Versioning & Regeneration

- **plans(project_id, version)** unique constraint prevents overwriting prior plan versions.
- **blueprints(plan_id, version)** unique constraint keeps generated outputs tied to their plan version.
- **generations** provides a full audit trail of every AI interaction, enabling replay and debugging.
- **ideas.interview_data** stores the full structured interview context so regeneration can reproduce the same input.
- **plans.generation_parameters** stores the AI configuration used for each plan version.

---

## New Tables — Phase 6 (Snapshot / Lineage)

### task_graphs

Persistent storage for generated task graphs. Replaces the in-memory-only `GraphStore`.

| Column                | Type          | Constraints                    |
| --------------------- | ------------- | ------------------------------ |
| id                    | `uuid`        | PK, `gen_random_uuid()`        |
| plan_id               | `uuid`        | NOT NULL → plans.id            |
| project_id            | `uuid`        | NOT NULL → projects.id         |
| plan_version          | `integer`     | NOT NULL                       |
| graph_version         | `integer`     | NOT NULL, DEFAULT 1            |
| derived_from_graph_id | `uuid`        | → task_graphs.id (lineage)     |
| status                | `varchar(15)` | NOT NULL, DEFAULT 'generating' |
| task_count            | `integer`     | NOT NULL, DEFAULT 0            |
| dependency_count      | `integer`     | NOT NULL, DEFAULT 0            |
| failure_reason        | `text`        | Set when status = 'failed'     |
| metadata              | `text`        | JSON for generation params     |
| created_at            | `timestamptz` | NOT NULL, `now()`              |
| updated_at            | `timestamptz` | NOT NULL, `now()`              |

Unique: `(plan_id, graph_version)`
Indexes: `plan_id`, `project_id`

### project_snapshots

Frozen point-in-time records for a project. Each snapshot captures which plan, blueprint, task graph, and interview session constitute the project state at that moment.

| Column               | Type          | Constraints                                                       |
| -------------------- | ------------- | ----------------------------------------------------------------- |
| id                   | `uuid`        | PK, `gen_random_uuid()`                                           |
| project_id           | `uuid`        | NOT NULL → projects.id                                            |
| version              | `integer`     | NOT NULL (increments per project)                                 |
| parent_snapshot_id   | `uuid`        | → project_snapshots.id (lineage)                                  |
| reason               | `varchar(30)` | NOT NULL — see `projectSnapshotReasons`                           |
| status               | `varchar(15)` | NOT NULL, DEFAULT 'creating'                                      |
| plan_id              | `uuid`        | → plans.id (nullable)                                             |
| plan_version         | `integer`     | Snapshot of plan version (nullable)                               |
| blueprint_id         | `uuid`        | → blueprints.id (nullable)                                        |
| task_graph_id        | `uuid`        | → task_graphs.id (nullable)                                       |
| interview_session_id | `uuid`        | → interview_sessions.id (nullable)                                |
| answer_count         | `integer`     | NOT NULL, DEFAULT 0                                               |
| affected_phase_types | `text`        | JSON array of affected phases, e.g. `["architecture","security"]` |
| change_summary       | `text`        | Human-readable description                                        |
| metadata             | `text`        | JSON extensible metadata                                          |
| created_at           | `timestamptz` | NOT NULL, `now()`                                                 |

Indexes: `project_id`, `(project_id, version)` unique, `parent_snapshot_id`

**Snapshot reasons:**

| Reason                   | When created                                |
| ------------------------ | ------------------------------------------- |
| `initial`                | Project first created                       |
| `interview_complete`     | All interview questions answered            |
| `plan_regenerated`       | Plan regenerated from edited answers        |
| `phase_edited`           | Individual answers edited mid-interview     |
| `task_graph_regenerated` | Task graph regenerated for new plan version |
| `manual`                 | Explicit user-triggered snapshot            |

### activity_log

Append-only timeline of events for a project. Lightweight — each record is a typed event with references and a description string.

| Column      | Type          | Constraints                           |
| ----------- | ------------- | ------------------------------------- |
| id          | `uuid`        | PK, `gen_random_uuid()`               |
| project_id  | `uuid`        | NOT NULL → projects.id                |
| event_type  | `varchar(30)` | NOT NULL — see `activityEventTypes`   |
| session_id  | `uuid`        | Loose reference to interview_sessions |
| plan_id     | `uuid`        | Loose reference to plans              |
| snapshot_id | `uuid`        | → project_snapshots.id (nullable)     |
| description | `text`        | NOT NULL                              |
| metadata    | `text`        | JSON event-specific data              |
| created_at  | `timestamptz` | NOT NULL, `now()`                     |

Indexes: `project_id`, `event_type`, `created_at`, `(project_id, created_at)`

**Event types:**

| Event                    | Meaning                             |
| ------------------------ | ----------------------------------- |
| `project.created`        | Project record created              |
| `interview.started`      | Interview session started           |
| `interview.completed`    | All questions answered              |
| `answer.submitted`       | Individual answer recorded          |
| `answer.edited`          | Previously submitted answer changed |
| `plan.generated`         | Initial plan generated              |
| `plan.regenerated`       | Plan re-generated (new version)     |
| `blueprint.generated`    | Blueprint output produced           |
| `task_graph.generated`   | Tasks decomposed from plan          |
| `task_graph.regenerated` | Tasks re-decomposed (new version)   |
| `prompts.exported`       | Prompt bundle exported              |
| `snapshot.created`       | Project snapshot taken              |
| `phase.insufficient`     | Phase marked as needing more detail |
| `phase.missing`          | Phase has no input                  |
| `generation.failed`      | AI generation call failed           |

### prompt_artifacts (modified)

Extended from Phase 2 with failure tracking:

New columns: `failure_reason` (`text`), `status` widened to `varchar(15)`.

| Status         | Meaning                          |
| -------------- | -------------------------------- |
| `pending`      | Prompt created but not yet sent  |
| `complete`     | Prompt sent and result received  |
| `failed`       | Assembly validation failed       |
| `needs_review` | Assembly passed but has warnings |
