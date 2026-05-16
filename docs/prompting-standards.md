# Prompting Standards

## Overview

Every task in the task graph produces a prompt artifact. Prompts are deterministic — given the same task context, the same prompt text is always produced. This document describes the prompt structure, validation rules, and stability guarantees.

---

## Prompt Structure

Every prompt is rendered as Markdown with seven sections:

```
# Execution Prompt

## Objective
What to build — derived from the task title.

## Context
Phase, task type, priority, phase summary, predecessor outputs, related tasks, dependency count, and estimated prompt rounds.

## Constraints
Implementation rules specific to the task type (config/code/test).

## Expected Output
Template describing what the agent should produce.

## Validation Criteria
List of verifiable acceptance criteria from the task definition.

## Architectural Alignment
How this task fits into the overall project architecture.

## Agent Tips
Security, edge cases, dependency warnings, and common bugs.
```

### Agent Tips Subsections

| Subsection          | Always included? | Task-type extras                                                             |
| ------------------- | ---------------- | ---------------------------------------------------------------------------- |
| Security            | Yes              | `config` type: secret-in-config warning                                      |
| Edge Cases          | Yes              | —                                                                            |
| Dependency Warnings | Yes              | —                                                                            |
| Common Bugs         | Yes              | `code` type: promise rejections, memory leaks; `config` type: default values |

Agent Tips subsections are only rendered when their arrays are non-empty.

---

## Determinism Guarantees

Prompts are deterministic and reproducible:

- **Same `TaskContext` → same `PromptSection` → same rendered Markdown.**
- No randomness, no timestamps, no UUIDs in the prompt text.
- The `createdAt` timestamp is on the `PromptArtifact` wrapper, not in the prompt text.
- `crypto.randomUUID()` is used only for the artifact ID, not the content.

This means:

- A prompt generated today is byte-for-byte identical to one generated tomorrow from the same inputs.
- Snapshots can be compared by their prompt contents without false positives.
- Version diffs that show prompt changes reflect real semantic changes, not formatting drift.

---

## Validation

Every prompt artifact is validated after assembly by `validatePrompt()`.

| Condition                                    | Status         | Action                     |
| -------------------------------------------- | -------------- | -------------------------- |
| All 7 required sections present with content | `complete`     | Stored as-is               |
| Missing required section                     | `failed`       | `failureReason` set        |
| Empty section                                | `failed`       | `failureReason` set        |
| Prompt text < 200 characters                 | `failed`       | `failureReason` set        |
| Prompt text > 5000 characters                | `needs_review` | Warning in `failureReason` |
| Agent tips all empty                         | `failed`       | `failureReason` set        |
| Objective < 10 characters                    | `failed`       | `failureReason` set        |
| Expected output < 20 characters              | `failed`       | `failureReason` set        |

---

## Versioning

Prompt artifacts are versioned by `(planId, planVersion)`:

- `PromptStore.getByPlan(planId, planVersion)` returns all prompts for a specific plan version.
- When a new plan version is created (via regeneration), new prompt artifacts are created with the new plan version.
- Old prompt artifacts remain in the store unchanged.
- The `ExportService` reads prompt artifacts from the store, exports do not regenerate prompts.

---

## Format Stability

The prompt format uses `formatPrompt()` in `lib/prompt/templates.ts`. Changes to the prompt format will:

1. Change the rendered output for all tasks.
2. Be detected by the `formatPrompt` snapshot test in `generator.test.ts`.
3. Require a snapshot update commit.

---

## Section Content Rules

### Objective

Derived from the task title. Format: `Implement: {title}`.

### Context

Contains structured metadata:

- Phase, task type, priority
- Phase summary from the blueprint
- Predecessor outputs (or "None — this is the first task")
- Related task titles from dependencies
- Dependency count and estimated prompt rounds

### Constraints

Base constraints (3–4 items) plus task-type-specific extras:

| Task type | Extra constraints                                                 |
| --------- | ----------------------------------------------------------------- |
| `config`  | Configuration must not break existing functionality; use env vars |
| `test`    | Tests must be reproducible; 80% coverage target                   |
| `code`    | Error handling; Single Responsibility Principle                   |

### Acceptance Criteria

From the task's `acceptanceCriteria` array. Falls back to a single criterion if the array is empty.

### Architectural Alignment

Contextual text based on task type:

- `config`: "Configuration tasks establish the foundation"
- `test`: "Verification tasks validate that implementation meets the defined criteria"
- `code`: "Implementation tasks build the core functionality"

---

## Snapshot Tests

Three snapshot families guard the prompt shape:

| Snapshot                     | What it captures                                    | Change detection           |
| ---------------------------- | --------------------------------------------------- | -------------------------- |
| `graph structure`            | Phase/type/status counts, dependency types          | Structural graph changes   |
| `missing/insufficient shape` | Task summary for non-decomposable phases            | Failure state changes      |
| `formatPrompt output`        | Section lengths, heading structure, section content | All format/content changes |

Snapshots use structural properties (counts, lengths, headings) — not raw text — to avoid brittleness from formatting-only shifts.
