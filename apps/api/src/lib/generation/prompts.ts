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

export function buildAnalysisMessage(analysis: AnalysisPack, projectDescription: string = ""): Message[] {
  const lines: string[] = [];

  lines.push(`Project: ${analysis.projectName}`);
  if (projectDescription) lines.push(`Description: ${projectDescription}`);
  lines.push("");
  lines.push("=== FULL INTERVIEW DATA ===");
  lines.push(
    "Below are all user answers organized by phase. Use these answers to build a detailed project plan.",
  );
  lines.push("");

  for (const phase of analysis.phases) {
    lines.push(`--- ${phase.phaseName} ---`);
    lines.push(
      `Status: ${phase.inputStatus} (${phase.answerCount}/${phase.requiredCount} questions answered)`,
    );

    if (phase.inferredRequirements.length > 0) {
      lines.push(`Requirements inferred: ${phase.inferredRequirements.join("; ")}`);
    }
    if (phase.likelyConstraints.length > 0) {
      lines.push(`Constraints identified: ${phase.likelyConstraints.join("; ")}`);
    }
    if (phase.explicitAssumptions.length > 0) {
      lines.push(`Assumptions made: ${phase.explicitAssumptions.join("; ")}`);
    }
    if (phase.identifiedRisks.length > 0) {
      lines.push(`Risks identified: ${phase.identifiedRisks.join("; ")}`);
    }
    if (phase.uncertaintyAreas.length > 0) {
      lines.push(`Uncertainties: ${phase.uncertaintyAreas.join("; ")}`);
    }

    lines.push("");
    lines.push("User answers for this phase:");
    for (const sub of phase.subphases) {
      const qText = sub.questionText.replace(/\n/g, " ");
      if (sub.answerPresent && sub.answerValue) {
        lines.push(`Q: ${qText}`);
        lines.push(`A: ${sub.answerValue}`);
        const flagMsgs = sub.flags.map((f) => f.message).filter(Boolean);
        if (flagMsgs.length > 0) {
          lines.push(`  [Flags: ${flagMsgs.join("; ")}]`);
        }
        lines.push("");
      } else {
        lines.push(`Q: ${qText}`);
        lines.push(`A: (not answered)`);
        lines.push("");
      }
    }
  }

  // Cross-phase insights
  if (analysis.crossPhase.globalAssumptions.length > 0) {
    lines.push("--- GLOBAL ASSUMPTIONS ---");
    for (const a of analysis.crossPhase.globalAssumptions) {
      lines.push(`- ${a}`);
    }
    lines.push("");
  }
  if (analysis.crossPhase.globalRisks.length > 0) {
    lines.push("--- GLOBAL RISKS ---");
    for (const r of analysis.crossPhase.globalRisks) {
      lines.push(`- ${r}`);
    }
    lines.push("");
  }

  return [{ role: "user" as const, content: lines.join("\n") }];
}

export function buildSystemPrompt(): string {
  return `You are an AI planning assistant. Output ONLY valid JSON with no extra text.

You are given the full interview data below. Analyze each user answer carefully and generate a detailed, personalized project plan.

Top-level fields required:
- "phases": ARRAY of 12 objects in this exact order: ideation, requirements, architecture, security, database, backend, frontend, core-features, ai-systems, testing, deployment, monitoring
  Each phase object must contain: phaseType, phaseName, summary, narrative, status, confidence, keyDecisions, executionPrompt
- "assumptions": ARRAY of { description: string }
- "constraints": ARRAY of { description: string }
- "risks": ARRAY of { description: string }
- "overallConfidence": 0-1
- "overallSummary": string (min 20 chars)
- "roadmapPhases": ARRAY of 12 { phaseType, phaseName, order, effort, prerequisites }
- "totalEffort": "small"|"medium"|"large"

FIELD SPECIFICATIONS:
  summary: detailed 2-3 sentences based on user answers
  narrative: 4-5 sentences reflecting the specific user input
  status: one of "sufficient" | "insufficient" | "missing" | "ai_augmented"
  confidence: 0-1
  keyDecisions: array of 2-4 strings based on answers
  executionPrompt: a complete, detailed markdown execution prompt for tasks in this phase.
    Format it with these 7 sections using markdown headings (##):
      ## Objective — what needs to be built
      ## Context — project description, phase goal, key background from user answers
      ## Constraints — ALL constraints, assumptions, and risks from the interview
      ## Expected Output — what the execution should produce
      ## Validation Criteria — specific, testable items as bullet list
      ## Architectural Alignment — how this fits the project architecture
      ## Agent Tips — security, edge cases, dependency warnings, common bugs for this phase

CRITICAL JSON RULES:
- "phases" must be an ARRAY, not an object
- "assumptions/constraints/risks" must be arrays of {description} objects, not strings
- The executionPrompt is a STRING containing markdown. Any double quotes inside it must be escaped with a backslash.
- Do NOT use {{ or }} or any curly braces inside the executionPrompt that aren't part of its text content
- Base ALL output on the actual user answers below
- Each phase executionPrompt must be unique and tailored to the answers for that phase
- You may think step by step first, then output the complete JSON object at the end.
- Do not include curly braces { } anywhere outside the JSON object itself.
- No markdown fences around the JSON. Just output the raw JSON.`;
}
