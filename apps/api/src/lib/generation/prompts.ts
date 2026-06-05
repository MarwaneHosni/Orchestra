import type { AIProvider, Message } from "../provider/types.js";
import type { RouterDecision } from "../router/types.js";
import type { AnalysisPack } from "../analysis/types.js";
import type { UsageAttempt } from "../accounting/streaming.js";
import type { BlueprintOutput } from "../contract/output-schema.js";

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
  attempts: UsageAttempt[];
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

export function buildProjectSummarySystemPrompt(): string {
  return `You are an expert project analyst. Given a complete project plan (blueprint) with phases, assumptions, constraints, risks, and overall summary, produce a concise project summary.

Output ONLY valid JSON with no extra text, no markdown fences.

Top-level fields required:
- "projectOverview": 2-3 sentence summary of what the project does
- "keyFeatures": array of strings — 5-10 main features extracted from the plan
- "technicalConstraints": array of strings — 3-6 key technical constraints from the plan
- "businessConditions": array of strings — 2-4 business conditions or operational requirements
- "architectureHighlights": array of strings — 3-6 notable architectural decisions or approaches
- "riskSummary": 1-2 sentence summary of the most significant risks

Base your summary entirely on the provided blueprint data. Do not invent details not present in the input.`;
}

export function buildProjectSummaryMessage(blueprint: BlueprintOutput): Message[] {
  const lines: string[] = [
    `Project: ${blueprint.projectId}`,
    `Version: ${blueprint.planVersion}`,
    "",
    "=== BLUEPRINT DATA ===",
    "",
    "Overall Summary:",
    blueprint.overallSummary,
    "",
    "Phases:",
    ...blueprint.phases.map((p) =>
      `  - ${p.phaseName} (${p.phaseType}): ${p.summary} [confidence: ${p.confidence}, status: ${p.status}]`
    ),
    "",
    "Assumptions:",
    ...(blueprint.assumptions.length > 0
      ? blueprint.assumptions.map((a) => `  - ${a.description}`)
      : ["  (none)"]),
    "",
    "Constraints:",
    ...(blueprint.constraints.length > 0
      ? blueprint.constraints.map((c) => `  - ${c.description}`)
      : ["  (none)"]),
    "",
    "Risks:",
    ...(blueprint.risks.length > 0
      ? blueprint.risks.map((r) => `  - ${r.description}`)
      : ["  (none)"]),
  ];

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
  executionPrompt: a COMPREHENSIVE markdown execution prompt (target 1500+ characters, prioritize completeness and specificity over brevity).

    This markdown is sent DIRECTLY to an advanced AI coding agent (e.g. OpenCode, Claude Code, Codex, Cursor Agent) responsible for implementing the task. The prompt must clearly describe WHAT capabilities, behaviors, outcomes, and user-facing functionality must be delivered. Do NOT focus on implementation mechanics unless they are explicitly required by the user's interview answers or project constraints.

    The receiving AI is capable of making architecture, file structure, and implementation decisions independently. Your responsibility is to communicate the business intent, functional requirements, constraints, success criteria, and integration expectations with enough detail that the implementation can be completed without requiring additional clarification.

    The prompt MUST be grounded in the user's interview answers, project goals, selected technologies, stated preferences, constraints, target users, and overall roadmap phase. Avoid generic recommendations. Tailor every section to the specific project.

    IMPORTANT:
    - Describe WHAT should be built, not HOW it should be coded.
    - Focus on capabilities, workflows, user outcomes, business rules, and expected behavior.
    - Do NOT spend prompt space listing files, classes, functions, folders, code patterns, abstractions, or implementation steps unless explicitly required by project constraints.
    - Preserve alignment with the project's goals, scope, and intended user experience.
    - Include all relevant interview-derived requirements and assumptions.
    - Prefer specificity over generality.
    - Avoid vague statements such as "implement best practices" without explaining the expected outcome.

    Each section below is REQUIRED. Failure to satisfy the minimum content requirements will cause the prompt to be rejected and regenerated.

    ## Objective
    (minimum 150 characters)
    Describe the specific capabilities, features, workflows, and user-facing functionality that must be implemented during this task.
    Include:
    - What users should be able to do.
    - What business outcome this task enables.
    - What problem this work solves.
    - Any critical functionality that must be included.
    Do NOT describe implementation details.
    Example:
    "Implement user authentication that allows users to register, sign in, manage active sessions, recover lost passwords, and use Google OAuth. The experience should support both new-user onboarding and returning-user access while protecting accounts from common abuse scenarios."

    ## Context
    (minimum 300 characters)
    Provide detailed project context for the task.
    Include:
    - Overall project purpose.
    - Current roadmap phase goals.
    - Relevant interview answers.
    - Target users.
    - Business objectives.
    - Relevant technology choices.
    - Dependencies on previous phases or completed work.
    Explain why this task matters and how it contributes to the larger project.
    Do NOT describe code organization.

    ## Constraints
    (10–20 items minimum)
    List ALL requirements, assumptions, limitations, technology choices, regulatory considerations, performance expectations, user preferences, platform requirements, and interview-derived constraints.
    Each item should describe a condition that must be respected.
    Good examples:
    - Use PostgreSQL as the primary persistence layer.
    - Support mobile and desktop usage.
    - Authentication must support Google OAuth.
    - The product must work offline after initial synchronization.
    - Data must remain accessible after browser refreshes.
    Avoid implementation instructions when possible.

    ## Expected Output
    (minimum 200 characters)
    Describe the completed end state.
    Focus on what should be true when the task is finished.
    Include:
    - What functionality exists.
    - What users can accomplish.
    - What workflows are operational.
    - What outcomes are available.
    - What business capabilities have been unlocked.
    Describe observable behavior, not implementation artifacts.
    Example:
    "Users can create accounts, authenticate using email/password or Google OAuth, reset forgotten passwords, manage active sessions, and access protected areas of the application. Authentication-related workflows function reliably across supported devices and browsers."

    ## Validation Criteria
    (5–10 items minimum)
    Provide specific, measurable, testable criteria that determine whether the task is complete.
    Each item must describe an observable outcome.
    Examples:
    - Users can complete registration without manual intervention.
    - Authentication persists correctly between sessions.
    - Password reset workflow successfully restores account access.
    - Invalid credentials are rejected with appropriate feedback.
    - Protected features are inaccessible to unauthenticated users.
    Every criterion should be objectively verifiable.

    ## Architectural Alignment
    (minimum 150 characters)
    Describe how this capability fits into the overall system.
    Include:
    - Dependencies on existing features.
    - Related workflows.
    - Upstream and downstream interactions.
    - External services or integrations.
    - Data relationships.
    - User journeys affected by this functionality.
    Focus on system behavior and integration expectations rather than implementation structure.

    ## Agent Tips
    Provide practical guidance in the following categories.

    ### Edge Cases
    (5–10 items)
    Identify uncommon situations, failure scenarios, unusual user behavior, incomplete data conditions, migration concerns, concurrency situations, or other edge cases that should be considered.

    ### Security Considerations
    (5–10 items)
    Identify relevant security concerns, abuse scenarios, data protection requirements, authorization concerns, privacy expectations, validation needs, or compliance-related considerations.

    ### Integration Notes
    (5–10 items)
    Describe interactions with existing workflows, external services, dependencies, user journeys, business processes, and system components that should remain compatible with this task.

    The final prompt should be detailed, project-specific, grounded in interview answers, and sufficiently comprehensive that another AI agent can complete the task without requiring additional clarification.

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
