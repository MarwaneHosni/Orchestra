import { describe, expect, it } from "vitest";
import { buildRoadmapAndTasks } from "./generator.js";
import { analyzeAnswers } from "../analysis/analyzer.js";
import { buildContextPack } from "../synthesis/synthesizer.js";
import { QUESTIONS, PHASE_ORDER } from "../interview/questions.js";
import type { AnswerRecord } from "../orchestration/types.js";

function makeAnswerForRef(
  phaseType: string,
  order: number,
  value: string,
  overrides?: Partial<AnswerRecord>,
): AnswerRecord {
  return {
    id: `ans-${phaseType}.${order}`,
    questionId: `${phaseType}.${order}`,
    projectId: "proj-1",
    sessionId: "session-1",
    value,
    confidence: "high",
    provenance: "user",
    version: 1,
    isLatest: true,
    createdAt: new Date().toISOString(),
    supersededAt: null,
    ...overrides,
  };
}

function answerAllSufficiently(): AnswerRecord[] {
  return QUESTIONS.map((q) => {
    if (q.type === "boolean") return makeAnswerForRef(q.phaseType, q.order, "true");
    if (q.type === "select") return makeAnswerForRef(q.phaseType, q.order, q.options?.[0] ?? "A");
    if (q.type === "multi_select") return makeAnswerForRef(q.phaseType, q.order, q.options?.[0] ?? "A");
    if (q.type === "scale") return makeAnswerForRef(q.phaseType, q.order, "3");
    return makeAnswerForRef(
      q.phaseType,
      q.order,
      "A sufficiently detailed answer long enough to pass validation checks.",
    );
  });
}

function buildAnalysis(answers: AnswerRecord[]) {
  const pack = buildContextPack("proj-1", "Test", "session-1", answers);
  return analyzeAnswers(pack);
}

