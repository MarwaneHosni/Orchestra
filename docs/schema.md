# Database Schema

## Entity-Relationship Overview

```
users ──< projects ──< ideas
                  │──< plans ──< phases ──< subphases
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

## Domain Model Summary

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
