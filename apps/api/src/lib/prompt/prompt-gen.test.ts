import { describe, expect, it } from "vitest";
import { generatePrompts } from "./generator.js";
import { buildRoadmapAndTasks } from "../roadmap/generator.js";
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

function buildTasks() {
  const analysis = buildAnalysis(answerAllSufficiently());
  const { taskDraft } = buildRoadmapAndTasks(analysis);
  return { analysis, tasks: taskDraft.tasks };
}

const REQUIRED_SECTION_KEYS = [
  "objective",
  "context",
  "constraints",
  "expectedOutput",
  "validationCriteria",
  "architecturalAlignment",
  "agentTips",
] as const;

const REQUIRED_AGENT_TIP_KEYS = ["security", "edgeCases", "dependencyWarnings", "commonBugs"] as const;

describe("generatePrompts", () => {
  describe("completeness", () => {
    it("produces one prompt per task", () => {
      const { analysis, tasks } = buildTasks();
      const bundle = generatePrompts(tasks, analysis, 1);
      expect(bundle.prompts.length).toBe(tasks.length);
      expect(bundle.promptCount).toBe(tasks.length);
    });

    it("every prompt has all required sections", () => {
      const { analysis, tasks } = buildTasks();
      const bundle = generatePrompts(tasks, analysis, 1);
      for (const prompt of bundle.prompts) {
        for (const key of REQUIRED_SECTION_KEYS) {
          expect(prompt.sections).toHaveProperty(key);
        }
      }
    });

    it("every prompt has all agent tip subsections", () => {
      const { analysis, tasks } = buildTasks();
      const bundle = generatePrompts(tasks, analysis, 1);
      for (const prompt of bundle.prompts) {
        for (const key of REQUIRED_AGENT_TIP_KEYS) {
          expect(prompt.sections.agentTips).toHaveProperty(key);
          expect(Array.isArray((prompt.sections.agentTips as Record<string, string[]>)[key])).toBe(true);
        }
      }
    });

    it("objective is non-empty", () => {
      const { analysis, tasks } = buildTasks();
      const bundle = generatePrompts(tasks, analysis, 1);
      for (const prompt of bundle.prompts) {
        expect(prompt.sections.objective.length).toBeGreaterThan(10);
      }
    });

    it("context is non-empty", () => {
      const { analysis, tasks } = buildTasks();
      const bundle = generatePrompts(tasks, analysis, 1);
      for (const prompt of bundle.prompts) {
        expect(prompt.sections.context.length).toBeGreaterThan(10);
      }
    });

    it("constraints array has entries", () => {
      const { analysis, tasks } = buildTasks();
      const bundle = generatePrompts(tasks, analysis, 1);
      for (const prompt of bundle.prompts) {
        expect(prompt.sections.constraints.length).toBeGreaterThan(0);
      }
    });

    it("expectedOutput is non-empty", () => {
      const { analysis, tasks } = buildTasks();
      const bundle = generatePrompts(tasks, analysis, 1);
      for (const prompt of bundle.prompts) {
        expect(prompt.sections.expectedOutput.length).toBeGreaterThan(10);
      }
    });

    it("validationCriteria has entries", () => {
      const { analysis, tasks } = buildTasks();
      const bundle = generatePrompts(tasks, analysis, 1);
      for (const prompt of bundle.prompts) {
        expect(prompt.sections.validationCriteria.length).toBeGreaterThan(0);
      }
    });
  });

  describe("lineage", () => {
    it("every prompt has lineage with session ID and phase type", () => {
      const { analysis, tasks } = buildTasks();
      const bundle = generatePrompts(tasks, analysis, 1);
      for (const prompt of bundle.prompts) {
        expect(prompt.lineage.analysisSessionId).toBe("session-1");
        expect(prompt.lineage.sourcePhaseType).toBeTruthy();
        expect(PHASE_ORDER).toContain(prompt.lineage.sourcePhaseType);
        expect(prompt.lineage.planVersion).toBe(1);
      }
    });

    it("lineage taskId matches the source task", () => {
      const { analysis, tasks } = buildTasks();
      const bundle = generatePrompts(tasks, analysis, 1);
      for (const prompt of bundle.prompts) {
        expect(prompt.lineage.taskId).toBe(prompt.taskId);
      }
    });

    it("bundle has project and session metadata", () => {
      const { analysis, tasks } = buildTasks();
      const bundle = generatePrompts(tasks, analysis, 1);
      expect(bundle.projectId).toBe("proj-1");
      expect(bundle.sessionId).toBe("session-1");
      expect(bundle.projectName).toBe("Test");
      expect(bundle.planVersion).toBe(1);
    });
  });

  describe("status", () => {
    it("tasks with unresolved input get needs_review status", () => {
      const analysis = buildAnalysis([]);
      const { taskDraft } = buildRoadmapAndTasks(analysis);
      const bundle = generatePrompts(taskDraft.tasks, analysis, 1);
      const reviewPrompts = bundle.prompts.filter((p) => p.status === "needs_review");
      expect(reviewPrompts.length).toBeGreaterThan(0);
    });

    it("tasks with sufficient input get pending status", () => {
      const { analysis, tasks } = buildTasks();
      const bundle = generatePrompts(tasks, analysis, 1);
      const pendingPrompts = bundle.prompts.filter((p) => p.status === "pending");
      expect(pendingPrompts.length).toBeGreaterThan(0);
    });
  });

  describe("reproducibility", () => {
    it("same inputs produce same prompt count and section structure", () => {
      const { analysis, tasks } = buildTasks();
      const bundle1 = generatePrompts(tasks, analysis, 1);
      const bundle2 = generatePrompts(tasks, analysis, 1);
      expect(bundle1.prompts.length).toBe(bundle2.prompts.length);
      for (let i = 0; i < bundle1.prompts.length; i++) {
        expect(bundle1.prompts[i]!.sections.objective).toBe(bundle2.prompts[i]!.sections.objective);
        expect(bundle1.prompts[i]!.sections.context).toBe(bundle2.prompts[i]!.sections.context);
        expect(bundle1.prompts[i]!.sections.expectedOutput).toBe(bundle2.prompts[i]!.sections.expectedOutput);
        expect(bundle1.prompts[i]!.sections.constraints).toEqual(bundle2.prompts[i]!.sections.constraints);
        expect(bundle1.prompts[i]!.sections.validationCriteria).toEqual(
          bundle2.prompts[i]!.sections.validationCriteria,
        );
      }
    });

    it("different plan version changes lineage planVersion", () => {
      const { analysis, tasks } = buildTasks();
      const bundle1 = generatePrompts(tasks, analysis, 1);
      const bundle2 = generatePrompts(tasks, analysis, 2);
      expect(bundle1.planVersion).toBe(1);
      expect(bundle2.planVersion).toBe(2);
      for (const p of bundle1.prompts) {
        expect(p.lineage.planVersion).toBe(1);
      }
      for (const p of bundle2.prompts) {
        expect(p.lineage.planVersion).toBe(2);
      }
    });
  });

  describe("prompt text", () => {
    it("formatted prompt contains all section headings", () => {
      const { analysis, tasks } = buildTasks();
      const bundle = generatePrompts(tasks, analysis, 1);
      for (const prompt of bundle.prompts) {
        expect(prompt.promptText).toContain("#");
        expect(prompt.promptText).toContain("Objective");
        expect(prompt.promptText).toContain("Context");
        expect(prompt.promptText).toContain("Constraints");
        expect(prompt.promptText).toContain("Expected Output");
        expect(prompt.promptText).toContain("Validation Criteria");
        expect(prompt.promptText).toContain("Architectural Alignment");
      }
    });

    it("prompt text is within reasonable length", () => {
      const { analysis, tasks } = buildTasks();
      const bundle = generatePrompts(tasks, analysis, 1);
      for (const prompt of bundle.prompts) {
        expect(prompt.promptText.length).toBeGreaterThan(200);
        expect(prompt.promptText.length).toBeLessThan(10000);
      }
    });
  });
});
