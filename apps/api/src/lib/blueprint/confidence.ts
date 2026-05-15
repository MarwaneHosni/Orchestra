import type { AnswerRecord } from "../orchestration/types.js";
import type { QuestionDefinition } from "../interview/types.js";

const CONFIDENCE_WEIGHTS: Record<string, number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.3,
};

export function computePhaseConfidence(
  questions: QuestionDefinition[],
  answers: AnswerRecord[],
  ambiguityCount: number,
): number {
  if (questions.length === 0) return 0;

  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  const requiredQuestions = questions.filter((q) => q.required);

  if (requiredQuestions.length === 0) return 1;

  // Ratio of required questions answered (60% weight)
  const answeredRequired = requiredQuestions.filter((q) => answerMap.has(`${q.phaseType}.${q.order}`)).length;
  const completionRatio = answeredRequired / requiredQuestions.length;

  // Average user confidence (20% weight)
  let totalConfidence = 0;
  let confidenceCount = 0;
  for (const q of questions) {
    const a = answerMap.get(`${q.phaseType}.${q.order}`);
    if (a) {
      totalConfidence += CONFIDENCE_WEIGHTS[a.confidence] ?? 0.5;
      confidenceCount++;
    }
  }
  const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

  // Avg answer length relative to 100-char baseline (10% weight)
  let totalLength = 0;
  let lengthCount = 0;
  for (const q of questions) {
    const a = answerMap.get(`${q.phaseType}.${q.order}`);
    if (a && q.type === "text") {
      totalLength += Math.min(a.value.length, 200);
      lengthCount++;
    }
  }
  const avgLength = lengthCount > 0 ? totalLength / lengthCount / 200 : 0.5;

  // Ambiguity penalty (10% weight)
  const ambiguityPenalty = Math.max(0, 1 - ambiguityCount * 0.15);

  const score = completionRatio * 0.6 + avgConfidence * 0.2 + avgLength * 0.1 + ambiguityPenalty * 0.1;

  return Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;
}

export function computeOverallConfidence(phaseScores: number[]): number {
  if (phaseScores.length === 0) return 0;
  const sum = phaseScores.reduce((a, b) => a + b, 0);
  return Math.round((sum / phaseScores.length) * 100) / 100;
}
