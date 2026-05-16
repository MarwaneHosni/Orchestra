# Snapshot Update Guidance

## Overview

Snapshot tests capture the deterministic output of prompt generation, task graph construction, and other structured artifacts. They serve as regression detectors — a snapshot change signals that an upstream code change has altered the output shape.

---

## Where Snapshots Live

| Snapshot file                                         | Source test file    | What it captures                                                                                                                         |
| ----------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/task-graph/__snapshots__/generator.test.ts.snap` | `generator.test.ts` | Graph structure (phase/type/status counts), missing/insufficient task shapes, prompt section content, formatted prompt heading structure |
| `lib/prompt/__snapshots__/prompt.test.ts.snap`        | `prompt.test.ts`    | Full prompt artifact structure (sections, constraints, agent tips, prompt length and prefix)                                             |

---

## When to Update Snapshots

### Legitimate reasons to update

| Reason                     | Example                                        | Risk                           |
| -------------------------- | ---------------------------------------------- | ------------------------------ |
| Intentional format change  | Adding a new section to `formatPrompt()`       | Low — expected output change   |
| Intentional content change | Updating agent tips text                       | Low — expected output change   |
| New task type added        | Adding `"docs"` type with specific constraints | Low — expected new structure   |
| New phase type added       | Adding a new phase to `PHASE_ORDER`            | Low — expected new graph shape |

### When NOT to update (investigate first)

| Sign                                       | Likely cause                                      | Action                                                                          |
| ------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Snapshot fails on UUID or timestamp        | Non-deterministic value leaked into snapshot data | Add a stable wrapper that excludes non-deterministic fields before snapshotting |
| Snapshot fails on whitespace or formatting | Prettier changed formatting between runs          | Run `pnpm format:fix` and re-run tests                                          |
| Snapshot fails for unrelated code change   | Test shares mutable state across runs             | Ensure each test creates fresh data via factory functions                       |

---

## How to Update Snapshots

### Local development

```bash
# Update all snapshots
pnpm exec vitest run --update

# Update snapshots for a specific file
pnpm exec vitest run lib/task-graph/generator.test.ts --update
```

### Code review workflow

1. Run `pnpm test` to confirm which snapshots changed.
2. Inspect the snapshot diff with `git diff`.
3. Verify each change is intentional (not a bug or formatting shift).
4. Include the snapshot update in the same commit as the code change.
5. Add a comment in the PR description: "Snapshot updated for [reason]."

### CI behavior

- CI runs `vitest run` without `--update`. If snapshots don't match, the test fails and CI is red.
- Snapshot changes MUST be committed. CI never auto-updates snapshots.
- A PR that includes snapshot changes should be reviewed with extra scrutiny on the diff.

---

## Best Practices

### Do

- ✅ Snapshot structural properties (counts, lengths, headings) rather than raw text.
- ✅ Exclude UUIDs, timestamps, and other non-deterministic fields before snapshotting.
- ✅ Use descriptive snapshot names so failures are easy to locate.
- ✅ Keep snapshots focused on one concern per test.

### Don't

- ❌ Snapshot entire objects that contain `id` or `createdAt` fields.
- ❌ Update snapshots without reviewing the diff.
- ❌ Use `--update` to suppress investigation of a failing test.
- ❌ Make snapshots so broad that a trivial text change causes a failure.

---

## Snapshot Structure Guidelines

### Good snapshot target

```typescript
const stable = {
  status: artifact.status,
  sectionCounts: {
    objective: artifact.sections.objective.length,
    constraints: artifact.sections.constraints.length,
    agentTips: artifact.sections.agentTips.security.length,
  },
  headingStructure: headingNames,
  totalLength: artifact.promptText.length,
};
expect(stable).toMatchSnapshot();
```

### Brittle snapshot target (avoid)

```typescript
// Avoid: includes UUID and timestamp
expect(artifact).toMatchSnapshot();
```

### Deterministic content snapshot (safe)

```typescript
// Safe: section content is deterministic for the same inputs
expect(artifact.sections).toMatchSnapshot();
```
