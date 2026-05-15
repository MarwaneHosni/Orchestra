import { describe, expect, it } from "vitest";
import { generateTasks, createInMemoryGraphStore, deriveGraph, validatePhases } from "./generator.js";
import { assemblePrompt, createInMemoryPromptStore } from "../prompt/index.js";
import type { PhaseInput } from "./types.js";

function makePhase(
  phaseType: string,
  status: "sufficient" | "insufficient" | "missing" = "sufficient",
  confidence = 0.8,
): PhaseInput {
  return {
    phaseType,
    phaseName: phaseType.charAt(0).toUpperCase() + phaseType.slice(1),
    status,
    confidence,
    summary: `${phaseType} summary content`,
  };
}

describe("TaskGraphGenerator - input validation", () => {
  it("throws when planId is missing", () => {
    expect(() => (generateTasks as any)("", 1, [])).toThrow("planId is required");
  });
  it("throws when planVersion < 1", () => {
    expect(() => generateTasks("plan-1", 0, [makePhase("ideation")])).toThrow("planVersion must be >= 1");
  });
  it("throws when phases are empty", () => {
    expect(() => generateTasks("plan-1", 1, [])).toThrow("At least one phase is required");
  });
});

describe("TaskGraphGenerator - phase decomposition", () => {
  it("generates tasks for a single sufficient phase", () => {
    const graph = generateTasks("plan-1", 1, [makePhase("ideation")]);
    expect(graph.planVersion).toBe(1);
    expect(graph.tasks.length).toBeGreaterThanOrEqual(1);
    expect(graph.tasks.length).toBeLessThanOrEqual(2);
  });
  it("generates tasks for all 12 phases", () => {
    const phases: PhaseInput[] = [
      "ideation",
      "requirements",
      "architecture",
      "security",
      "database",
      "backend",
      "frontend",
      "core-features",
      "ai-systems",
      "testing",
      "deployment",
      "monitoring",
    ].map((p) => makePhase(p));
    const graph = generateTasks("plan-1", 1, phases);
    expect(graph.tasks.length).toBeGreaterThanOrEqual(18);
    expect(graph.tasks.length).toBeLessThanOrEqual(40);
    expect(graph.dependencies.length).toBeGreaterThan(0);
  });
  it("generates review task for missing phases", () => {
    const graph = generateTasks("plan-1", 1, [makePhase("security", "missing")]);
    expect(graph.tasks).toHaveLength(1);
    expect(graph.tasks[0]!.type).toBe("review");
    expect(graph.tasks[0]!.status).toBe("needs_review");
  });
  it("adds failureReason for missing phase tasks", () => {
    const graph = generateTasks("plan-1", 1, [makePhase("security", "missing")]);
    expect(graph.tasks[0]!.failureReason).toContain("missing");
  });
  it("generates additional pending_input task for insufficient phases", () => {
    const graph = generateTasks("plan-1", 1, [makePhase("backend", "insufficient")]);
    const pendingTasks = graph.tasks.filter((t) => t.type === "pending_input");
    expect(pendingTasks.length).toBeGreaterThan(0);
    expect(pendingTasks[0]!.status).toBe("needs_review");
  });
  it("adds failureReason for insufficient phase tasks", () => {
    const graph = generateTasks("plan-1", 1, [makePhase("backend", "insufficient")]);
    const pendingTasks = graph.tasks.filter((t) => t.type === "pending_input");
    expect(pendingTasks[0]!.failureReason).toContain("insufficient");
  });
  it("generates fewer tasks for insufficient phases", () => {
    const sufficient = generateTasks("plan-1", 1, [makePhase("backend", "sufficient")]);
    const insufficient = generateTasks("plan-1", 1, [makePhase("backend", "insufficient")]);
    expect(insufficient.tasks.length).toBeLessThanOrEqual(sufficient.tasks.length);
  });
});

