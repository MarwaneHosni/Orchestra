import { describe, expect, it } from "vitest";
import { buildContextPack } from "../synthesis/synthesizer.js";
import { analyzeAnswers } from "../analysis/analyzer.js";
import { buildRoadmapAndTasks } from "../roadmap/generator.js";
import { generatePrompts } from "../prompt/generator.js";
import { validateAll } from "../validation/validator.js";
import { attemptRepair } from "../validation/repairer.js";
import { PersistenceService } from "../persistence/service.js";
import { PHASE_ORDER } from "../contract/output-schema.js";
import { QUESTIONS } from "../interview/questions.js";

function makeAnswer(phaseType: string, order: number, value: string) {
  return {
    id: `ans-${phaseType}.${order}`,
    questionId: `${phaseType}.${order}`,
    projectId: "e2e-proj",
    sessionId: "e2e-session",
    value,
    confidence: "high",
    provenance: "user",
    version: 1,
    isLatest: true,
    createdAt: new Date().toISOString(),
    supersededAt: null,
  };
}

function buildFullAnswerSet(): ReturnType<typeof makeAnswer>[] {
  return QUESTIONS.map((q) => {
    if (q.type === "boolean") return makeAnswer(q.phaseType, q.order, "true");
    if (q.type === "select") return makeAnswer(q.phaseType, q.order, q.options?.[0] ?? "Selected option");
    if (q.type === "multi_select")
      return makeAnswer(q.phaseType, q.order, q.options?.[0] ?? "Selected options");
    if (q.type === "scale") return makeAnswer(q.phaseType, q.order, "3");
    return makeAnswer(
      q.phaseType,
      q.order,
      "A detailed answer covering the question topic with sufficient depth for analysis.",
    );
  });
}

