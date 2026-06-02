import type { AnswerRecord } from "../orchestration/types.js";
import { buildContextPack } from "../synthesis/synthesizer.js";
import { analyzeAnswers } from "../analysis/analyzer.js";
import { AIBlueprintGenerator } from "./ai-generator.js";
import { RouterService } from "../router/router.js";
import { getCredentialStore, decryptKey } from "../credentials/store.js";
import { generateTasks } from "../task-graph/generator.js";
import { assemblePrompt, formatPrompt } from "../prompt/index.js";
import { getGraphStore, getPromptStore } from "../shared-stores.js";
import type { PhaseInput } from "../task-graph/types.js";
import type { TaskNode } from "../task-graph/types.js";
import { taskTypeVerb } from "../task-graph/verbs.js";
import type { PromptArtifact } from "../prompt/types.js";
import { runTransaction } from "../../db/sqlite/index.js";
import {
  createWorkflowRun,
  updateWorkflowStep,
  completeWorkflowRun,
} from "../repositories/workflow-repository.js";
import { saveAnalysisResults } from "../repositories/analysis-repository.js";
import { createUsageRecord, createInMemoryUsageStore } from "../accounting/index.js";
import type { TokenUsage } from "../provider/types.js";
import type { AIProvider, GenerationInput, Message } from "../provider/types.js";
import type { ModelSelection } from "../router/types.js";
import { validateExecutionPrompt, extractSectionContent, PROMPT_SCHEMA_VERSION } from "../prompt/structural-validator.js";
import { EXECUTION_PROMPT_SECTIONS } from "../prompt/schema.js";
import type { PromptSection } from "../prompt/types.js";
import type { TaskContext } from "../prompt/types.js";
import type { StructuralValidationError } from "../prompt/schema.js";
import { emitProgress } from "../events/progress-emitter.js";
import { createEvent, STAGE_ORDER } from "../events/schema.js";
import { createModuleLogger } from "../logging/logger.js";
import { OpenAIProvider } from "../provider/openai.js";
import { AnthropicProvider } from "../provider/anthropic.js";
import { OpenRouterProvider } from "../provider/openrouter.js";
import { MockAIProvider } from "../provider/mock.js";
import { OpencodeGoProvider } from "../provider/opencode-go.js";
import { instrumentProviderCall } from "../metrics/index.js";

const log = createModuleLogger("orchestrator");

export type GenerationMode = "ai_success" | "ai_fallback_deterministic" | "deterministic_only";

export interface OrchestrationResult {
  output: object;
  mode: GenerationMode;
  model?: string;
  provider?: string;
  usage?: TokenUsage;
}

const _usageStore = createInMemoryUsageStore();

export function getUsageStore(): ReturnType<typeof createInMemoryUsageStore> {
  return _usageStore;
}

function extractSectionsFromMarkdown(markdown: string): PromptSection {
  const get = (heading: string): string => extractSectionContent(markdown, heading) ?? "";
  const getLines = (heading: string): string[] => {
    const content = extractSectionContent(markdown, heading);
    if (!content) return [];
    return content
      .split("\n")
      .map((l) => l.replace(/^[-*]\s*/, "").trim())
      .filter((l) => l.length > 0);
  };

  return {
    objective: get("Objective"),
    context: get("Context"),
    constraints: getLines("Constraints"),
    expectedOutput: get("Expected Output"),
    validationCriteria: getLines("Validation Criteria"),
    architecturalAlignment: get("Architectural Alignment"),
    agentTips: {
      security: getLines("Security"),
      edgeCases: getLines("Edge Cases"),
      dependencyWarnings: getLines("Dependency Warnings"),
      commonBugs: getLines("Common Bugs"),
    },
  };
}

/**
 * Auto-repair failing sections in an AI-generated execution prompt using available
 * phase data instead of falling back to hardcoded templates.
 *
 * Returns the repaired markdown string on success, or null if repair isn't possible
 * (which means the caller should fall back to assemblePrompt).
 */
