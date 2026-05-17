import type { AnswerRecord } from "../orchestration/types.js";
import { buildContextPack } from "../synthesis/synthesizer.js";
import { analyzeAnswers } from "../analysis/analyzer.js";
import { AIBlueprintGenerator } from "./ai-generator.js";
import { RouterService } from "../router/router.js";
import { getCredentialStore, decryptKey } from "../credentials/store.js";
import { generateTasks } from "../task-graph/generator.js";
import { assemblePrompt } from "../prompt/index.js";
import { graphStore, promptStore } from "../shared-stores.js";
import type { PhaseInput } from "../task-graph/types.js";
import type { PromptArtifact } from "../prompt/types.js";
import { runTransaction } from "../../db/sqlite/index.js";
import {
  createWorkflowRun,
  updateWorkflowStep,
  completeWorkflowRun,
} from "../repositories/workflow-repository.js";
import { saveAnalysisResults } from "../repositories/analysis-repository.js";

export type GenerationMode = "ai_success" | "ai_fallback_deterministic" | "deterministic_only";

export interface OrchestrationResult {
  output: object;
  mode: GenerationMode;
  model?: string;
  provider?: string;
}

export async function generateWithAI(
  projectId: string,
  projectName: string,
  projectDescription: string,
  sessionId: string,
  answers: AnswerRecord[],
  planId: string,
  planVersion: number,
): Promise<OrchestrationResult> {
  const workflowId = crypto.randomUUID();
  const now = () => new Date().toISOString();

  // Create workflow run
  createWorkflowRun(workflowId, planId);

  // 1. Build analysis from answers
  let analysis: ReturnType<typeof analyzeAnswers>;
  try {
    const pack = buildContextPack(projectId, projectName, sessionId, answers);
    updateWorkflowStep(workflowId, "synthesis", "completed");

    analysis = analyzeAnswers(pack);
    updateWorkflowStep(workflowId, "analysis", "completed");

    // Persist analysis results
    saveAnalysisResults(planId, analysis);
  } catch (err) {
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

  if (!hasValidCreds) {
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
  const result = await aiGen.generate(analysis, planId, planVersion, projectDescription);

  if (result.success && result.data) {
    updateWorkflowStep(workflowId, "blueprint", "completed");
    const { blueprint } = result.data;

    // Persist AI generation metadata to workflow
    completeWorkflowRun(workflowId, "running", result.provider, result.model);

    // 6. Generate task graph from AI-authored phases
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
      graph = generateTasks(planId, planVersion, phases);
      updateWorkflowStep(workflowId, "taskGraph", "completed");
    } catch {
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
      runTransaction(() => {
        graphStore.saveGraph(graph);

        for (const task of graph.tasks) {
          const phaseData = blueprint.phases.find((p) => p.phaseType === task.phaseType);
          const aiPrompt = phaseData?.executionPrompt;

          if (aiPrompt && aiPrompt.length >= 100) {
            const artifact: PromptArtifact = {
              id: crypto.randomUUID(),
              taskId: task.id,
              planId: task.planId,
              planVersion,
              promptText: aiPrompt,
              sections: {
                objective: "",
                context: "",
                constraints: [],
                expectedOutput: "",
                validationCriteria: [],
                architecturalAlignment: "",
                agentTips: { security: [], edgeCases: [], dependencyWarnings: [], commonBugs: [] },
              },
              version: 1,
              status: "complete",
              failureReason: null,
              createdAt: now(),
            };
            promptStore.save(artifact);
          } else {
            assemblePrompt(
              {
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
              },
              promptStore,
              planVersion,
            );
          }
        }
      });
      updateWorkflowStep(workflowId, "promptGen", "completed");
    } catch {
      completeWorkflowRun(workflowId, "failed", result.provider, result.model, "Prompt generation failed");
      return { output: null as any, mode: "ai_fallback_deterministic" };
    }

    // Mark workflow complete
    completeWorkflowRun(workflowId, "completed", result.provider, result.model);

    return {
      output: blueprint,
      mode: "ai_success",
      model: result.model,
      provider: result.provider,
    };
  }

  // AI failed
  updateWorkflowStep(workflowId, "blueprint", "failed");
  completeWorkflowRun(workflowId, "failed", result.provider, result.model, result.error);
  return { output: null as any, mode: "ai_fallback_deterministic" };
}