describe("TaskGraphGenerator - dependencies", () => {
  it("creates within-phase sequential dependencies", () => {
    const graph = generateTasks("plan-1", 1, [makePhase("database")]);
    const deps = graph.dependencies.filter((d) => graph.tasks.some((t) => t.id === d.taskId));
    expect(deps.length).toBeGreaterThanOrEqual(1);
  });
  it("creates cross-phase blocking dependencies", () => {
    const phases: PhaseInput[] = ["ideation", "requirements"].map((p) => makePhase(p));
    const graph = generateTasks("plan-1", 1, phases);
    const crossPhase = graph.dependencies.filter((d) => {
      const task = graph.tasks.find((t) => t.id === d.taskId);
      const dep = graph.tasks.find((t) => t.id === d.dependsOnTaskId);
      return task && dep && task.phaseType !== dep.phaseType;
    });
    expect(crossPhase.length).toBeGreaterThan(0);
  });
  it("all dependencies are between existing tasks", () => {
    const phases: PhaseInput[] = ["ideation", "requirements", "architecture"].map((p) => makePhase(p));
    const graph = generateTasks("plan-1", 1, phases);
    const taskIds = new Set(graph.tasks.map((t) => t.id));
    for (const dep of graph.dependencies) {
      expect(taskIds.has(dep.taskId)).toBe(true);
      expect(taskIds.has(dep.dependsOnTaskId)).toBe(true);
    }
  });
});

describe("TaskGraphGenerator - status computation", () => {
  it("first task is ready, subsequent tasks are blocked by dependency", () => {
    const graph = generateTasks("plan-1", 1, [makePhase("ideation")]);
    const sorted = [...graph.tasks].sort((a, b) => a.order - b.order);
    expect(sorted[0]!.status).toBe("ready");
    if (sorted.length > 1) {
      expect(sorted[1]!.status).toBe("blocked");
    }
  });
});