function repairPromptSections(
  aiPrompt: string,
  errors: StructuralValidationError[],
  context: TaskContext,
): string | null {
  const sections = extractSectionsFromMarkdown(aiPrompt);

  for (const error of errors) {

    switch (error.section) {
      case "objective":
        sections.objective = context.phaseSummary
          ? `${taskTypeVerb(context.task.type)}: ${context.task.title}.\n\n${context.phaseSummary}`
          : `${taskTypeVerb(context.task.type)}: ${context.task.title}`;
        break;

      case "context":
        sections.context = [
          `Phase: ${context.task.phaseType}`,
          context.aiPhaseSummary ? `\nPhase summary: ${context.aiPhaseSummary}` : "",
          context.aiPhaseNarrative ? `\nPhase narrative: ${context.aiPhaseNarrative}` : "",
          context.aiOverallSummary ? `\nProject context: ${context.aiOverallSummary}` : "",
          `\nTask type: ${context.task.type} | Priority: ${context.task.priority}`,
        ].join("\n");
        break;

      case "constraints": {
        const items: string[] = [
          `Task must be completable within ${context.task.estimatedPromptRounds ?? 1} prompt round(s)`,
          `Output must be coherent and independently verifiable`,
          `Follow the existing project conventions and code style`,
        ];
        if (context.aiAssumptions?.length) {
          items.push(`Assumptions from interview:`, ...context.aiAssumptions.map((a) => `  - ${a.description}`));
        }
        if (context.aiConstraints?.length) {
          items.push(`Constraints from interview:`, ...context.aiConstraints.map((c) => `  - ${c.description}`));
        }
        if (context.aiRisks?.length) {
          items.push(`Risks to mitigate:`, ...context.aiRisks.map((r) => `  - ${r.description}`));
        }
        sections.constraints = items;
        break;
      }

      case "expectedOutput":
        sections.expectedOutput = [
          `Complete the following work:`,
          ``,
          `1. ${context.task.title}`,
          `2. Ensure the output meets the acceptance criteria below`,
          `3. If applicable, update or create the relevant files in the project`,
        ].join("\n");
        break;

      case "validationCriteria":
        sections.validationCriteria = context.task.acceptanceCriteria?.length
          ? context.task.acceptanceCriteria
          : [`Task "${context.task.title}" is complete and meets requirements`,
             `Output follows the specified format and conventions`,
             `All edge cases described in context are handled`,
             `No regressions introduced to existing functionality`];
        break;

      case "architecturalAlignment":
        sections.architecturalAlignment = [
          `This task is part of the "${context.task.phaseType}" phase of "${context.planName}".`,
          context.aiOverallSummary ? `\nProject context: ${context.aiOverallSummary}` : "",
          `\nThis task contributes to: ${context.task.title}`,
          `It has ${context.task.dependencies.length > 0 ? `${context.task.dependencies.length} predecessor(s)` : "no dependencies"}.`,
        ].join("\n");
        break;

      case "agentTips": {
        const tips = sections.agentTips;
        if (tips.security.length === 0) tips.security = ["Validate all inputs and sanitize outputs", "Do not hardcode secrets or credentials"];
        if (tips.edgeCases.length === 0) tips.edgeCases = ["Consider empty states", "Consider error states", "Consider boundary conditions"];
        if (tips.dependencyWarnings.length === 0) tips.dependencyWarnings = ["Ensure all imported modules are declared", "Check type definitions match between interfaces"];
        if (tips.commonBugs.length === 0) tips.commonBugs = ["Off-by-one errors in loops", "Race conditions in async operations"];
        break;
      }
    }
  }

  return formatPrompt(sections);
}

/**
 * Build a TaskContext from available phase/blueprint data.
 * predecessorOutputs is populated from the task's dependency graph.
 */
function buildTaskContext(
  task: TaskNode,
  phaseData: { summary?: string; narrative?: string; status?: string; confidence?: number; keyDecisions?: string[]; executionPrompt?: string } | undefined,
  blueprint: { assumptions: { description: string }[]; constraints: { description: string }[]; risks: { description: string }[]; overallSummary?: string },
  projectName: string,
  graph: { tasks: TaskNode[] },
  taskMap: Map<string, TaskNode>,
): TaskContext {
  // Resolve predecessor outputs from dependency tasks
  const predecessorOutputs: string[] = [];
  for (const dep of task.dependencies) {
    const depTask = taskMap.get(dep.taskId);
    if (depTask) {
      predecessorOutputs.push(`${depTask.title} [${depTask.phaseType}, ${depTask.status}]`);
    }
  }

  return {
    task,
    planName: projectName,
    allTasks: graph.tasks,
    predecessorOutputs,
    phaseSummary: phaseData?.summary ?? task.phaseType,
    ...(phaseData?.narrative !== undefined ? { aiPhaseNarrative: phaseData.narrative } : {}),
    ...(phaseData?.summary !== undefined ? { aiPhaseSummary: phaseData.summary } : {}),
    ...(phaseData?.status !== undefined ? { aiPhaseStatus: phaseData.status } : {}),
    ...(phaseData?.confidence !== undefined ? { aiPhaseConfidence: phaseData.confidence } : {}),
    ...(phaseData?.keyDecisions !== undefined ? { aiKeyDecisions: phaseData.keyDecisions } : {}),
    ...(blueprint.assumptions.length > 0 ? { aiAssumptions: blueprint.assumptions } : {}),
    ...(blueprint.constraints.length > 0 ? { aiConstraints: blueprint.constraints } : {}),
    ...(blueprint.risks.length > 0 ? { aiRisks: blueprint.risks } : {}),
    ...(blueprint.overallSummary ? { aiOverallSummary: blueprint.overallSummary } : {}),
  };
}

