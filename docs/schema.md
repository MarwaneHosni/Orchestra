# Database Schema

## Entity-Relationship Overview

```
users ──< projects ──< ideas
                 │──< plans ──< phases ──< subphases
                 │──< answers >── questions
                 └──< generations
```

## Tables

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| email | `varchar(255)` | NOT NULL, UNIQUE |
| display_name | `varchar(100)` | NOT NULL |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |

### projects
| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| user_id | `uuid` | NOT NULL → users.id |
| name | `varchar(200)` | NOT NULL |
| description | `text` | NOT NULL, DEFAULT '' |
| status | `varchar(20)` | NOT NULL, DEFAULT 'draft' |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |

Indexes: `user_id`, `status`

### ideas
Stores the raw and refined description of a project idea. The `interview_data` column holds structured Q&A context for regeneration workflows.

| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| project_id | `uuid` | NOT NULL → projects.id |
| raw_description | `text` | NOT NULL |
| refined_description | `text` | |
| status | `varchar(20)` | NOT NULL, DEFAULT 'raw' |
| interview_data | `text` | JSON string for regeneration |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |

Indexes: `project_id`

### plans
Represents a generated plan version for a project. The `generation_parameters` column stores the AI provider, model, and prompt configuration used to produce the plan.

| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| project_id | `uuid` | NOT NULL → projects.id |
| version | `integer` | NOT NULL, DEFAULT 1 |
| status | `varchar(20)` | NOT NULL, DEFAULT 'generating' |
| generation_parameters | `text` | JSON string for reproducibility |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |

Indexes: `project_id`
Unique: `(project_id, version)`

### phases
One row per lifecycle phase within a plan. Follows the 12-phase SDLC model. The `content` column stores phase-specific generated output for later regeneration.

| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| plan_id | `uuid` | NOT NULL → plans.id |
| type | `varchar(30)` | NOT NULL |
| order | `integer` | NOT NULL |
| title | `varchar(200)` | NOT NULL |
| status | `varchar(20)` | NOT NULL, DEFAULT 'pending' |
| content | `text` | JSON string for regeneration |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |

Indexes: `(plan_id, order)`

### subphases
Individual tasks within a phase. The `ai_prompt` column holds the exact prompt sent to the AI agent. `acceptance_criteria` stores validation conditions. `dependency_ids` stores a serialized array of subphase UUIDs that must complete first.

| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| phase_id | `uuid` | NOT NULL → phases.id |
| order | `integer` | NOT NULL |
| title | `varchar(200)` | NOT NULL |
| status | `varchar(20)` | NOT NULL, DEFAULT 'pending' |
| ai_prompt | `text` | Prompt text for AI execution |
| acceptance_criteria | `text` | JSON array of criteria |
| dependency_ids | `text` | JSON array of UUIDs |
| created_at | `timestamptz` | NOT NULL, `now()` |
| updated_at | `timestamptz` | NOT NULL, `now()` |

Indexes: `(phase_id, order)`

### questions
Interview questions associated with lifecycle phase types. Used by the Interview Engine to refine raw ideas.

| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| phase_type | `varchar(30)` | NOT NULL |
| order | `integer` | NOT NULL |
| text | `text` | NOT NULL |
| type | `varchar(20)` | NOT NULL |
| options | `text` | JSON array for select types |
| created_at | `timestamptz` | NOT NULL, `now()` |

Indexes: `(phase_type, order)`

### answers
User answers to interview questions for a specific project.

| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| question_id | `uuid` | NOT NULL → questions.id |
| project_id | `uuid` | NOT NULL → projects.id |
| value | `text` | NOT NULL |
| created_at | `timestamptz` | NOT NULL, `now()` |

Indexes: `(question_id, project_id)`

### generations
Tracks every AI generation request. Stores prompt and result text for audit, debugging, and cost tracking.

| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, `gen_random_uuid()` |
| project_id | `uuid` | NOT NULL → projects.id |
| subphase_id | `uuid` | → subphases.id (nullable) |
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

## Versioning & Regeneration

The schema includes dedicated columns for versioning and regeneration support:

- **ideas.interview_data** — preserves the structured interview context so an idea can be re-interviewed or the requirements regenerated from scratch.
- **plans.generation_parameters** — records the AI model, provider, and prompt configuration used for a plan version, making regeneration identical if needed.
- **plans.version + plans_project_version_unique** — supports multiple plan iterations for the same project.
- **phases.content** — holds per-phase generated content so individual phases can be regenerated without re-running the entire plan.
- **subphases.ai_prompt** — the exact prompt executed by the AI agent, enabling replay and debugging.
- **subphases.acceptance_criteria** — validation rules tied to each task, enabling automated verification.
- **subphases.dependency_ids** — enables the dependency-aware task graph by storing prerequisite subphase IDs.
- **generations** — full audit trail of every AI interaction, including prompt, result, token counts, and model info.
