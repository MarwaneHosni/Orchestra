import { describe, expect, it } from "vitest";
import { BlueprintGenerator } from "./generator.js";
import { normalizeText, isVague, isTooShort, buildSummary } from "./normalizer.js";
import { detectAmbiguity, detectConflicts } from "./ambiguity.js";
import { computePhaseConfidence, computeOverallConfidence } from "./confidence.js";
import { QUESTIONS } from "../interview/questions.js";

describe("BlueprintGenerator", () => {
  const generator = new BlueprintGenerator();

  function makeAnswers(count: number) {
    return QUESTIONS.slice(0, count).map((q, i) => ({
      id: `ans-${i}`,
      questionId: `${q.phaseType}.${q.order}`,
      projectId: "proj-1",
      sessionId: "sess-1",
      value: "A detailed answer that provides useful information about the project requirements and goals.",
      confidence: "high",
      provenance: "user",
      createdAt: new Date().toISOString(),
    }));
  }

  const project = {
    id: "proj-1",
    name: "Test Project",
    description: "A test project",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const session = {
    id: "sess-1",
    projectId: "proj-1",
    status: "ready_for_generation" as const,
    currentPhaseIndex: 0,
    currentQuestionIndex: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("produces a blueprint with all 12 phases", () => {
    const answers = makeAnswers(50);
    const output = generator.generate(project, session, answers, "plan-1", 1);
    expect(output.phases).toHaveLength(12);
    expect(output.planVersion).toBe(1);
    expect(output.projectName).toBe("Test Project");
  });

  it("assigns each phase a status", () => {
    const answers = makeAnswers(50);
    const output = generator.generate(project, session, answers, "plan-1", 1);
    for (const phase of output.phases) {
      expect(["sufficient", "insufficient", "missing"]).toContain(phase.status);
    }
  });

  it("includes overall confidence score", () => {
    const answers = makeAnswers(50);
    const output = generator.generate(project, session, answers, "plan-1", 1);
    expect(output.overallConfidence).toBeGreaterThanOrEqual(0);
    expect(output.overallConfidence).toBeLessThanOrEqual(1);
  });

  it("marks phases with no answers as missing", () => {
    const output = generator.generate(project, session, [], "plan-1", 1);
    for (const phase of output.phases) {
      if (phase.answers.length === 0) {
        expect(phase.status).toBe("missing");
      }
    }
  });

  it("flags ambiguity for missing required answers", () => {
    const output = generator.generate(project, session, [], "plan-1", 1);
    const missingFlags = output.ambiguityFlags.filter((f) => f.type === "missing");
    expect(missingFlags.length).toBeGreaterThan(0);
    for (const flag of missingFlags) {
      expect(flag.severity).toBe("high");
    }
  });

  it("collects structured assumptions, constraints, risks", () => {
    const answers = makeAnswers(50);
    const output = generator.generate(project, session, answers, "plan-1", 1);
    expect(Array.isArray(output.assumptions)).toBe(true);
    expect(Array.isArray(output.constraints)).toBe(true);
    expect(Array.isArray(output.risks)).toBe(true);
  });

  it("includes ambiguity flags array", () => {
    const output = generator.generate(project, session, [], "plan-1", 1);
    expect(Array.isArray(output.ambiguityFlags)).toBe(true);
  });
});

describe("normalizeText", () => {
  it("trims whitespace", () => {
    expect(normalizeText("  hello world  ")).toBe("hello world");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeText("hello    world")).toBe("hello world");
  });

  it("removes filler prefixes", () => {
    expect(normalizeText("I think this is a good idea")).toBe("this is a good idea");
    expect(normalizeText("maybe we could try something")).toBe("we could try something");
  });

  it("truncates long text", () => {
    const long = "a".repeat(2000);
    expect(normalizeText(long).length).toBe(1000);
  });
});

describe("isVague", () => {
  it("detects 'not sure'", () => {
    expect(isVague("not sure about this")).toBe(true);
  });

  it("detects 'TBD'", () => {
    expect(isVague("TBD")).toBe(true);
  });

  it("returns false for specific answers", () => {
    expect(isVague("We will use PostgreSQL with Redis caching")).toBe(false);
  });
});

describe("isTooShort", () => {
  it("flags short text answers", () => {
    expect(isTooShort("Yes", "text")).toBe(true);
  });

  it("ignores boolean answers", () => {
    expect(isTooShort("true", "boolean")).toBe(false);
  });

  it("ignores select answers", () => {
    expect(isTooShort("Web", "select")).toBe(false);
  });
});

describe("computePhaseConfidence", () => {
  it("returns 0 for no questions", () => {
    expect(computePhaseConfidence([], [], 0)).toBe(0);
  });

  it("returns 1 for all high-confidence answers", () => {
    const qs = QUESTIONS.filter((q) => q.phaseType === "ideation");
    const answers = qs.map((q) => ({
      id: "a",
      questionId: `${q.phaseType}.${q.order}`,
      projectId: "p",
      sessionId: "s",
      value: "A detailed answer with sufficient length for testing purposes here and now.",
      confidence: "high",
      provenance: "user",
      createdAt: new Date().toISOString(),
    }));
    const score = computePhaseConfidence(qs, answers, 0);
    expect(score).toBeGreaterThanOrEqual(0.7);
  });

  it("penalizes when ambiguity flags are present", () => {
    const qs = QUESTIONS.filter((q) => q.phaseType === "ideation");
    const answers = qs.map((q) => ({
      id: "a",
      questionId: `${q.phaseType}.${q.order}`,
      projectId: "p",
      sessionId: "s",
      value: "A detailed answer with sufficient length for testing purposes here and now.",
      confidence: "high",
      provenance: "user",
      createdAt: new Date().toISOString(),
    }));
    const clean = computePhaseConfidence(qs, answers, 0);
    const penalized = computePhaseConfidence(qs, answers, 5);
    expect(penalized).toBeLessThanOrEqual(clean);
  });
});

describe("computeOverallConfidence", () => {
  it("averages phase scores", () => {
    expect(computeOverallConfidence([1, 0.5, 0])).toBe(0.5);
  });

  it("returns 0 for empty array", () => {
    expect(computeOverallConfidence([])).toBe(0);
  });
});

describe("detectAmbiguity", () => {
  it("flags missing required questions as high severity", () => {
    const q = QUESTIONS.find((q) => q.phaseType === "ideation" && q.required)!;
    const flags = detectAmbiguity({ question: q, answer: undefined });
    expect(flags.some((f) => f.type === "missing" && f.severity === "high")).toBe(true);
  });

  it("flags low confidence answers", () => {
    const q = QUESTIONS.find((q) => q.phaseType === "ideation")!;
    const answer = {
      id: "a",
      questionId: `${q.phaseType}.${q.order}`,
      projectId: "p",
      sessionId: "s",
      value: "Some answer here with enough text to pass validation.",
      confidence: "low",
      provenance: "user",
      createdAt: new Date().toISOString(),
    };
    const flags = detectAmbiguity({ question: q, answer });
    expect(flags.some((f) => f.type === "low_confidence")).toBe(true);
  });
});

describe("detectConflicts", () => {
  it("flags when gate is false but follow-up has answer", () => {
    const answers = [
      {
        id: "a1",
        questionId: "requirements.2",
        projectId: "p",
        sessionId: "s",
        value: "false",
        confidence: "high",
        provenance: "user",
        createdAt: "",
      },
      {
        id: "a2",
        questionId: "requirements.3",
        projectId: "p",
        sessionId: "s",
        value: "Email + password",
        confidence: "high",
        provenance: "user",
        createdAt: "",
      },
    ];
    const flags = detectConflicts(answers);
    expect(flags.some((f) => f.type === "conflicting")).toBe(true);
  });

  it("does not flag when gate matches expected value", () => {
    const answers = [
      {
        id: "a1",
        questionId: "requirements.2",
        projectId: "p",
        sessionId: "s",
        value: "true",
        confidence: "high",
        provenance: "user",
        createdAt: "",
      },
      {
        id: "a2",
        questionId: "requirements.3",
        projectId: "p",
        sessionId: "s",
        value: "Email + password",
        confidence: "high",
        provenance: "user",
        createdAt: "",
      },
    ];
    const flags = detectConflicts(answers);
    expect(flags.some((f) => f.type === "conflicting")).toBe(false);
  });
});

describe("buildSummary", () => {
  it("joins answers with semicolons", () => {
    const result = buildSummary([
      { questionText: "Q1", normalizedValue: "Answer one" },
      { questionText: "Q2", normalizedValue: "Answer two" },
    ]);
    expect(result).toContain("Answer one");
    expect(result).toContain("Answer two");
  });

  it("returns empty string for no answers", () => {
    expect(buildSummary([])).toBe("");
  });
});
