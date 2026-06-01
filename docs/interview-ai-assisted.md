# AI-Assisted Interview Strategies

## Overview

The interview system uses three AI-assisted mechanisms to reduce manual question burden while preserving output quality:

1. **Inference engine** — derives likely values for `derivable` questions from existing answers
2. **Contradiction detector** — flags conflicting answers across phases
3. **Freeform extractor** — extracts structured data (requirements, constraints, risks) from text answers

## Inference Engine (`lib/interview/inference-engine.ts`)

### What it does

For each `derivable` question (12 total), the inference engine examines existing answers and produces an inferred value with a confidence level:

| Confidence | Meaning | Behavior |
|---|---|---|
| **high** | Strong signal from existing answers | Auto-accepted. No follow-up question asked. |
| **medium** | Plausible but not certain | Used as default. User confirms after generation. |
| **low** | Weak or no signal | Not used. Question is marked as needing user input in refinement. |

### Inference rules

| Derivable question | From | Rule |
|---|---|---|
| `ideation.3` (new vs rebuild) | `ideation.1` (problem description) | If description mentions rebuild/migration → "Addition"; otherwise "New product" |
| `database.2` (data volume) | `ideation.4` (user scale) + `database.1` (data types) | User count → volume tier. File/TS data → scale up one tier |
| `backend.2` (job queue) | `backend.1` (capabilities) | If "Background job processing" selected → true; else false |
| `backend.3` (API volume) | `ideation.4` (user scale) | User count → request volume tier |
| `frontend.2` (SSR/SSG) | `ideation.2` (platform) | If Web/Cross-platform → true; else false |
| `testing.1` (coverage) | `requirements.1` (features) | If complex features → 60%; else 30% |
| `testing.2` (test types) | `ideation.2` + `requirements.1` | Standard suite + E2E if web, + contract if API-heavy |
| `deployment.1` (hosting) | `ideation.2` + `architecture.1` | Tech stack match → specific provider; platform → general suggestion |
| `deployment.2` (CI/CD) | None | Default: CI/CD pipeline, Staging environment |
| `monitoring.1` (tools) | None | Default: Error tracking, Log aggregation, APM |
| `monitoring.2` (SLA) | `ideation.4` (user scale) | High scale → 99.9%; else 99% |

### Confidence-based follow-up logic

```
inference.confidence === "high"  →  auto-accept, no follow-up
inference.confidence === "low"   →  flag for user input in refinement
inference.confidence === "medium" →  use as default, confirm after generation
```

## Contradiction Detector (`lib/interview/contradiction-detector.ts`)

### What it detects

| Type | Detects | Severity | Example |
|---|---|---|---|
| `direct_conflict` | Answers that directly contradict each other | high | Realtime=No + WebSocket in backend |
| `implied_conflict` | Answers that imply contradictory positions | medium | Users <100 + 1M requests/day |
| `gate_violation` | Gate question satisfied but follow-up missing | high | Needs auth + no methods selected |

### Detection rules

1. **Real-time conflict**: `architecture.3=false` but `backend.1` includes "Real-time / WebSocket"
2. **Scale conflict**: User count vs API volume ratio exceeds 100x
3. **Auth violation**: `requirements.2=true` but no auth methods selected
4. **AI violation**: `ai-systems.1=true` but no AI capabilities selected
5. **Platform conflict**: Platform is "API/service only" but frontend capabilities specified

### How contradictions are handled

- **High severity** contradictions are surfaced to the user with an explanation and resolution suggestion
- **Medium severity** contradictions are noted but don't block the flow
- Contradictions are included in the `AdaptiveResult` for the frontend to display

## Freeform Extractor (`lib/interview/freeform-extractor.ts`)

### What it does

Extracts structured items from freeform text answers using pattern matching:

| Item type | Pattern | Example match |
|---|---|---|
| **requirement** | "must/have to/need to/essential" | "Users must be able to upload files" |
| **constraint** | "limited by/restricted/compliance/budget" | "We need GDPR compliance" |
| **assumption** | "assume/presume/likely/probably" | "Users likely have modern browsers" |
| **risk** | "risk/concern/challenge/if we don't" | "If the API rate limit is hit..." |
| **integration** | "integrate with/API/third-party/webhook" | "We integrate with Stripe for payments" |

### Extraction sources

- `ideation.1` (problem description) → requirements, assumptions
- `requirements.1` (core features) → requirements, features
- `requirements.5` (user workflows) → requirements, integrations
- `architecture.1` (tech stack) → constraints
- `core-features.1` (complex feature) → requirements, risks

### Suggested follow-ups

The extractor analyzes answer length and pattern coverage to suggest when a follow-up is needed:
- If feature descriptions are brief (< 50 chars) but the user has provided substantial answers → suggest adding more detail
- If no requirements were extractable but the user answered feature-related questions → suggest clarifying

## Integration with Adaptive Engine

The adaptive engine (`lib/interview/adaptive-engine.ts`) combines all three systems:

```
getNextQuestion(config):
  1. Determine eligible questions by mode (quick/advanced)
  2. Run inference engine → get inferred values for derivable questions
  3. Run contradiction detector → check for conflicts
  4. Run freeform extractor → check for follow-up suggestions
  5. Return next question + inferences + contradictions + followUps
```

The `AdaptiveResult` now includes:
```typescript
{
  nextQuestion: QuestionDefinition | null;
  eligibleCount: number;
  answeredCount: number;
  allAnswered: boolean;
  skippedCategories: QuestionCategory[];
  inferences: [{ questionRef, value, confidence, explanation }];
  contradictions: [{ type, severity, explanation }];
  followUps: string[];
}
```

## Handling Strategy

| Scenario | Strategy |
|---|---|
| **Partial answers** | Freeform extractor finds what it can; missing fields tracked in `missingCriticalFields` |
| **Ambiguous answers** | Vague detection flags them; inference engine skips ambiguous inputs |
| **Contradictory answers** | Contradiction detector flags with severity; high-severity surfaced to user |
| **Incomplete interviews** | Adaptive engine stops when critical questions are answered; derivable/advanced deferred |
| **Low confidence inference** | Flagged for user confirmation after generation |
| **High confidence inference** | Auto-accepted without follow-up |
