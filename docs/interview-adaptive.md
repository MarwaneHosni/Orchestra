# Adaptive Interview Architecture

## Overview

The interview system has three modes of operation, each with different question counts, validation strictness, and depth. The mode is selected at session creation and can be refined post-generation.

## Interview Modes

| Mode | Questions asked | Question categories | Generation readiness | Best for |
|---|---|---|---|---|
| **Quick** | 10–18 | critical, high-value, contextual | Fast (3–7 min) | New users, simple projects, prototyping |
| **Advanced** | 14–24 | critical, high-value, optional, contextual | Standard (5–10 min) | Users who want thorough coverage |
| **Refinement** | 0–17 | optional, advanced-only, derivable confirmations | Post-generation | Filling gaps after initial plan |

## Decision Flow

```
Session created with mode = "quick" | "advanced"
  │
  ▼
AdaptiveEngine.getNextQuestion({ mode, answeredIds, answers })
  │
  ├── Question is critical/high-value → ALWAYS ASK
  ├── Question is optional:
  │     ├── mode=quick → SKIP (reason: quick_mode_skip_optional)
  │     └── mode=advanced → ASK
  ├── Question is contextual:
  │     ├── gate not satisfied → SKIP (reason: gate_not_satisfied)
  │     └── gate satisfied → ASK
  ├── Question is derivable → SKIP (reason: derivable_ai_inferred)
  └── Question is advanced-only → SKIP (reason: advanced_only_deferred)
  │
  ▼
All eligible questions answered → status = ready_for_generation
  │
  ▼
[AI Generation]
  │
  ▼
Post-generation refinement available:
  ├── Derivable confirmations (12): "We assumed X — correct?"
  ├── Optional questions (6): user can answer to enrich plan
  └── Advanced-only questions (5): user can answer for depth
```

## Adaptive Engine

The adaptive engine (`lib/interview/adaptive-engine.ts`) decides which questions to ask next based on:

1. **Mode** — Quick vs Advanced determines which categories are eligible
2. **Gate dependencies** — Contextual questions only shown when gate condition met
3. **Answer state** — Already-answered questions are skipped
4. **Category priority** — Critical > High-value > Optional

### Key Functions

```typescript
getNextQuestion(config: AdaptiveConfig): AdaptiveResult
  // Returns the next unanswered eligible question, or null if all answered
  // Fields: nextQuestion, eligibleCount, answeredCount, allAnswered, skippedCategories

getEligibleQuestions(answers, mode): QuestionDefinition[]
  // Returns all questions eligible for the current mode, filtered by gate status

getRefinementQuestions(answers, answeredIds): QuestionDefinition[]
  // Returns all questions that were skipped (derivable, advanced-only, optional in quick mode)

shouldSkip(q, answers, mode): { skip: boolean, reason?: string }
  // Determines if a specific question should be skipped based on mode, category, and gate status
```

## State Machine

```
                    ┌──────────────────────────────────┐
                    │           draft                   │
                    └────────┬─────────────────────────┘
                             │ start
                             ▼
                    ┌──────────────────────────────────┐
              ┌─────│        in_progress               │◄────┐
              │     └────────┬─────────────────────────┘     │
              │              │ present question              │
              │              ▼                               │
              │     ┌──────────────────────────────────┐     │
              │     │     waiting_for_answers           │─────┘
              │     └────────┬─────────────────────────┘  submit answer
              │              │ all eligible answered
              │              ▼
              │     ┌──────────────────────────────────┐
              │     │    ready_for_generation           │
              │     └────────┬─────────────────────────┘
              │              │ generate plan
              │              ▼
              │     ┌──────────────────────────────────┐
              │     │         completed                 │
              │     └────────┬─────────────────────────┘
              │              │ user enters refinement
              │              ▼
              │     ┌──────────────────────────────────┐
              │     │        refining                   │────► completed
              │     └────────┬─────────────────────────┘
              │              │ answer refinement questions
              │              ▼
              │     ┌──────────────────────────────────┐
              └─────│        in_progress               │ (re-enter for more questions)
                    └──────────────────────────────────┘
```

## Quick Mode Specification

### What changes

| Aspect | Quick | Advanced |
|---|---|---|
| Question count | 10–18 (avg 14) | 14–24 (avg 20) |
| Optional questions | Skipped | Shown |
| Derivable questions | Skipped (AI infers) | Skipped (AI infers) |
| Advanced-only | Deferred | Deferred |
| Generation quality | Good for common patterns | Better for edge cases |
| Time to complete | 3–7 minutes | 5–10 minutes |
| Refinement needed | Recommended | Optional |

### When to use Quick Mode

- User wants to generate a quick plan to validate their idea
- Project is well-understood by the user (not exploratory)
- User has a tight deadline or low patience
- The 12 derivable questions can be safely defaulted

### What Quick Mode does NOT sacrifice

- All `critical` and `high-value` questions are still asked
- All `captureAs` questions are still asked (constraints, assumptions, risks)
- AI still sees all answered data via `buildAnalysisMessage()`
- Post-generation refinement catches any missed details

## Post-Generation Refinement

After a plan is generated, the session enters `refining` status. The user can:

1. **Confirm derivations** (12 items)
   - "We assumed this is a new product. Correct?"
   - "We estimated ~10GB data volume. Correct?"
   - Each confirmation or correction triggers a partial regeneration

2. **Answer skipped optional questions** (6 items)
   - `ideation.5` (differentiators)
   - `requirements.4` (user roles)
   - `architecture.4` (read/write ratio)
   - `security.4` (security concerns)
   - `backend.4` (multi-tenancy)
   - `frontend.3` (i18n/a11y)
   - `deployment.3` (deploy frequency)

3. **Answer advanced-only questions** (5 items)
   - `requirements.6` (integrations)
   - `database.3` (query patterns)
   - `core-features.3` (third-party assumptions)
   - `testing.3` (performance benchmarks)
   - `monitoring.3` (operational risks)

## API Changes

### Creating a session with mode

```
POST /api/v1/interviews/:id/start
Body: { "mode": "quick" | "advanced" }
→ { sessionId, status, mode }

POST /api/v1/projects/:projectId/interviews
Body: { "mode": "quick" | "advanced" }
→ { sessionId, status, mode }
```

### Transitioning to refinement

```
POST /api/v1/interviews/:id/transition
Body: { "toStatus": "refining" }
→ { sessionId, status: "refining" }
```

### Getting refinement questions

```
GET /api/v1/interviews/:id/refinement
→ { questions: [...], skippedCategories: [...] }
```
