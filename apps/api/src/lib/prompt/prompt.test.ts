import { describe, expect, it } from "vitest";
import { assemblePrompt } from "./assembler.js";
import { validatePrompt } from "./validator.js";
import { createInMemoryPromptStore } from "./types.js";
import type { TaskNode } from "../task-graph/types.js";
import type { TaskContext } from "./types.js";

function makeTask(overrides: Partial<TaskNode> = {}): TaskNode {
  return {
    id: "task-1",
    planId: "plan-1",
    phaseType: "backend",
    title: "Implement user authentication endpoint",
    type: "code",
    priority: "high",
    status: "ready",
    order: 1,
    dependencies: [],
    acceptanceCriteria: ["Users can register and log in", "Passwords are hashed"],
    estimatedPromptRounds: 3,
    ...overrides,
  };
}

function makeContext(overrides: Partial<TaskContext> = {}): TaskContext {
  return {
    task: makeTask(),
    planName: "TeamSync",
    allTasks: [makeTask()],
    predecessorOutputs: ["API contract defined in architecture phase"],
    phaseSummary: "Backend phase implementing REST API endpoints for user management.",
    ...overrides,
  };
}

describe("assemblePrompt", () => {
  it("produces a valid prompt artifact", () => {
    const artifact = assemblePrompt(makeContext());
    expect(artifact.id).toBeDefined();
    expect(artifact.taskId).toBe("task-1");
    expect(artifact.promptText).toBeDefined();
    expect(artifact.promptText.length).toBeGreaterThan(200);
    expect(artifact.status).toBe("complete");
    expect(artifact.failureReason).toBeNull();
  });

  it("includes all required sections in prompt text", () => {
    const artifact = assemblePrompt(makeContext());
    const sections = [
      "Objective",
      "Context",
      "Constraints",
      "Expected Output",
      "Validation Criteria",
      "Architectural Alignment",
      "Agent Tips",
    ];
    for (const section of sections) {
      expect(artifact.promptText).toContain(section);
    }
  });

  it("includes the task title in the objective", () => {
    const artifact = assemblePrompt(makeContext());
    expect(artifact.sections.objective).toContain("Implement user authentication endpoint");
  });

  it("includes predecessor outputs in context when available", () => {
    const ctx = makeContext({ predecessorOutputs: ["Auth middleware created"] });
    const artifact = assemblePrompt(ctx);
    expect(artifact.sections.context).toContain("Auth middleware created");
  });

  it("includes agent tips from buildAgentTips", () => {
    const artifact = assemblePrompt(makeContext());
    const tips = artifact.sections.agentTips;
    expect(tips.security.length).toBeGreaterThan(0);
    expect(tips.edgeCases.length).toBeGreaterThan(0);
    expect(tips.dependencyWarnings.length).toBeGreaterThan(0);
    expect(tips.commonBugs.length).toBeGreaterThan(0);
  });

  it("includes predecessor info when none exist", () => {
    const ctx = makeContext({ predecessorOutputs: [] });
    const artifact = assemblePrompt(ctx);
    expect(artifact.sections.context).toContain("first task");
  });

  it("adds code-specific common bugs for code tasks", () => {
    const ctx = makeContext({ task: makeTask({ type: "code" }) });
    const artifact = assemblePrompt(ctx);
    expect(artifact.sections.agentTips.commonBugs.some((b) => b.includes("promise"))).toBe(true);
  });

  it("accepts planVersion parameter", () => {
    const artifact = assemblePrompt(makeContext(), undefined, 3);
    expect(artifact.planVersion).toBe(3);
  });
});

describe("assemblePrompt - validation integration", () => {
  it("sets status = needs_review when prompt exceeds length threshold", () => {
    const ctx = makeContext({
      predecessorOutputs: [
        "A".repeat(800),
        "B".repeat(800),
        "C".repeat(800),
        "D".repeat(800),
        "E".repeat(800),
        "F".repeat(800),
      ],
    });
    const artifact = assemblePrompt(ctx);
    expect(artifact.promptText.length).toBeGreaterThan(5000);
    expect(artifact.status).toBe("needs_review");
    expect(artifact.failureReason).toContain("long");
  });

  it("sets status = complete for well-formed prompts", () => {
    const artifact = assemblePrompt(makeContext());
    expect(artifact.status).toBe("complete");
    expect(artifact.failureReason).toBeNull();
  });
});

describe("formatPrompt", () => {
  it("produces markdown with proper heading structure", () => {
    const artifact = assemblePrompt(makeContext());
    expect(artifact.promptText).toMatch(/^# Execution Prompt/);
    expect(artifact.promptText).toContain("## Objective");
    expect(artifact.promptText).toContain("## Context");
  });
});

describe("validatePrompt", () => {
  it("passes for a well-formed prompt", () => {
    const artifact = assemblePrompt(makeContext());
    const result = validatePrompt(artifact);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when objective is empty", () => {
    const ctx = makeContext();
    const artifact = assemblePrompt(ctx);
    artifact.sections.objective = "";
    const result = validatePrompt(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("objective"))).toBe(true);
  });

  it("fails when agent tips are empty", () => {
    const ctx = makeContext();
    const artifact = assemblePrompt(ctx);
    artifact.sections.agentTips = { security: [], edgeCases: [], dependencyWarnings: [], commonBugs: [] };
    const result = validatePrompt(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("tips"))).toBe(true);
  });

  it("warns on very long prompts", () => {
    const ctx = makeContext();
    const artifact = assemblePrompt(ctx);
    artifact.promptText = "x".repeat(6000);
    const result = validatePrompt(artifact);
    expect(result.warnings.some((w) => w.includes("long"))).toBe(true);
  });
});

describe("PromptStore", () => {
  it("persists and retrieves prompt artifacts", () => {
    const store = createInMemoryPromptStore();
    const ctx = makeContext();
    const artifact = assemblePrompt(ctx, store);

    const retrieved = store.getByTask(ctx.task.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(artifact.id);
  });

  it("lists prompts by plan and version", () => {
    const store = createInMemoryPromptStore();
    const ctx1 = makeContext({ task: makeTask({ id: "t1", planId: "p1" }) });
    const ctx2 = makeContext({ task: makeTask({ id: "t2", planId: "p1" }) });
    assemblePrompt(ctx1, store);
    assemblePrompt(ctx2, store);

    const prompts = store.getByPlan("p1", 1);
    expect(prompts).toHaveLength(2);
  });
});
