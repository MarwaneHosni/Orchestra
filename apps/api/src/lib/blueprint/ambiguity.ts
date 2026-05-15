import type { AnswerRecord } from "../orchestration/types.js";
import type { QuestionDefinition } from "../interview/types.js";
import { QUESTIONS } from "../interview/questions.js";
import { isVague, isTooShort } from "./normalizer.js";

export interface AmbiguityDetectionInput {
  question: QuestionDefinition;
  answer: AnswerRecord | undefined;
}

export interface DetectedFlag {
  type: "missing" | "too_short" | "low_confidence" | "vague" | "conflicting";
  questionRef: string;
  message: string;
  severity: "low" | "medium" | "high";
}

export function detectAmbiguity(input: AmbiguityDetectionInput): DetectedFlag[] {
  const flags: DetectedFlag[] = [];
  const ref = `${input.question.phaseType}.${input.question.order}`;
  const answer = input.answer;

  if (!answer) {
    if (input.question.required) {
      flags.push({
        type: "missing",
        questionRef: ref,
        message: `Required question "${input.question.text.slice(0, 60)}..." has no answer`,
        severity: "high",
      });
    }
    return flags;
  }

  if (answer.confidence === "low") {
    flags.push({
      type: "low_confidence",
      questionRef: ref,
      message: `User expressed low confidence in their answer to this question`,
      severity: "medium",
    });
  }

  if (isTooShort(answer.value, input.question.type)) {
    flags.push({
      type: "too_short",
      questionRef: ref,
      message: `Answer is very short (${answer.value.trim().length} chars) for a ${input.question.type} question`,
      severity: "medium",
    });
  }

  if (isVague(answer.value)) {
    flags.push({
      type: "vague",
      questionRef: ref,
      message: `Answer contains vague or uncertain language`,
      severity: "medium",
    });
  }

  return flags;
}

export function detectConflicts(answers: AnswerRecord[]): DetectedFlag[] {
  const flags: DetectedFlag[] = [];
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  for (const q of QUESTIONS) {
    if (!q.dependsOn) continue;

    const ref = `${q.phaseType}.${q.order}`;
    const answer = answerMap.get(ref);
    if (!answer) continue;

    const gateAnswer = answerMap.get(q.dependsOn.questionRef);
    if (!gateAnswer) continue;

    // If the gate question was answered with something that should block
    // this follow-up, but the follow-up has a substantive answer, flag it.
    const expected = q.dependsOn.expectedValue;
    const gateSatisfied = Array.isArray(expected)
      ? expected.includes(gateAnswer.value)
      : gateAnswer.value === expected;

    if (!gateSatisfied && answer.value.trim().length > 0) {
      const gateRef = q.dependsOn.questionRef;
      const gateQuestion = QUESTIONS.find((x) => `${x.phaseType}.${x.order}` === gateRef);
      flags.push({
        type: "conflicting",
        questionRef: ref,
        message: `Answer conflicts with prior answer to "${(gateQuestion?.text ?? gateRef).slice(0, 60)}..." (expected ${expected} but got "${gateAnswer.value}")`,
        severity: "high",
      });
    }
  }

  return flags;
}

export function detectAllAmbiguities(
  questions: QuestionDefinition[],
  answers: AnswerRecord[],
): DetectedFlag[] {
  const all: DetectedFlag[] = [];
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  for (const q of questions) {
    const answer = answerMap.get(`${q.phaseType}.${q.order}`);
    const flags = detectAmbiguity({ question: q, answer });
    all.push(...flags);
  }

  const conflicts = detectConflicts(answers);
  all.push(...conflicts);

  return all;
}
