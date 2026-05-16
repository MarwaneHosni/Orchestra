import type { PhaseType } from "../contract/output-schema.js";

// ─────────────────────────────────────────────────────────────
// Prompt sections — required by contract
// ─────────────────────────────────────────────────────────────

export interface GeneratedPromptSections {
  objective: string;
  context: string;
  constraints: string[];
  expectedOutput: string;
  validationCriteria: string[];
  architecturalAlignment: string;
  agentTips: AgentTips;
}

export interface AgentTips {
  security: string[];
  edgeCases: string[];
  dependencyWarnings: string[];
  commonBugs: string[];
}

// ─────────────────────────────────────────────────────────────
// Versioned prompt artifact
// ─────────────────────────────────────────────────────────────

export interface ExecutionPrompt {
  id: string;
  taskId: string;
  planVersion: number;
  promptVersion: number;
  sections: GeneratedPromptSections;
  promptText: string;
  status: "pending" | "complete" | "needs_review";
  createdAt: string;
  lineage: PromptLineage;
}

export interface PromptLineage {
  taskId: string;
  planVersion: number;
  blueprintArtifactId: string | null;
  analysisSessionId: string;
  sourcePhaseType: PhaseType;
}

// ─────────────────────────────────────────────────────────────
// Prompt bundle — collection of all prompts
// ─────────────────────────────────────────────────────────────

export interface PromptBundle {
  bundleId: string;
  planVersion: number;
  projectId: string;
  sessionId: string;
  projectName: string;
  createdAt: string;
  prompts: ExecutionPrompt[];
  promptCount: number;
}
