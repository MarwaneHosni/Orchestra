// ─────────────────────────────────────────────────────────────
// Validation severity
// ─────────────────────────────────────────────────────────────

export type ValidationSeverity = "error" | "warning" | "info";

// ─────────────────────────────────────────────────────────────
// A single validation issue
// ─────────────────────────────────────────────────────────────

export interface ValidationIssue {
  artifactType: ArtifactType;
  code: string;
  severity: ValidationSeverity;
  message: string;
  phaseType?: string;
  field?: string;
}

// ─────────────────────────────────────────────────────────────
// Artifact types
// ─────────────────────────────────────────────────────────────

export type ArtifactType =
  | "blueprint"
  | "roadmap"
  | "task_graph"
  | "prompt_bundle"
  | "analysis"
  | "context_pack";

// ─────────────────────────────────────────────────────────────
// Full validation result
// ─────────────────────────────────────────────────────────────

export type ValidationOutcome = "pass" | "repairable" | "unrecoverable";

export interface ValidationResult {
  outcome: ValidationOutcome;
  issues: ValidationIssue[];
  stats: ValidationStats;
}

export interface ValidationStats {
  totalChecks: number;
  errors: number;
  warnings: number;
  repaired: number;
}

// ─────────────────────────────────────────────────────────────
// Repair result
// ─────────────────────────────────────────────────────────────

export interface RepairResult {
  repaired: boolean;
  fixes: RepairFix[];
  remainingIssues: ValidationIssue[];
}

export interface RepairFix {
  artifactType: ArtifactType;
  field: string;
  description: string;
}
