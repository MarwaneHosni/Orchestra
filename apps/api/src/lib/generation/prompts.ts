import type { AIProvider, Message } from "../provider/types.js";
import type { RouterDecision } from "../router/types.js";
import type { AnalysisPack } from "../analysis/types.js";

export type ModelTier = "cheap" | "balanced" | "strong";

export interface ProviderFactory {
  getProvider(providerName: string, modelName: string): AIProvider | undefined;
  getAvailableProviders(): { provider: string; available: boolean }[];
}

export interface ProviderRegistry extends ProviderFactory {
  register(providerName: string, apiKey: string): void;
}

export interface AIGenerationResult<T> {
  success: boolean;
  data: T | null;
  model: string;
  provider: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason: string;
  fallbackUsed: boolean;
  routerDecision: RouterDecision;
  durationMs: number;
  error?: string;
}

export interface AIResponseParser<T> {
  parse(raw: string): T | null;
  validate(data: unknown): { valid: boolean; errors: string[] };
}

export function buildAnalysisMessage(analysis: AnalysisPack): Message[] {
  const lines: string[] = [];

  lines.push(`Project: ${analysis.projectName}`);
  lines.push("");
  lines.push("Phase summaries:");

  for (const phase of analysis.phases) {
    lines.push(`- ${phase.phaseName}: ${phase.answerCount}/${phase.requiredCount} answered`);
    if (phase.inferredRequirements.length > 0) {
      lines.push(`  Requirements: ${phase.inferredRequirements.slice(0, 2).join("; ").slice(0, 200)}`);
    }
  }

  return [{ role: "user" as const, content: lines.join("\n") }];
}

export function buildSystemPrompt(): string {
  return `You are an AI planning assistant. Output ONLY valid JSON with no extra text.

Top-level fields required:
- "phases": ARRAY of 12 objects in this exact order: ideation, requirements, architecture, security, database, backend, frontend, core-features, ai-systems, testing, deployment, monitoring
  Each phase: { phaseType, phaseName, summary (1 sentence), narrative (2 sentences max), status, confidence (0-1), keyDecisions [1-2 items] }
- "assumptions": ARRAY of { description: string }
- "constraints": ARRAY of { description: string }
- "risks": ARRAY of { description: string }
- "overallConfidence": 0-1
- "overallSummary": string (min 10 chars)
- "roadmapPhases": ARRAY of 12 { phaseType, phaseName, order, effort, prerequisites }
- "totalEffort": "small"|"medium"|"large"

CRITICAL: "phases" must be an ARRAY, not an object. "assumptions/constraints/risks" must be arrays of {description} objects, not strings.
Only output JSON. No markdown, no text outside.`;
}

export function buildTaskPromptMessage(
  task: { id: string; title: string; description: string; phaseType: string; acceptanceCriteria: string[] },
  analysis: AnalysisPack,
): Message[] {
  const lines: string[] = [];
  lines.push(`Project: ${analysis.projectName}`);
  lines.push(`Task: ${task.title}`);
  lines.push(`Phase: ${task.phaseType}`);
  lines.push(`Description: ${task.description}`);
  lines.push("");
  lines.push("Acceptance Criteria:");
  for (const c of task.acceptanceCriteria) {
    lines.push(`  - ${c}`);
  }
  lines.push("");
  lines.push("Generate an AI execution prompt with these sections:");
  lines.push("- objective");
  lines.push("- context");
  lines.push("- constraints (array)");
  lines.push("- expectedOutput");
  lines.push("- validationCriteria (array)");
  lines.push("- architecturalAlignment");
  lines.push("- agentTips with sub-arrays: security, edgeCases, dependencyWarnings, commonBugs");
  lines.push("");
  lines.push("Output valid JSON only.");

  return [{ role: "user" as const, content: lines.join("\n") }];
}
