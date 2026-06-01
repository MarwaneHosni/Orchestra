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
import { validateExecutionPrompt, extractSectionContent, PROMPT_SCHEMA_VERSION } from "../prompt/structural-validator.js";
import type { PromptSection } from "../prompt/types.js";
import type { TaskContext } from "../prompt/types.js";
import type { StructuralValidationError } from "../prompt/schema.js";
import { emitProgress } from "../events/progress-emitter.js";
import { createEvent, STAGE_ORDER } from "../events/schema.js";
import { createModuleLogger } from "../logging/logger.js";

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
          ? `Implement: ${context.task.title}.\n\n${context.phaseSummary}`
          : `Implement: ${context.task.title}`;
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
 */
function buildTaskContext(
  task: TaskNode,
  phaseData: { summary?: string; narrative?: string; status?: string; confidence?: number; keyDecisions?: string[]; executionPrompt?: string } | undefined,
  blueprint: { assumptions: { description: string }[]; constraints: { description: string }[]; risks: { description: string }[]; overallSummary?: string },
  projectName: string,
  graph: { tasks: TaskNode[] },
): TaskContext {
  return {
    task,
    planName: projectName,
    allTasks: graph.tasks,
    predecessorOutputs: [],
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
    objective: `Implement: ${context.task.title}. ${context.phaseSummary ?? ""}`,
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
 * Placeholder for Option B — AI retry on failed sections.
 * Will be wired to send the prompt + validation errors back to the AI for correction.
 * Synchronous for now (Option B will make this async).
 */
function retryPromptWithAI(
  _aiPrompt: string,
  _errors: StructuralValidationError[],
  _context: TaskContext,
): string | null {
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
              // Validation failed — try to repair the AI prompt before falling back
              const context = buildTaskContext(task, phaseData, blueprint, projectName, graph);
              log.warn({ taskId: task.id, phaseType: task.phaseType, errors: validation.errors }, "execution_prompt_validation_failed");

              // Option B hook: AI retry first (placeholder, returns null for now)
              const aiRetry = retryPromptWithAI(aiPrompt, validation.errors, context);
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
            const context = buildTaskContext(task, phaseData, blueprint, projectName, graph);
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
