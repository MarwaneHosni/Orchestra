import { describe, expect, it, beforeEach } from "vitest";
import { PersistenceService } from "./service.js";
import { createInMemoryAnswerStore, createInMemoryArtifactStore } from "./stores.js";
import type { AnswerRecord } from "../orchestration/types.js";
import type { BlueprintOutput, PhaseType } from "../contract/output-schema.js";
import type { Roadmap, TaskDraft } from "../roadmap/types.js";
import type { PromptBundle } from "../prompt/prompt-bundle-types.js";
import { PHASE_ORDER } from "../contract/output-schema.js";

const sampleAnswers: AnswerRecord[] = [
  {
    id: "a1",
    questionId: "ideation.1",
    projectId: "proj-1",
    sessionId: "session-1",
    value: "Build a chat app",
    confidence: "high",
    provenance: "user",
    version: 1,
    isLatest: true,
    createdAt: new Date().toISOString(),
    supersededAt: null,
  },
  {
    id: "a2",
    questionId: "ideation.2",
    projectId: "proj-1",
    sessionId: "session-1",
    value: "Web",
    confidence: "high",
    provenance: "user",
    version: 1,
    isLatest: true,
    createdAt: new Date().toISOString(),
    supersededAt: null,
  },
];

function sampleBlueprint(version: number): BlueprintOutput {
  return {
    planId: "plan-1",
    planVersion: version,
    projectId: "proj-1",
    sessionId: "session-1",
    createdAt: new Date().toISOString(),
    schemaVersion: "orchestra-generated-v1",
    artifactType: "blueprint",
    phases: PHASE_ORDER.map((p) => ({
      phaseType: p as PhaseType,
      phaseName: p,
      summary: "Summary",
      narrative:
        "A detailed narrative that is long enough to pass validation. This is the test narrative for the phase.",
      status: "sufficient" as const,
      confidence: 0.8,
      keyDecisions: [],
      sourceAnswers: [],
    })),
    assumptions: [],
    constraints: [],
    risks: [],
    overallConfidence: 0.8,
    overallSummary: "Overall test plan summary.",
    generationMetadata: {
      model: "gpt-4o",
      provider: "openai",
      generationId: `gen-${version}`,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 1000,
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
      estimatedCost: 0.001,
      fallbackUsed: false,
    },
  };
}

function sampleRoadmap(_version: number): Roadmap {
  return {
    projectId: "proj-1",
    projectName: "Test",
    sessionId: "session-1",
    generatedAt: new Date().toISOString(),
    milestones: PHASE_ORDER.map((p, i) => ({
      phaseType: p as PhaseType,
      phaseName: p,
      order: i,
      title: `${p} phase`,
      description: `Complete ${p}`,
      keyDeliverables: ["Output"],
      estimatedEffort: "medium" as const,
      dependsOn: [],
    })),
    totalEffort: "medium" as const,
  };
}

function sampleTaskDraft(version: number): TaskDraft {
  void version;
  return {
    projectId: "proj-1",
    projectName: "Test",
    sessionId: "session-1",
    generatedAt: new Date().toISOString(),
    tasks: PHASE_ORDER.flatMap((p, pi) => [
      {
        id: `task-${p}-${version}`,
        phaseType: p as PhaseType,
        title: `Task ${p}`,
        description: `Do ${p}`,
        kind: "code" as const,
        priority: "medium" as const,
        order: pi * 10,
        acceptanceCriteria: [`Criterion`],
        dependencies: [],
        dependsOnUnresolvedInput: false,
        uncertaintyNote: null,
      },
    ]),
    dependencyCount: 0,
    tasksWithUnresolvedInput: 0,
  };
}

function samplePromptBundle(version: number): PromptBundle {
  return {
    bundleId: `bundle-${version}`,
    planVersion: version,
    projectId: "proj-1",
    sessionId: "session-1",
    projectName: "Test",
    createdAt: new Date().toISOString(),
    promptCount: 1,
    prompts: PHASE_ORDER.map((p) => ({
      id: `prompt-${p}-${version}`,
      taskId: `task-${p}-${version}`,
      planVersion: version,
      promptVersion: 1,
      sections: {
        objective: "Implement task",
        context: "Project context",
        constraints: [],
        expectedOutput: "Output",
        validationCriteria: [],
        architecturalAlignment: "Phase",
        agentTips: { security: [], edgeCases: [], dependencyWarnings: [], commonBugs: [] },
      },
      promptText: "# Task",
      status: "pending" as const,
      createdAt: new Date().toISOString(),
      lineage: {
        taskId: `task-${p}-${version}`,
        planVersion: version,
        blueprintArtifactId: null,
        analysisSessionId: "session-1",
        sourcePhaseType: p as PhaseType,
      },
    })),
  };
}

