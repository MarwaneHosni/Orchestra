import type { QuestionDefinition, QuestionCategory, InterviewMode } from "../interview/types.js";
import type { AnswerRecord } from "../orchestration/types.js";
import { QUESTIONS, PHASE_ORDER } from "./questions.js";
import { runAllInferences } from "./inference-engine.js";
import { detectAllContradictions } from "./contradiction-detector.js";
import { extractFromAllAnswers } from "./freeform-extractor.js";

export interface AdaptiveConfig {
  mode: InterviewMode;
  answeredIds: Set<string>;
  answers: AnswerRecord[];
}

export interface AdaptiveResult {
  nextQuestion: QuestionDefinition | null;
  eligibleCount: number;
  answeredCount: number;
  allAnswered: boolean;
  skippedCategories: QuestionCategory[];
  inferences?: Array<{
    questionRef: string;
    value: string;
    confidence: "high" | "medium" | "low";
    explanation: string;
  }>;
  contradictions?: Array<{
    type: string;
    severity: "high" | "medium" | "low";
    explanation: string;
  }>;
  followUps?: string[];
}

const QUICK_MODE_CATEGORIES: QuestionCategory[] = ["critical", "high-value", "contextual"];
const ADVANCED_FIRST_PASS: QuestionCategory[] = ["critical", "high-value", "optional", "contextual"];
const REFINEMENT_CATEGORIES: QuestionCategory[] = ["optional", "advanced-only", "derivable"];

function isGateSatisfied(q: QuestionDefinition, answers: AnswerRecord[]): boolean {
  const rule = q.dependsOn;
  if (!rule) return true;
  const prior = answers.find((a) => a.questionId === rule.questionRef);
  if (!prior) return false;
  return Array.isArray(rule.expectedValue)
    ? rule.expectedValue.includes(prior.value)
    : prior.value === rule.expectedValue;
}

function categoriseQuestion(q: QuestionDefinition): QuestionCategory {
  return q.category as QuestionCategory;
}

export function shouldSkip(
  q: QuestionDefinition,
  answers: AnswerRecord[],
  mode: InterviewMode,
): { skip: boolean; reason?: string } {
  const cat = categoriseQuestion(q);

  // Gated questions: skip if gate not satisfied
  if (q.dependsOn && !isGateSatisfied(q, answers)) {
    return { skip: true, reason: "gate_not_satisfied" };
  }

  // Quick mode: skip optional
  if (mode === "quick" && cat === "optional") {
    return { skip: true, reason: "quick_mode_skip_optional" };
  }

  // Derivable: skip in both modes (AI infers)
  if (cat === "derivable") {
    return { skip: true, reason: "derivable_ai_inferred" };
  }

  // Advanced-only: skip in both modes (post-generation refinement)
  if (cat === "advanced-only") {
    return { skip: true, reason: "advanced_only_deferred" };
  }

  return { skip: false };
}

export function getEligibleQuestions(
  answers: AnswerRecord[],
  mode: InterviewMode,
): QuestionDefinition[] {
  const categories = mode === "quick" ? QUICK_MODE_CATEGORIES : ADVANCED_FIRST_PASS;

  return QUESTIONS.filter((q) => {
    const cat = categoriseQuestion(q);
    if (!categories.includes(cat)) return false;
    if (!isGateSatisfied(q, answers)) return false;
    return true;
  });
}

export function getRefinementQuestions(answers: AnswerRecord[], answeredIds: Set<string>): QuestionDefinition[] {
  return QUESTIONS.filter((q) => {
    const cat = categoriseQuestion(q);
    if (!REFINEMENT_CATEGORIES.includes(cat)) return false;
    if (answeredIds.has(`${q.phaseType}.${q.order}`)) return false;
    if (q.dependsOn && !isGateSatisfied(q, answers)) return false;
    return true;
  });
}

export function getConfidenceLevel(questionId: string, answers: AnswerRecord[]): "high" | "medium" | "low" {
  const answer = answers.find((a) => a.questionId === questionId);
  if (!answer) return "low";
  const conf = answer.confidence ?? "medium";
  return conf as "high" | "medium" | "low";
}

export function getNextQuestion(
  config: AdaptiveConfig,
): AdaptiveResult {
  const { mode, answeredIds, answers } = config;
  const eligible = getEligibleQuestions(answers, mode);
  const skippedCategories: QuestionCategory[] = [];

  if (mode === "quick") {
    skippedCategories.push("optional");
  }
  skippedCategories.push("derivable", "advanced-only");

  // Compute inferences for derivable questions
  const inferenceResult = runAllInferences(answers);
  const inferences = inferenceResult.inferences.map((inf) => ({
    questionRef: inf.questionRef,
    value: inf.inferredValue,
    confidence: inf.confidence,
    explanation: inf.explanation,
  }));

  // Detect contradictions
  const contradictions = detectAllContradictions(answers).map((c) => ({
    type: c.type,
    severity: c.severity,
    explanation: c.explanation,
  }));

  // Extract suggested follow-ups from freeform answers
  const extraction = extractFromAllAnswers(answers);
  const followUps = extraction.suggestedFollowUps;

  // If there are high-severity contradictions, flag them but still serve next question
  const hasContradictions = contradictions.some((c) => c.severity === "high");

  for (const phaseType of PHASE_ORDER) {
    const phaseQuestions = eligible.filter((q) => q.phaseType === phaseType);
    for (const q of phaseQuestions) {
      const ref = `${q.phaseType}.${q.order}`;
      if (!answeredIds.has(ref)) {
        return {
          nextQuestion: q,
          eligibleCount: eligible.length,
          answeredCount: answeredIds.size,
          allAnswered: false,
          skippedCategories,
          inferences: hasContradictions ? inferences : [],
          contradictions: hasContradictions ? contradictions : [],
          followUps,
        };
      }
    }
  }

  return {
    nextQuestion: null,
    eligibleCount: eligible.length,
    answeredCount: answeredIds.size,
    allAnswered: true,
    skippedCategories,
    inferences,
    contradictions,
    followUps,
  };
}