/**
 * Generate a complete execution prompt from TaskContext (no AI involved).
 * Used when the AI didn't produce an executionPrompt at all (missing/too short).
 */
function generatePromptFromContext(context: TaskContext): string | null {
  const sections: PromptSection = {
    objective: `${taskTypeVerb(context.task.type)}: ${context.task.title}. ${context.phaseSummary ?? ""}`,
    context: [
      `Phase: ${context.task.phaseType}`,
      context.aiPhaseSummary ? `\nPhase summary: ${context.aiPhaseSummary}` : "",
      context.aiPhaseNarrative ? `\nPhase narrative: ${context.aiPhaseNarrative}` : "",
      context.aiOverallSummary ? `\nProject context: ${context.aiOverallSummary}` : "",
    ].join("\n"),
    constraints: [
      `Task must be completable within ${context.task.estimatedPromptRounds ?? 1} prompt round(s)`,
      `Output must be coherent and independently verifiable`,
      `Follow the existing project conventions and code style`,
      ...(context.aiAssumptions?.length ? ["", "Assumptions from interview:", ...context.aiAssumptions.map((a) => `  - ${a.description}`)] : []),
      ...(context.aiConstraints?.length ? ["", "Constraints from interview:", ...context.aiConstraints.map((c) => `  - ${c.description}`)] : []),
      ...(context.aiRisks?.length ? ["", "Risks to mitigate:", ...context.aiRisks.map((r) => `  - ${r.description}`)] : []),
    ],
    expectedOutput: `Complete the following work:\n\n1. ${context.task.title}\n2. Ensure the output meets the acceptance criteria below\n3. If applicable, update or create the relevant files in the project`,
    validationCriteria: context.task.acceptanceCriteria?.length
      ? context.task.acceptanceCriteria
      : [`Task "${context.task.title}" is complete and meets requirements`],
    architecturalAlignment: [
      `This task is part of the "${context.task.phaseType}" phase of "${context.planName}".`,
      context.aiOverallSummary ? `\nProject context: ${context.aiOverallSummary}` : "",
    ].join("\n"),
    agentTips: {
      security: ["Validate all inputs and sanitize outputs", "Do not hardcode secrets or credentials"],
      edgeCases: ["Consider empty states", "Consider error states", "Consider boundary conditions"],
      dependencyWarnings: ["Ensure all imported modules are declared", "Check type definitions match between interfaces"],
      commonBugs: ["Off-by-one errors in loops", "Race conditions in async operations"],
    },
  };
  const markdown = formatPrompt(sections);
  if (markdown.length < 100) return null;
  return markdown;
}

/**
 * Build a targeted fix prompt asking the AI to correct specific validation errors
 * in its execution prompt markdown. Includes section minimum lengths and structural requirements.
 */