describe("buildRoadmapAndTasks", () => {
  describe("roadmap", () => {
    it("has exactly 12 milestones matching lifecycle order", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { roadmap } = buildRoadmapAndTasks(analysis);
      expect(roadmap.milestones.length).toBe(PHASE_ORDER.length);
      for (let i = 0; i < PHASE_ORDER.length; i++) {
        expect(roadmap.milestones[i]!.phaseType).toBe(PHASE_ORDER[i]);
      }
    });

    it("milestones have unique titles and descriptions", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { roadmap } = buildRoadmapAndTasks(analysis);
      const titles = new Set(roadmap.milestones.map((m) => m.title));
      expect(titles.size).toBe(roadmap.milestones.length);
      for (const m of roadmap.milestones) {
        expect(m.description.length).toBeGreaterThan(10);
        expect(m.keyDeliverables.length).toBeGreaterThan(0);
      }
    });

    it("each milestone depends on the prior phase", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { roadmap } = buildRoadmapAndTasks(analysis);
      for (let i = 1; i < roadmap.milestones.length; i++) {
        expect(roadmap.milestones[i]!.dependsOn).toContain(PHASE_ORDER[i - 1]);
      }
    });

    it("has project metadata", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { roadmap } = buildRoadmapAndTasks(analysis);
      expect(roadmap.projectId).toBe("proj-1");
      expect(roadmap.projectName).toBe("Test");
      expect(roadmap.generatedAt).toBeTruthy();
      expect(roadmap.totalEffort).toMatch(/^(small|medium|large)$/);
    });
  });

  describe("task draft", () => {
    it("produces tasks for every non-missing phase", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      expect(taskDraft.tasks.length).toBeGreaterThanOrEqual(PHASE_ORDER.length);
    });

    it("every task has a valid phase type", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      for (const task of taskDraft.tasks) {
        expect(PHASE_ORDER).toContain(task.phaseType);
      }
    });

    it("tasks have acceptance criteria", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      for (const task of taskDraft.tasks) {
        expect(task.acceptanceCriteria.length).toBeGreaterThan(0);
        for (const c of task.acceptanceCriteria) {
          expect(c.length).toBeGreaterThan(5);
        }
      }
    });

    it("tasks have unique IDs", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      const ids = new Set(taskDraft.tasks.map((t) => t.id));
      expect(ids.size).toBe(taskDraft.tasks.length);
    });

    it("each task has a kind, priority, and order", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      for (const task of taskDraft.tasks) {
        expect(task.kind).toMatch(/^(code|config|test|docs|review|deploy|other)$/);
        expect(task.priority).toMatch(/^(low|medium|high|critical)$/);
        expect(task.order).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("dependency integrity", () => {
    it("all task dependency refs point to existing tasks", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      const taskIds = new Set(taskDraft.tasks.map((t) => t.id));
      for (const task of taskDraft.tasks) {
        for (const dep of task.dependencies) {
          expect(taskIds.has(dep.taskId)).toBe(true);
        }
      }
    });

    it("no circular dependencies across phases", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      const visited = new Set<string>();
      const checkCycle = (taskId: string, stack: Set<string>): boolean => {
        if (stack.has(taskId)) return true;
        if (visited.has(taskId)) return false;
        visited.add(taskId);
        stack.add(taskId);
        const task = taskDraft.tasks.find((t) => t.id === taskId);
        if (task) {
          for (const dep of task.dependencies) {
            if (checkCycle(dep.taskId, stack)) return true;
          }
        }
        stack.delete(taskId);
        return false;
      };
      for (const task of taskDraft.tasks) {
        expect(checkCycle(task.id, new Set())).toBe(false);
      }
    });

    it("dependencies only point to earlier-ordered tasks", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      for (const task of taskDraft.tasks) {
        for (const dep of task.dependencies) {
          const depTask = taskDraft.tasks.find((t) => t.id === dep.taskId);
          if (depTask) {
            expect(depTask.order).toBeLessThan(task.order);
          }
        }
      }
    });

    it("cross-phase dependencies respect lifecycle order", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      for (const task of taskDraft.tasks) {
        for (const dep of task.dependencies) {
          const depTask = taskDraft.tasks.find((t) => t.id === dep.taskId);
          if (depTask) {
            const taskPhaseIndex = PHASE_ORDER.indexOf(task.phaseType);
            const depPhaseIndex = PHASE_ORDER.indexOf(depTask.phaseType);
            expect(depPhaseIndex).toBeLessThanOrEqual(taskPhaseIndex);
          }
        }
      }
    });
  });

  describe("granularity and quality", () => {
    it("no task is too broad (description exists)", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      for (const task of taskDraft.tasks) {
        expect(task.description.length).toBeGreaterThan(20);
      }
    });

    it("tasks per phase are grouped in order", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      for (const phase of PHASE_ORDER) {
        const phaseTasks = taskDraft.tasks
          .filter((t) => t.phaseType === phase)
          .sort((a, b) => a.order - b.order);
        for (let i = 1; i < phaseTasks.length; i++) {
          expect(phaseTasks[i]!.order).toBeGreaterThan(phaseTasks[i - 1]!.order);
        }
      }
    });
  });

  describe("edge cases", () => {
    it("missing phase gets a review task", () => {
      const analysis = buildAnalysis([]);
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      const reviewTasks = taskDraft.tasks.filter((t) => t.kind === "review");
      expect(reviewTasks.length).toBe(PHASE_ORDER.length);
      for (const rt of reviewTasks) {
        expect(rt.dependsOnUnresolvedInput).toBe(true);
        expect(rt.uncertaintyNote).toBeTruthy();
      }
    });

    it("phases with uncertainty have tasks flagged", () => {
      const answers = QUESTIONS.map((q) => makeAnswerForRef(q.phaseType, q.order, "I am not sure yet"));
      const analysis = buildAnalysis(answers);
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      const flagged = taskDraft.tasks.filter((t) => t.dependsOnUnresolvedInput);
      expect(flagged.length).toBeGreaterThan(0);
    });

    it("phases with sufficient input have zero flagged tasks", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      const flagged = taskDraft.tasks.filter((t) => t.dependsOnUnresolvedInput);
      expect(flagged.length).toBe(0);
    });

    it("metadata is propagated", () => {
      const analysis = buildAnalysis(answerAllSufficiently());
      const { roadmap, taskDraft } = buildRoadmapAndTasks(analysis);
      expect(roadmap.projectId).toBe("proj-1");
      expect(taskDraft.projectId).toBe("proj-1");
      expect(roadmap.sessionId).toBe("session-1");
      expect(taskDraft.sessionId).toBe("session-1");
    });
  });
});