describe("TaskGraphGenerator - snapshot stability", () => {
  it("graph structure snapshot is stable for same inputs (IDs excluded)", () => {
    const phases: PhaseInput[] = ["ideation", "requirements"].map((p) => makePhase(p));
    const graph = generateTasks("plan-snap", 1, phases);

    const phaseCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    for (const t of graph.tasks) {
      phaseCounts[t.phaseType] = (phaseCounts[t.phaseType] ?? 0) + 1;
      typeCounts[t.type] = (typeCounts[t.type] ?? 0) + 1;
      statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
    }

    const depTypes: Record<string, number> = {};
    for (const d of graph.dependencies) {
      depTypes[d.dependencyType] = (depTypes[d.dependencyType] ?? 0) + 1;
    }

    expect({
      phaseCounts,
      typeCounts,
      statusCounts,
      depTypes,
      totalTasks: graph.tasks.length,
      totalDeps: graph.dependencies.length,
    }).toMatchSnapshot();
  });

  it("graph shape is consistent for missing/insufficient phases", () => {
    const phases: PhaseInput[] = [
      makePhase("ideation", "missing"),
      makePhase("requirements", "insufficient"),
    ];
    const graph = generateTasks("plan-snap-2", 1, phases);

    const summary = graph.tasks.map((t) => ({
      phaseType: t.phaseType,
      type: t.type,
      status: t.status,
      hasFailureReason: !!t.failureReason,
    }));

    expect(summary).toMatchSnapshot();
  });

  it("prompt section content is deterministic", () => {
    const task = {
      id: "task-sec-1",
      planId: "plan-det",
      phaseType: "backend",
      title: "API error handling",
      type: "code" as const,
      priority: "high" as const,
      status: "ready" as const,
      order: 1,
      dependencies: [],
      acceptanceCriteria: ["Errors are caught and logged", "Stack traces never leak"],
      estimatedPromptRounds: 2,
    };
    const artifact = assemblePrompt(
      {
        task,
        planName: "SnapshotTest",
        allTasks: [task],
        predecessorOutputs: ["Middleware created"],
        phaseSummary: "Backend error handling",
      },
      undefined,
      1,
    );

    expect(artifact.sections).toMatchSnapshot();
  });

  it("formatPrompt output is deterministic", () => {
    const task = {
      id: "task-det-1",
      planId: "plan-det",
      phaseType: "backend",
      title: "API error handling",
      type: "code" as const,
      priority: "high" as const,
      status: "ready" as const,
      order: 1,
      dependencies: [],
      acceptanceCriteria: ["Errors are caught and logged", "Stack traces never leak"],
      estimatedPromptRounds: 2,
    };
    const artifact = assemblePrompt(
      {
        task,
        planName: "SnapshotTest",
        allTasks: [task],
        predecessorOutputs: ["Middleware created"],
        phaseSummary: "Backend error handling",
      },
      undefined,
      1,
    );

    const formattedLines = artifact.promptText.split("\n");
    const structure = formattedLines.filter((l) => l.startsWith("#")).map((l) => l.replace(/#{1,3} /, ""));

    expect({
      status: artifact.status,
      failureReason: artifact.failureReason,
      sections: [
        "objective length: " + artifact.sections.objective.length,
        "context length: " + artifact.sections.context.length,
        "constraints count: " + artifact.sections.constraints.length,
        "expectedOutput length: " + artifact.sections.expectedOutput.length,
        "validationCriteria count: " + artifact.sections.validationCriteria.length,
        "architecturalAlignment length: " + artifact.sections.architecturalAlignment.length,
        "agentTips security: " + artifact.sections.agentTips.security.length,
        "agentTips edgeCases: " + artifact.sections.agentTips.edgeCases.length,
        "agentTips dependencyWarnings: " + artifact.sections.agentTips.dependencyWarnings.length,
        "agentTips commonBugs: " + artifact.sections.agentTips.commonBugs.length,
      ],
      headingStructure: structure,
      totalLength: artifact.promptText.length,
    }).toMatchSnapshot();
  });
});

describe("validatePhases", () => {
  it("passes for valid phases", () => {
    const result = validatePhases([makePhase("ideation")]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects unknown phase type", () => {
    const result = validatePhases([
      {
        phaseType: "nonsense",
        phaseName: "Nonsense",
        status: "sufficient",
        confidence: 0.5,
        summary: "foo bar baz",
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("nonsense"))).toBe(true);
  });

  it("rejects duplicate phase types", () => {
    const result = validatePhases([makePhase("backend"), makePhase("backend")]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Duplicate"))).toBe(true);
  });

  it("rejects out-of-range confidence", () => {
    const result = validatePhases([{ ...makePhase("ideation"), confidence: 1.5 }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("confidence"))).toBe(true);
  });

  it("rejects short summary", () => {
    const result = validatePhases([{ ...makePhase("ideation"), summary: "ab" }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("summary"))).toBe(true);
  });

  it("warns on low confidence with sufficient status", () => {
    const result = validatePhases([{ ...makePhase("ideation"), confidence: 0.3 }]);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("confidence"))).toBe(true);
  });
});

describe("deriveGraph - regeneration", () => {
  it("creates a new graph version derived from an existing one", () => {
    const v1 = generateTasks("plan-reg", 1, [makePhase("ideation"), makePhase("requirements")]);
    const v2 = deriveGraph("plan-reg", 2, [makePhase("ideation"), makePhase("requirements")], v1);

    expect(v2.planVersion).toBe(2);
    expect(v2.derivedFromPlanVersion).toBe(1);
    expect(v2.tasks.length).toBe(v1.tasks.length);
    expect(v2.dependencies.length).toBe(v1.dependencies.length);
    expect(v2.tasks[0]!.id).not.toBe(v1.tasks[0]!.id);
  });

  it("preserves the old graph when deriving new version", () => {
    const store = createInMemoryGraphStore();
    const v1 = generateTasks("plan-reg-2", 1, [makePhase("ideation")]);
    store.saveGraph(v1);

    const v2 = deriveGraph("plan-reg-2", 2, [makePhase("ideation")], v1);
    store.saveGraph(v2);

    expect(store.getGraph("plan-reg-2", 1)).toBeDefined();
    expect(store.getGraph("plan-reg-2", 2)).toBeDefined();
    expect(store.getGraphsByPlan("plan-reg-2")).toHaveLength(2);
  });

  it("old prompt artifacts remain unchanged after regeneration", () => {
    const v1 = generateTasks("plan-stable", 1, [makePhase("ideation")]);
    const promptStore = createInMemoryPromptStore();
    const v1Prompts: string[] = [];
    for (const task of v1.tasks) {
      const a = assemblePrompt(
        {
          task,
          planName: "StableTest",
          allTasks: v1.tasks,
          predecessorOutputs: [],
          phaseSummary: task.phaseType,
        },
        promptStore,
        1,
      );
      v1Prompts.push(a.promptText);
    }

    const v2 = deriveGraph("plan-stable", 2, [makePhase("ideation")], v1);
    for (const task of v2.tasks) {
      assemblePrompt(
        {
          task,
          planName: "StableTest",
          allTasks: v2.tasks,
          predecessorOutputs: [],
          phaseSummary: task.phaseType,
        },
        promptStore,
        2,
      );
    }

    const retrievedV1 = promptStore.getByPlan("plan-stable", 1);
    expect(retrievedV1).toHaveLength(v1Prompts.length);
    for (let i = 0; i < retrievedV1.length; i++) {
      expect(retrievedV1[i]!.promptText).toBe(v1Prompts[i]!);
      expect(retrievedV1[i]!.planVersion).toBe(1);
    }
  });

  it("new prompts are created for derived graph with correct version", () => {
    const v1 = generateTasks("plan-reg-3", 1, [makePhase("ideation")]);
    const promptStore = createInMemoryPromptStore();
    for (const task of v1.tasks) {
      assemblePrompt(
        {
          task,
          planName: "RegTest",
          allTasks: v1.tasks,
          predecessorOutputs: [],
          phaseSummary: task.phaseType,
        },
        promptStore,
        1,
      );
    }

    const v2 = deriveGraph("plan-reg-3", 2, [makePhase("ideation")], v1);
    for (const task of v2.tasks) {
      assemblePrompt(
        {
          task,
          planName: "RegTest",
          allTasks: v2.tasks,
          predecessorOutputs: [],
          phaseSummary: task.phaseType,
        },
        promptStore,
        2,
      );
    }

    const v1Prompts = promptStore.getByPlan("plan-reg-3", 1);
    const v2Prompts = promptStore.getByPlan("plan-reg-3", 2);
    expect(v1Prompts).toHaveLength(v1.tasks.length);
    expect(v2Prompts).toHaveLength(v2.tasks.length);
    expect(v1Prompts[0]!.id).not.toBe(v2Prompts[0]!.id);
    expect(v1Prompts[0]!.planVersion).toBe(1);
    expect(v2Prompts[0]!.planVersion).toBe(2);
  });
});

describe("TaskGraphGenerator - reproducibility", () => {
  it("same inputs produce different task IDs but same counts", () => {
    const phases: PhaseInput[] = ["ideation", "requirements"].map((p) => makePhase(p));
    const g1 = generateTasks("plan-1", 1, phases);
    const g2 = generateTasks("plan-1", 1, phases);
    expect(g1.tasks.length).toBe(g2.tasks.length);
    expect(g1.dependencies.length).toBe(g2.dependencies.length);
    expect(g1.tasks[0]!.id).not.toBe(g2.tasks[0]!.id);
  });

  it("different inputs produce different graph structures", () => {
    const single = generateTasks("plan-diff", 1, [makePhase("ideation")]);
    const multi = generateTasks("plan-diff", 1, [makePhase("ideation"), makePhase("requirements")]);
    expect(multi.tasks.length).toBeGreaterThan(single.tasks.length);
    expect(multi.dependencies.length).toBeGreaterThan(single.dependencies.length);
    const multiPhaseTypes = new Set(multi.tasks.map((t) => t.phaseType));
    expect(multiPhaseTypes.has("ideation")).toBe(true);
    expect(multiPhaseTypes.has("requirements")).toBe(true);
  });

  it("different status inputs produce different task types", () => {
    const sufficient = generateTasks("plan-diff-2", 1, [makePhase("backend", "sufficient")]);
    const missing = generateTasks("plan-diff-2", 1, [makePhase("backend", "missing")]);
    expect(sufficient.tasks.every((t) => t.type !== "review")).toBe(true);
    expect(missing.tasks.every((t) => t.type === "review")).toBe(true);
  });
});

describe("TaskGraphStore", () => {
  it("saves and retrieves graphs", () => {
    const store = createInMemoryGraphStore();
    const graph = generateTasks("plan-store-1", 1, [makePhase("ideation")]);
    store.saveGraph(graph);
    const loaded = store.getGraph("plan-store-1", 1);
    expect(loaded).toBeDefined();
    expect(loaded!.tasks.length).toBe(graph.tasks.length);
  });
  it("lists graphs by plan", () => {
    const store = createInMemoryGraphStore();
    store.saveGraph(generateTasks("plan-store-2", 1, [makePhase("ideation")]));
    store.saveGraph(generateTasks("plan-store-2", 2, [makePhase("ideation")]));
    store.saveGraph(generateTasks("plan-store-3", 1, [makePhase("ideation")]));
    expect(store.getGraphsByPlan("plan-store-2")).toHaveLength(2);
    expect(store.getGraphsByPlan("plan-store-3")).toHaveLength(1);
  });
  it("rejects duplicate (planId, planVersion)", () => {
    const store = createInMemoryGraphStore();
    store.saveGraph(generateTasks("plan-dup", 1, [makePhase("ideation")]));
    expect(() => store.saveGraph(generateTasks("plan-dup", 1, [makePhase("ideation")]))).toThrow(
      "already exists",
    );
  });
});

describe("Export bundle", () => {
  it("produces a complete bundle with all prompts", () => {
    const graphStore = createInMemoryGraphStore();
    const promptStore = createInMemoryPromptStore();
    const phases: PhaseInput[] = ["ideation", "requirements"].map((p) => makePhase(p));
    const graph = generateTasks("plan-export", 1, phases);
    graphStore.saveGraph(graph);
    const allTasks = graph.tasks;
    for (const task of allTasks) {
      assemblePrompt(
        { task, planName: "ExportTest", allTasks, predecessorOutputs: [], phaseSummary: task.phaseType },
        promptStore,
        1,
      );
    }
    const tasks = allTasks;
    const prompts = promptStore.getByPlan("plan-export", 1);
    const missing = tasks.filter((t) => !prompts.find((p) => p.taskId === t.id));
    expect(prompts.length).toBe(tasks.length);
    expect(missing).toHaveLength(0);
    expect(prompts[0].promptText.length).toBeGreaterThan(200);
  });

  it("separates exports by version", () => {
    const graphStore = createInMemoryGraphStore();
    const promptStore = createInMemoryPromptStore();
    const phases = [makePhase("ideation")];

    const g1 = generateTasks("plan-export-v2", 1, phases);
    graphStore.saveGraph(g1);
    for (const task of g1.tasks) {
      assemblePrompt(
        { task, planName: "V1", allTasks: g1.tasks, predecessorOutputs: [], phaseSummary: task.phaseType },
        promptStore,
        1,
      );
    }

    const g2 = deriveGraph("plan-export-v2", 2, phases, g1);
    graphStore.saveGraph(g2);
    for (const task of g2.tasks) {
      assemblePrompt(
        { task, planName: "V2", allTasks: g2.tasks, predecessorOutputs: [], phaseSummary: task.phaseType },
        promptStore,
        2,
      );
    }

    const v1Prompts = promptStore.getByPlan("plan-export-v2", 1);
    const v2Prompts = promptStore.getByPlan("plan-export-v2", 2);
    const v1TaskIds = new Set(g1.tasks.map((t) => t.id));
    const v2TaskIds = new Set(g2.tasks.map((t) => t.id));

    expect(v1Prompts).toHaveLength(g1.tasks.length);
    expect(v2Prompts).toHaveLength(g2.tasks.length);
    expect(v1Prompts.every((p) => v1TaskIds.has(p.taskId))).toBe(true);
    expect(v2Prompts.every((p) => v2TaskIds.has(p.taskId))).toBe(true);
    expect(g2.derivedFromPlanVersion).toBe(1);
  });
});