describe("PersistenceService", () => {
  let service: PersistenceService;

  beforeEach(() => {
    service = new PersistenceService();
  });

  describe("persistGeneration", () => {
    it("stores raw answers and generated artifacts separately", () => {
      const result = service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "gpt-4o",
        provider: "openai",
        modelTier: "balanced",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(1),
        roadmap: null,
        taskDraft: null,
        promptBundle: null,
      });

      // Answers stored separately
      expect(result.answerSnapshot).toBeDefined();
      expect(result.answerSnapshot.answers.length).toBe(2);
      expect(result.answerSnapshot.answerCount).toBe(2);

      // Blueprint stored as artifact
      expect(result.blueprint).toBeDefined();
      expect(result.blueprint!.type).toBe("blueprint");

      // Generation run recorded
      expect(result.run.model).toBe("gpt-4o");
      expect(result.run.sourceAnswerSnapshotId).toBe(result.answerSnapshot.snapshotId);
    });

    it("preserves all artifact types when provided", () => {
      const result = service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "gpt-4o",
        provider: "openai",
        modelTier: "balanced",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(1),
        roadmap: sampleRoadmap(1),
        taskDraft: sampleTaskDraft(1),
        promptBundle: samplePromptBundle(1),
      });

      expect(result.blueprint).toBeDefined();
      expect(result.roadmap).toBeDefined();
      expect(result.taskDraft).toBeDefined();
      expect(result.promptBundle).toBeDefined();
      expect(result.run.artifacts.length).toBe(4);
    });

    it("increments generation version automatically", () => {
      service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "gpt-4o",
        provider: "openai",
        modelTier: "balanced",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(1),
      });

      const result2 = service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "claude-sonnet-4",
        provider: "anthropic",
        modelTier: "strong",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(2),
      });

      expect(result2.run.generationVersion).toBe(2);
      expect(result2.run.model).toBe("claude-sonnet-4");
    });

    it("link artifacts to source answer snapshot", () => {
      const result = service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "gpt-4o",
        provider: "openai",
        modelTier: "balanced",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(1),
      });

      expect(result.blueprint!.lineage.sourceAnswerSnapshotId).toBe(result.answerSnapshot.snapshotId);
      expect(result.blueprint!.lineage.model).toBe("gpt-4o");
      expect(result.blueprint!.lineage.generationVersion).toBe(1);
    });
  });

  describe("retrieval", () => {
    it("getGenerationPackage returns all stored data", () => {
      const saved = service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "gpt-4o",
        provider: "openai",
        modelTier: "balanced",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(1),
        roadmap: sampleRoadmap(1),
      });

      const loaded = service.getGenerationPackage(saved.run.id);
      expect(loaded).toBeDefined();
      expect(loaded!.run.id).toBe(saved.run.id);
      expect(loaded!.answerSnapshot.snapshotId).toBe(saved.answerSnapshot.snapshotId);
      expect(loaded!.blueprint).toBeDefined();
      expect(loaded!.roadmap).toBeDefined();
    });

    it("getGenerationRuns lists all runs for a project", () => {
      service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "gpt-4o",
        provider: "openai",
        modelTier: "balanced",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(1),
      });
      service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "gpt-4o",
        provider: "openai",
        modelTier: "balanced",
        fallbackUsed: true,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(2),
      });

      const runs = service.getGenerationRuns("proj-1");
      expect(runs.length).toBe(2);
    });
  });

  describe("versioning", () => {
    it("multiple generations create separate versions", () => {
      service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "gpt-4o",
        provider: "openai",
        modelTier: "balanced",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(1),
      });
      service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "claude-sonnet-4",
        provider: "anthropic",
        modelTier: "strong",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(2),
      });

      const versions = service.listArtifactVersions("proj-1", "blueprint");
      expect(versions.length).toBe(2);
      expect(versions[0]!.version).toBe(1);
      expect(versions[1]!.version).toBe(2);
      expect(versions[0]!.lineage.model).toBe("gpt-4o");
      expect(versions[1]!.lineage.model).toBe("claude-sonnet-4");
    });

    it("prior versions remain accessible after new generation", () => {
      const v1 = service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "gpt-4o",
        provider: "openai",
        modelTier: "balanced",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(1),
      });
      const v2 = service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "gpt-4o",
        provider: "openai",
        modelTier: "balanced",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(2),
      });

      // Both answer snapshots exist
      expect(service.answers.getSnapshot(v1.answerSnapshot.snapshotId)).toBeDefined();
      expect(service.answers.getSnapshot(v2.answerSnapshot.snapshotId)).toBeDefined();

      // Both artifact versions exist
      expect(service.artifacts.getByTypeAndVersion("proj-1", "blueprint", 1)).toBeDefined();
      expect(service.artifacts.getByTypeAndVersion("proj-1", "blueprint", 2)).toBeDefined();
    });
  });

  describe("store separation", () => {
    it("raw answers are not mixed with generated artifacts in storage", () => {
      service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "gpt-4o",
        provider: "openai",
        modelTier: "balanced",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(1),
        roadmap: sampleRoadmap(1),
      });

      // Answer store only has answer snapshots
      const answers = service.answers.getSnapshotsBySession("session-1");
      expect(answers.length).toBe(1);
      expect(answers[0]!.answers).toBeDefined();
      expect(answers[0]!.answers[0]!.value).toBe("Build a chat app");

      // Artifact store only has generated artifacts
      const artifacts = service.artifacts.getByProject("proj-1");
      expect(artifacts.length).toBe(2);
      expect(artifacts[0]!.type).toBe("blueprint");
      expect(artifacts[1]!.type).toBe("roadmap");
    });

    it("can trace an artifact back to its source answers via lineage", () => {
      const saved = service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "gpt-4o",
        provider: "openai",
        modelTier: "balanced",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(1),
      });

      const answerSnapId = saved.blueprint!.lineage.sourceAnswerSnapshotId;
      const sourceAnswers = service.answers.getSnapshot(answerSnapId);
      expect(sourceAnswers).toBeDefined();
      expect(sourceAnswers!.answers[0]!.value).toBe("Build a chat app");
    });
  });

  describe("compareArtifactVersions", () => {
    it("returns the two requested versions", () => {
      service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "gpt-4o",
        provider: "openai",
        modelTier: "balanced",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(1),
      });
      service.persistGeneration({
        projectId: "proj-1",
        sessionId: "session-1",
        model: "gpt-4o",
        provider: "openai",
        modelTier: "balanced",
        fallbackUsed: false,
        routerDecision: null,
        answers: sampleAnswers,
        blueprint: sampleBlueprint(2),
      });

      const comparison = service.compareArtifactVersions("proj-1", "blueprint", 1, 2);
      expect(comparison.left).toBeDefined();
      expect(comparison.right).toBeDefined();
      expect(comparison.left!.version).toBe(1);
      expect(comparison.right!.version).toBe(2);
    });
  });
});

