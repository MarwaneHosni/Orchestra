import { describe, expect, it } from "vitest";
import { analyzeAnswers } from "./analyzer.js";
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
      "A sufficiently detailed answer that is long enough to pass all validation checks.",
    );
  });
}

describe("analyzeAnswers", () => {
  it("produces an analysis record for every lifecycle phase", () => {
    const pack = buildContextPack("proj-1", "Test", "session-1", answerAllSufficiently());
    const analysis = analyzeAnswers(pack);
    expect(analysis.phases.length).toBe(PHASE_ORDER.length);
    for (let i = 0; i < PHASE_ORDER.length; i++) {
      expect(analysis.phases[i]!.phaseType).toBe(PHASE_ORDER[i]);
    }
  });

  it("marks all phases as sufficient when all questions answered well", () => {
    const pack = buildContextPack("proj-1", "Test", "session-1", answerAllSufficiently());
    const analysis = analyzeAnswers(pack);
    expect(analysis.summary.phasesWithSufficientInput).toBe(PHASE_ORDER.length);
    expect(analysis.summary.phasesWithMissingInput).toBe(0);
    expect(analysis.summary.phasesWithInsufficientInput).toBe(0);
    for (const phase of analysis.phases) {
      expect(phase.inputStatus).toBe("sufficient");
    }
  });

  it("marks phases as missing when no answers given", () => {
    const pack = buildContextPack("proj-1", "Test", "session-1", []);
    const analysis = analyzeAnswers(pack);
    expect(analysis.summary.phasesWithMissingInput).toBeGreaterThan(0);
    for (const phase of analysis.phases) {
      expect(phase.inputStatus).toBe("missing");
    }
  });

  it("detects ambiguity findings for vague answers", () => {
    const answers = QUESTIONS.map((q) => {
      if (q.type === "text") return makeAnswerForRef(q.phaseType, q.order, "I am not sure yet");
      if (q.type === "boolean") return makeAnswerForRef(q.phaseType, q.order, "true");
      return makeAnswerForRef(q.phaseType, q.order, q.options?.[0] ?? "A");
    });
    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    const analysis = analyzeAnswers(pack);
    const ambiguityFindings = analysis.phases.flatMap((p) =>
      p.findings.filter((f) => f.kind === "ambiguity"),
    );
    expect(ambiguityFindings.length).toBeGreaterThan(0);
  });

  it("records source links for each finding", () => {
    const answers = answerAllSufficiently();
    answers[0] = makeAnswerForRef("ideation", 1, "I am not sure yet");
    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    const analysis = analyzeAnswers(pack);
    const ideation = analysis.phases.find((p) => p.phaseType === "ideation")!;
    const findingsWithSources = ideation.findings.filter((f) => f.sources.length > 0);
    expect(findingsWithSources.length).toBeGreaterThan(0);
    for (const f of findingsWithSources) {
      expect(f.sources[0]!.questionRef).toBeTruthy();
      expect(f.sources[0]!.questionText).toBeTruthy();
    }
  });

  it("flags insufficient input for too-short answers", () => {
    const answers = QUESTIONS.map((q) => {
      if (q.type === "text") return makeAnswerForRef(q.phaseType, q.order, "Hi");
      if (q.type === "boolean") return makeAnswerForRef(q.phaseType, q.order, "true");
      return makeAnswerForRef(q.phaseType, q.order, q.options?.[0] ?? "A");
    });
    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    const analysis = analyzeAnswers(pack);
    const insufficientFindings = analysis.phases.flatMap((p) =>
      p.findings.filter((f) => f.kind === "insufficient_input"),
    );
    expect(insufficientFindings.length).toBeGreaterThan(0);
  });

  it("flags low confidence findings", () => {
    const answers = QUESTIONS.map((q) =>
      makeAnswerForRef(q.phaseType, q.order, "Some answer", { confidence: "low" }),
    );
    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    const analysis = analyzeAnswers(pack);
    const uncertaintyFindings = analysis.phases.flatMap((p) =>
      p.findings.filter((f) => f.kind === "uncertainty"),
    );
    expect(uncertaintyFindings.length).toBeGreaterThan(0);
  });

  it("reports uncertainty areas per phase", () => {
    const answers = QUESTIONS.map((q) =>
      makeAnswerForRef(q.phaseType, q.order, "I am not sure yet", { confidence: "low" }),
    );
    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    const analysis = analyzeAnswers(pack);
    const totalUncertainty = analysis.phases.reduce((sum, p) => sum + p.uncertaintyAreas.length, 0);
    expect(totalUncertainty).toBeGreaterThan(0);
    expect(analysis.summary.totalUncertaintyAreas).toBe(totalUncertainty);
  });

  it("extracts captureAs items into key decisions", () => {
    const captureQuestions = QUESTIONS.filter((q) => q.captureAs);
    if (captureQuestions.length === 0) return;
    const answers = answerAllSufficiently();
    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    const analysis = analyzeAnswers(pack);
    const allKeyDecisions = analysis.phases.flatMap((p) => p.keyDecisions);
    expect(allKeyDecisions.length).toBeGreaterThan(0);
    for (const d of allKeyDecisions) {
      expect(d.sourceRef).toBeTruthy();
      expect(d.description).toBeTruthy();
    }
  });

  it("reports cross-phase contradictions", () => {
    // Find a gated question
    const gatedQ = QUESTIONS.find((q) => q.dependsOn);
    if (!gatedQ) return;
    const gateRef = gatedQ.dependsOn!.questionRef;
    const expected = gatedQ.dependsOn!.expectedValue;
    const wrongValue = Array.isArray(expected) ? "not_matching" : "not_matching";

    const answers = answerAllSufficiently();
    // Override the GATE answer with a wrong value so the gated answer contradicts it
    const [gatePhase, gateOrderStr] = gateRef.split(".");
    if (!gatePhase || !gateOrderStr) return;
    const gateOrder = parseInt(gateOrderStr, 10);
    const gateAnswerIdx = answers.findIndex((a) => a.questionId === gateRef);
    if (gateAnswerIdx >= 0) {
      answers[gateAnswerIdx] = makeAnswerForRef(gatePhase, gateOrder, wrongValue);
    }

    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    const analysis = analyzeAnswers(pack);
    expect(analysis.crossPhase.contradictions.length).toBeGreaterThan(0);
    expect(analysis.summary.totalFindings).toBeGreaterThan(0);
  });

  it("includes project/session metadata", () => {
    const pack = buildContextPack("proj-x", "My Project", "session-y", answerAllSufficiently());
    const analysis = analyzeAnswers(pack);
    expect(analysis.projectId).toBe("proj-x");
    expect(analysis.projectName).toBe("My Project");
    expect(analysis.sessionId).toBe("session-y");
    expect(analysis.generatedAt).toBeTruthy();
    expect(() => new Date(analysis.generatedAt)).not.toThrow();
  });

  it("deterministic output for same input", () => {
    const pack = buildContextPack("proj-1", "Test", "session-1", answerAllSufficiently());
    const a1 = analyzeAnswers(pack);
    const a2 = analyzeAnswers(pack);
    expect(a1.summary).toEqual(a2.summary);
    expect(a1.phases.map((p) => p.inputStatus)).toEqual(a2.phases.map((p) => p.inputStatus));
    expect(a1.phases.map((p) => p.findings.length)).toEqual(a2.phases.map((p) => p.findings.length));
  });

  it("each phase finding has a kind, severity, and description", () => {
    const answers = answerAllSufficiently();
    // Make some answers problematic to get findings
    answers[0] = makeAnswerForRef("ideation", 1, "I am not sure yet", { confidence: "low" });
    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    const analysis = analyzeAnswers(pack);
    for (const phase of analysis.phases) {
      for (const f of phase.findings) {
        expect(f.kind).toBeTruthy();
        expect(f.severity).toMatch(/^(low|medium|high)$/);
        expect(f.description).toBeTruthy();
      }
    }
  });

  it("grades input status correctly — missing when no answers", () => {
    const pack = buildContextPack("proj-1", "Test", "session-1", []);
    const analysis = analyzeAnswers(pack);
    for (const phase of analysis.phases) {
      expect(phase.inputStatus).toBe("missing");
      expect(phase.findings.some((f) => f.kind === "insufficient_input")).toBe(true);
    }
  });

  it("output is structured enough for downstream consumption", () => {
    const pack = buildContextPack("proj-1", "Test", "session-1", answerAllSufficiently());
    const analysis = analyzeAnswers(pack);
    const ideation = analysis.phases.find((p) => p.phaseType === "ideation")!;
    expect(ideation.inferredRequirements).toBeDefined();
    expect(ideation.likelyConstraints).toBeDefined();
    expect(ideation.explicitAssumptions).toBeDefined();
    expect(ideation.identifiedRisks).toBeDefined();
    expect(ideation.keyDecisions).toBeDefined();
    expect(ideation.uncertaintyAreas).toBeDefined();
    expect(ideation.findings).toBeDefined();
    expect(ideation.dependencies).toBeDefined();
    expect(ideation.subphases).toBeDefined();
  });

  it("subphases match answer count per phase", () => {
    const pack = buildContextPack("proj-1", "Test", "session-1", answerAllSufficiently());
    const analysis = analyzeAnswers(pack);
    for (const phase of analysis.phases) {
      expect(phase.subphases.length).toBeGreaterThan(0);
      expect(phase.subphases.length).toBe(phase.answerCount + phase.missingRequiredCount);
      for (const sub of phase.subphases) {
        expect(sub.questionRef).toBeTruthy();
        expect(sub.questionText).toBeTruthy();
        expect(sub.order).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("subphases preserve order within phase", () => {
    const pack = buildContextPack("proj-1", "Test", "session-1", answerAllSufficiently());
    const analysis = analyzeAnswers(pack);
    for (const phase of analysis.phases) {
      const orders = phase.subphases.map((s) => s.order);
      const sorted = [...orders].sort((a, b) => a - b);
      expect(orders).toEqual(sorted);
    }
  });

  it("subphases capture flags for weak answers", () => {
    const answers = answerAllSufficiently();
    answers[0] = makeAnswerForRef("ideation", 1, "I am not sure yet", { confidence: "low" });
    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    const analysis = analyzeAnswers(pack);
    const ideation = analysis.phases.find((p) => p.phaseType === "ideation")!;
    const flaggedSub = ideation.subphases.find((s) => s.flags.length > 0);
    expect(flaggedSub).toBeDefined();
    expect(flaggedSub!.flags.some((f) => f.kind === "ambiguity")).toBe(true);
  });

  it("computes lifecycle dependencies for each phase", () => {
    const pack = buildContextPack("proj-1", "Test", "session-1", answerAllSufficiently());
    const analysis = analyzeAnswers(pack);
    // First phase (ideation) should have 0 lifecycle deps
    expect(analysis.phases[0]!.dependencies.length).toBe(0);
    // Second phase (requirements) should depend on ideation
    expect(analysis.phases[1]!.dependencies.some((d) => d.nature === "lifecycle")).toBe(true);
    // Later phases should have multiple lifecycle deps
    const lastPhase = analysis.phases[analysis.phases.length - 1]!;
    const lifecycleDeps = lastPhase.dependencies.filter((d) => d.nature === "lifecycle");
    expect(lifecycleDeps.length).toBeGreaterThan(0);
  });

  it("reports totalInferredDependencies in summary", () => {
    const pack = buildContextPack("proj-1", "Test", "session-1", answerAllSufficiently());
    const analysis = analyzeAnswers(pack);
    expect(analysis.summary.totalInferredDependencies).toBeGreaterThanOrEqual(0);
  });
});
