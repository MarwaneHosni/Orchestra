# Output Schema Contract

## Purpose

Define the strict schema that all AI-generated plan artifacts must conform to. The system enforces structural constraints (phase ordering, required fields, type safety) while leaving full creative control over content to the AI model.

## Principles

1. **Structure is enforced by the system** — phase order, field types, cardinality constraints are encoded in Zod schemas that the AI cannot override.
2. **Content is authored by the AI** — every `narrative`, `summary`, `description`, `rationale`, and `promptText` field is free-form text that the model writes.
3. **Provenance is tracked** — every generated field that derives from an answer references the source `questionRef`.
4. **Generation metadata is mandatory** — every artifact carries `model`, `provider`, token usage, timing, and cost.

## Artifact Types

### 1. Blueprint (`blueprint`)

The structured plan output — phases with AI-written narratives, assumptions, constraints, and risks.

| Field                | Type                       | Required | Description                          |
| -------------------- | -------------------------- | -------- | ------------------------------------ |
| `planId`             | UUID                       | ✅       | Parent plan identifier               |
| `planVersion`        | positive int               | ✅       | Monotonic version number             |
| `projectId`          | UUID                       | ✅       | Project owner                        |
| `sessionId`          | UUID                       | ✅       | Interview session that produced this |
| `createdAt`          | ISO 8601                   | ✅       | Generation timestamp                 |
| `schemaVersion`      | `"orchestra-generated-v1"` | ✅       | Fixed literal for schema evolution   |
| `artifactType`       | `"blueprint"`              | ✅       | Discriminator                        |
| `phases`             | PhaseContent[12]           | ✅       | Exactly 12 phases in lifecycle order |
| `assumptions`        | StructuredItem[]           | ✅       | Defaults to `[]`                     |
| `constraints`        | StructuredItem[]           | ✅       | Defaults to `[]`                     |
| `risks`              | StructuredItem[]           | ✅       | Defaults to `[]`                     |
| `overallConfidence`  | 0–1                        | ✅       | Aggregate confidence score           |
| `overallSummary`     | string                     | ✅       | AI-written executive summary         |
| `generationMetadata` | object                     | ✅       | Model, tokens, cost, timing          |

**PhaseContent:**

| Field           | Type           | Required | Description                                                |
| --------------- | -------------- | -------- | ---------------------------------------------------------- |
| `phaseType`     | PhaseType enum | ✅       | Enforced via Zod: one of 12 fixed phases                   |
| `phaseName`     | string         | ✅       | Human-readable name                                        |
| `summary`       | string         | ✅       | AI-written one-paragraph summary                           |
| `narrative`     | string         | ✅       | AI-written detailed narrative                              |
| `status`        | enum           | ✅       | `sufficient` / `insufficient` / `missing` / `ai_augmented` |
| `confidence`    | 0–1            | ✅       | AI-assigned confidence score                               |
| `keyDecisions`  | string[]       | ✅       | Defaults to `[]`                                           |
| `sourceAnswers` | AnswerRef[]    | ✅       | Defaults to `[]`                                           |

### 2. Roadmap (`roadmap`)

Sequenced phases with dependencies and effort estimates.

| Field                 | Type             | Required | Description                       |
| --------------------- | ---------------- | -------- | --------------------------------- |
| _(all base fields)_   | —                | ✅       | Same as Blueprint                 |
| `artifactType`        | `"roadmap"`      | ✅       | Discriminator                     |
| `phases`              | RoadmapPhase[12] | ✅       | Exactly 12 in lifecycle order     |
| `totalEffort`         | enum             |          | `small` / `medium` / `large`      |
| `recommendedApproach` | string           |          | Free-text delivery recommendation |
| `generationMetadata`  | object           | ✅       | Same structure                    |

**RoadmapPhase:**

| Field               | Type            | Required | Description                                        |
| ------------------- | --------------- | -------- | -------------------------------------------------- |
| `phaseType`         | PhaseType enum  | ✅       | Enforced                                           |
| `phaseName`         | string          | ✅       | Human-readable                                     |
| `order`             | nonnegative int | ✅       | Position in sequence                               |
| `estimatedDuration` | string          |          | e.g. "2 weeks", "1 sprint"                         |
| `effort`            | enum            | ✅       | `small` / `medium` / `large` / `unknown` (default) |
| `prerequisites`     | PhaseType[]     | ✅       | Defaults to `[]`                                   |
| `rationale`         | string          |          | Why this phase is ordered here                     |

### 3. Task Graph (`task_graph`)

Decomposed tasks per phase with dependencies.

| Field                | Type                   | Required | Description              |
| -------------------- | ---------------------- | -------- | ------------------------ |
| _(all base fields)_  | —                      | ✅       | Same as Blueprint        |
| `artifactType`       | `"task_graph"`         | ✅       | Discriminator            |
| `tasks`              | AITaskNode[]           | ✅       | Unordered list of tasks  |
| `phaseTaskCounts`    | Record<PhaseType, int> | ✅       | Count of tasks per phase |
| `generationMetadata` | object                 | ✅       | Same structure           |

**AITaskNode:**

