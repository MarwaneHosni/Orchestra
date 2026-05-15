# Interview System Specification

## Overview

The interview system transforms a raw project idea into a structured set of requirements by walking the user through a deterministic, phase-by-phase question flow. Each question belongs to one of the 12 lifecycle phases and is designed to extract high-signal information without being generic.

---

## Question Taxonomy

### Types

| Type           | Storage                    | Purpose                                      | Example                                    |
| -------------- | -------------------------- | -------------------------------------------- | ------------------------------------------ |
| `text`         | Free-text string           | Open-ended descriptions, workflows, concerns | "Describe the core problem."               |
| `select`       | Single string from options | Categorical choices, preferences             | "Platform: Web / Mobile / Desktop"         |
| `multi_select` | Array of strings           | Capability selection, feature requirements   | "Select auth methods needed."              |
| `boolean`      | "true" / "false"           | Binary decisions                             | "Does the app need user accounts?"         |
| `scale`        | Integer (1-5)              | Ratings, priorities, confidence              | "Rate the priority of real-time features." |

### Payload Shape

Every question in the system conforms to this structure:

```typescript
interface QuestionDefinition {
  phaseType: string; // Which lifecycle phase
  order: number; // Display order within phase
  text: string; // Question text shown to user
  type: QuestionType; // text | select | multi_select | boolean | scale
  options?: string[]; // For select / multi_select types
  required: boolean; // Must be answered before completing the phase
  dependsOn?: {
    // Skip logic — only show if prior answer matches
    questionId: string;
    expectedValue: string | string[];
  };
  validation?: {
    // Client + server validation rules
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
  captureAs?: {
    // Auto-create entity from answer
    type: "assumption" | "constraint" | "risk";
  };
  helpText?: string; // Guidance shown alongside the question
}
```

---

## Phase-to-Question Mapping

Questions are grouped by lifecycle phase and asked in order. The system progresses through phases sequentially. Each phase has 3-6 questions.

### Phase Order

```
 1. ideation         (5 questions)
 2. requirements     (6 questions)
 3. architecture     (4 questions)
 4. security         (4 questions)
 5. database         (3 questions)
 6. backend          (4 questions)
 7. frontend         (3 questions)
 8. core-features    (3 questions)
 9. ai-systems       (3 questions)
10. testing          (3 questions)
11. deployment       (3 questions)
12. monitoring       (3 questions)
```

**Total: 44 questions** — across 12 phases, averaging 3.7 questions per phase.

---

## Question Dependency Rules

Dependencies ensure the user only sees relevant follow-up questions. Rules are deterministic — no AI inference needed.

### Example Rules

| Question              | Condition                                | Effect                         |
| --------------------- | ---------------------------------------- | ------------------------------ |
| "Auth methods?"       | Only if "Needs user accounts?" = true    | Skipped for public apps        |
| "AI capabilities?"    | Only if "Uses AI features?" = true       | Skipped for non-AI apps        |
| "Encryption details?" | Only if "Handles sensitive data?" = true | Skipped for non-sensitive apps |

### Implementation

Dependencies use deterministic **ref keys** (`"<phaseType>.<order>"`) instead of database UUIDs, since question IDs are generated at seed time and cannot be known upfront.

```typescript
interface DependencyRule {
  questionRef: string; // e.g. "requirements.2" → question at phaseType=requirements, order=2
  expectedValue: string | string[]; // Required answer value(s)
}
```

Dependencies are evaluated server-side when fetching the next question set. The `questionRef` is resolved to the actual question definition by looking up `(phaseType, order)`:

```typescript
function isQuestionEligible(question, answers): boolean {
  if (!question.dependsOn) return true;
  const priorAnswer = answers.find((a) => a.questionId === resolveRef(question.dependsOn.questionRef));
  if (!priorAnswer) return false;
  const expected = question.dependsOn.expectedValue;
  return Array.isArray(expected) ? expected.includes(priorAnswer.value) : priorAnswer.value === expected;
}
```

```

---

## Assumption, Constraint & Risk Capture

During the interview, certain questions automatically create structured records. This prevents information loss and seeds the planning engine with contextual data.

| Captured Entity | Trigger | Example Question |
|----------------|---------|-----------------|
| `constraint` | Tech stack, platform, compliance questions | "Do you have preferences on the tech stack?" |
| `constraint` | Integration, compliance questions | "Are there critical external integrations?" |
| `assumption` | Third-party reliability questions | "Assumptions about service reliability?" |
| `risk` | Operational risk questions | "Biggest operational risks?" |

When a question with `captureAs` is answered, the planning engine automatically:
1. Creates a row in the `assumptions`, `constraints`, or `risks` table.
2. Sets `provenance` to `"user"`.
3. Links the record to the project and phase type.
4. Sets `confidence` to `"high"` for explicitly stated inputs.

---

## Interview Flow State Machine

### States

```

                    ┌─────────┐
                    │  DRAFT  │
                    └────┬────┘
                         │ start
                         ▼
                 ┌───────────────┐
        ┌───────│  IN_PROGRESS  │◄────────┐
        │       └───────┬───────┘         │
        │ pause         │ complete        │ resume
        ▼               ▼                 │

