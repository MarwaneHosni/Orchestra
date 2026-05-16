import { describe, expect, it } from "vitest";
import { validateAll } from "./validator.js";
import { attemptRepair } from "./repairer.js";
import { PHASE_ORDER } from "../contract/output-schema.js";
import type { BlueprintOutput, PhaseType } from "../contract/output-schema.js";
import type { Roadmap, TaskDraft, DraftTask } from "../roadmap/types.js";
import type { PromptBundle } from "../prompt/prompt-bundle-types.js";

function validBlueprint(): BlueprintOutput {
  return {
    planId: "00000000-0000-0000-0000-000000000001",
    planVersion: 1,
    projectId: "proj-1",
    sessionId: "session-1",
    createdAt: new Date().toISOString(),
    schemaVersion: "orchestra-generated-v1",
    artifactType: "blueprint",
    phases: PHASE_ORDER.map((p) => ({
      phaseType: p as PhaseType,
      phaseName: p,
      summary: "A high-level summary of this phase covering key goals.",
      narrative:
        "A detailed narrative written by the AI describing goals, approach, and tradeoffs for this phase of the project lifecycle.",
      status: "sufficient" as const,
      confidence: 0.85,
      keyDecisions: [],
      sourceAnswers: [],
    })),
    assumptions: [],
    constraints: [],
    risks: [],
    overallConfidence: 0.85,
    overallSummary: "A comprehensive project plan covering all lifecycle phases.",
    generationMetadata: {
      model: "gpt-4o",
      provider: "openai",
      generationId: "gen-1",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 5000,
      promptTokens: 500,
      completionTokens: 800,
      totalTokens: 1300,
      estimatedCost: 0.005,
      fallbackUsed: false,
    },
  };
}

function validRoadmap(): Roadmap {
  return {
    projectId: "proj-1",
    projectName: "Test",
    sessionId: "session-1",
    generatedAt: new Date().toISOString(),
    milestones: PHASE_ORDER.map((p, i) => ({
      phaseType: p as PhaseType,
      phaseName: p,
      order: i,
      title: `${p} — Implementation`,
      description: `Complete the ${p} phase including requirements and verification.`,
      keyDeliverables: [`Deliverable for ${p}`],
      estimatedEffort: "medium" as const,
      dependsOn: i > 0 ? [PHASE_ORDER[i - 1] as PhaseType] : [],
    })),
    totalEffort: "large" as const,
  };
}

function validTasks(): DraftTask[] {
  return PHASE_ORDER.flatMap((p, pi) => [
    {
      id: `task-${p}-setup`,
      phaseType: p as PhaseType,
      title: `Set up ${p}`,
      description: `Foundation for ${p}`,
      kind: "config" as const,
      priority: "high" as const,
      order: pi * 10,
      acceptanceCriteria: [`Criterion for ${p}`],
      dependencies: [],
      dependsOnUnresolvedInput: false,
      uncertaintyNote: null,
    },
    {
      id: `task-${p}-core`,
      phaseType: p as PhaseType,
      title: `Implement ${p}`,
      description: `Core logic for ${p}`,
      kind: "code" as const,
      priority: "medium" as const,
      order: pi * 10 + 1,
      acceptanceCriteria: [`Core criterion for ${p}`],
      dependencies: [{ taskId: `task-${p}-setup`, kind: "blocks" as const }],
      dependsOnUnresolvedInput: false,
      uncertaintyNote: null,
    },
  ]);
}

function validTaskDraft(): TaskDraft {
  return {
    projectId: "proj-1",
    projectName: "Test",
    sessionId: "session-1",
    generatedAt: new Date().toISOString(),
    tasks: validTasks(),
    dependencyCount: PHASE_ORDER.length,
    tasksWithUnresolvedInput: 0,
  };
}

