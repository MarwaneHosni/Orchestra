import { describe, expect, it } from "vitest";
import { buildContextPack } from "./synthesizer.js";
import { QUESTIONS, PHASE_ORDER } from "../interview/questions.js";
import type { AnswerRecord } from "../orchestration/types.js";

function makeAnswer(questionId: string, value: string, overrides?: Partial<AnswerRecord>): AnswerRecord {
  return {
    id: `ans-${questionId}-${Date.now()}`,
    questionId,
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

function makeAnswerForRef(
  phaseType: string,
  order: number,
  value: string,
  overrides?: Partial<AnswerRecord>,
): AnswerRecord {
  return makeAnswer(`${phaseType}.${order}`, value, overrides);
}

describe("buildContextPack", () => {
  it("includes every answer in order, all phases present", () => {
    const answers: AnswerRecord[] = [];
    const answered: string[] = [];

    // Answer every question with a meaningful value
    for (const q of QUESTIONS) {
      const ref = `${q.phaseType}.${q.order}`;
      if (q.type === "boolean") {
        answers.push(makeAnswerForRef(q.phaseType, q.order, "true"));
      } else if (q.type === "select") {
        answers.push(makeAnswerForRef(q.phaseType, q.order, q.options?.[0] ?? "answered"));
      } else if (q.type === "multi_select") {
        answers.push(makeAnswerForRef(q.phaseType, q.order, q.options?.[0] ?? "answered"));
      } else if (q.type === "scale") {
        answers.push(makeAnswerForRef(q.phaseType, q.order, "3"));
      } else {
        answers.push(
          makeAnswerForRef(q.phaseType, q.order, "A detailed answer that is long enough to pass validation."),
        );
      }
      answered.push(ref);
    }

    const pack = buildContextPack("proj-1", "Test Project", "session-1", answers);

    expect(pack.phases.length).toBe(PHASE_ORDER.length);
    expect(pack.allAnswers.length).toBe(QUESTIONS.length);
    expect(pack.summary.totalQuestions).toBe(QUESTIONS.length);
    expect(pack.summary.answeredQuestions).toBe(QUESTIONS.length);
    expect(pack.summary.unansweredRequired).toBe(0);
    expect(pack.gaps.length).toBe(0);
    expect(pack.contradictions.length).toBe(0);
  });

  it("flags missing required questions as gaps", () => {
    const answers = [makeAnswerForRef("ideation", 1, "A detailed answer")];
    const pack = buildContextPack("proj-1", "Test", "session-1", answers);

    expect(pack.summary.unansweredRequired).toBeGreaterThan(0);
    const missingReq = pack.gaps.filter((g) => g.type === "missing_required");
    expect(missingReq.length).toBeGreaterThan(0);
    for (const g of missingReq) {
      expect(g.type).toBe("missing_required");
    }
  });

  it("detects vague and too-short answers", () => {
    const answers: AnswerRecord[] = [];
    for (const q of QUESTIONS) {
      if (q.type === "text") {
        // Use vague for half the text questions, too-short for the other half
        const short = q.order % 2 === 0;
        answers.push(makeAnswerForRef(q.phaseType, q.order, short ? "Hi" : "I am not sure yet"));
      } else if (q.type === "boolean") {
        answers.push(makeAnswerForRef(q.phaseType, q.order, "true"));
      } else {
        answers.push(makeAnswerForRef(q.phaseType, q.order, "Some option"));
      }
    }

    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    expect(pack.summary.totalVague).toBeGreaterThan(0);
    expect(pack.summary.totalTooShort).toBeGreaterThan(0);
    expect(pack.weakAnswers.length).toBeGreaterThan(0);
  });

  it("detects low confidence flags", () => {
    const answers = QUESTIONS.map((q) =>
      makeAnswerForRef(q.phaseType, q.order, "Some answer", { confidence: "low" }),
    );

    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    expect(pack.summary.totalLowConfidence).toBeGreaterThan(0);
    const lowConfAnswers = pack.allAnswers.filter((a) => a.userConfidence === "low");
    expect(lowConfAnswers.length).toBeGreaterThan(0);
  });

  it("ignores superseded (non-latest) answers", () => {
    const answers = QUESTIONS.map((q) =>
      makeAnswerForRef(q.phaseType, q.order, "old answer", { version: 1, isLatest: false }),
    );

    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    expect(pack.summary.answeredQuestions).toBe(0);
  });

  it("includes edited answers from version > 1", () => {
    const q = QUESTIONS[0]!;
    const answers = [
      makeAnswerForRef(q.phaseType, q.order, "First version", { version: 1, isLatest: false }),
      makeAnswerForRef(q.phaseType, q.order, "Second version", { version: 2, isLatest: true }),
    ];

    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    const syn = pack.allAnswers.find((a) => a.questionRef === `${q.phaseType}.${q.order}`);
    expect(syn?.isPresent).toBe(true);
    expect(syn?.normalizedValue).toBe("Second version");
    expect(syn?.version).toBe(2);
    expect(syn?.flags.some((f) => f.type === "edited")).toBe(true);
  });

  it("maps answers to correct phases in lifecycle order", () => {
    const answers = QUESTIONS.map((q) => makeAnswerForRef(q.phaseType, q.order, "answer"));

    const pack = buildContextPack("proj-1", "Test", "session-1", answers);

    for (let i = 0; i < PHASE_ORDER.length; i++) {
      expect(pack.phases[i]!.phaseType).toBe(PHASE_ORDER[i]);
    }
  });

  it("produces deterministic output for same input", () => {
    const answers = QUESTIONS.map((q) => makeAnswerForRef(q.phaseType, q.order, "identical answer"));

    const pack1 = buildContextPack("proj-1", "Test", "session-1", answers);
    const pack2 = buildContextPack("proj-1", "Test", "session-1", answers);

    expect(pack1.allAnswers.length).toBe(pack2.allAnswers.length);
    expect(pack1.summary).toEqual(pack2.summary);
    expect(pack1.phases.map((p) => p.flagCount)).toEqual(pack2.phases.map((p) => p.flagCount));
  });

  it("reports correct per-phase stats", () => {
    // Answer only ideation questions
    const answers = QUESTIONS.filter((q) => q.phaseType === "ideation").map((q) =>
      makeAnswerForRef(q.phaseType, q.order, "A sufficiently detailed answer for testing purposes."),
    );

    const pack = buildContextPack("proj-1", "Test", "session-1", answers);

    const ideationPhase = pack.phases.find((p) => p.phaseType === "ideation")!;
    expect(ideationPhase.answeredCount).toBeGreaterThan(0);
    expect(ideationPhase.flagCount).toBe(0);

    const laterPhase = pack.phases.find((p) => p.phaseType === "requirements")!;
    expect(laterPhase.missingRequiredCount).toBeGreaterThan(0);
    expect(laterPhase.answeredCount).toBe(0);
  });

  it("captures skipped answers (empty string)", () => {
    const q = QUESTIONS.find((x) => x.type === "text" && x.required)!;
    const answers = [makeAnswerForRef(q.phaseType, q.order, "")];

    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    const syn = pack.allAnswers.find((a) => a.questionRef === `${q.phaseType}.${q.order}`);
    expect(syn?.isSkipped).toBe(true);
    expect(syn?.flags.some((f) => f.type === "skipped")).toBe(true);
  });

  it("detects gate contradictions", () => {
    // Find a question with a dependency (gate)
    const gatedQ = QUESTIONS.find((q) => q.dependsOn);
    if (!gatedQ) return; // skip if no gated questions exist

    const gateRef = gatedQ.dependsOn!.questionRef;
    const expected = gatedQ.dependsOn!.expectedValue;
    const contradictoryValue = Array.isArray(expected) ? "something_else" : "something_else";

    const answers: AnswerRecord[] = [
      makeAnswer(gateRef, contradictoryValue),
      makeAnswerForRef(gatedQ.phaseType, gatedQ.order, "A substantive answer that contradicts the gate"),
    ];

    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    expect(pack.contradictions.length).toBeGreaterThan(0);
    expect(pack.contradictions[0]!.questionRef).toBe(`${gatedQ.phaseType}.${gatedQ.order}`);
  });

  it("marks gated questions as missing_due_to_gate when gate not satisfied", () => {
    const gatedQ = QUESTIONS.find((q) => q.dependsOn);
    if (!gatedQ) return;

    const gateRef = gatedQ.dependsOn!.questionRef;
    const expected = gatedQ.dependsOn!.expectedValue;
    const wrongValue = Array.isArray(expected) ? "not_matching" : "not_matching";

    // Answer the gate question with a value that DOESN'T satisfy it, but DON'T answer the gated question
    const answers: AnswerRecord[] = [makeAnswer(gateRef, wrongValue)];

    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    const gatedGaps = pack.gaps.filter((g) => g.type === "missing_due_to_gate");
    expect(gatedGaps.length).toBeGreaterThan(0);
  });

  it("output is stable across repeated runs on same data", () => {
    const answers = QUESTIONS.slice(0, 5).map((q) =>
      makeAnswerForRef(q.phaseType, q.order, "Stable answer for testing determinism."),
    );

    const pack1 = buildContextPack("proj-1", "Test", "session-1", answers);
    const pack2 = buildContextPack("proj-1", "Test", "session-1", answers);

    expect(pack1.phases.length).toBe(pack2.phases.length);
    expect(pack1.allAnswers.length).toBe(pack2.allAnswers.length);
    expect(pack1.gaps.length).toBe(pack2.gaps.length);
    expect(pack1.summary).toEqual(pack2.summary);
  });

  it("phase groups appear in fixed lifecycle order", () => {
    const answers = QUESTIONS.filter((q) => q.required).map((q) =>
      makeAnswerForRef(q.phaseType, q.order, "Answer"),
    );

    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    const phaseTypes = pack.phases.map((p) => p.phaseType);
    expect(phaseTypes).toEqual(PHASE_ORDER);
  });

  it("each phase's answers appear in question order within the phase", () => {
    const answers = QUESTIONS.filter((q) => q.phaseType === "ideation").map((q) =>
      makeAnswerForRef(q.phaseType, q.order, "Answer for testing ordering."),
    );

    const pack = buildContextPack("proj-1", "Test", "session-1", answers);
    const ideation = pack.phases.find((p) => p.phaseType === "ideation")!;
    const orders = ideation.answers.map((a) => a.order);
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
  });

  it("reports project/session metadata", () => {
    const pack = buildContextPack("proj-x", "My Project", "session-y", []);
    expect(pack.projectId).toBe("proj-x");
    expect(pack.projectName).toBe("My Project");
    expect(pack.sessionId).toBe("session-y");
    expect(pack.generatedAt).toBeTruthy();
    expect(() => new Date(pack.generatedAt)).not.toThrow();
  });
});