function buildFixPrompt(
  aiPrompt: string,
  errors: StructuralValidationError[],
  context: TaskContext,
): string {
  const errorBullets = errors
    .map((e) => `- ${e.message}`)
    .join("\n");

  // Minimum content length requirements per section
  const SECTION_MINS: Record<string, number> = {};
  for (const def of EXECUTION_PROMPT_SECTIONS) {
    SECTION_MINS[def.id] = def.minContentLength;
  }

  return [
    `Fix the execution prompt for task "${context.task.title}" (phase: ${context.task.phaseType}).`,
    ``,
    `Structural validation errors to fix:`,
    errorBullets,
    ``,
    `Required section minimum lengths:`,
    `  Objective: ${SECTION_MINS.objective} chars`,
    `  Context: ${SECTION_MINS.context} chars`,
    `  Constraints: ${SECTION_MINS.constraints} chars (list items count toward total)`,
    `  Expected Output: ${SECTION_MINS.expectedOutput} chars`,
    `  Validation Criteria: ${SECTION_MINS.validationCriteria} chars (list items count toward total)`,
    `  Architectural Alignment: ${SECTION_MINS.architecturalAlignment} chars`,
    `  Agent Tips: ${SECTION_MINS.agentTips} chars`,
    ``,
    `Rules:`,
    `- All 7 sections must be present in order: Objective, Context, Constraints, Expected Output, Validation Criteria, Architectural Alignment, Agent Tips`,
    `- Each section must meet its minimum character count — expand short sections with meaningful content`,
    `- Keep all non-flagged content unchanged`,
    `- Do NOT wrap the output in code fences or add explanations`,
    `- Output ONLY the corrected markdown starting with ## Objective`,
    ``,
    `Original prompt:`,
    `---`,
    aiPrompt,
    `---`,
  ].join("\n");
}

/**
 * Create a provider instance from a model selection.
 */
function createFixProvider(selection: ModelSelection): AIProvider | undefined {
  const { provider } = selection;
  const credStore = getCredentialStore();
  const allCreds = credStore.list();
  const cred = allCreds.find((c) => c.provider === provider);
  if (!cred) return undefined;
  const raw = credStore.getRaw(cred.id);
  if (!raw?.encryptedApiKey) return undefined;
  const apiKey = decryptKey(raw.encryptedApiKey);
  if (!apiKey) return undefined;

  switch (provider) {
    case "openai": return new OpenAIProvider(apiKey);
    case "anthropic": return new AnthropicProvider(apiKey);
    case "openrouter": return new OpenRouterProvider(apiKey);
    case "mock": return new MockAIProvider(apiKey);
    case "opencode-go": return new OpencodeGoProvider(apiKey);
    default: return undefined;
  }
}

/**
 * Send a failed AI execution prompt + validation errors back to the AI for correction.
 * Uses the same provider router to select a model, up to 2 retry attempts.
 * Returns the corrected markdown string, or null if all attempts fail.
 */