┌──────────┐ ┌──────────────┐ │
│ PAUSED │ │ COMPLETE │ │
└──────────┘ └──────────────┘ │
│ │
└────────── resume ───────────────┘

        DRAFT ──► CANCELLED
        IN_PROGRESS ──► CANCELLED

```

### Transition Rules

| From | To | Condition |
|------|----|-----------|
| `draft` | `in_progress` | User clicks "Start interview" |
| `in_progress` | `paused` | User pauses manually |
| `paused` | `in_progress` | User clicks "Resume" |
| `in_progress` | `complete` | All required questions answered |
| `in_progress` | `cancelled` | User abandons |
| `draft` | `cancelled` | Project deleted before starting |

### State Behaviors

- **Draft**: Interview created but no answers recorded. Project idea is captured.
- **In Progress**: Active session. Answers are persisted immediately on submission. The current phase and question index are tracked so the user can resume from the exact position.
- **Paused**: Session suspended. The question progress is preserved. No new answers can be submitted.
- **Complete**: All 12 phases have their required questions answered. The planning engine can begin generating the plan. The session is locked — no further answers accepted.
- **Cancelled**: Session abandoned. Existing answers are preserved for potential future resumption but no plan will be generated.

### Progress Tracking

```

interface InterviewState {
sessionId: string;
projectId: string;
status: InterviewStatus;
currentPhaseIndex: number; // 0-11 (index into PHASE_ORDER)
currentQuestionIndex: number; // 0-N (index into phase's questions)
answeredQuestionIds: string[]; // IDs of completed questions
startedAt: Date | null;
completedAt: Date | null;
}

````

Progress is deterministically computable:
- Total questions: count of all questions across all phases
- Completed questions: length of `answeredQuestionIds`
- Current position: `PHASE_ORDER[currentPhaseIndex]` → `getQuestionsByPhase(phase)[currentQuestionIndex]`
- Remaining: total - completed

---

## Deterministic Question Ordering

Questions are ordered by `(phaseType order, order)` — a fixed, seeded ordering. The same project idea always produces the same question sequence.

### Progressive Refinement Rules

1. **Broad to specific**: Each phase starts with high-level questions and narrows to detailed ones.
2. **Dependency gate**: A question with a `dependsOn` rule is hidden until its prerequisite is answered with the expected value.
3. **Phase completion**: A phase is considered complete when all its required questions have been answered. Optional questions are skippable.
4. **Sequential phases**: Phases are completed in order. The system does not show questions from phase N+1 until phase N has all required answers.

### Anti-generic Measures

- Questions reference the user's own answers from prior phases (e.g., "Given you selected [platform], what...").
- No generic "anything else?" questions.
- `select` and `multi_select` types are preferred over open-ended `text` where enumeration is feasible.
- `text` questions include `helpText` to guide the user toward high-signal answers.
- Validation constraints (`minLength`, `maxLength`) prevent one-word or novel-length answers.

---

## Schema Dependencies

The interview system reads from and writes to these tables:

| Table | Read | Write | Purpose |
|-------|------|-------|---------|
| `questions` | ✅ | — | Question definitions (seeded, not modified at runtime) |
| `interview_sessions` | ✅ | ✅ | Session state and lifecycle |
| `answers` | ✅ | ✅ | User responses with provenance and confidence |
| `assumptions` | — | ✅ | Auto-captured assumptions from tagged questions |
| `constraints` | — | ✅ | Auto-captured constraints from tagged questions |
| `risks` | — | ✅ | Auto-captured risks from tagged questions |

The `answers.confidence` field is set to `"high"` for directly answered questions and can be adjusted if the user indicates uncertainty.

---

## Seed Data

The default question set is defined in `src/lib/interview/questions.ts` and loaded into the database via:

```bash
pnpm --filter @orchestra/api db:seed
````

The seed script is idempotent — it checks for existing questions and skips if data is already present.

---

## Backend Interface (Planned)

```
POST   /api/v1/projects/:id/interviews          → Create draft session
GET    /api/v1/interviews/:id/next              → Get next unanswered question
POST   /api/v1/interviews/:id/answers           → Submit answer
POST   /api/v1/interviews/:id/transition        → Change session state
GET    /api/v1/interviews/:id/progress          → Get completion status
```
