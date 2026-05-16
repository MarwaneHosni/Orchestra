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
  lines.push(`Session: ${analysis.sessionId}`);
  lines.push("");
  lines.push("## Phase Analysis Summary");
  lines.push("");

  for (const phase of analysis.phases) {
    lines.push(`### ${phase.phaseName} (${phase.inputStatus})`);
    lines.push(`- Answered ${phase.answerCount}/${phase.requiredCount} required questions`);
    if (phase.inferredRequirements.length > 0) {
      lines.push("- Inferred Requirements:");
      for (const r of phase.inferredRequirements.slice(0, 5)) {
        lines.push(`  - ${r.length > 150 ? r.slice(0, 147) + "..." : r}`);
      }
    }
    if (phase.likelyConstraints.length > 0) {
      lines.push("- Likely Constraints:");
      for (const c of phase.likelyConstraints.slice(0, 3)) {
        lines.push(`  - ${c.length > 150 ? c.slice(0, 147) + "..." : c}`);
      }
    }
    if (phase.explicitAssumptions.length > 0) {
      lines.push(`- Explicit Assumptions: ${phase.explicitAssumptions.length} recorded`);
    }
    if (phase.identifiedRisks.length > 0) {
      lines.push(`- Identified Risks: ${phase.identifiedRisks.length} identified`);
    }
    if (phase.uncertaintyAreas.length > 0) {
      lines.push("- Uncertainty Areas:");
      for (const u of phase.uncertaintyAreas.slice(0, 3)) {
        lines.push(`  - ${u.length > 150 ? u.slice(0, 147) + "..." : u}`);
      }
    }
    lines.push("");
  }

  if (analysis.crossPhase.contradictions.length > 0) {
    lines.push("## Cross-Phase Contradictions");
    for (const c of analysis.crossPhase.contradictions) {
      lines.push(`- ${c.description}`);
    }
    lines.push("");
  }

  return [{ role: "user" as const, content: lines.join("\n") }];
}

export function buildSystemPrompt(): string {
  return `You are an AI software planning assistant. Your job is to analyze interview answers about a software project and produce a structured plan.

You must output valid JSON matching the schema provided. Do not invent new phases or reorder them. The 12 lifecycle phases are:
ideation → requirements → architecture → security → database → backend → frontend → core-features → ai-systems → testing → deployment → monitoring

For each phase, provide:
- summary: A concise 1-2 sentence summary
- narrative: A detailed paragraph (4-6 sentences) describing the approach, key decisions, and tradeoffs
- status: "sufficient" (good input), "insufficient" (some gaps), "missing" (no answers), or "ai_augmented" (AI filled gaps)
- confidence: 0.0 to 1.0 how confident you are in the output
- keyDecisions: Array of 2-5 key decisions made by the AI for this phase

Also extract:
- assumptions: Things assumed based on the answers
- constraints: Limitations or requirements derived from answers
- risks: Things that could go wrong

Always respond with valid JSON only. No markdown, no explanations outside the JSON.`;
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
