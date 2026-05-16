import type { AnswerRecord } from "../orchestration/types.js";
import { buildContextPack } from "../synthesis/synthesizer.js";
import { analyzeAnswers } from "../analysis/analyzer.js";
import { AIBlueprintGenerator } from "./ai-generator.js";
import { RouterService } from "../router/router.js";
import { getCredentialStore, decryptKey } from "../credentials/store.js";
import { generateTasks, createInMemoryGraphStore } from "../task-graph/generator.js";
import { assemblePrompt, createInMemoryPromptStore } from "../prompt/index.js";
import type { PhaseInput } from "../task-graph/types.js";

const graphStore = createInMemoryGraphStore();
const promptStore = createInMemoryPromptStore();

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
  sessionId: string,
  answers: AnswerRecord[],
  planId: string,
  planVersion: number,
): Promise<OrchestrationResult> {
  // 1. Build analysis from answers
  const pack = buildContextPack(projectId, projectName, sessionId, answers);
  const analysis = analyzeAnswers(pack);

  // 2. Check if any provider credentials are stored
  const store = getCredentialStore();
  const allCreds = store.list();
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
    // Look up credential by provider name (e.g., "openrouter")
    for (const c of allCreds) {
      if (c.provider === provider) {
        const raw = store.getRaw(c.id);
        if (raw?.encryptedApiKey) return decryptKey(raw.encryptedApiKey);
      }
    }
    // Fallback: try alternate credential if the stored one has a different name
    if (provider === "openrouter" || provider === "openai" || provider === "anthropic") {
      for (const c of allCreds) {
        const raw = store.getRaw(c.id);
        if (raw?.encryptedApiKey) return decryptKey(raw.encryptedApiKey);
      }
    }
    return undefined;
  });

  // 5. Call AI
  const result = await aiGen.generate(analysis, planId, planVersion);

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

    // 7. Assemble prompts for each task
    for (const task of graph.tasks) {
      assemblePrompt(
        {
          task,
          planName: projectName,
          allTasks: graph.tasks,
          predecessorOutputs: [],
          phaseSummary: task.phaseType,
        },
        promptStore,
        planVersion,
      );
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
