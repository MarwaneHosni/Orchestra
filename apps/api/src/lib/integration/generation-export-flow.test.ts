import { describe, expect, it } from "vitest";
import { OrchestrationService } from "../orchestration/orchestration.service.js";
import { createInMemoryStore } from "../orchestration/store.js";
import { generateTasks, createInMemoryGraphStore } from "../task-graph/generator.js";
import { assemblePrompt, createInMemoryPromptStore } from "../prompt/index.js";
import { VersioningService, createInMemorySnapshotStore } from "../versioning/index.js";
import { ExportService, createInMemoryExportStore } from "../export/index.js";
import type { PhaseInput } from "../task-graph/types.js";

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
  ].map((p) => ({
    phaseType: p,
    phaseName: p.charAt(0).toUpperCase() + p.slice(1),
    status: "sufficient" as const,
    confidence: 0.8,
    summary: `${p} summary`,
  }));
}

function completeInterview(orch: OrchestrationService, sessionId: string) {
  orch.startSession(sessionId);
  for (let i = 0; i < 100; i++) {
    const result = orch.getNextQuestion(sessionId);
    if (!result.question) break;
    orch.submitAnswer(sessionId, (result.question as any).id, "Integration test answer.", "high");
  }
}

describe("Connected workflow — full pipeline", () => {
  it("completes project → interview → blueprint → task graph → prompts → snapshot → export", () => {
    const orchStore = createInMemoryStore();
    const orch = new OrchestrationService(orchStore);

    // 1. Create project and complete interview
    const { sessionId } = orch.createProject({
      ideaText: "A workflow integration test project for connected services.",
    });
    completeInterview(orch, sessionId);

    const final = orch.getNextQuestion(sessionId);
    expect(final.question).toBeNull();
    const output: any = orch.generateBlueprint(sessionId);
    expect(output.phases).toHaveLength(12);

    // 2. Generate task graph from blueprint phases
    const phases: PhaseInput[] = output.phases.map((p: any) => ({
      phaseType: p.phaseType,
      phaseName: p.phaseName,
      status: p.status,
      confidence: p.confidence,
      summary: p.summary,
    }));
    const graph = generateTasks("plan-int", 1, phases);
    expect(graph.tasks.length).toBeGreaterThanOrEqual(18);

    // 3. Assemble prompts for all tasks
    const promptStore = createInMemoryPromptStore();
    for (const task of graph.tasks) {
      const artifact = assemblePrompt(
        {
          task,
          planName: "IntTest",
          allTasks: graph.tasks,
          predecessorOutputs: [],
          phaseSummary: task.phaseType,
        },
        promptStore,
        1,
      );
      expect(artifact.status).toBe("complete");
      expect(artifact.promptText.length).toBeGreaterThan(200);
    }

    // 4. Create snapshot
    const snapshotStore = createInMemorySnapshotStore();
    const graphStore = createInMemoryGraphStore();
    graphStore.saveGraph(graph);
    const versioner = new VersioningService(snapshotStore, graphStore, promptStore);
    const snapshot = versioner.createSnapshot({
      projectId: "proj-int",
      reason: "interview_complete",
      planId: "plan-int",
      planVersion: 1,
      taskGraphId: "tg-int",
      interviewSessionId: sessionId,
      answerCount: final.answered,
    });
    expect(snapshot.version).toBe(1);
    expect(snapshot.parentSnapshotId).toBeNull();
    expect(snapshot.status).toBe("complete");
    expect(snapshot.planId).toBe("plan-int");
    expect(snapshot.planVersion).toBe(1);
    expect(snapshot.taskGraphId).toBe("tg-int");
    expect(snapshot.interviewSessionId).toBe(sessionId);
    expect(snapshot.answerCount).toBe(final.answered);

    // Stored snapshot matches returned snapshot
    const storedSnapshot = snapshotStore.get(snapshot.id);
    expect(storedSnapshot).toBeDefined();
    expect(storedSnapshot!.planId).toBe("plan-int");
    expect(storedSnapshot!.planVersion).toBe(1);

    // 5. Export full bundle from snapshot
    const exportStore = createInMemoryExportStore();
    const exporter = new ExportService(snapshotStore, graphStore, promptStore, exportStore);
    const bundleMd = exporter.exportFullBundle(snapshot.id, { format: "markdown" });
    expect(bundleMd.format).toBe("markdown");
    expect(bundleMd.snapshotVersion).toBe(1);
    expect(bundleMd.content).toContain("# Orchestra Project Export");

    const bundleJson = exporter.exportFullBundle(snapshot.id, { format: "json" });
    expect(bundleJson.format).toBe("json");
    const parsed = JSON.parse(bundleJson.content);
    expect(parsed.snapshot.version).toBe(1);
    expect(parsed.taskGraph.length).toBeGreaterThan(0);
    expect(parsed.prompts.length).toBeGreaterThan(0);

    // 6. Verify export store persistence
    const bySnapshot = exportStore.getBySnapshot(snapshot.id);
    expect(bySnapshot.length).toBe(2);
  });

  it("generates, diffs, and exports two versions correctly", () => {
    const graphStore = createInMemoryGraphStore();
    const promptStore = createInMemoryPromptStore();

    // Create v1
    const v1 = generateTasks("plan-diff", 1, allPhases());
    graphStore.saveGraph(v1);
    for (const task of v1.tasks) {
      assemblePrompt(
        { task, planName: "Diff", allTasks: v1.tasks, predecessorOutputs: [], phaseSummary: task.phaseType },
        promptStore,
        1,
      );
    }

    // Create snapshot v1
    const snapshotStore = createInMemorySnapshotStore();
    const versioner = new VersioningService(snapshotStore, graphStore, promptStore);
    const s1 = versioner.createSnapshot({
      projectId: "proj-diff",
      reason: "initial",
      planId: "plan-diff",
      planVersion: 1,
      taskGraphId: "tg-diff-v1",
    });

    // Create v2 via regeneration
    const result = versioner.regenerate({
      projectId: "proj-diff",
      planId: "plan-diff",
      planVersion: 2,
      phases: allPhases(),
      changeReason: "Backend refined",
      changedPhaseTypes: ["backend"],
    });
    expect(result.escalatedToFull).toBe(false);
    expect(result.snapshot.version).toBeGreaterThan(s1.version);
    expect(result.snapshot.parentSnapshotId).toBe(s1.id);

    // Verify both versions exist
    const all = snapshotStore.getByProject("proj-diff");
    expect(all).toHaveLength(2);

    // Export from both versions
    const exportStore = createInMemoryExportStore();
    const exporter = new ExportService(snapshotStore, graphStore, promptStore, exportStore);

    const v1Export = exporter.exportFullBundle(s1.id, { format: "json" });
    const v2Export = exporter.exportFullBundle(result.snapshot.id, { format: "json" });

    expect(v1Export.snapshotVersion).toBe(1);
    expect(v2Export.snapshotVersion).toBe(2);
    expect(v1Export.snapshotId).toBe(s1.id);
    expect(v2Export.snapshotId).toBe(result.snapshot.id);
    expect(v1Export.id).not.toBe(v2Export.id);

    // Exports are persisted independently
    const storedV1 = exportStore.getBySnapshot(s1.id);
    expect(storedV1).toHaveLength(1);
    expect(storedV1[0]!.id).toBe(v1Export.id);

    // Old version 1 graph and prompts remain accessible
    const oldGraph = graphStore.getGraph("plan-diff", 1);
    expect(oldGraph).toBeDefined();
    const oldPrompts = promptStore.getByPlan("plan-diff", 1);
    expect(oldPrompts.length).toBeGreaterThan(0);
  });
});