describe("E2E: full AI-first generation pipeline", () => {
  it("Stage 1 — synthesis: raw answers produce context pack in lifecycle order", () => {
    const answers = buildFullAnswerSet();
    const pack = buildContextPack("e2e-proj", "E2E Test Project", "e2e-session", answers);
    expect(pack.phases.length).toBe(PHASE_ORDER.length);
    expect(pack.summary.totalQuestions).toBe(QUESTIONS.length);
    expect(pack.summary.answeredQuestions).toBe(QUESTIONS.length);
    expect(pack.summary.unansweredRequired).toBe(0);
    for (let i = 0; i < PHASE_ORDER.length; i++) {
      expect(pack.phases[i]!.phaseType).toBe(PHASE_ORDER[i]);
    }
  });

  it("Stage 2 — analysis: context pack produces structured per-phase analysis", () => {
    const pack = buildContextPack("e2e-proj", "E2E Test Project", "e2e-session", buildFullAnswerSet());
    const analysis = analyzeAnswers(pack);
    expect(analysis.phases.length).toBe(PHASE_ORDER.length);
    expect(analysis.summary.totalPhases).toBe(PHASE_ORDER.length);
    for (const phase of analysis.phases) {
      expect(phase.inputStatus).toMatch(/^(sufficient|insufficient|missing)$/);
      expect(phase.subphases.length).toBeGreaterThan(0);
      expect(phase.dependencies).toBeDefined();
    }
    expect(analysis.crossPhase.overallInputStatus).toMatch(/^(sufficient|insufficient|mixed)$/);
  });

  it("Stage 3 — roadmap + tasks: analysis produces dependency-aware task draft", () => {
    const pack = buildContextPack("e2e-proj", "E2E Test Project", "e2e-session", buildFullAnswerSet());
    const analysis = analyzeAnswers(pack);
    const { roadmap, taskDraft } = buildRoadmapAndTasks(analysis);

    // Roadmap
    expect(roadmap.milestones.length).toBe(PHASE_ORDER.length);
    for (let i = 0; i < PHASE_ORDER.length; i++) {
      expect(roadmap.milestones[i]!.phaseType).toBe(PHASE_ORDER[i]);
    }
    expect(roadmap.totalEffort).toMatch(/^(small|medium|large)$/);

    // Task draft
    expect(taskDraft.tasks.length).toBeGreaterThan(0);
    const taskIds = new Set(taskDraft.tasks.map((t) => t.id));
    expect(taskIds.size).toBe(taskDraft.tasks.length);

    // All dependency refs point to existing tasks
    for (const task of taskDraft.tasks) {
      for (const dep of task.dependencies) {
        expect(taskIds.has(dep.taskId)).toBe(true);
      }
    }

    // Phase coverage
    const phasesWithTasks = new Set(taskDraft.tasks.map((t) => t.phaseType));
    for (const phase of PHASE_ORDER) {
      expect(phasesWithTasks.has(phase)).toBe(true);
    }
  });

  it("Stage 4 — prompts: every task gets a versioned execution prompt", () => {
    const pack = buildContextPack("e2e-proj", "E2E Test Project", "e2e-session", buildFullAnswerSet());
    const analysis = analyzeAnswers(pack);
    const { taskDraft } = buildRoadmapAndTasks(analysis);
    const bundle = generatePrompts(taskDraft.tasks, analysis, 1);

    expect(bundle.prompts.length).toBe(taskDraft.tasks.length);
    for (const prompt of bundle.prompts) {
      expect(prompt.sections.objective.length).toBeGreaterThan(10);
      expect(prompt.sections.context.length).toBeGreaterThan(10);
      expect(prompt.sections.constraints.length).toBeGreaterThan(0);
      expect(prompt.sections.expectedOutput.length).toBeGreaterThan(10);
      expect(prompt.sections.validationCriteria.length).toBeGreaterThan(0);
      expect(prompt.sections.architecturalAlignment.length).toBeGreaterThan(10);
      expect(prompt.sections.agentTips).toBeDefined();
      expect(prompt.lineage.sourcePhaseType).toBeTruthy();
      expect(PHASE_ORDER).toContain(prompt.lineage.sourcePhaseType);
      expect(prompt.lineage.planVersion).toBe(1);
    }
  });

  it("Stage 5 — validation: complete artifact set passes quality checks", () => {
    const pack = buildContextPack("e2e-proj", "E2E Test Project", "e2e-session", buildFullAnswerSet());
    const analysis = analyzeAnswers(pack);
    const { roadmap, taskDraft } = buildRoadmapAndTasks(analysis);
    const bundle = generatePrompts(taskDraft.tasks, analysis, 1);

    // Build a minimal blueprint-compatible object for validation
    const blueprintStub = {
      planId: "e2e-plan",
      planVersion: 1,
      projectId: "e2e-proj",
      sessionId: "e2e-session",
      createdAt: new Date().toISOString(),
      schemaVersion: "orchestra-generated-v1" as const,
      artifactType: "blueprint" as const,
      phases: PHASE_ORDER.map((p) => ({
        phaseType: p,
        phaseName: p,
        summary: "A high-level summary of this phase covering key goals and approach.",
        narrative:
          "A detailed AI-authored narrative describing the goals, approach, and tradeoffs for this phase of the project lifecycle.",
        status: "sufficient" as const,
        confidence: 0.85,
        keyDecisions: ["Key decision about implementation approach"],
        sourceAnswers: [
          { questionRef: `${p}.1`, questionText: "Sample question", normalizedValue: "Sample answer" },
        ],
      })),
      assumptions: [],
      constraints: [],
      risks: [],
      overallConfidence: 0.85,
      overallSummary:
        "A comprehensive project plan covering all lifecycle phases with detailed implementation guidance.",
      generationMetadata: {
        model: "gpt-4o",
        provider: "openai",
        generationId: "e2e-gen",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 1000,
        promptTokens: 500,
        completionTokens: 800,
        totalTokens: 1300,
        estimatedCost: 0.005,
        fallbackUsed: false,
      },
    };

    const result = validateAll({
      blueprint: blueprintStub,
      roadmap,
      taskDraft,
      promptBundle: bundle,
    });

    expect(result.outcome).toBe("pass");
  });

  it("Stage 6 — repair recovers weak prompt sections", () => {
    const pack = buildContextPack("e2e-proj", "E2E Test Project", "e2e-session", buildFullAnswerSet());
    const analysis = analyzeAnswers(pack);
    const { taskDraft } = buildRoadmapAndTasks(analysis);
    const bundle = generatePrompts(taskDraft.tasks, analysis, 1);

    // Intentionally weaken a prompt — short objective triggers PB003 warning
    bundle.prompts[0]!.sections.objective = "Hi";
    bundle.prompts[0]!.sections.expectedOutput = ""; // triggers PB005

    const result = validateAll({ promptBundle: bundle });
    expect(result.stats.warnings).toBeGreaterThan(0);

    const repaired = attemptRepair({ promptBundle: bundle }, result);
    const totalFixes = repaired.repairs.reduce((s, r) => s + r.fixes.length, 0);
    expect(totalFixes).toBeGreaterThan(0);
    // Verify the weak sections were repaired
    const fixedPrompt = repaired.promptBundle!.prompts[0]!;
    expect(fixedPrompt.sections.objective.length).toBeGreaterThan(10);
    expect(fixedPrompt.sections.expectedOutput.length).toBeGreaterThan(10);
  });

  it("Stage 7 — persistence: full generation run stored with lineage", () => {
    const pack = buildContextPack("e2e-proj", "E2E Test Project", "e2e-session", buildFullAnswerSet());
    const analysis = analyzeAnswers(pack);
    const { roadmap, taskDraft } = buildRoadmapAndTasks(analysis);
    const bundle = generatePrompts(taskDraft.tasks, analysis, 1);

    const svc = new PersistenceService();
    const saved = svc.persistGeneration({
      projectId: "e2e-proj",
      sessionId: "e2e-session",
      model: "gpt-4o",
      provider: "openai",
      modelTier: "balanced",
      fallbackUsed: false,
      routerDecision: null,
      answers: buildFullAnswerSet(),
      blueprint: null,
      roadmap,
      taskDraft,
      promptBundle: bundle,
    });

    expect(saved.run.model).toBe("gpt-4o");
    expect(saved.run.generationVersion).toBe(1);
    expect(saved.answerSnapshot.answerCount).toBeGreaterThan(0);
    expect(saved.roadmap).toBeDefined();
    expect(saved.taskDraft).toBeDefined();
    expect(saved.promptBundle).toBeDefined();

    // Lineage: trace prompt → generation run → source answers
    const promptLineage = saved.promptBundle!.lineage;
    expect(promptLineage.generationRunId).toBe(saved.run.id);
    expect(promptLineage.sourceAnswerSnapshotId).toBe(saved.answerSnapshot.snapshotId);
    expect(promptLineage.model).toBe("gpt-4o");

    // Source answers are retrievable separately
    const sourceAnswers = svc.answers.getSnapshot(saved.answerSnapshot.snapshotId);
    expect(sourceAnswers).toBeDefined();
    expect(sourceAnswers!.answers.length).toBeGreaterThan(0);
  });

  it("Stage 8 — multiple generations preserve version history", () => {
    const answers = buildFullAnswerSet();
    const pack = buildContextPack("e2e-proj", "E2E Test Project", "e2e-session", answers);
    const analysis = analyzeAnswers(pack);
    const { roadmap, taskDraft } = buildRoadmapAndTasks(analysis);

    const svc = new PersistenceService();

    // Generation 1
    svc.persistGeneration({
      projectId: "e2e-proj",
      sessionId: "e2e-session",
      model: "gpt-4o",
      provider: "openai",
      modelTier: "balanced",
      fallbackUsed: false,
      routerDecision: null,
      answers,
      blueprint: null,
      roadmap,
      taskDraft,
      promptBundle: null,
    });

    // Generation 2 with different model
    svc.persistGeneration({
      projectId: "e2e-proj",
      sessionId: "e2e-session",
      model: "claude-sonnet-4",
      provider: "anthropic",
      modelTier: "strong",
      fallbackUsed: true,
      routerDecision: "Fallback to anthropic",
      answers,
      blueprint: null,
      roadmap,
      taskDraft,
      promptBundle: null,
    });

    const runs = svc.getGenerationRuns("e2e-proj");
    expect(runs.length).toBe(2);
    expect(runs[0]!.generationVersion).toBe(1);
    expect(runs[0]!.model).toBe("gpt-4o");
    expect(runs[1]!.generationVersion).toBe(2);
    expect(runs[1]!.model).toBe("claude-sonnet-4");
    expect(runs[1]!.fallbackUsed).toBe(true);
  });

  it("full pipeline is deterministic for same inputs", () => {
    const answers = buildFullAnswerSet();

    const pack1 = buildContextPack("e2e-proj", "E2E", "s1", answers);
    const analysis1 = analyzeAnswers(pack1);
    const { roadmap: rm1, taskDraft: td1 } = buildRoadmapAndTasks(analysis1);
    const prompts1 = generatePrompts(td1.tasks, analysis1, 1);

    const pack2 = buildContextPack("e2e-proj", "E2E", "s1", answers);
    const analysis2 = analyzeAnswers(pack2);
    const { roadmap: rm2, taskDraft: td2 } = buildRoadmapAndTasks(analysis2);
    const prompts2 = generatePrompts(td2.tasks, analysis2, 1);

    expect(analysis1.summary).toEqual(analysis2.summary);
    expect(rm1.milestones.map((m) => m.title)).toEqual(rm2.milestones.map((m) => m.title));
    expect(td1.tasks.map((t) => ({ id: t.id, title: t.title }))).toEqual(
      td2.tasks.map((t) => ({ id: t.id, title: t.title })),
    );
    expect(prompts1.prompts.map((p) => p.sections.objective)).toEqual(
      prompts2.prompts.map((p) => p.sections.objective),
    );
  });
});
