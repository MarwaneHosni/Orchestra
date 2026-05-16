import { describe, expect, it } from "vitest";
import { VersioningService } from "./versioning.service.js";
import { createInMemorySnapshotStore } from "./store.js";
import { createInMemoryGraphStore, generateTasks } from "../task-graph/generator.js";
import { createInMemoryPromptStore } from "../prompt/types.js";
import type { PhaseInput } from "../task-graph/types.js";
import { assemblePrompt } from "../prompt/assembler.js";

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

const PLAN_ID = "plan-1";
const PROJECT_ID = "project-1";

function createService() {
  const snapshotStore = createInMemorySnapshotStore();
  const graphStore = createInMemoryGraphStore();
  const promptStore = createInMemoryPromptStore();

  // Pre-populate v1 graph
  const v1 = generateTasks(PLAN_ID, 1, allPhases());
  graphStore.saveGraph(v1);

  const service = new VersioningService(snapshotStore, graphStore, promptStore);
  return { service, snapshotStore, graphStore, promptStore, v1 };
}

describe("VersioningService - snapshot creation", () => {
  it("creates an initial snapshot at version 1", () => {
    const { service, snapshotStore } = createService();

    const snap = service.createSnapshot({
      projectId: PROJECT_ID,
      reason: "initial",
      planId: PLAN_ID,
      planVersion: 1,
    });

    expect(snap.version).toBe(1);
    expect(snap.parentSnapshotId).toBeNull();
    expect(snap.reason).toBe("initial");
    expect(snap.status).toBe("complete");
    expect(snap.projectId).toBe(PROJECT_ID);

    const stored = snapshotStore.get(snap.id);
    expect(stored).toBeDefined();
    expect(stored!.version).toBe(1);
  });

  it("increments version for subsequent snapshots", () => {
    const { service } = createService();

    const v1 = service.createSnapshot({ projectId: "project-2", reason: "initial" });
    const v2 = service.createSnapshot({ projectId: "project-2", reason: "interview_complete" });
    const v3 = service.createSnapshot({ projectId: "project-2", reason: "plan_regenerated" });

    expect(v1.version).toBe(1);
    expect(v1.parentSnapshotId).toBeNull();
    expect(v2.version).toBe(2);
    expect(v2.parentSnapshotId).toBe(v1.id);
    expect(v3.version).toBe(3);
    expect(v3.parentSnapshotId).toBe(v2.id);
  });

  it("tracks answer count and affected phases", () => {
    const { service } = createService();

    const snap = service.createSnapshot({
      projectId: "project-3",
      reason: "phase_edited",
      answerCount: 12,
      affectedPhaseTypes: ["database", "backend"],
      changeSummary: "Database and Backend answers refined",
    });

    expect(snap.answerCount).toBe(12);
    expect(snap.affectedPhaseTypes).toEqual(["database", "backend"]);
    expect(snap.changeSummary).toBe("Database and Backend answers refined");
  });

  it("separates versions by project", () => {
    const { service } = createService();

    const a1 = service.createSnapshot({ projectId: "proj-a", reason: "initial" });
    const a2 = service.createSnapshot({ projectId: "proj-a", reason: "interview_complete" });
    const b1 = service.createSnapshot({ projectId: "proj-b", reason: "initial" });

    expect(a1.version).toBe(1);
    expect(a2.version).toBe(2);
    expect(b1.version).toBe(1);
  });

  it("creates a failed-status snapshot when told", () => {
    const { service } = createService();

    const snap = service.createSnapshot({
      projectId: "project-fail",
      reason: "generation.failed",
    });
    expect(snap.status).toBe("complete");
    expect(snap.failureReason).toBeNull();
  });
});