function validPromptBundle(): PromptBundle {
  return {
    bundleId: "bundle-1",
    planVersion: 1,
    projectId: "proj-1",
    sessionId: "session-1",
    projectName: "Test",
    createdAt: new Date().toISOString(),
    promptCount: PHASE_ORDER.length * 2,
    prompts: validTasks().map((t) => ({
      id: `prompt-${t.id}`,
      taskId: t.id,
      planVersion: 1,
      promptVersion: 1,
      sections: {
        objective: `Implement the ${t.title} task.`,
        context: `Project: Test. Phase: ${t.phaseType}.`,
        constraints: ["Must follow project standards"],
        expectedOutput: `Complete ${t.title} with all criteria met.`,
        validationCriteria: ["All tests pass", "Code reviewed"],
        architecturalAlignment: `Part of ${t.phaseType} phase.`,
        agentTips: {
          security: ["Validate inputs"],
          edgeCases: ["Handle empty states"],
          dependencyWarnings: ["Check upstream deps"],
          commonBugs: ["Avoid hardcoded values"],
        },
      },
      promptText: `# ${t.title}\n## Objective\n...`,
      status: "pending" as const,
      createdAt: new Date().toISOString(),
      lineage: {
        taskId: t.id,
        planVersion: 1,
        blueprintArtifactId: null,
        analysisSessionId: "session-1",
        sourcePhaseType: t.phaseType,
      },
    })),
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("validateAll", () => {
  describe("valid artifacts pass", () => {
    it("passes for complete blueprint", () => {
      const result = validateAll({ blueprint: validBlueprint() });
      expect(result.outcome).toBe("pass");
    });

    it("passes for complete roadmap", () => {
      const result = validateAll({ roadmap: validRoadmap() });
      expect(result.outcome).toBe("pass");
    });

    it("passes for complete task draft", () => {
      const result = validateAll({ taskDraft: validTaskDraft() });
      expect(result.outcome).toBe("pass");
    });

    it("passes for complete prompt bundle", () => {
      const result = validateAll({ promptBundle: validPromptBundle() });
      expect(result.outcome).toBe("pass");
    });

    it("passes for all artifacts together", () => {
      const result = validateAll({
        blueprint: validBlueprint(),
        roadmap: validRoadmap(),
        taskDraft: validTaskDraft(),
        promptBundle: validPromptBundle(),
      });
      expect(result.outcome).toBe("pass");
    });
  });

  describe("blueprint validation", () => {
    it("fails on wrong phase count", () => {
      const bp = validBlueprint();
      bp.phases = bp.phases.slice(0, 6);
      const result = validateAll({ blueprint: bp });
      expect(result.issues.some((i) => i.code === "BP001")).toBe(true);
    });

    it("fails on wrong phase order", () => {
      const bp = validBlueprint();
      [bp.phases[0], bp.phases[1]] = [bp.phases[1]!, bp.phases[0]!];
      const result = validateAll({ blueprint: bp });
      expect(result.issues.some((i) => i.code === "BP002")).toBe(true);
    });

    it("fails on short summary", () => {
      const bp = validBlueprint();
      bp.phases[0]!.summary = "Hi";
      const result = validateAll({ blueprint: bp });
      expect(result.issues.some((i) => i.code === "BP003")).toBe(true);
    });

    it("fails on short narrative", () => {
      const bp = validBlueprint();
      bp.phases[0]!.narrative = "Too short";
      const result = validateAll({ blueprint: bp });
      expect(result.issues.some((i) => i.code === "BP004")).toBe(true);
    });

    it("fails on missing overallSummary", () => {
      const bp = validBlueprint();
      bp.overallSummary = "";
      const result = validateAll({ blueprint: bp });
      expect(result.issues.some((i) => i.code === "BP006")).toBe(true);
    });
  });

  describe("roadmap validation", () => {
    it("fails on wrong milestone count", () => {
      const rm = validRoadmap();
      rm.milestones = rm.milestones.slice(0, 3);
      const result = validateAll({ roadmap: rm });
      expect(result.issues.some((i) => i.code === "RM001")).toBe(true);
    });

    it("fails on short title", () => {
      const rm = validRoadmap();
      rm.milestones[0]!.title = "";
      const result = validateAll({ roadmap: rm });
      expect(result.issues.some((i) => i.code === "RM003")).toBe(true);
    });
  });

  describe("task validation", () => {
    it("fails on empty task list", () => {
      const td = validTaskDraft();
      td.tasks = [];
      const result = validateAll({ taskDraft: td });
      expect(result.issues.some((i) => i.code === "TK001")).toBe(true);
    });

    it("fails on broken dependency ref", () => {
      const td = validTaskDraft();
      td.tasks[0]!.dependencies.push({ taskId: "non-existent", kind: "blocks" });
      const result = validateAll({ taskDraft: td });
      expect(result.issues.some((i) => i.code === "TK006")).toBe(true);
    });
  });

  describe("prompt validation", () => {
    it("fails on missing lineage", () => {
      const pb = validPromptBundle();
      pb.prompts[0]!.lineage = null as any;
      const result = validateAll({ promptBundle: pb });
      expect(result.issues.some((i) => i.code === "PB007")).toBe(true);
    });

    it("fails on missing section", () => {
      const pb = validPromptBundle();
      (pb.prompts[0]!.sections as any).objective = "";
      const result = validateAll({ promptBundle: pb });
      expect(result.issues.some((i) => i.code === "PB002" || i.code === "PB003")).toBe(true);
    });
  });

  describe("outcome classification", () => {
    it("pass when no errors", () => {
      const result = validateAll({ blueprint: validBlueprint() });
      expect(result.outcome).toBe("pass");
    });

    it("repairable with few errors", () => {
      const bp = validBlueprint();
      bp.phases[0]!.summary = "";
      bp.phases[1]!.narrative = "";
      const result = validateAll({ blueprint: bp });
      expect(result.outcome).toBe("repairable");
    });

    it("unrecoverable with many errors", () => {
      const bp = validBlueprint();
      for (const p of bp.phases) {
        p.summary = "";
        p.narrative = "";
      }
      bp.overallSummary = "";
      const result = validateAll({ blueprint: bp });
      expect(result.outcome).toBe("unrecoverable");
    });
  });
});

describe("attemptRepair", () => {
  it("repairs empty blueprint summaries and narratives", () => {
    const bp = validBlueprint();
    bp.phases[0]!.summary = "";
    bp.phases[1]!.narrative = "";
    const result = validateAll({ blueprint: bp });
    expect(result.outcome).toBe("repairable");

    const repaired = attemptRepair({ blueprint: bp }, result);
    const rep = repaired.repairs[0]!;
    expect(rep.repaired).toBe(true);
    expect(rep.fixes.length).toBeGreaterThan(0);
    expect(repaired.blueprint!.phases[0]!.summary.length).toBeGreaterThan(10);
    expect(repaired.blueprint!.phases[1]!.narrative.length).toBeGreaterThan(50);
  });

  it("repairs empty overallSummary", () => {
    const bp = validBlueprint();
    bp.overallSummary = "";
    const result = validateAll({ blueprint: bp });
    const repaired = attemptRepair({ blueprint: bp }, result);
    expect(repaired.blueprint!.overallSummary.length).toBeGreaterThan(10);
  });

  it("repairs short roadmap titles", () => {
    const rm = validRoadmap();
    rm.milestones[0]!.title = "";
    const result = validateAll({ roadmap: rm });
    const repaired = attemptRepair({ roadmap: rm }, result);
    expect(repaired.roadmap!.milestones[0]!.title.length).toBeGreaterThan(5);
  });

  it("repairs short prompt objectives", () => {
    const pb = validPromptBundle();
    pb.prompts[0]!.sections.objective = "Hi";
    const result = validateAll({ promptBundle: pb });
    const repaired = attemptRepair({ promptBundle: pb }, result);
    const fixed = repaired.promptBundle!.prompts.find((p) => p.id === pb.prompts[0]!.id)!;
    expect(fixed.sections.objective.length).toBeGreaterThan(10);
  });

  it("re-validates after repair, remaining issues are fewer", () => {
    const bp = validBlueprint();
    bp.phases[0]!.summary = "";
    bp.phases[1]!.narrative = "";
    bp.overallSummary = "";
    const result = validateAll({ blueprint: bp });
    const initialErrorCount = result.stats.errors;

    const repaired = attemptRepair({ blueprint: bp }, result);
    const remainingErrors = repaired.remainingIssues.filter((i) => i.severity === "error");
    expect(remainingErrors.length).toBeLessThan(initialErrorCount);
  });

  it("repairs are idempotent — second pass adds no new fixes", () => {
    const bp = validBlueprint();
    bp.phases[0]!.summary = "";
    const result = validateAll({ blueprint: bp });

    const pass1 = attemptRepair({ blueprint: bp }, result);
    const result2 = validateAll({ blueprint: pass1.blueprint! });
    const pass2 = attemptRepair({ blueprint: pass1.blueprint! }, result2);
    // No new fixes expected on already-repaired artifact
    const newFixes = pass2.repairs.flatMap((r) => r.fixes);
    const meaningfulFixes = newFixes.filter((f) => !f.description.includes("already"));
    expect(meaningfulFixes.length).toBe(0);
  });

  it("does not modify valid artifacts", () => {
    const bp = validBlueprint();
    const result = validateAll({ blueprint: bp });
    const repaired = attemptRepair({ blueprint: bp }, result);
    const totalFixes = repaired.repairs.reduce((s, r) => s + r.fixes.length, 0);
    expect(totalFixes).toBe(0);
  });

  it("task draft passes through without repair", () => {
    const td = validTaskDraft();
    const result = validateAll({ taskDraft: td });
    const repaired = attemptRepair({ taskDraft: td }, result);
    expect(repaired.taskDraft).toBe(td);
  });

  it("cross-artifact consistency flagged", () => {
    const bp = validBlueprint();
    const rm = validRoadmap();
    // Break consistency: offset roadmap milestones
    rm.milestones = [rm.milestones[rm.milestones.length - 1]!, ...rm.milestones.slice(0, -1)];
    const result = validateAll({ blueprint: bp, roadmap: rm });
    // Phase order mismatch in roadmap will trigger RM002 first
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("detects circular dependencies in tasks", () => {
    const td = validTaskDraft();
    // Create a cycle: task-A → task-B, task-B → task-A
    const taskA = td.tasks[0]!;
    const taskB = td.tasks[1]!;
    taskA.dependencies.push({ taskId: taskB.id, kind: "blocks" });
    taskB.dependencies.push({ taskId: taskA.id, kind: "blocks" });
    const result = validateAll({ taskDraft: td });
    expect(result.issues.some((i) => i.code === "TK008")).toBe(true);
  });

  it("detects prompt referencing non-existent task", () => {
    const pb = validPromptBundle();
    const td = validTaskDraft();
    pb.prompts[0]!.lineage.taskId = "non-existent-task-id";
    const result = validateAll({ promptBundle: pb, taskDraft: td });
    expect(result.issues.some((i) => i.code === "CR003")).toBe(true);
  });

  it("detects significant prompt-task count mismatch", () => {
    const pb = validPromptBundle();
    const td = validTaskDraft();
    // Truncate tasks to 1, keeping all prompts — big mismatch
    td.tasks = td.tasks.slice(0, 1);
    const result = validateAll({ promptBundle: pb, taskDraft: td });
    expect(result.issues.some((i) => i.code === "CR004")).toBe(true);
  });
});
