# Decision 008: Planning Engine Data Model

**Date:** 2026-05-15

## Context

Phase 2 of the project requires defining the core planning-engine data model and storage contracts needed to support idea intake, interviews, answers, draft plans, and regenerated outputs. This builds on the 9-table foundation from Phase 1.

## Decisions

### New Entities (5 tables)

| Table                  | Purpose                                                                                                                                           | Key Relationships   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **interview_sessions** | Groups answers into a structured interview flow per project. Supports draft status for reopening and resuming.                                    | → projects          |
| **assumptions**        | Assumptions captured during planning, tagged to lifecycle phases. Includes confidence and provenance tracking.                                    | → projects          |
| **constraints**        | Constraints across technical, business, time, resource, and legal categories. Supports severity grading and provenance.                           | → projects          |
| **risks**              | Risks with likelihood, impact, and mitigation strategy. Supports status tracking through the risk lifecycle.                                      | → projects          |
| **blueprints**         | Generated plan output artifact linked to a specific plan version. Supports versioned regeneration across multiple formats (json, yaml, markdown). | → plans, → projects |

### Modified Entities (2 tables)

| Table       | Changes                                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **answers** | Added `interview_session_id` (FK → interview_sessions.id) to associate answers with sessions. Added `confidence` (high/medium/low) and `provenance` (user/ai_suggested/ai_generated) for ambiguity metadata. |
| **ideas**   | Added `provenance` column to track whether the idea was entered by the user or generated/refined by AI.                                                                                                      |

### Unchanged Entities (7 tables)

users, projects, questions, plans, phases, subphases, generations — all retain their Phase 1 schema.

### Draft & Reopening Support

- `interview_sessions.status` uses a `draft → in_progress → complete` lifecycle. Draft sessions can be reopened and resumed.
- `answers.confidence` lets users mark uncertainty, enabling the planning engine to flag ambiguous inputs for follow-up.
- `answers.provenance` distinguishes user-entered, AI-suggested, and AI-generated answers, supporting partial regeneration workflows.

### Versioning & Regeneration

- `plans(project_id, version)` unique constraint preserves prior plan versions.
- `blueprints(plan_id, version)` unique constraint keeps generated outputs tied to their plan version.
- The `generations` table provides a full audit trail for every AI call (provider, model, tokens, prompt, result), enabling replay and debugging.
- `ideas.interview_data` stores the structured interview context for regeneration reproducibility.

### Provenance & Confidence Metadata

Applied consistently across new and modified entities:

- **provenance**: `user` | `ai_suggested` | `ai_generated` — tracks the origin of each data point.
- **confidence**: `high` | `medium` | `low` — captures certainty where ambiguity exists.
- These fields enable the planning engine to make informed decisions about which inputs need human review vs. which can be processed autonomously.

## Frozen Assumptions

- Interview sessions are linked to a single project. A project may have multiple interview sessions over time (e.g., for different planning iterations), but active planning uses the most recent complete session.
- Blueprints are generated per plan version. Each plan version has at most one blueprint (enforced by unique constraint). Regenerating produces a new plan version with a new blueprint.
- Assumptions, constraints, and risks are scoped to a project and tagged to a phase_type. They are not directly tied to a specific plan version — they persist across plan iterations as contextual knowledge.
- The `generations` table remains the sole audit trail for AI calls. Blueprints reference plan versions, not generation IDs, keeping the audit and artifact models decoupled.

## Status

Accepted.