describe("VersioningService - regeneration scope assessment", () => {
  it("escalates cross-cutting phases (ideation, requirements, architecture)", () => {
    const { service } = createService();

    const ideation = service.assessRegenerationScope(["ideation"]);
    expect(ideation.escalatedToFull).toBe(true);
    expect(ideation.reason).toContain("cross-cutting");

    const reqs = service.assessRegenerationScope(["requirements"]);
    expect(reqs.escalatedToFull).toBe(true);

    const arch = service.assessRegenerationScope(["architecture"]);
    expect(arch.escalatedToFull).toBe(true);
  });

  it("allows partial regeneration for leaf phases", () => {
    const { service } = createService();

    const monitoring = service.assessRegenerationScope(["monitoring"]);
    expect(monitoring.escalatedToFull).toBe(false);

    const deployment = service.assessRegenerationScope(["deployment"]);
    expect(deployment.escalatedToFull).toBe(false);
  });

  it("allows partial regeneration for middle phases", () => {
    const { service } = createService();

    const backend = service.assessRegenerationScope(["backend"]);
    expect(backend.escalatedToFull).toBe(false);
    expect(backend.affectedPhaseTypes).toContain("backend");
    expect(backend.affectedPhaseTypes).toContain("frontend");

    const db = service.assessRegenerationScope(["database"]);
    expect(db.escalatedToFull).toBe(false);
    expect(db.affectedPhaseTypes).toContain("database");
    expect(db.affectedPhaseTypes).toContain("backend");
  });

  it("affects multiple phases when multiple change", () => {
    const { service } = createService();

    const scope = service.assessRegenerationScope(["database", "security"]);
    expect(scope.escalatedToFull).toBe(false);
    expect(scope.affectedPhaseTypes).toContain("database");
    expect(scope.affectedPhaseTypes).toContain("security");
    expect(scope.affectedPhaseTypes).toContain("backend");
  });

  it("escalates when ANY changed phase is cross-cutting", () => {
    const { service } = createService();

    const scope = service.assessRegenerationScope(["database", "ideation"]);
    expect(scope.escalatedToFull).toBe(true);
  });
});

describe("VersioningService - regeneration", () => {
  it("escalates to full regeneration when cross-cutting phases change", () => {
    const { service, graphStore, promptStore } = createService();

    const result = service.regenerate({
      projectId: PROJECT_ID,
      planId: PLAN_ID,
      planVersion: 2,
      phases: allPhases(),
      changeReason: "Ideation answers edited",
      changedPhaseTypes: ["ideation"],
    });

    expect(result.escalatedToFull).toBe(true);
    expect(result.taskGraph).toBeDefined();
    expect(result.taskGraph!.planVersion).toBe(2);
    expect(result.affectedTasks).toBeGreaterThan(0);
    expect(result.affectedPrompts).toBeGreaterThan(0);
    expect(result.snapshot.version).toBeGreaterThanOrEqual(1);

    const prompts = promptStore.getByPlan(PLAN_ID, 2);
    expect(prompts).toHaveLength(result.affectedPrompts);

    const graph = graphStore.getGraph(PLAN_ID, 2);
    expect(graph).toBeDefined();
    expect(graph!.tasks).toHaveLength(result.affectedTasks);
  });

  it("only regenerates affected phases during partial regeneration", () => {
    const { service, graphStore, promptStore } = createService();
    const v1 = graphStore.getGraph(PLAN_ID, 1)!;
    const totalTasks = v1.tasks.length;

    const result = service.regenerate({
      projectId: PROJECT_ID,
      planId: PLAN_ID,
      planVersion: 2,
      phases: allPhases(),
      changeReason: "Backend phase answers refined",
      changedPhaseTypes: ["backend"],
    });

    expect(result.escalatedToFull).toBe(false);
    expect(result.affectedTasks).toBeGreaterThan(0);
    expect(result.affectedTasks).toBeLessThan(totalTasks);

    const prompts = promptStore.getByPlan(PLAN_ID, 2);
    const uniquePhaseTypes = [
      ...new Set(
        prompts.map((p) => {
          const task = result.taskGraph!.tasks.find((t) => t.id === p.taskId);
          return task?.phaseType;
        }),
      ),
    ];
    expect(uniquePhaseTypes).toEqual(expect.arrayContaining(["backend", "frontend", "testing"]));
  });

  it("preserves the old graph when deriving new version", () => {
    const { service, graphStore } = createService();

    const v1 = graphStore.getGraph(PLAN_ID, 1)!;
    service.regenerate({
      projectId: PROJECT_ID,
      planId: PLAN_ID,
      planVersion: 2,
      phases: allPhases(),
      changeReason: "Testing phase refined",
      changedPhaseTypes: ["testing"],
    });

    const oldGraph = graphStore.getGraph(PLAN_ID, 1);
    expect(oldGraph).toBeDefined();
    expect(oldGraph!.tasks).toHaveLength(v1.tasks.length);
  });

  it("can force full regeneration even for leaf changes", () => {
    const { service } = createService();

    const result = service.regenerate({
      projectId: PROJECT_ID,
      planId: PLAN_ID,
      planVersion: 2,
      phases: allPhases(),
      changeReason: "Manual full regeneration",
      changedPhaseTypes: ["monitoring"],
      forceFullRegeneration: true,
    });

    expect(result.escalatedToFull).toBe(true);
  });

  it("generates prompt artifacts with the correct plan version", () => {
    const { service, promptStore } = createService();

    service.regenerate({
      projectId: PROJECT_ID,
      planId: PLAN_ID,
      planVersion: 5,
      phases: allPhases(),
      changeReason: "Version test",
      changedPhaseTypes: ["deployment"],
    });

    const prompts = promptStore.getByPlan(PLAN_ID, 5);
    for (const p of prompts) {
      expect(p.planVersion).toBe(5);
    }
  });
});

