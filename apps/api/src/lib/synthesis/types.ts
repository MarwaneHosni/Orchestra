import type { QuestionDefinition } from "../interview/types.js";
import type { PhaseType } from "../contract/output-schema.js";

// ─────────────────────────────────────────────────────────────
// Individual answer with full context
// ─────────────────────────────────────────────────────────────

export interface SynthesizedAnswer {
  questionRef: string;
  questionText: string;
  phaseType: PhaseType;
  order: number;
  type: string;
  required: boolean;
  options: string[] | null;
  helpText: string | null;
  validation: { minLength?: number; maxLength?: number } | null;

  rawValue: string;
  normalizedValue: string;
  userConfidence: "high" | "medium" | "low";

  isPresent: boolean;
  isVague: boolean;
  isTooShort: boolean;
  isSkipped: boolean;
  isLatestVersion: boolean;
  version: number;

  captureAs: "assumption" | "constraint" | "risk" | null;

  flags: AnswerFlag[];
}

export type AnswerFlagType =
  | "missing"
  | "too_short"
  | "vague"
  | "low_confidence"
  | "skipped"
  | "contradicts_gate"
  | "edited";

export interface AnswerFlag {
  type: AnswerFlagType;
  severity: "low" | "medium" | "high";
  message: string;
}

// ─────────────────────────────────────────────────────────────
// Phase group — all answers for one phase in lifecycle order
// ─────────────────────────────────────────────────────────────

export interface PhaseAnswerGroup {
  phaseType: PhaseType;
  phaseName: string;
  answers: SynthesizedAnswer[];
  answeredCount: number;
  requiredCount: number;
  missingRequiredCount: number;
  flagCount: number;
}

// ─────────────────────────────────────────────────────────────
// Gate dependency violation
// ─────────────────────────────────────────────────────────────

export interface Contradiction {
  questionRef: string;
  questionText: string;
  gateQuestionRef: string;
  gateQuestionText: string;
  gateExpected: string | string[];
  actualValue: string;
  severity: "low" | "medium" | "high";
  description: string;
}

// ─────────────────────────────────────────────────────────────
// Synthesis context pack — the full output
// ─────────────────────────────────────────────────────────────

export interface SynthesisContextPack {
  projectId: string;
  projectName: string;
  sessionId: string;
  generatedAt: string;

  phases: PhaseAnswerGroup[];
  allAnswers: SynthesizedAnswer[];
  unansweredQuestions: QuestionDefinition[];

  gaps: GapMarker[];
  contradictions: Contradiction[];
  weakAnswers: SynthesizedAnswer[];

  summary: SynthesisSummary;
}

export interface GapMarker {
  questionRef: string;
  questionText: string;
  phaseType: string;
  type: "missing_required" | "missing_optional" | "missing_due_to_gate";
  gateQuestionRef?: string;
  gateExpected?: string | string[];
}

export interface SynthesisSummary {
  totalQuestions: number;
  answeredQuestions: number;
  unansweredRequired: number;
  totalGates: number;
  totalVague: number;
  totalTooShort: number;
  totalLowConfidence: number;
  totalContradictions: number;
  totalFlags: number;
}
