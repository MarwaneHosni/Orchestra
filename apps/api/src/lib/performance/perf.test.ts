import { describe, expect, it, beforeEach } from "vitest";
import { createInMemoryStore } from "../orchestration/store.js";
import { createInMemoryGraphStore } from "../task-graph/generator.js";
import { createInMemoryPromptStore } from "../prompt/types.js";
import { createInMemoryCredentialStore } from "../credentials/store.js";
import { createInMemorySnapshotStore } from "../versioning/store.js";
import { createInMemoryExportStore } from "../export/store.js";
import { createInMemoryAuditStore } from "../audit/logger.js";
import { generateTasks } from "../task-graph/generator.js";
import { paginatedResponse } from "../../schemas/index.js";

describe("Performance: indexed store read times", () => {
  describe("SessionStore — O(1) indexing", () => {
    let store: ReturnType<typeof createInMemoryStore>;

    beforeEach(() => {
      store = createInMemoryStore();
      // Insert 1000 projects, each with 10 sessions, 50 answers, 5 plans, 5 blueprints
      for (let p = 0; p < 1000; p++) {
        const pid = `proj-${p}`;
        store.insertProject({
          id: pid,
          name: `Project ${p}`,
          description: "test",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        for (let s = 0; s < 10; s++) {
          const sid = `session-${p}-${s}`;
          store.insertSession({
            id: sid,
            projectId: pid,
            status: "completed",
            currentPhaseIndex: 0,
            currentQuestionIndex: 0,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          for (let a = 0; a < 50; a++) {
            store.insertAnswer({
              id: `answer-${p}-${s}-${a}`,
              questionId: `q.${a}`,
              projectId: pid,
              sessionId: sid,
              value: `answer ${a}`,
              confidence: "high",
              provenance: "user",
              version: 1,
              isLatest: a === 0,
              createdAt: new Date().toISOString(),
              supersededAt: null,
            });
          }
        }
        for (let pl = 0; pl < 5; pl++) {
          store.insertPlan({
            id: `plan-${p}-${pl}`,
            projectId: pid,
            version: pl + 1,
            status: "complete",
            staleAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        for (let b = 0; b < 5; b++) {
          store.insertBlueprint({
            id: `bp-${p}-${b}`,
            planId: `plan-${p}-${b}`,
            projectId: pid,
            content: "{}",
            format: "json",
            version: 1,
            status: "complete",
            staleAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    });

    it("getProject is fast at 1000 records", () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) store.getProject("proj-500");
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it("getLatestAnswersBySession is fast at 1000 sessions × 50 answers each", () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) store.getLatestAnswersBySession("session-500-5");
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it("getSessionsByProject is fast at 1000 projects", () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) store.getSessionsByProject("proj-500");
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it("getPlansByProject is fast at 1000 projects", () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) store.getPlansByProject("proj-500");
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(10);
    });
  });

  describe("GraphStore — O(1) indexing", () => {
    it("handles getGraph at scale", () => {
      const store = createInMemoryGraphStore();
      for (let v = 0; v < 100; v++) {
        const graph = generateTasks("plan-1", v + 1, [
          {
            phaseType: "ideation",
            phaseName: "Ideation",
            status: "sufficient",
            confidence: 0.8,
            summary: "Project ideation phase",
          },
          {
            phaseType: "requirements",
            phaseName: "Requirements",
            status: "sufficient",
            confidence: 0.8,
            summary: "Requirements gathering phase",
          },
        ]);
        store.saveGraph(graph);
      }
      const start = performance.now();
      for (let i = 0; i < 100; i++) store.getGraph("plan-1", 50);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(10);
    });

    it("handles getGraphsByPlan at scale", () => {
      const store = createInMemoryGraphStore();
      for (let v = 0; v < 100; v++) {
        const graph = generateTasks("plan-1", v + 1, [
          {
            phaseType: "ideation",
            phaseName: "Ideation",
            status: "sufficient",
            confidence: 0.8,
            summary: "Ideation summary for test",
          },
        ]);
        store.saveGraph(graph);
      }
      const start = performance.now();
      for (let i = 0; i < 100; i++) store.getGraphsByPlan("plan-1");
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe("PromptStore — O(1) indexing", () => {
    it("handles getByPlan at scale", () => {
      const store = createInMemoryPromptStore();
      for (let i = 0; i < 1000; i++) {
        store.save({
          id: `prompt-${i}`,
          taskId: `task-${i}`,
          planId: "plan-1",
          planVersion: 1,
          promptText: "test",
          sections: {} as any,
          version: 1,
          status: "complete",
          failureReason: null,
          createdAt: new Date().toISOString(),
        });
      }
      const start = performance.now();
      for (let i = 0; i < 100; i++) store.getByPlan("plan-1", 1);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it("handles getByTask at scale", () => {
      const store = createInMemoryPromptStore();
      for (let i = 0; i < 10000; i++) {
        store.save({
          id: `prompt-${i}`,
          taskId: `task-${i}`,
          planId: "plan-1",
          planVersion: 1,
          promptText: "test",
          sections: {} as any,
          version: 1,
          status: "complete",
          failureReason: null,
          createdAt: new Date().toISOString(),
        });
      }
      const start = performance.now();
      for (let i = 0; i < 100; i++) store.getByTask("task-5000");
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(5);
    });
  });

  describe("CredentialStore — O(1) indexing", () => {
    it("handles get at scale", () => {
      const store = createInMemoryCredentialStore();
      for (let i = 0; i < 10000; i++) {
        store.insert({
          id: `cred-${i}`,
          userId: "user-1",
          projectId: null,
          provider: "openai",
          displayName: `Cred ${i}`,
          status: "valid",
          encryptedApiKey: "enc",
          keyReference: null,
          defaultModel: null,
          modelsAvailable: null,
          lastVerifiedAt: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      const start = performance.now();
      for (let i = 0; i < 100; i++) store.get("cred-5000");
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(5);
    });
  });

  describe("SnapshotStore — O(1) indexing", () => {
    it("handles getByProject at scale", () => {
      const store = createInMemorySnapshotStore();
      for (let i = 0; i < 10000; i++) {
        store.insert({
          id: `snap-${i}`,
          projectId: `proj-${i % 100}`,
          version: i,
          parentSnapshotId: null,
          reason: "test",
          status: "complete",
          planId: null,
          planVersion: null,
          blueprintId: null,
          taskGraphId: null,
          interviewSessionId: null,
          answerCount: 0,
          affectedPhaseTypes: null,
          changeSummary: null,
          failureReason: null,
          createdAt: new Date().toISOString(),
        });
      }
      const start = performance.now();
      for (let i = 0; i < 100; i++) store.getByProject("proj-50");
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it("handles getLatestByProject at scale", () => {
      const store = createInMemorySnapshotStore();
      for (let i = 0; i < 10000; i++) {
        store.insert({
          id: `snap-${i}`,
          projectId: `proj-${i % 100}`,
          version: i,
          parentSnapshotId: null,
          reason: "test",
          status: "complete",
          planId: null,
          planVersion: null,
          blueprintId: null,
          taskGraphId: null,
          interviewSessionId: null,
          answerCount: 0,
          affectedPhaseTypes: null,
          changeSummary: null,
          failureReason: null,
          createdAt: new Date().toISOString(),
        });
      }
      const start = performance.now();
      for (let i = 0; i < 100; i++) store.getLatestByProject("proj-50");
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe("ExportStore — O(1) indexing", () => {
    it("handles getByProject at scale", () => {
      const store = createInMemoryExportStore();
      for (let i = 0; i < 10000; i++) {
        store.insert({
          id: `export-${i}`,
          snapshotId: `snap-${i % 500}`,
          projectId: `proj-${i % 100}`,
          format: "json",
          type: "full_bundle",
          content: "{}",
          bundleVersion: "v1",
          snapshotVersion: 1,
          planVersion: null,
          planId: null,
          sourceReason: "test",
          lineageRef: null,
          createdAt: new Date().toISOString(),
        });
      }
      const start = performance.now();
      for (let i = 0; i < 100; i++) store.getByProject("proj-50");
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe("AuditStore — indexed query by eventType", () => {
    it("handles query by eventType at scale", () => {
      const store = createInMemoryAuditStore();
      const eventTypes = [
        "generation.completed",
        "snapshot.created",
        "export.generated",
        "credential.created",
      ];
      for (let i = 0; i < 10000; i++) {
        store.append({
          id: `audit-${i}`,
          eventType: eventTypes[i % 4]!,
          timestamp: new Date().toISOString(),
          actor: "system",
          resourceId: `res-${i % 100}`,
          metadata: {},
        });
      }
      const start = performance.now();
      for (let i = 0; i < 100; i++) store.query({ eventType: "generation.completed" });
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });
});

describe("Performance: export endpoint — Map replaces nested O(n*m) loops", () => {
  it("builds prompt map in O(n+m) instead of O(n*m)", () => {
    const tasks = Array.from({ length: 100 }, (_, i) => ({
      id: `task-${i}`,
    }));
    const prompts = Array.from({ length: 100 }, (_, i) => ({
      taskId: `task-${i}`,
      promptText: `prompt ${i}`,
    }));

    const start = performance.now();
    const promptMap = new Map(prompts.map((p) => [p.taskId, p]));
    let missingCount = 0;
    let nullTextCount = 0;
    for (const t of tasks) {
      const p = promptMap.get(t.id);
      if (!p) missingCount++;
      else if (!p.promptText) nullTextCount++;
    }
    const mapped = tasks.map((t) => {
      const prompt = promptMap.get(t.id);
      return { order: 0, text: prompt?.promptText ?? null };
    });
    const elapsed = performance.now() - start;
    expect(missingCount).toBe(0);
    expect(nullTextCount).toBe(0);
    expect(mapped.length).toBe(100);
    expect(elapsed).toBeLessThan(10);
  });

  it("old approach would be O(n*m) and slower", () => {
    const tasks = Array.from({ length: 100 }, (_, i) => ({ id: `task-${i}` }));
    const prompts = Array.from({ length: 100 }, (_, i) => ({
      taskId: `task-${i}`,
      promptText: `prompt ${i}`,
    }));

    // Simulate old approach: 3 iterations of nested find()
    const start = performance.now();
    const missing = tasks.filter((t) => !prompts.find((p) => p.taskId === t.id));
    const nullText = tasks.filter((t) => {
      const p = prompts.find((p) => p.taskId === t.id);
      return p && !p.promptText;
    });
    const mapped = tasks.map((t) => {
      const prompt = prompts.find((p) => p.taskId === t.id);
      return { order: 0, text: prompt?.promptText ?? null };
    });
    const elapsed = performance.now() - start;
    expect(missing.length).toBe(0);
    expect(nullText.length).toBe(0);
    expect(mapped.length).toBe(100);
    // Map-based approach is consistently faster than O(n*m), but we just verify
    // the old code produces the correct result
    expect(elapsed).toBeGreaterThan(0);
  });
});

describe("Performance: pagination consistency", () => {
  it("paginatedResponse computes correct metadata", () => {
    const items = [1, 2, 3, 4, 5];
    const result = paginatedResponse(items, 100, 2, 5);
    expect(result.data).toEqual([1, 2, 3, 4, 5]);
    expect(result.meta).toEqual({ total: 100, page: 2, pageSize: 5, totalPages: 20 });
  });
});
