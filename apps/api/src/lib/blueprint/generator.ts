import { QUESTIONS, PHASE_ORDER, PHASE_LABELS } from "../interview/questions.js";
import { normalizeText, buildSummary } from "./normalizer.js";
import { detectAllAmbiguities } from "./ambiguity.js";
import { computePhaseConfidence, computeOverallConfidence } from "./confidence.js";
import type { AnswerRecord, SessionRecord, ProjectRecord } from "../orchestration/types.js";
import type { BlueprintOutput, PhaseBlueprint, PhaseAnswer, StructuredItem } from "./types.js";

export class BlueprintGenerator {
  generate(
    project: ProjectRecord,
    session: SessionRecord,
    answers: AnswerRecord[],
    planId: string,
    planVersion: number,
  ): BlueprintOutput {
    const allFlags = detectAllAmbiguities(QUESTIONS, answers);
    const answerMap = new Map(answers.map((a) => [a.questionId, a]));
    const phases: PhaseBlueprint[] = [];
    const assumptions: StructuredItem[] = [];
    const constraints: StructuredItem[] = [];
    const risks: StructuredItem[] = [];

    for (const phaseType of PHASE_ORDER) {
      const phaseQuestions = QUESTIONS.filter((q) => q.phaseType === phaseType);
      const phaseAnswers = phaseQuestions
        .map((q) => {
          const ref = `${q.phaseType}.${q.order}`;
          const raw = answerMap.get(ref);
          if (!raw) return null;
          return { q, raw };
        })
        .filter((x): x is { q: (typeof phaseQuestions)[number]; raw: AnswerRecord } => x !== null);

      const phaseAnswerRecords: PhaseAnswer[] = phaseAnswers.map(({ q, raw }) => ({
        questionRef: `${q.phaseType}.${q.order}`,
        questionText: q.text,
        normalizedValue: normalizeText(raw.value),
        originalValue: raw.value,
        confidence: raw.confidence as "high" | "medium" | "low",
        required: q.required,
      }));

      const phaseFlags = allFlags.filter((f) => {
        const parts = f.questionRef?.split(".");
        return parts && parts[0] === phaseType;
      });

      const answeredRequired = phaseQuestions.filter(
        (q) => q.required && answerMap.has(`${q.phaseType}.${q.order}`),
      ).length;
      const totalRequired = phaseQuestions.filter((q) => q.required).length;

      let status: "sufficient" | "insufficient" | "missing";
      if (totalRequired === 0) {
        status = "sufficient";
      } else if (answeredRequired === 0) {
        status = "missing";
      } else if (answeredRequired < totalRequired) {
        status = "insufficient";
      } else {
        status = "sufficient";
      }

      const confidence = computePhaseConfidence(phaseQuestions, answers, phaseFlags.length);

      const summary = buildSummary(
        phaseAnswers.map(({ q, raw }) => ({
          questionText: q.text,
          normalizedValue: normalizeText(raw.value),
        })),
      );

      phases.push({
        phaseType,
        phaseName: PHASE_LABELS[phaseType] ?? phaseType,
        summary,
        status,
        confidence,
        answers: phaseAnswerRecords,
        ambiguityFlags: phaseFlags,
      });

      // Collect structured items from captureAs tagged questions
      for (const { q, raw } of phaseAnswers) {
        if (q.captureAs?.type === "assumption") {
          assumptions.push({
            id: `${planId}-assumption-${assumptions.length + 1}`,
            description: normalizeText(raw.value),
            source: q.text,
            provenance: raw.provenance,
          });
        }
        if (q.captureAs?.type === "constraint") {
          constraints.push({
            id: `${planId}-constraint-${constraints.length + 1}`,
            description: normalizeText(raw.value),
            source: q.text,
            provenance: raw.provenance,
          });
        }
        if (q.captureAs?.type === "risk") {
          risks.push({
            id: `${planId}-risk-${risks.length + 1}`,
            description: normalizeText(raw.value),
            source: q.text,
            provenance: raw.provenance,
          });
        }
      }
    }

    const overallConfidence = computeOverallConfidence(phases.map((p) => p.confidence));

    return {
      projectId: project.id,
      sessionId: session.id,
      planVersion,
      generatedAt: new Date().toISOString(),
      projectName: project.name,
      projectDescription: project.description,
      phases,
      assumptions,
      constraints,
      risks,
      overallConfidence,
      ambiguityFlags: allFlags,
    };
  }
}
