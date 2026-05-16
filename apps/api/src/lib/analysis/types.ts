import type { PhaseType } from "../contract/output-schema.js";

// ─────────────────────────────────────────────────────────────
// Source link — traces an analysis record back to specific answers
// ─────────────────────────────────────────────────────────────

export interface SourceLink {
  questionRef: string;
  questionText: string;
  excerpt: string;
}

// ─────────────────────────────────────────────────────────────
// Finding — a single structured observation about the answers
// ─────────────────────────────────────────────────────────────

export type FindingKind =
  | "inferred_requirement"
  | "likely_constraint"
  | "explicit_assumption"
  | "identified_risk"
  | "ambiguity"
  | "uncertainty"
  | "dependency"
  | "contradiction"
  | "insufficient_input";

export type FindingSeverity = "low" | "medium" | "high";

export interface AnalysisFinding {
  kind: FindingKind;
  severity: FindingSeverity;
  description: string;
  sources: SourceLink[];
}

// ─────────────────────────────────────────────────────────────
// Phase analysis — all findings and assessment for one phase
// ─────────────────────────────────────────────────────────────

export type PhaseInputStatus = "sufficient" | "insufficient" | "missing";

export interface PhaseDependency {
  dependsOnPhase: PhaseType;
  reason: string;
  sourceRef: string;
  nature: "lifecycle" | "inferred_from_answers";
}

// ─────────────────────────────────────────────────────────────
// Subphase analysis — per-question granular breakdown
// ─────────────────────────────────────────────────────────────

export interface SubphaseAnalysis {
  order: number;
  questionRef: string;
  questionText: string;
  answerValue: string;
  answerPresent: boolean;
  userConfidence: "high" | "medium" | "low";
  flags: { kind: FindingKind; severity: FindingSeverity; message: string }[];
  captureAs: "assumption" | "constraint" | "risk" | null;
}

export interface PhaseAnalysis {
  phaseType: PhaseType;
  phaseName: string;
  inputStatus: PhaseInputStatus;
  answerCount: number;
  requiredCount: number;
  missingRequiredCount: number;
  findings: AnalysisFinding[];
  subphases: SubphaseAnalysis[];
  inferredRequirements: string[];
  likelyConstraints: string[];
  explicitAssumptions: string[];
  identifiedRisks: string[];
  keyDecisions: { description: string; sourceRef: string }[];
  uncertaintyAreas: string[];
  dependencies: PhaseDependency[];
}

// ─────────────────────────────────────────────────────────────
// Analysis pack — the full output of the analysis stage
// ─────────────────────────────────────────────────────────────

export interface AnalysisPack {
  projectId: string;
  projectName: string;
  sessionId: string;
  generatedAt: string;
  phases: PhaseAnalysis[];
  crossPhase: CrossPhaseInsights;
  summary: AnalysisSummary;
}

export interface CrossPhaseInsights {
  contradictions: {
    description: string;
    between: string[];
    severity: FindingSeverity;
    sources: SourceLink[];
  }[];
  globalAssumptions: string[];
  globalRisks: string[];
  overallInputStatus: "sufficient" | "insufficient" | "mixed";
}

export interface AnalysisSummary {
  totalPhases: number;
  phasesWithSufficientInput: number;
  phasesWithInsufficientInput: number;
  phasesWithMissingInput: number;
  totalFindings: number;
  highSeverityFindings: number;
  totalUncertaintyAreas: number;
  totalInferredDependencies: number;
}
