import { describe, expect, it } from "vitest";
import { generateTasks, createInMemoryGraphStore } from "./generator.js";
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

describe("TaskGraphGenerator — input validation", () => {
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

describe("TaskGraphGenerator — phase decomposition", () => {
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

  it("generates additional pending_input task for insufficient phases", () => {
    const graph = generateTasks("plan-1", 1, [makePhase("backend", "insufficient")]);
    const pendingTasks = graph.tasks.filter((t) => t.type === "pending_input");
    expect(pendingTasks.length).toBeGreaterThan(0);
    expect(pendingTasks[0]!.status).toBe("needs_review");
  });

  it("generates fewer tasks for insufficient phases", () => {
    const sufficient = generateTasks("plan-1", 1, [makePhase("backend", "sufficient")]);
    const insufficient = generateTasks("plan-1", 1, [makePhase("backend", "insufficient")]);
    expect(insufficient.tasks.length).toBeLessThanOrEqual(sufficient.tasks.length);
  });
});

describe("TaskGraphGenerator — dependencies", () => {
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

describe("TaskGraphGenerator — status computation", () => {
  it("first task is ready, subsequent tasks are blocked by dependency", () => {
    const graph = generateTasks("plan-1", 1, [makePhase("ideation")]);
    const sorted = [...graph.tasks].sort((a, b) => a.order - b.order);
    expect(sorted[0]!.status).toBe("ready");
    if (sorted.length > 1) {
      expect(sorted[1]!.status).toBe("blocked");
    }
  });
});

describe("TaskGraphGenerator — reproducibility", () => {
  it("same inputs produce different task IDs but same counts", () => {
    const phases: PhaseInput[] = ["ideation", "requirements"].map((p) => makePhase(p));
    const g1 = generateTasks("plan-1", 1, phases);
    const g2 = generateTasks("plan-1", 1, phases);
    expect(g1.tasks.length).toBe(g2.tasks.length);
    expect(g1.dependencies.length).toBe(g2.dependencies.length);
    expect(g1.tasks[0]!.id).not.toBe(g2.tasks[0]!.id); // Different UUIDs
  });
});

describe("TaskGraphStore", () => {
  it("saves and retrieves graphs", () => {
    const store = createInMemoryGraphStore();
    const graph = generateTasks("plan-1", 1, [makePhase("ideation")]);
    store.saveGraph(graph);

    const loaded = store.getGraph("plan-1", 1);
    expect(loaded).toBeDefined();
    expect(loaded!.tasks.length).toBe(graph.tasks.length);
  });

  it("lists graphs by plan", () => {
    const store = createInMemoryGraphStore();
    store.saveGraph(generateTasks("plan-1", 1, [makePhase("ideation")]));
    store.saveGraph(generateTasks("plan-1", 2, [makePhase("ideation")]));
    store.saveGraph(generateTasks("plan-2", 1, [makePhase("ideation")]));

    expect(store.getGraphsByPlan("plan-1")).toHaveLength(2);
    expect(store.getGraphsByPlan("plan-2")).toHaveLength(1);
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
      );
    }

    const tasks = allTasks;
    const prompts = promptStore.getByPlan("plan-export", 1);
    const missing = tasks.filter((t) => !prompts.find((p) => p.taskId === t.id));

    expect(prompts.length).toBe(tasks.length);
    expect(missing).toHaveLength(0);
    expect(prompts[0].promptText.length).toBeGreaterThan(200);
  });
});