| Field                   | Type            | Required | Description                                           |
| ----------------------- | --------------- | -------- | ----------------------------------------------------- |
| `id`                    | UUID            | ✅       | Unique task identifier                                |
| `phaseType`             | PhaseType enum  | ✅       | Must be one of 12                                     |
| `title`                 | string          | ✅       | AI-written title                                      |
| `description`           | string          |          | AI-written description                                |
| `type`                  | TaskType enum   | ✅       | `code` / `config` / `test` / `docs` / `review` / etc. |
| `priority`              | Priority enum   | ✅       | Defaults to `medium`                                  |
| `status`                | Status enum     | ✅       | Defaults to `pending`                                 |
| `order`                 | nonnegative int | ✅       | Display/execution order                               |
| `dependencies`          | UUID[]          | ✅       | References to other task `id`s                        |
| `acceptanceCriteria`    | string[]        | ✅       | Defaults to `[]`                                      |
| `estimatedPromptRounds` | positive int    | ✅       | Defaults to `1`                                       |

### 4. Prompt Bundle (`prompt_bundle`)

AI execution prompts per task.

| Field                | Type               | Required | Description                     |
| -------------------- | ------------------ | -------- | ------------------------------- |
| _(all base fields)_  | —                  | ✅       | Same as Blueprint               |
| `artifactType`       | `"prompt_bundle"`  | ✅       | Discriminator                   |
| `taskCount`          | nonnegative int    | ✅       | Total tasks in the graph        |
| `promptCount`        | nonnegative int    | ✅       | Count of prompts in this bundle |
| `prompts`            | AIPromptArtifact[] | ✅       | The prompt artifacts            |
| `generationMetadata` | object             | ✅       | Same structure                  |

**AIPromptArtifact:**

| Field              | Type          | Required | Description                                        |
| ------------------ | ------------- | -------- | -------------------------------------------------- |
| `id`               | UUID          | ✅       | Unique prompt identifier                           |
| `taskId`           | UUID          | ✅       | Links to AITaskNode                                |
| `planId`           | UUID          | ✅       | Parent plan                                        |
| `planVersion`      | positive int  | ✅       | Plan version                                       |
| `promptText`       | string        | ✅       | Full prompt text for AI execution                  |
| `sections`         | PromptSection | ✅       | Structured prompt sections                         |
| `version`          | positive int  | ✅       | Defaults to `1`                                    |
| `status`           | enum          | ✅       | `pending` / `complete` / `failed` / `needs_review` |
| `validationErrors` | string[]      | ✅       | Defaults to `[]`                                   |
| `createdAt`        | ISO 8601      | ✅       | Timestamp                                          |

**PromptSection:**

| Field                    | Type     | Required | Description                       |
| ------------------------ | -------- | -------- | --------------------------------- |
| `objective`              | string   | ✅       | What the AI agent must accomplish |
| `context`                | string   | ✅       | Background and project context    |
| `constraints`            | string[] | ✅       | Defaults to `[]`                  |
| `expectedOutput`         | string   | ✅       | What the agent should produce     |
| `validationCriteria`     | string[] | ✅       | Defaults to `[]`                  |
| `architecturalAlignment` | string   |          | How this fits the architecture    |
| `agentTips`              | string[] | ✅       | Defaults to `[]`                  |

## Fixed Lifecycle Order

The 12 phases are encoded in `PhaseTypeSchema` as a Zod enum. Every artifact that contains phases enforces `.length(PHASE_ORDER.length)` and validates each element against the enum. The `assertPhaseOrder()` runtime check verifies both length and positional correctness.

```
ideation → requirements → architecture → security → database →
backend → frontend → core-features → ai-systems → testing →
deployment → monitoring
```

## Generation Metadata

Every artifact carries:

```typescript
{
  model: string;           // e.g. "gpt-4o", "claude-sonnet-4"
  provider: string;        // e.g. "openai", "anthropic", "openrouter"
  generationId: UUID;      // Unique for this generation call
  startedAt: ISO8601;
  completedAt: ISO8601;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  fallbackUsed: boolean;   // Defaults to false
  routerDecision?: string; // Explanation if fallback was used
}
```

## Schema Versioning

All artifacts carry `schemaVersion: "orchestra-generated-v1"`. When the schema evolves:

- Increment the version string (e.g. `"orchestra-generated-v2"`)
- The old version is still parseable via `z.discriminatedUnion` for snapshot compatibility
- The migration path is: old data → upgrade transform → new schema

## What the System Controls vs What the AI Controls

| Controlled by System (Zod)       | Authored by AI (free text)  |
| -------------------------------- | --------------------------- |
| Phase count (exactly 12)         | Phase narratives, summaries |
| Phase ordering (fixed lifecycle) | Task titles, descriptions   |
| Field types and cardinalities    | Acceptance criteria         |
| Required vs optional fields      | Prompt text and sections    |
| UUID generation                  | Recommended approaches      |
| Timestamps                       | Estimated durations         |
| Model/provider identification    | Rationale for ordering      |
| Status enums                     | Validation criteria content |
| Confidence score range (0-1)     | Key decision descriptions   |

## Validation

All schemas are Zod objects and can be used with `.safeParse()` for runtime validation or `.parse()` for strict enforcement. Example:

```typescript
import { BlueprintOutputSchema } from "../lib/contract/index.js";

const result = BlueprintOutputSchema.safeParse(aiResponse);
if (!result.success) {
  console.error(result.error.issues); // Structural failures
}
```
