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
  // 1. Build analysis from answers
  const pack = buildContextPack(projectId, projectName, sessionId, answers);
  const analysis = analyzeAnswers(pack);

  // 2. Always ensure a mock credential exists as last-resort fallback
  const store = getCredentialStore();
  let allCreds = store.list();
  const hasMock = allCreds.some(
    (c) => c.provider === "mock" && (c.status === "valid" || c.status === "unverified"),
  );

  if (!hasMock) {
    const now = new Date().toISOString();
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
      lastVerifiedAt: now,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });
    allCreds = store.list();
  }

  const hasValidCreds = allCreds.some((c) => c.status === "valid" || c.status === "unverified");

  if (!hasValidCreds) {
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
    // Mock provider doesn't need an API key
    if (provider === "mock") return "mock-key";
    // Look up credential by provider name (exact match only — never use OpenRouter key for OpenAI)
    for (const c of allCreds) {
      if (c.provider === provider) {
        const raw = store.getRaw(c.id);
        if (raw?.encryptedApiKey) {
          const decrypted = decryptKey(raw.encryptedApiKey);
          console.log(
            "[ORCHESTRATOR DEBUG]",
            JSON.stringify({
              step: "getApiKey",
              provider,
              credentialId: c.id,
              credentialStatus: c.status,
              keyPreview: decrypted.slice(0, 8) + "...",
              keyLength: decrypted.length,
            }),
          );
          return decrypted;
        }
      }
    }
    console.log(
      "[ORCHESTRATOR DEBUG]",
      JSON.stringify({
        step: "getApiKey_not_found",
        provider,
        availableProviders: allCreds.map((c) => ({ provider: c.provider, status: c.status })),
      }),
    );
    return undefined;
  });

  // 5. Call AI
  const result = await aiGen.generate(analysis, planId, planVersion, projectDescription);

  if (result.success && result.data) {
    const { blueprint } = result.data;

    // 6. Generate task graph from AI-authored phases
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
    } catch {
      // If task generation fails (e.g. unknown phase types), fall back
      return { output: null as any, mode: "deterministic_only" };
    }

    graphStore.saveGraph(graph);

    // 7. Assemble prompts for each task — use AI-generated executionPrompt if available, else assemblePrompt
    for (const task of graph.tasks) {
      const phaseData = blueprint.phases.find((p) => p.phaseType === task.phaseType);
      const aiPrompt = phaseData?.executionPrompt;

      if (aiPrompt && aiPrompt.length >= 100) {
        promptStore.save({
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
          createdAt: new Date().toISOString(),
        });
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

    return {
      output: blueprint,
      mode: "ai_success",
      model: result.model,
      provider: result.provider,
    };
  }

  // AI failed — fall back to deterministic
  return { output: null as any, mode: "ai_fallback_deterministic" };
}
