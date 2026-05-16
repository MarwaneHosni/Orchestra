import { describe, expect, it } from "vitest";
import { ExportService } from "./export.service.js";
import { createInMemoryExportStore } from "./store.js";
import { createInMemorySnapshotStore } from "../versioning/store.js";
import { createInMemoryGraphStore, generateTasks } from "../task-graph/generator.js";
import { createInMemoryPromptStore } from "../prompt/types.js";
import { assemblePrompt } from "../prompt/assembler.js";
import { EXPORT_BUNDLE_VERSION } from "./types.js";
import type { PhaseInput } from "../task-graph/types.js";

const PLAN_ID = "plan-export-test";
const PROJECT_ID = "proj-export-test";

function makePhase(
  phaseType: string,
  status: "sufficient" | "insufficient" | "missing" = "sufficient",
): PhaseInput {
  return {
    phaseType,
    phaseName: phaseType.charAt(0).toUpperCase() + phaseType.slice(1),
    status,
    confidence: 0.8,
    summary: `${phaseType} summary`,
  };
}

function allPhases(): PhaseInput[] {
  return [
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
}

function setupEnv() {
  const snapshotStore = createInMemorySnapshotStore();
  const graphStore = createInMemoryGraphStore();
  const promptStore = createInMemoryPromptStore();
  const exportStore = createInMemoryExportStore();

  const graph = generateTasks(PLAN_ID, 1, allPhases());
  graphStore.saveGraph(graph);

  for (const task of graph.tasks) {
    assemblePrompt(
      {
        task,
        planName: "ExportTest",
        allTasks: graph.tasks,
        predecessorOutputs: [],
        phaseSummary: task.phaseType,
      },
      promptStore,
      1,
    );
  }

  const snapshotId = crypto.randomUUID();
  const snapshot = {
    id: snapshotId,
    projectId: PROJECT_ID,
    version: 1,
    parentSnapshotId: null,
    reason: "initial",
    status: "complete" as const,
    planId: PLAN_ID,
    planVersion: 1,
    blueprintId: null,
    taskGraphId: "tg-1",
    interviewSessionId: null,
    answerCount: graph.tasks.length,
    affectedPhaseTypes: null,
    changeSummary: null,
    failureReason: null,
    createdAt: new Date().toISOString(),
  };
  snapshotStore.insert(snapshot);

  const service = new ExportService(snapshotStore, graphStore, promptStore, exportStore);
  return { snapshotStore, graphStore, promptStore, exportStore, service, snapshot, graph };
}

describe("ExportService - full bundle", () => {
  it("exports a full bundle in markdown format", () => {
    const { service, snapshot } = setupEnv();
    const result = service.exportFullBundle(snapshot.id, { format: "markdown" });

    expect(result.format).toBe("markdown");
    expect(result.type).toBe("full_bundle");
    expect(result.snapshotVersion).toBe(1);
    expect(result.snapshotId).toBe(snapshot.id);
    expect(result.content).toContain("# Orchestra Project Export");
    expect(result.content).toContain("## Blueprint");
    expect(result.content).toContain("## Task Graph");
    expect(result.content).toContain("## AI Prompt Bundle");
    expect(result.content).toContain("Set up Ideation foundations");
  });

  it("exports a full bundle in JSON format", () => {
    const { service, snapshot } = setupEnv();
    const result = service.exportFullBundle(snapshot.id, { format: "json" });

    expect(result.format).toBe("json");
    const parsed = JSON.parse(result.content);
    expect(parsed.exportFormat).toBe("orchestra-export-v1");
    expect(parsed.snapshot.version).toBe(1);
    expect(parsed.taskGraph).toBeDefined();
    expect(parsed.prompts).toBeDefined();
    expect(parsed.metadata.graphTaskCount).toBeGreaterThan(0);
  });

  it("rejects failed snapshots", () => {
    const { service, snapshotStore } = setupEnv();
    const failedId = crypto.randomUUID();
    snapshotStore.insert({
      id: failedId,
      projectId: PROJECT_ID,
      version: 2,
      parentSnapshotId: null,
      reason: "failed",
      status: "failed" as const,
      planId: null,
      planVersion: null,
      blueprintId: null,
      taskGraphId: null,
      interviewSessionId: null,
      answerCount: 0,
      affectedPhaseTypes: null,
      changeSummary: null,
      failureReason: "Something broke",
      createdAt: new Date().toISOString(),
    });

    expect(() => service.exportFullBundle(failedId, { format: "markdown" })).toThrow("cannot export");
  });
});

describe("ExportService - single artifact exports", () => {
  it("exports blueprint in markdown", () => {
    const { service, snapshot } = setupEnv();
    const result = service.exportBlueprint(snapshot.id, { format: "markdown" });

    expect(result.type).toBe("blueprint");
    expect(result.content).toContain("## Blueprint");
    expect(result.content).toContain(snapshot.reason);
  });

  it("exports blueprint in JSON", () => {
    const { service, snapshot } = setupEnv();
    const result = service.exportBlueprint(snapshot.id, { format: "json" });

    const parsed = JSON.parse(result.content);
    expect(parsed.exportType).toBe("blueprint");
    expect(parsed.snapshotVersion).toBe(1);
  });

  it("exports task graph in markdown", () => {
    const { service, snapshot } = setupEnv();
    const result = service.exportTaskGraph(snapshot.id, { format: "markdown" });

    expect(result.type).toBe("task_graph");
    expect(result.content).toContain("## Task Graph");
    expect(result.content).toContain("Ideation");
  });

  it("exports task graph in JSON", () => {
    const { service, snapshot } = setupEnv();
    const result = service.exportTaskGraph(snapshot.id, { format: "json" });

    const parsed = JSON.parse(result.content);
    expect(parsed.exportType).toBe("task_graph");
    expect(parsed.tasks.length).toBeGreaterThan(0);
  });

  it("exports prompts in markdown", () => {
    const { service, snapshot } = setupEnv();
    const result = service.exportPrompts(snapshot.id, { format: "markdown" });

    expect(result.type).toBe("prompts");
    expect(result.content).toContain("## AI Prompt Bundle");
    expect(result.content).toContain("# Execution Prompt");
  });

  it("exports prompts in JSON", () => {
    const { service, snapshot } = setupEnv();
    const result = service.exportPrompts(snapshot.id, { format: "json" });

    const parsed = JSON.parse(result.content);
    expect(parsed.exportType).toBe("prompts");
    expect(parsed.prompts.length).toBeGreaterThan(0);
  });
});

describe("ExportService - metadata and lineage", () => {
  it("includes version lineage in the record", () => {
    const { service, snapshot } = setupEnv();
    const result = service.exportFullBundle(snapshot.id, { format: "markdown" });

    expect(result.snapshotVersion).toBe(1);
    expect(result.planVersion).toBe(1);
    expect(result.bundleVersion).toBe("orchestra-export-v1");
    expect(result.sourceReason).toBe("initial");
  });

  it("includes lineage reference when parent exists", () => {
    const { service, snapshot, snapshotStore } = setupEnv();

    const childSnapshot = {
      id: crypto.randomUUID(),
      projectId: PROJECT_ID,
      version: 2,
      parentSnapshotId: snapshot.id,
      reason: "plan_regenerated",
      status: "complete" as const,
      planId: PLAN_ID,
      planVersion: 2,
      blueprintId: null,
      taskGraphId: "tg-2",
      interviewSessionId: null,
      answerCount: 20,
      affectedPhaseTypes: null,
      changeSummary: null,
      failureReason: null,
      createdAt: new Date().toISOString(),
    };
    snapshotStore.insert(childSnapshot);

    const result = service.exportFullBundle(childSnapshot.id, { format: "json" });
    expect(result.lineageRef).toBe(snapshot.id);
    expect(result.sourceReason).toBe("plan_regenerated");

    const parsed = JSON.parse(result.content);
    expect(parsed.snapshot.parentSnapshotId).toBe(snapshot.id);
  });

  it("preserves regeneration reason in markdown header", () => {
    const { service, snapshot } = setupEnv();
    const result = service.exportFullBundle(snapshot.id, { format: "markdown" });
    expect(result.content).toContain("initial");
    expect(result.content).toContain(EXPORT_BUNDLE_VERSION);
  });
});

describe("ExportService - determinism", () => {
  it("produces identical output on repeated runs", () => {
    const { service, snapshot } = setupEnv();

    const r1 = service.exportFullBundle(snapshot.id, { format: "json" });
    const r2 = service.exportFullBundle(snapshot.id, { format: "json" });

    const c1 = JSON.parse(r1.content);
    const c2 = JSON.parse(r2.content);

    // All content except exportedAt and id should match
    expect(c1.snapshot).toEqual(c2.snapshot);
    expect(c1.taskGraph).toEqual(c2.taskGraph);
    expect(c1.prompts).toEqual(c2.prompts);
  });
});

describe("ExportService - export store", () => {
  it("stores and retrieves exports", () => {
    const { service, snapshot } = setupEnv();

    const result = service.exportFullBundle(snapshot.id, { format: "json" });
    const retrieved = service.getExport(result.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(result.id);
  });

  it("lists exports by project", () => {
    const { service, snapshot } = setupEnv();

    service.exportFullBundle(snapshot.id, { format: "json" });
    service.exportBlueprint(snapshot.id, { format: "markdown" });

    const all = service.listExports(PROJECT_ID);
    expect(all.length).toBe(2);
  });

  it("lists exports by snapshot", () => {
    const { service, snapshot } = setupEnv();

    service.exportFullBundle(snapshot.id, { format: "json" });
    service.exportTaskGraph(snapshot.id, { format: "markdown" });

    const bySnapshot = service.listExportsBySnapshot(snapshot.id);
    expect(bySnapshot.length).toBe(2);
  });
});

describe("ExportService - error handling", () => {
  it("throws for missing snapshot", () => {
    const { service } = setupEnv();
    expect(() => service.exportFullBundle("missing", { format: "markdown" })).toThrow("not found");
  });
});
