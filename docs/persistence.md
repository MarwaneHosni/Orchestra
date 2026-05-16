# Persistence Architecture

## Storage Boundaries

The system maintains strict separation between user-provided inputs and AI-generated outputs across three independent stores:

| Store                  | Contents                                                        | Source                    | Versioned           | Persistence     |
| ---------------------- | --------------------------------------------------------------- | ------------------------- | ------------------- | --------------- |
| **AnswerStore**        | Raw interview answers (`AnswerSnapshot`)                        | User input via interview  | ✅ Snapshot version | In-memory (Map) |
| **ArtifactStore**      | Generated blueprint, roadmap, tasks, prompts (`ArtifactRecord`) | AI generation             | ✅ Artifact version | In-memory (Map) |
| **GenerationRunStore** | Generation run metadata (`GenerationRunRecord`)                 | System at generation time | ✅ Run version      | In-memory (Map) |

## Separation Principle

Raw answers and generated artifacts are never stored in the same record. Answers are captured as immutable snapshots at generation time. Generated artifacts reference the source answer snapshot via `lineage.sourceAnswerSnapshotId` but do not contain the answer data themselves.

## Lineage Chain

Every generated artifact carries full lineage:

```
ArtifactRecord.lineage = {
  generationRunId    → links to the GenerationRunRecord
  sourceAnswerSnapshotId → links to the AnswerSnapshot used as input
  generationVersion  → monotonic version number per project
  model              → AI model used (e.g. "gpt-4o")
  provider           → AI provider (e.g. "openai")
  sourceSessionId    → interview session that produced the answers
}
```

This allows tracing any generated artifact back to:

1. The specific generation run that produced it
2. The exact set of raw answers used as input
3. The AI model and provider that generated it
4. The interview session where answers were collected

## Versioning

### Answer versions

Each call to `PersistenceService.persistGeneration()` captures a new answer snapshot. Prior snapshots are never modified. The version number is auto-incremented per project.

### Artifact versions

Each generated artifact type (blueprint, roadmap, task_graph, prompt_bundle) has its own independent version sequence per project. Multiple generation runs can produce different version numbers for different artifact types.

### Generation run versions

Every generation run gets a monotonic `generationVersion` per project, regardless of which artifact types were generated. This provides a single ordering key.

## Query Patterns

| What you need                         | Method                                             |
| ------------------------------------- | -------------------------------------------------- |
| All artifacts from one generation run | `getGenerationPackage(runId)`                      |
| All generation runs for a project     | `getGenerationRuns(projectId)`                     |
| All versions of one artifact type     | `listArtifactVersions(projectId, type)`            |
| Compare two versions of same type     | `compareArtifactVersions(projectId, type, vA, vB)` |
| Latest version of one type            | `getLatestArtifact(projectId, type)`               |
| All answer snapshots for a session    | `answers.getSnapshotsBySession(sessionId)`         |
| Trace artifact → source answers       | `getGenerationPackage(runId)` → `answerSnapshot`   |

## Example: Full persistence flow

```typescript
const svc = new PersistenceService();
const result = svc.persistGeneration({
  projectId: "proj-1",
  sessionId: "session-1",
  model: "gpt-4o",
  provider: "openai",
  modelTier: "balanced",
  fallbackUsed: false,
  routerDecision: null,
  answers: rawAnswerRecords,
  blueprint: blueprintOutput,
  roadmap: roadmapOutput,
});

// result.run              → GenerationRunRecord
// result.answerSnapshot   → AnswerSnapshot (raw answers)
// result.blueprint        → ArtifactRecord (generated, not raw)
// result.roadmap          → ArtifactRecord
```

## Storage Notes

- All stores are currently in-memory (`Map`-based) and reset on server restart
- Each store follows the existing codebase pattern: `Map<id, Record>` + `Map<projectId, Record[]>`
- To persist across restarts, replace `createInMemory*Store()` functions with DB-backed implementations using the same interfaces
- The `content` field in `ArtifactRecord` is a JSON string — use `JSON.parse()` to deserialize
