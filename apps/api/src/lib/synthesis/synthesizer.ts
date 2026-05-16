import type { AnswerRecord } from "../orchestration/types.js";
import type { QuestionDefinition } from "../interview/types.js";
import { QUESTIONS, PHASE_ORDER, PHASE_LABELS } from "../interview/questions.js";
import { normalizeText, isVague, isTooShort } from "../blueprint/normalizer.js";
import type { PhaseType } from "../contract/output-schema.js";
import type {
  SynthesizedAnswer,
  AnswerFlag,
  PhaseAnswerGroup,
  Contradiction,
  GapMarker,
  SynthesisContextPack,
  SynthesisSummary,
} from "./types.js";

export function buildContextPack(
  projectId: string,
  projectName: string,
  sessionId: string,
  answers: AnswerRecord[],
): SynthesisContextPack {
  const generatedAt = new Date().toISOString();
  const answerMap = new Map<string, AnswerRecord>();

  for (const a of answers) {
    if (a.isLatest) {
      answerMap.set(a.questionId, a);
    }
  }

  const allSynthesized: SynthesizedAnswer[] = [];
  const unansweredQuestions: QuestionDefinition[] = [];
  const gaps: GapMarker[] = [];
  const contradictions: Contradiction[] = [];
  const weakAnswers: SynthesizedAnswer[] = [];
  const phases: PhaseAnswerGroup[] = [];

  // Build a quick lookup for gate checking
  const gateMap = new Map<string, QuestionDefinition>();
  for (const q of QUESTIONS) {
    const ref = `${q.phaseType}.${q.order}`;
    gateMap.set(ref, q);
  }

  for (const phaseType of PHASE_ORDER) {
    const phaseQuestions = QUESTIONS.filter((q) => q.phaseType === phaseType);
    const phaseAnswers: SynthesizedAnswer[] = [];

    for (const q of phaseQuestions) {
      const ref = `${q.phaseType}.${q.order}`;
      const answer = answerMap.get(ref);

      // Check gate: if this question has a dependency and the gate isn't satisfied, mark as gated
      let isGated = false;
      if (q.dependsOn) {
        const gateAnswer = answerMap.get(q.dependsOn.questionRef);
        if (gateAnswer) {
          const expected = q.dependsOn.expectedValue;
          const gateSatisfied = Array.isArray(expected)
            ? expected.includes(gateAnswer.value)
            : gateAnswer.value === expected;

          // Contradiction: gate not satisfied but question has a substantive answer
          if (!gateSatisfied && answer && answer.value.trim().length > 0) {
            const gateQuestion = gateMap.get(q.dependsOn.questionRef);
            contradictions.push({
              questionRef: ref,
              questionText: q.text,
              gateQuestionRef: q.dependsOn.questionRef,
              gateQuestionText: gateQuestion?.text ?? q.dependsOn.questionRef,
              gateExpected: expected,
              actualValue: answer.value,
              severity: "high",
              description: `Answer to "${q.text.slice(0, 60)}" contradicts gate "${(gateQuestion?.text ?? q.dependsOn.questionRef).slice(0, 60)}": expected ${JSON.stringify(expected)}, got "${answer.value}"`,
            });
          }

          if (!gateSatisfied && !answer) {
            isGated = true;
          }
        }
      }

      const flags: AnswerFlag[] = [];
      const rawValue = answer?.value ?? "";
      const normalized = answer ? normalizeText(rawValue) : "";
      const present = !!answer;

      if (!present && q.required && !isGated) {
        gaps.push({
          questionRef: ref,
          questionText: q.text,
          phaseType,
          type: "missing_required",
        });
        flags.push({
          type: "missing",
          severity: "high",
          message: `Required question "${q.text.slice(0, 60)}" has no answer`,
        });
      } else if (!present && !q.required && !isGated) {
        gaps.push({
          questionRef: ref,
          questionText: q.text,
          phaseType,
          type: "missing_optional",
        });
      } else if (!present && isGated) {
        const gap: GapMarker = {
          questionRef: ref,
          questionText: q.text,
          phaseType,
          type: "missing_due_to_gate",
        };
        if (q.dependsOn) {
          gap.gateQuestionRef = q.dependsOn.questionRef;
          gap.gateExpected = q.dependsOn.expectedValue;
        }
        gaps.push(gap);
      }

      if (present && q.required && answer!.value.trim().length === 0) {
        flags.push({
          type: "skipped",
          severity: "low",
          message: `Required question "${q.text.slice(0, 60)}" was skipped (empty answer)`,
        });
      }

      if (present && isVague(rawValue)) {
        flags.push({
          type: "vague",
          severity: "medium",
          message: `Answer contains vague or uncertain language`,
        });
      }

      if (present && isTooShort(rawValue, q.type)) {
        flags.push({
          type: "too_short",
          severity: "medium",
          message: `Answer is only ${rawValue.trim().length} chars`,
        });
      }

      if (present && answer!.confidence === "low") {
        flags.push({
          type: "low_confidence",
          severity: "medium",
          message: `User expressed low confidence in this answer`,
        });
      }

      if (present && answer!.version > 1) {
        flags.push({ type: "edited", severity: "low", message: `Answer was edited (v${answer!.version})` });
      }

      const synthesized: SynthesizedAnswer = {
        questionRef: ref,
        questionText: q.text,
        phaseType: phaseType as PhaseType,
        order: q.order,
        type: q.type,
        required: q.required,
        options: q.options ?? null,
        helpText: q.helpText ?? null,
        validation: q.validation ?? null,
        rawValue,
        normalizedValue: normalized,
        userConfidence: (answer?.confidence as "high" | "medium" | "low") ?? "medium",
        isPresent: present,
        isVague: present && isVague(rawValue),
        isTooShort: present && isTooShort(rawValue, q.type),
        isSkipped: present && rawValue.trim().length === 0,
        isLatestVersion: answer?.isLatest ?? false,
        version: answer?.version ?? 0,
        captureAs: q.captureAs?.type ?? null,
        flags,
      };

      if (flags.length > 0 && present) {
        weakAnswers.push(synthesized);
      }

      phaseAnswers.push(synthesized);
      allSynthesized.push(synthesized);
    }

    // Sort phase answers by question order
    phaseAnswers.sort((a, b) => a.order - b.order);

    const requiredCount = phaseQuestions.filter((q) => q.required).length;
    const answeredCount = phaseAnswers.filter((a) => a.isPresent).length;
    const missingRequiredCount = phaseAnswers.filter((a) => a.required && !a.isPresent).length;
    const flagCount = phaseAnswers.reduce((sum, a) => sum + a.flags.length, 0);

    phases.push({
      phaseType: phaseType as PhaseType,
      phaseName: PHASE_LABELS[phaseType] ?? phaseType,
      answers: phaseAnswers,
      answeredCount,
      requiredCount,
      missingRequiredCount,
      flagCount,
    });
  }

  // Find unanswered questions
  for (const q of QUESTIONS) {
    const ref = `${q.phaseType}.${q.order}`;
    if (!answerMap.has(ref)) {
      unansweredQuestions.push(q);
    }
  }

  // Build summary
  const totalQuestions = QUESTIONS.length;
  const answeredQuestions = allSynthesized.filter((a) => a.isPresent).length;
  const unansweredRequired = gaps.filter((g) => g.type === "missing_required").length;
  const totalGates = QUESTIONS.filter((q) => q.dependsOn).length;
  const totalVague = allSynthesized.filter((a) => a.isVague).length;
  const totalTooShort = allSynthesized.filter((a) => a.isTooShort).length;
  const totalLowConfidence = allSynthesized.filter((a) => a.userConfidence === "low").length;
  const totalContradictions = contradictions.length;
  const totalFlags = allSynthesized.reduce((sum, a) => sum + a.flags.length, 0);

  const summary: SynthesisSummary = {
    totalQuestions,
    answeredQuestions,
    unansweredRequired,
    totalGates,
    totalVague,
    totalTooShort,
    totalLowConfidence,
    totalContradictions,
    totalFlags,
  };

  return {
    projectId,
    projectName,
    sessionId,
    generatedAt,
    phases,
    allAnswers: allSynthesized,
    unansweredQuestions,
    gaps,
    contradictions,
    weakAnswers,
    summary,
  };
}