describe("standalone stores", () => {
  describe("createInMemoryAnswerStore", () => {
    it("captures and retrieves answer snapshots", () => {
      const store = createInMemoryAnswerStore();
      const snap = store.captureSnapshot("proj-1", "session-1", sampleAnswers);
      expect(snap.answerCount).toBe(2);
      expect(snap.version).toBe(1);
      expect(store.getSnapshot(snap.snapshotId)).toBeDefined();
      expect(store.getLatestAnswerVersion("proj-1")?.version).toBe(1);
    });

    it("increments version per capture", () => {
      const store = createInMemoryAnswerStore();
      store.captureSnapshot("proj-1", "session-1", sampleAnswers);
      store.captureSnapshot("proj-1", "session-1", sampleAnswers);
      expect(store.getLatestAnswerVersion("proj-1")?.version).toBe(2);
    });
  });

  describe("createInMemoryArtifactStore", () => {
    it("saves and retrieves by type and version", () => {
      const store = createInMemoryArtifactStore();
      store.save({
        id: "art-1",
        projectId: "proj-1",
        generationRunId: "run-1",
        type: "blueprint",
        content: "{}",
        version: 1,
        createdAt: new Date().toISOString(),
        lineage: {
          generationRunId: "run-1",
          sourceAnswerSnapshotId: "snap-1",
          generationVersion: 1,
          model: "gpt-4o",
          provider: "openai",
          sourceSessionId: "session-1",
        },
      });
      expect(store.getByTypeAndVersion("proj-1", "blueprint", 1)).toBeDefined();
      expect(store.getByTypeAndVersion("proj-1", "blueprint", 2)).toBeUndefined();
    });
  });
});
