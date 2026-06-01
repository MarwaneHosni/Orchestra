# Implementation Roadmap: Redesigned Interview System

## State Management Design

### Current State
- `SessionRecord` tracks: `status`, `currentPhaseIndex`, `currentQuestionIndex`, `mode`
- `AnswerRecord` tracks: `questionId`, `value`, `confidence`, `provenance`, `version`
- Answers have `isLatest` boolean for versioning
- `getLatestAnswersBySession()` returns only `isLatest === true` answers

### Skipped Answer Handling
Questions are "skipped" when submitted with an empty string value:
- The `submitAnswer` handler records the empty value as a regular `AnswerRecord`
- The answer's `confidence` is set to the user's reported confidence (defaults to `"high"`)
- The `provenance` is `"user"` (the user chose to skip, the system didn't infer)
- Skipped answers are indistinguishable from regular answers at the data level — only the empty `value` distinguishes them

### Inferred Answer Storage
When the inference engine produces values for `derivable` questions:
- Inferred values are stored in `AdaptiveResult.inferences[]` (not persisted to the answer store)
- During generation, the AI receives both user-entered answers AND inferred values
- After generation, the user can confirm or correct each inference
- Confirmed inferences are persisted as `AnswerRecord` with `provenance: "inferred"` and `confidence: "medium"`

### Partial Interview Recovery
Partial recovery is handled by the existing flow:
- `GET /api/v1/interviews/:id/resume` returns the session state + answers + next question
- The session's `currentPhaseIndex` and `currentQuestionIndex` persist between requests
- `getNextQuestion()` resumes from the last unanswered question
- Status `"draft" | "in_progress" | "waiting_for_answers"` indicates partial completion
- No changes needed — the existing mechanism already supports this

## Analytics Implementation

### Metrics Added

| Metric | Type | Labels | When emitted |
|---|---|---|---|
| `interview_actions_total` | Counter | `action`, `release` | start, question_answered, question_skipped, abandoned, completed, quick_mode_used, advanced_mode_used |
| `interview_duration_minutes` | Histogram | `mode`, `release` | On generation (completed interview) |
| `interview_skipped_questions` | Histogram | `release` | On generation |
| `interview_quick_mode_total` | Counter | `action`, `release` | When Quick Mode session starts |

### Existing Metrics Already in Place

| Metric | Source | What it measures |
|---|---|---|
| `generation_funnel_total` | `orchestration.service.ts` | attempted → completed → failed |
| `generation_phases_per_run` | `orchestration.service.ts` | Phase count per generation |
| `generation_failures_by_category` | `orchestration.service.ts` | Failure categorization |

### Logging Events

The `orchestration.service.ts` already logs structured JSON events:
- `project.created` — with mode
- `session.ready_for_generation` — with question counts
- `answer.submitted` — with skipped flag, length
- `blueprint.generation_started`, `blueprint.generated`, `blueprint.generation_failed`
- `ambiguity.detected`

## Files Modified

### API Layer

| File | What changed |
|---|---|
| `lib/metrics/instrumentation.ts` | Added 4 interview metric functions |
| `lib/metrics/index.ts` | Exports new metrics |
| `lib/orchestration/orchestration.service.ts` | Instrumented `createProject` with mode tracking, `submitAnswer` with skip/answer distinction |
| `lib/interview/adaptive-engine.ts` | Extended `AdaptiveResult` with inferences, contradictions, followUps |
| `lib/interview/inference-engine.ts` | NEW — 11 inference rules |
| `lib/interview/contradiction-detector.ts` | NEW — 5 contradiction rules |
| `lib/interview/freeform-extractor.ts` | NEW — freeform text extraction |
| `lib/interview/types.ts` | Added `InterviewMode`, `"refining"` status, `category` field |
| `lib/interview/flow.ts` | Extended state with mode, refinement, transitions |
| `lib/orchestration/types.ts` | Added `mode` to `SessionRecord` |
| `lib/repositories/session-repository.ts` | Defaults `mode: "quick"` for backward compat |

### Frontend

| File | What changed |
|---|---|
| `components/interview/interview-view.tsx` | Phase intros, time estimates, smart completion screen |
| `components/interview/question-renderer.tsx` | Category badges, "why this matters", "I'm not sure" button |
| `components/interview/progress-bar.tsx` | 4-group labels, estimated time remaining |
| `lib/api.ts` | Added `category` to `QuestionPayload` |

## Rollout Strategy

### Phase 1: Backend (shipped)
- All API changes are backward-compatible
- `mode` defaults to `"quick"` for all new sessions
- Existing sessions from before the change default to `mode: "quick"` via `toSessionRecord()`
- The adaptive engine's `getNextQuestion()` replaces the old category filter with the same logical contract
- **No frontend changes needed for Phase 1** — the API still returns the same `{ question, phaseIndex, ... }` shape

### Phase 2: Frontend (shipped)
- The new `ProgressBar`, `QuestionRenderer`, and `InterviewView` are drop-in replacements
- No new API endpoints called
- The `category` field is optional in the API response — old backends without it work fine

### Phase 3: Quick Mode (shipped)
- Quick Mode is the default for all new sessions
- Advanced Mode is available via `{ "mode": "advanced" }` in the create request
- Post-generation refinement is available via `status: "refining"` transition

### Rollback Plan
- **Backend rollback**: Revert the `mode` field addition. The `toSessionRecord()` default ensures old sessions work.
- **Frontend rollback**: The old components can be restored by reverting the three component files.
- **Feature flag**: The mode selection is a frontend UX concern. If Quick Mode causes quality issues, change the default to `"advanced"`.

## Testing Strategy

### Unit Tests (existing: 586 passing)

| Test area | File | Coverage |
|---|---|---|
| Question categorization | `structural-validator.test.ts` | 26 tests |
| Cache behavior | `cache.test.ts` | 34 tests |
| Accounting/reporting | `accounting.test.ts` + `accounting.hardening.test.ts` | 65 tests |
| Orchestration | `orchestration.service.test.ts` | 17 tests |

### Tests to Add

| Area | What to test | Priority |
|---|---|---|
| **Inference engine** | Each of 11 inference rules produces correct output for various inputs | High |
| **Contradiction detector** | Each of 5 rules fires correctly; no false positives for non-conflicting inputs | High |
| **Freeform extractor** | Pattern matching extracts correct types from sample text | Medium |
| **Adaptive engine** | `getNextQuestion` returns correct questions per mode; `getEligibleQuestions` filters correctly | High |
| **Quick Mode** | Only critical + high-value + contextual questions are returned | High |
| **Advanced Mode** | Also includes optional questions | High |
| **State recovery** | Session with partial answers resumes at the right question | High |
| **Analytics** | Metric counters are incremented correctly | Medium |
| **Regression** | Old sessions without `mode` field default to `"quick"` | High |

### Test Patterns
- No live API calls — all tests are pure logic tests
- Each inference rule is tested with sample `AnswerRecord[]` inputs
- Contradiction detector tests with conflicting and non-conflicting answer sets
- Adaptive engine tests with full and partial answer sets for both modes

## Success Metrics

| Metric | Target | How to measure |
|---|---|---|
| **Abandonment rate** | Reduce by 40% | `interview_actions_total{action="abandoned"}` / `{action="start"}` |
| **Interview completion time** | Reduce by 50% | `interview_duration_minutes` histogram p50/p90 by mode |
| **Skipped questions per interview** | < 3 avg | `interview_skipped_questions` histogram |
| **Quick Mode adoption** | > 60% of new interviews | `interview_actions_total{action="quick_mode_used"}` / `{action="start"}` |
| **Generation quality (Quick vs Advanced)** | No statistical diff | Compare blueprint confidence scores, phase counts, generation funnel rates |
| **Questions asked upfront** | 14 avg (was 34) | `total` from `getNextQuestion()` response |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Quick Mode generates lower-quality plans | Medium | Medium | Track generation quality metrics by mode. Default to Advanced for complex projects. |
| Users confused by skipped questions | Low | Low | Completion screen explains skipped questions. Refinement available post-generation. |
| Inference engine makes wrong assumptions | Medium | Low | All inferences are medium-confidence by default. User confirms after generation. |
| Contradiction detector false positives | Low | Low | Only high-severity contradictions are surfaced. Medium/Low are logged only. |
| Mode field missing in existing sessions | Medium | Low | `toSessionRecord()` defaults to `"quick"`. No crashes. |
