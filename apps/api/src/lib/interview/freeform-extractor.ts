import type { AnswerRecord } from "../orchestration/types.js";

export interface ExtractedItem {
  type: "requirement" | "constraint" | "assumption" | "risk" | "integration" | "feature";
  text: string;
  sourceQuestionRef: string;
  confidence: "high" | "medium" | "low";
}

export interface ExtractionResult {
  items: ExtractedItem[];
  missingCriticalFields: string[];
  suggestedFollowUps: string[];
}

const PATTERN_REQUIREMENTS = [
  /\b(?:must|need|require|should|has to|have to|essential|critical)\s+(?:have|support|handle|be|include|provide)\b/i,
  /\b(?:users?|customers?|audience)\s+(?:must|need|should|can|will)\s+(?:be able to|have|see|do|access|use)\b/i,
  /\bcore\s+(?:feature|functionality|capabilit)/i,
];

const PATTERN_CONSTRAINTS = [
  /\b(?:limit(?:ed|ation)?|restrict(?:ion|ed)?|constraint|boundary|must not|cannot|can't)\b/i,
  /\b(?:budget|deadline|timeline|regulat(?:ion|ory)|complian(?:ce|t)|standard|policy)\b/i,
  /\b(?:legacy|existing|current)\s+(?:system|codebase|platform|infrastructure)\b/i,
];

const PATTERN_ASSUMPTIONS = [
  /\b(?:assume?|assumption|presume?|presumption|expect(?:ed|ation)?|take it)\b/i,
  /\b(?:likely|probably|should be|ought to|normally|typically|generally)\b/i,
];

const PATTERN_RISKS = [
  /\b(?:risk|concern|worry|issue|problem|challenge|difficult|complex)\b/i,
  /\b(?:if\s+(?:we|this|it)\s+(?:don't|doesn't|cannot|fail)|in case|scal(?:ing|ability)|performance)\b/i,
];

const PATTERN_INTEGRATIONS = [
  /\b(?:integrat(?:ion|e|ed)?|connect(?:ion|ed|or)?|API|third.party|external\s+service|webhook)\b/i,
];

export function extractFromAnswer(
  questionRef: string,
  text: string,
): ExtractedItem[] {
  const items: ExtractedItem[] = [];

  if (PATTERN_REQUIREMENTS.some((p) => p.test(text))) {
    const sentences = text.split(/[.!\n]+/).filter((s) => PATTERN_REQUIREMENTS.some((p) => p.test(s)));
    for (const s of sentences.slice(0, 3)) {
      const trimmed = s.trim();
      if (trimmed.length > 10) {
        items.push({
          type: "requirement",
          text: trimmed,
          sourceQuestionRef: questionRef,
          confidence: "medium",
        });
      }
    }
  }

  if (PATTERN_CONSTRAINTS.some((p) => p.test(text))) {
    const sentences = text.split(/[.!\n]+/).filter((s) => PATTERN_CONSTRAINTS.some((p) => p.test(s)));
    for (const s of sentences.slice(0, 2)) {
      const trimmed = s.trim();
      if (trimmed.length > 10) {
        items.push({
          type: "constraint",
          text: trimmed,
          sourceQuestionRef: questionRef,
          confidence: "medium",
        });
      }
    }
  }

  if (PATTERN_ASSUMPTIONS.some((p) => p.test(text))) {
    const sentences = text.split(/[.!\n]+/).filter((s) => PATTERN_ASSUMPTIONS.some((p) => p.test(s)));
    for (const s of sentences.slice(0, 2)) {
      const trimmed = s.trim();
      if (trimmed.length > 10) {
        items.push({
          type: "assumption",
          text: trimmed,
          sourceQuestionRef: questionRef,
          confidence: "low",
        });
      }
    }
  }

  if (PATTERN_RISKS.some((p) => p.test(text))) {
    const sentences = text.split(/[.!\n]+/).filter((s) => PATTERN_RISKS.some((p) => p.test(s)));
    for (const s of sentences.slice(0, 2)) {
      const trimmed = s.trim();
      if (trimmed.length > 10) {
        items.push({
          type: "risk",
          text: trimmed,
          sourceQuestionRef: questionRef,
          confidence: "low",
        });
      }
    }
  }

  if (PATTERN_INTEGRATIONS.some((p) => p.test(text))) {
    const sentences = text.split(/[.!\n]+/).filter((s) => PATTERN_INTEGRATIONS.some((p) => p.test(s)));
    for (const s of sentences.slice(0, 3)) {
      const trimmed = s.trim();
      if (trimmed.length > 10) {
        items.push({
          type: "integration",
          text: trimmed,
          sourceQuestionRef: questionRef,
          confidence: "medium",
        });
      }
    }
  }

  return items;
}

const FEATURE_EXTRACTION_QUESTIONS = ["ideation.1", "requirements.1", "requirements.5", "core-features.1"];

export function extractFromAllAnswers(answers: AnswerRecord[]): ExtractionResult {
  const allItems: ExtractedItem[] = [];
  const missingCriticalFields: string[] = [];
  const suggestedFollowUps: string[] = [];

  for (const answer of answers) {
    const items = extractFromAnswer(answer.questionId, answer.value);
    allItems.push(...items);
  }

  const featureQuestions = FEATURE_EXTRACTION_QUESTIONS.map((ref) => answers.find((a) => a.questionId === ref));
  const hasFeatureExtraction = featureQuestions.some(
    (a) => a && a.value.length > 50 && PATTERN_REQUIREMENTS.some((p) => p.test(a.value)),
  );

  if (!hasFeatureExtraction && answers.length >= 3) {
    const featureDefined = FEATURE_EXTRACTION_QUESTIONS.some((ref) => {
      const a = answers.find((ans) => ans.questionId === ref);
      return a && a.value.length > 30;
    });
    if (featureDefined) {
      suggestedFollowUps.push("Your feature descriptions are brief — consider adding more detail about specific capabilities.");
    }
  }

  return {
    items: allItems,
    missingCriticalFields,
    suggestedFollowUps,
  };
}

export function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["this", "that", "with", "from", "have", "been", "will", "would", "could", "should", "their", "there", "which", "what", "when"].includes(w));
  const unique = [...new Set(words)];
  const stopWords = ["about", "after", "also", "another", "being", "does", "done", "each", "else", "even", "ever", "fact", "full", "gets", "give", "goes", "gonna", "just", "know", "like", "made", "make", "many", "more", "most", "much", "must", "need", "next", "note", "once", "only", "ones", "other", "over", "part", "same", "said", "some", "still", "such", "take", "than", "them", "then", "time", "used", "very", "want", "ways", "well", "went", "were", "year"];
  return unique.filter((w) => w.length > 3 && !stopWords.includes(w));
}