async function retryPromptWithAI(
  aiPrompt: string,
  errors: StructuralValidationError[],
  context: TaskContext,
  router: RouterService,
): Promise<string | null> {
  const fixPrompt = buildFixPrompt(aiPrompt, errors, context);

  // Select a model for the fix — use cheap tier since this is a targeted edit
  let selections: ModelSelection[];
  try {
    const decision = router.select("prompt_generation");
    selections = [decision.selection, ...decision.fallbackChain.slice(0, 2)];
  } catch {
    log.warn({ taskId: context.task.id, phaseType: context.task.phaseType }, "prompt_retry_no_provider_available");
    return null;
  }

  for (const selection of selections) {
    const provider = createFixProvider(selection);
    if (!provider) continue;

    try {
      const input: GenerationInput = {
        model: selection.model,
        systemPrompt: "You are an expert at fixing AI-generated execution prompts. The user will show you a prompt with structural validation errors (missing/empty/too-short/out-of-order sections). Fix ONLY the reported issues. Expand any sections that are too short. Do NOT change sections that passed validation. Output ONLY the corrected markdown with no code fences, no explanations, no preamble.",
        messages: [{ role: "user", content: fixPrompt }],
        temperature: 0.3,
      };

      const result = await instrumentProviderCall(selection.provider, selection.model, () =>
        provider.generate(input),
      );

      // Extract the corrected markdown — strip any code fences
      let corrected = result.content.trim();
      const fenceMatch = corrected.match(/```(?:markdown)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        corrected = fenceMatch[1]!.trim();
      }

      // Validate the fix
      if (corrected.length >= 100) {
        const validation = validateExecutionPrompt(corrected);
        if (validation.valid) {
          log.info({ model: selection.model, provider: selection.provider, taskId: context.task.id, phaseType: context.task.phaseType }, "ai_prompt_retry_success");
          return corrected;
        }
        log.debug({ taskId: context.task.id, errors: validation.errors }, "ai_prompt_retry_still_invalid");
      }
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : err, provider: selection.provider, model: selection.model }, "ai_prompt_retry_provider_error");
    }
  }

  return null;
}

export async function generateWithAI(
  projectId: string,
  projectName: string,
  projectDescription: string,
  sessionId: string,
  answers: AnswerRecord[],
  planId: string,
  planVersion: number,
  externalWorkflowId?: string,
): Promise<OrchestrationResult> {
  const workflowId = externalWorkflowId ?? crypto.randomUUID();
  const now = () => new Date().toISOString();

  // Create workflow run
  createWorkflowRun(workflowId, planId);
  emitProgress(createEvent(workflowId, "started", "synthesis", { totalStages: STAGE_ORDER.length, stages: [...STAGE_ORDER] }));

  // 1. Build analysis from answers
  let analysis: ReturnType<typeof analyzeAnswers>;
  try {
    const pack = buildContextPack(projectId, projectName, sessionId, answers);
    updateWorkflowStep(workflowId, "synthesis", "completed");
    emitProgress(createEvent(workflowId, "stage_completed", "synthesis", { stageLabel: "Analyzing your answers", attempt: 1, durationMs: 0 }));

    analysis = analyzeAnswers(pack);
    updateWorkflowStep(workflowId, "analysis", "running");
    updateWorkflowStep(workflowId, "analysis", "completed");
    emitProgress(createEvent(workflowId, "stage_completed", "analysis", { stageLabel: "Building project analysis", attempt: 1, durationMs: 0 }));

    // Persist analysis results
    saveAnalysisResults(planId, analysis);
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : err }, "synthesis_analysis_failed");
    completeWorkflowRun(
      workflowId,
      "failed",
      undefined,
      undefined,
      err instanceof Error ? err.message : "Synthesis/analysis failed",
    );
    return { output: null as any, mode: "deterministic_only" };
  }

  // 2. Always ensure a mock credential exists as last-resort fallback
  const store = getCredentialStore();
  let allCreds = store.list();
  log.debug({ credentialCount: allCreds.length, providers: allCreds.map((c) => ({ provider: c.provider, status: c.status, id: c.id })) }, "credential_check_start");
  const hasMock = allCreds.some(
    (c) => c.provider === "mock" && (c.status === "valid" || c.status === "unverified"),
  );

  if (!hasMock) {
    const _now = now();
    store.insert({
      id: "mock-credential",
      userId: "00000000-0000-0000-0000-000000000000",
      projectId: null,
      provider: "mock",
      displayName: "Mock AI Provider",
      status: "valid",
      encryptedApiKey: "mock-key",
      keyReference: null,
      defaultModel: "mock-blueprint-v1",
      modelsAvailable: null,
      lastVerifiedAt: _now,
      errorMessage: null,
      createdAt: _now,
      updatedAt: _now,
    });
    allCreds = store.list();
  }

  const hasValidCreds = allCreds.some((c) => c.status === "valid" || c.status === "unverified");
  log.debug({ hasValidCreds, credentialCount: allCreds.length, providers: allCreds.map((c) => ({ provider: c.provider, status: c.status })) }, "credential_check_result");

  if (!hasValidCreds) {
    log.warn({ credentialCount: allCreds.length }, "no_valid_credentials");
    completeWorkflowRun(workflowId, "failed", undefined, undefined, "No valid provider credentials");
    return { output: null as any, mode: "deterministic_only" };
  }

  // 3. Build router from stored credentials
  const router = new RouterService((provider: string) => {
    const cred = allCreds.find((c) => c.provider === provider);
    return {
      provider,
      available: cred?.status === "valid" || cred?.status === "unverified",
      validatedAt: cred?.lastVerifiedAt ?? null,
    };
  });

  // 4. Create AI generator
  const aiGen = new AIBlueprintGenerator(router, (provider: string) => {
    if (provider === "mock") return "mock-key";
    for (const c of allCreds) {
      if (c.provider === provider) {
        const raw = store.getRaw(c.id);
        if (raw?.encryptedApiKey) {
          const decrypted = decryptKey(raw.encryptedApiKey);
          return decrypted;
        }
      }
    }
    return undefined;
  });

  // 5. Call AI
  updateWorkflowStep(workflowId, "blueprint", "running");
  emitProgress(createEvent(workflowId, "stage_started", "blueprint", { stageLabel: "Generating project plan with AI", attempt: 1 }));
  const result = await aiGen.generate(analysis, planId, planVersion, projectDescription);

  if (result.success && result.data) {
    emitProgress(createEvent(workflowId, "stage_completed", "blueprint", { stageLabel: "Generating project plan with AI", attempt: 1, durationMs: result.durationMs, model: result.model, provider: result.provider }));
    updateWorkflowStep(workflowId, "blueprint", "completed");
    const { blueprint } = result.data;

    // 6. Generate task graph from AI-authored phases
    updateWorkflowStep(workflowId, "roadmap", "running");
    emitProgress(createEvent(workflowId, "stage_completed", "roadmap", { stageLabel: "Creating roadmap", attempt: 1, durationMs: 0 }));
    updateWorkflowStep(workflowId, "roadmap", "completed");

    const phases: PhaseInput[] = blueprint.phases.map((p) => ({
      phaseType: p.phaseType,
      phaseName: p.phaseName,
      status: p.status as "sufficient" | "insufficient" | "missing",
      confidence: p.confidence,
      summary: p.summary,
      narrative: p.narrative,
      keyDecisions: p.keyDecisions,
      executionPrompt: p.executionPrompt,
    }));

    let graph;
    try {
      updateWorkflowStep(workflowId, "taskGraph", "running");
      graph = generateTasks(planId, planVersion, phases);
      emitProgress(createEvent(workflowId, "stage_completed", "taskGraph", { stageLabel: "Decomposing into tasks", attempt: 1, durationMs: 0 }));
      updateWorkflowStep(workflowId, "taskGraph", "completed");
    } catch (err) {
      log.warn({ phaseCount: phases.length, err: err instanceof Error ? err.message : err }, "task_graph_generation_failed");
      completeWorkflowRun(
        workflowId,
        "failed",
        result.provider,
        result.model,
        "Task graph generation failed",
      );
      return { output: null as any, mode: "deterministic_only" };
    }

    // 7. Assemble prompts for each task — transactional
    updateWorkflowStep(workflowId, "promptGen", "running");
    const taskMap = new Map(graph.tasks.map((t) => [t.id, t]));

    // Pre-compute AI retry fixes for failed prompts (before transaction, since AI calls are async)
    const promptFixes = new Map<string, string | null>();
    for (const task of graph.tasks) {
      const phaseData = blueprint.phases.find((p) => p.phaseType === task.phaseType);
      const aiPrompt = phaseData?.executionPrompt;
      if (aiPrompt && aiPrompt.length >= 500) {
        const validation = validateExecutionPrompt(aiPrompt);
        if (!validation.valid) {
          const context = buildTaskContext(task, phaseData, blueprint, projectName, graph, taskMap);
          const fix = await retryPromptWithAI(aiPrompt, validation.errors, context, router);
          promptFixes.set(task.id, fix);
        }
      }
    }

    try {
      let withAiPrompt = 0;
      let aiPromptUsed = 0;
      let fallbackUsed = 0;

      runTransaction(() => {
        getGraphStore().saveGraph(graph);

        for (const task of graph.tasks) {
          const phaseData = blueprint.phases.find((p) => p.phaseType === task.phaseType);
          const aiPrompt = phaseData?.executionPrompt;

          if (aiPrompt) {
            withAiPrompt++;
            log.debug({ taskId: task.id, phaseType: task.phaseType, promptLength: aiPrompt.length, preview: aiPrompt.slice(0, 80) }, "ai_execution_prompt_found");
          } else {
            log.warn({ taskId: task.id, phaseType: task.phaseType }, "no_ai_execution_prompt");
          }

          if (aiPrompt && aiPrompt.length >= 500) {
            const validation = validateExecutionPrompt(aiPrompt);
            if (validation.valid) {
              aiPromptUsed++;
              const sections = extractSectionsFromMarkdown(aiPrompt);
              const artifact: PromptArtifact = {
                id: crypto.randomUUID(),
                taskId: task.id,
                planId: task.planId,
                planVersion,
                promptText: aiPrompt,
                sections,
                version: PROMPT_SCHEMA_VERSION,
                status: "complete",
                failureReason: null,
                createdAt: now(),
              };
              getPromptStore().save(artifact);
            } else {
              // Validation failed — use pre-computed AI retry, then repair fallback
              const context = buildTaskContext(task, phaseData, blueprint, projectName, graph, taskMap);
              log.warn({ taskId: task.id, phaseType: task.phaseType, errors: validation.errors }, "execution_prompt_validation_failed");

              const aiRetry = promptFixes.get(task.id) ?? null;
              const fixed = aiRetry ?? repairPromptSections(aiPrompt, validation.errors, context);

              if (fixed) {
                const fixedValidation = validateExecutionPrompt(fixed);
                if (fixedValidation.valid) {
                  aiPromptUsed++;
                  const fixedSections = extractSectionsFromMarkdown(fixed);
                  const artifact: PromptArtifact = {
                    id: crypto.randomUUID(),
                    taskId: task.id,
                    planId: task.planId,
                    planVersion,
                    promptText: fixed,
                    sections: fixedSections,
                    version: PROMPT_SCHEMA_VERSION,
                    status: "complete",
                    failureReason: null,
                    createdAt: now(),
                  };
                  getPromptStore().save(artifact);
                  log.info({ taskId: task.id, phaseType: task.phaseType, repairMethod: aiRetry ? "ai_retry" : "section_repair" }, "execution_prompt_repaired");
                } else {
                  fallbackUsed++;
                  log.warn({ taskId: task.id, phaseType: task.phaseType, errors: fixedValidation.errors }, "execution_prompt_repair_failed");
                  assemblePrompt(context, getPromptStore(), planVersion);
                }
              } else {
                fallbackUsed++;
                assemblePrompt(context, getPromptStore(), planVersion);
              }
            }
          } else {
            fallbackUsed++;
            if (aiPrompt) {
              log.warn({ taskId: task.id, phaseType: task.phaseType, promptLength: aiPrompt.length }, "ai_execution_prompt_too_short");
            }
            // Generate from phase data instead of hardcoded templates
            const context = buildTaskContext(task, phaseData, blueprint, projectName, graph, taskMap);
            const generated = generatePromptFromContext(context);
            if (generated) {
              const genValidation = validateExecutionPrompt(generated);
              if (genValidation.valid) {
                aiPromptUsed++;
                const genSections = extractSectionsFromMarkdown(generated);
                const artifact: PromptArtifact = {
                  id: crypto.randomUUID(),
                  taskId: task.id,
                  planId: task.planId,
                  planVersion,
                  promptText: generated,
                  sections: genSections,
                  version: PROMPT_SCHEMA_VERSION,
                  status: "complete",
                  failureReason: null,
                  createdAt: now(),
                };
                getPromptStore().save(artifact);
              } else {
                assemblePrompt(context, getPromptStore(), planVersion);
              }
            } else {
              assemblePrompt(context, getPromptStore(), planVersion);
            }
          }
        }
      });
      log.info({ totalTasks: graph.tasks.length, withAiPrompt, aiPromptUsed, fallbackUsed }, "prompt_assembly_summary");
      emitProgress(createEvent(workflowId, "stage_completed", "promptGen", { stageLabel: "Assembling execution prompts", attempt: 1, durationMs: 0 }));
      updateWorkflowStep(workflowId, "promptGen", "completed");
    } catch {
      completeWorkflowRun(workflowId, "failed", result.provider, result.model, "Prompt generation failed");
      return { output: null as any, mode: "ai_fallback_deterministic" };
    }

    // Mark workflow complete
    completeWorkflowRun(workflowId, "completed", result.provider, result.model);
    emitProgress(createEvent(workflowId, "completed", "complete", { totalDurationMs: Date.now() - parseInt(workflowId, 36) || 0, model: result.model, provider: result.provider }));

    // 8. Record usage — one record per attempt, plus a summary record
    for (const attempt of (result.attempts ?? [])) {
      const attemptRecord = createUsageRecord({
        projectId,
        userId: "system",
        sessionId,
        taskType: "blueprint",
        provider: attempt.provider,
        model: attempt.model,
        estimatedPromptTokens: attempt.usage.promptTokens,
        estimatedCompletionTokens: attempt.usage.completionTokens,
        estimatedCost: 0,
        actualPromptTokens: attempt.usage.promptTokens,
        actualCompletionTokens: attempt.usage.completionTokens,
        retryAttempt: 0,
        fallbackAttempt: 0,
        status: attempt.success ? "completed" : "failed",
      });
      _usageStore.insertRecord(attemptRecord);
    }

    return {
      output: blueprint,
      mode: "ai_success",
      model: result.model,
      provider: result.provider,
      usage: result.usage,
    };
  }

  // AI failed
  updateWorkflowStep(workflowId, "blueprint", "failed");
  completeWorkflowRun(workflowId, "failed", result.provider, result.model, result.error);
  return { output: null as any, mode: "ai_fallback_deterministic" };
}