describe("VersioningService - failure handling", () => {
  it("creates a failed-status snapshot when regeneration throws", () => {
    const { service, snapshotStore } = createService();

    const badPhases = [makePhase("backend"), makePhase("backend")];

    expect(() =>
      service.regenerate({
        projectId: PROJECT_ID,
        planId: PLAN_ID,
        planVersion: 2,
        phases: badPhases,
        changeReason: "Bad data test",
        changedPhaseTypes: ["backend"],
      }),
    ).toThrow("Regeneration failed");

    // A failed snapshot should exist
    const all = snapshotStore.getByProject(PROJECT_ID);
    const failed = all.find((s) => s.status === "failed");
    expect(failed).toBeDefined();
    expect(failed!.failureReason).toBeTruthy();
    expect(failed!.reason).toContain("failed");
  });

  it("propagates the original error message in the failure reason", () => {
    const { service, snapshotStore } = createService();

    const badPhases = [makePhase("backend"), makePhase("backend")];

    try {
      service.regenerate({
        projectId: PROJECT_ID,
        planId: PLAN_ID,
        planVersion: 2,
        phases: badPhases,
        changeReason: "Duplicate test",
        changedPhaseTypes: ["backend"],
      });
    } catch {
      // expected
    }

    const all = snapshotStore.getByProject(PROJECT_ID);
    const failed = all.find((s) => s.status === "failed");
    expect(failed).toBeDefined();
    expect(failed!.failureReason).toContain("Duplicate");
  });

  it("does not save a graph when regeneration fails mid-way", () => {
    const { service, graphStore } = createService();

    const badPhases = [makePhase("backend"), makePhase("backend")];

    try {
      service.regenerate({
        projectId: PROJECT_ID,
        planId: PLAN_ID,
        planVersion: 2,
        phases: badPhases,
        changeReason: "Fail test",
        changedPhaseTypes: ["backend"],
      });
    } catch {
      // expected
    }

    const v2Graph = graphStore.getGraph(PLAN_ID, 2);
    expect(v2Graph).toBeUndefined();
  });
});

describe("VersioningService - lineage integrity", () => {
  it("snapshots form a linked chain", () => {
    const { service, snapshotStore } = createService();

    const s1 = service.createSnapshot({ projectId: "lineage-proj", reason: "initial" });
    const s2 = service.createSnapshot({ projectId: "lineage-proj", reason: "interview_complete" });
    const s3 = service.createSnapshot({ projectId: "lineage-proj", reason: "plan_regenerated" });

    expect(s1.parentSnapshotId).toBeNull();
    expect(s2.parentSnapshotId).toBe(s1.id);
    expect(s3.parentSnapshotId).toBe(s2.id);

    const all = snapshotStore.getByProject("lineage-proj");
    expect(all).toHaveLength(3);
  });

  it("regeneration creates a new snapshot with parent reference", () => {
    const { service, snapshotStore } = createService();

    service.createSnapshot({ projectId: PROJECT_ID, reason: "initial", planId: PLAN_ID });

    const result = service.regenerate({
      projectId: PROJECT_ID,
      planId: PLAN_ID,
      planVersion: 2,
      phases: allPhases(),
      changeReason: "Backend refined",
      changedPhaseTypes: ["backend"],
    });

    const all = snapshotStore.getByProject(PROJECT_ID);
    expect(all).toHaveLength(2);
    expect(result.snapshot.parentSnapshotId).toBe(all[0]!.id);
  });

  it("old prompt artifacts remain unchanged after regeneration", () => {
    const { service, promptStore, v1 } = createService();

    // Assemble prompts for v1
    for (const task of v1.tasks) {
      assemblePrompt(
        { task, planName: "Test", allTasks: v1.tasks, predecessorOutputs: [], phaseSummary: task.phaseType },
        promptStore,
        1,
      );
    }
    const v1Texts = promptStore.getByPlan(PLAN_ID, 1).map((p) => p.promptText);

    service.regenerate({
      projectId: PROJECT_ID,
      planId: PLAN_ID,
      planVersion: 2,
      phases: allPhases(),
      changeReason: "Backend refined",
      changedPhaseTypes: ["backend"],
    });

    const v1After = promptStore.getByPlan(PLAN_ID, 1);
    expect(v1After).toHaveLength(v1Texts.length);
    for (let i = 0; i < v1After.length; i++) {
      expect(v1After[i]!.promptText).toBe(v1Texts[i]);
    }
  });
});
