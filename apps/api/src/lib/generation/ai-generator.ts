import type { AIProvider, GenerationInput } from "../provider/types.js";
import { OpenAIProvider } from "../provider/openai.js";
import { AnthropicProvider } from "../provider/anthropic.js";
import { OpenRouterProvider } from "../provider/openrouter.js";
import { MockAIProvider } from "../provider/mock.js";
import { OpencodeGoProvider } from "../provider/opencode-go.js";
import type { RouterService } from "../router/router.js";
import type { RouterDecision, ModelSelection } from "../router/types.js";
import type { AnalysisPack } from "../analysis/types.js";
import type { BlueprintOutput, RoadmapOutput, PhaseType } from "../contract/output-schema.js";
import { BlueprintOutputSchema, RoadmapOutputSchema, PHASE_ORDER } from "../contract/output-schema.js";
import { PHASE_LABELS } from "../interview/questions.js";
import { instrumentProviderCall } from "../metrics/index.js";
import type { AIGenerationResult } from "./prompts.js";
import { buildSystemPrompt, buildAnalysisMessage } from "./prompts.js";

export class AIBlueprintGenerator {
  private projectDescription: string = "";

  constructor(
    private router: RouterService,
    private getApiKey: (provider: string) => string | undefined,
    private providerFactory?: (provider: string, apiKey: string) => AIProvider | undefined,
  ) {}

  async generate(
    analysis: AnalysisPack,
    planId: string,
    planVersion: number,
    projectDescription: string = "",
  ): Promise<AIGenerationResult<{ blueprint: BlueprintOutput; roadmap: RoadmapOutput }>> {
    this.projectDescription = projectDescription;
    try {
      const decision = this.router.select("blueprint", {});
      return this.callProvider(decision, analysis, planId, planVersion, false);
    } catch (err) {
      return {
        success: false,
        data: null,
        model: "unknown",
        provider: "unknown",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: "error",
        fallbackUsed: false,
        routerDecision: {
          taskType: "blueprint",
          selection: { provider: "unknown", model: "unknown", tier: "balanced" },
          fallbackChain: [],
          usedFallback: false,
          reasoning: [],
          timestamp: new Date().toISOString(),
        },
        durationMs: 0,
        error: err instanceof Error ? err.message : "Router selection failed",
      };
    }
  }

  private async callProvider(
    decision: RouterDecision,
    analysis: AnalysisPack,
    planId: string,
    planVersion: number,
    isFallback: boolean,
    depth = 0,
  ): Promise<AIGenerationResult<{ blueprint: BlueprintOutput; roadmap: RoadmapOutput }>> {
    if (depth > 5) {
      return this.failureResult("Max retry depth exceeded", decision, Date.now());
    }
    const startTime = Date.now();
    const selection = decision.selection;

    console.log(
      "[AI-GEN DEBUG]",
      JSON.stringify({
        step: "callProvider",
        depth,
        selection: { provider: selection.provider, model: selection.model, tier: selection.tier },
        fallbackChainLength: decision.fallbackChain.length,
        isFallback,
      }),
    );

    const provider = this.createProvider(selection);
    if (!provider) {
      console.log(
        "[AI-GEN DEBUG]",
        JSON.stringify({
          step: "provider_not_created",
          provider: selection.provider,
          model: selection.model,
          reason: "getApiKey returned undefined or createProvider returned undefined",
        }),
      );
      // Try fallback — remove current fallback from chain to avoid infinite loops
      while (decision.fallbackChain.length > 0) {
        const fallback = decision.fallbackChain[0]!;
        const remaining = decision.fallbackChain.slice(1);
        const fbDecision: RouterDecision = {
          ...decision,
          selection: fallback,
          fallbackChain: remaining,
          usedFallback: true,
          reasoning: [...decision.reasoning, `Fallback to ${fallback.provider}/${fallback.model}`],
        };
        return this.callProvider(fbDecision, analysis, planId, planVersion, true, depth + 1);
      }
      return this.failureResult(`No provider available for ${selection.provider}`, decision, startTime);
    }

    console.log(
      "[AI-GEN DEBUG]",
      JSON.stringify({
        step: "provider_created",
        provider: selection.provider,
        model: selection.model,
        providerType: provider.constructor.name,
      }),
    );

    const systemPrompt = buildSystemPrompt();
    const messages = buildAnalysisMessage(analysis, this.projectDescription);

    const input: GenerationInput = {
      model: selection.model,
      systemPrompt,
      messages,
      temperature: 0.3,
    };

    try {
      const result = await instrumentProviderCall(selection.provider, selection.model, () =>
        provider.generate(input),
      );

      const parsed = this.parseBlueprintResponse(
        result.content,
        analysis,
        planId,
        planVersion,
        selection.provider,
        result.model,
      );

      if (parsed) {
        return {
          success: true,
          data: parsed,
          model: result.model,
          provider: selection.provider,
          usage: result.usage,
          finishReason: result.finishReason,
          fallbackUsed: isFallback,
          routerDecision: decision,
          durationMs: Date.now() - startTime,
        };
      }

      // JSON parse failed — try fallback if available
      if (decision.fallbackChain.length > 0) {
        return this.tryFallback(
          decision,
          analysis,
          planId,
          planVersion,
          startTime,
          "AI response could not be parsed as valid JSON",
          depth + 1,
        );
      }

      return this.failureResult("AI response could not be parsed as valid JSON", decision, startTime);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(
        "[AI-GEN DEBUG]",
        JSON.stringify({
          step: "provider_error",
          provider: selection.provider,
          model: selection.model,
          error: errorMsg,
          fallbackChainLength: decision.fallbackChain.length,
          depth,
        }),
      );
      if (decision.fallbackChain.length > 0) {
        return this.tryFallback(decision, analysis, planId, planVersion, startTime, errorMsg, depth + 1);
      }
      return this.failureResult(errorMsg, decision, startTime);
    }
  }

  private parseBlueprintResponse(
    content: string,
    analysis: AnalysisPack,
    planId: string,
    planVersion: number,
    provider: string,
    model: string,
  ): { blueprint: BlueprintOutput; roadmap: RoadmapOutput } | null {
    // Log first 500 chars of AI response for debugging
    console.log(
      "[AI RAW RESPONSE]",
      JSON.stringify({
        provider,
        model,
        length: content.length,
        preview: content.slice(0, 500),
      }),
    );

    let parsed: unknown;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log("[AI PARSE ERROR] No JSON object found in response");
        return null;
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.log("[AI PARSE ERROR] JSON parse failed:", err instanceof Error ? err.message : String(err));
      return null;
    }

    if (!parsed || typeof parsed !== "object") {
      console.log("[AI PARSE ERROR] Parsed value is not an object");
      return null;
    }

    const data = parsed as Record<string, unknown>;
    const now = new Date().toISOString();

    // Normalize status values: AI may return "completed", "done", "COMPLETED", etc. instead of valid enums
    const validStatuses = ["sufficient", "insufficient", "missing", "ai_augmented"];
    const normalizeStatus = (s: unknown): string => {
      if (typeof s !== "string") return "ai_augmented";
      const lower = s.toLowerCase().replace(/[\s_-]/g, "");
      if (validStatuses.includes(lower)) return lower;
      if (lower === "completed" || lower === "done" || lower === "ready" || lower === "passed")
        return "sufficient";
      if (lower === "inprogress" || lower === "incomplete" || lower === "partial") return "insufficient";
      return "ai_augmented";
    };

    // Normalize phases: convert object-style { "ideation": {...} } to array-style [{ phaseType: "ideation", ... }]
    let normalizedPhases: unknown = data.phases;
    if (data.phases && typeof data.phases === "object" && !Array.isArray(data.phases)) {
      const phaseMap = data.phases as Record<string, unknown>;
      normalizedPhases = PHASE_ORDER.map((pt) => {
        const p = phaseMap[pt] as Record<string, unknown> | undefined;
        return p
          ? { phaseType: pt, ...p, status: normalizeStatus(p.status) }
          : {
              phaseType: pt,
              phaseName: pt,
              summary: `AI analysis for ${pt}`,
              narrative: `Phase ${pt} analysis.`,
              status: "sufficient",
              confidence: 0.5,
              keyDecisions: [],
              sourceAnswers: [],
            };
      });
    } else if (Array.isArray(normalizedPhases)) {
      // Normalize in-place for array-format phases
      normalizedPhases = (normalizedPhases as Record<string, unknown>[]).map((p) => ({
        ...p,
        status: normalizeStatus(p.status),
      }));
    }

    // Normalize structured items: convert string arrays to object arrays with required fields
    const normalizeItems = (
      items: unknown,
      type: "assumption" | "constraint" | "risk",
    ): { id: string; description: string; source: string; provenance: string }[] => {
      if (!Array.isArray(items)) return [];
      return items.map((item, i) => {
        if (typeof item === "string") {
          return {
            id: `${type}-${i + 1}`,
            description: item,
            source: "ai_generation",
            provenance: "ai_generated",
          };
        }
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          return {
            id: (obj.id as string) ?? `${type}-${i + 1}`,
            description: (obj.description as string) ?? String(item),
            source: (obj.source as string) ?? "ai_generation",
            provenance: (obj.provenance as string) ?? "ai_generated",
          };
        }
        return {
          id: `${type}-${i + 1}`,
          description: String(item),
          source: "ai_generation",
          provenance: "ai_generated",
        };
      });
    };

    // Ensure overallSummary exists
    if (!data.overallSummary || String(data.overallSummary).trim().length < 5) {
      data.overallSummary = `Project plan covering all ${PHASE_ORDER.length} lifecycle phases generated by AI analysis of interview answers.`;
    }

    // Build blueprint — use normalized data
    const blueprintResult = BlueprintOutputSchema.safeParse({
      planId,
      planVersion,
      projectId: analysis.projectId,
      sessionId: analysis.sessionId,
      createdAt: now,
      schemaVersion: "orchestra-generated-v1",
      artifactType: "blueprint",
      phases: normalizedPhases,
      assumptions: normalizeItems(data.assumptions, "assumption"),
      constraints: normalizeItems(data.constraints, "constraint"),
      risks: normalizeItems(data.risks, "risk"),
      overallConfidence: data.overallConfidence ?? 0.5,
      overallSummary: data.overallSummary ?? "",
      generationMetadata: {
        model,
        provider,
        generationId: crypto.randomUUID(),
        startedAt: now,
        completedAt: now,
        durationMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        fallbackUsed: false,
      },
    });

    if (!blueprintResult.success) {
      console.log(
        "[AI ZOD ERROR] Blueprint validation failed:",
        JSON.stringify(blueprintResult.error.issues, null, 2),
      );
      return null;
    }

    // Build roadmap
    const validEfforts = ["small", "medium", "large", "unknown"];
    const normalizeEffort = (e: unknown): string => {
      if (typeof e === "string" && validEfforts.includes(e)) return e;
      if (typeof e === "string") {
        const lower = e.toLowerCase();
        if (validEfforts.includes(lower)) return lower;
        if (lower === "xs" || lower === "tiny") return "small";
        if (lower === "xl" || lower === "huge" || lower === "big") return "large";
      }
      return "unknown";
    };

    // Build reverse label-to-key map once
    const phaseLabelToKey = new Map<string, string>();
    for (const key of PHASE_ORDER) {
      const label = PHASE_LABELS[key];
      if (label) phaseLabelToKey.set(label.toLowerCase(), key);
      // Also store the key itself for direct matches
      phaseLabelToKey.set(key.toLowerCase(), key);
    }

    const normalizePhaseRef = (ref: unknown): string => {
      if (typeof ref !== "string") return "";
      const trimmed = ref.trim().toLowerCase();
      if ((PHASE_ORDER as readonly string[]).includes(trimmed)) return trimmed;
      const direct = phaseLabelToKey.get(trimmed);
      if (direct) return direct;
      for (const [label, key] of phaseLabelToKey) {
        if (label.includes(trimmed) || trimmed.includes(label)) return key;
      }
      for (const [label, key] of phaseLabelToKey) {
        for (const word of trimmed.split(/[\s_\-&,]+/).filter(Boolean)) {
          if (label.includes(word)) return key;
        }
      }
      return "";
    };

    const rawRoadmapPhases = (data.roadmapPhases ?? data.phases) as Record<string, unknown>[] | undefined;
    const roadmapPhases = Array.isArray(rawRoadmapPhases)
      ? rawRoadmapPhases.map((p) => ({
          ...p,
          phaseType: (normalizePhaseRef(p.phaseType) as PhaseType) || ("ideation" as PhaseType),
          effort: normalizeEffort(p.effort),
          prerequisites: ((Array.isArray(p.prerequisites) ? p.prerequisites : []) as unknown[])
            .map((ref) => normalizePhaseRef(ref))
            .filter((s): s is string => s !== "")
            .map((s) => s as PhaseType),
        }))
      : [];

    const roadmapResult = RoadmapOutputSchema.safeParse({
      planId,
      planVersion,
      projectId: analysis.projectId,
      sessionId: analysis.sessionId,
      createdAt: now,
      schemaVersion: "orchestra-generated-v1",
      artifactType: "roadmap",
      phases: roadmapPhases,
      totalEffort: normalizeEffort(data.totalEffort ?? "medium"),
      recommendedApproach: data.recommendedApproach,
      generationMetadata: {
        model,
        provider,
        generationId: crypto.randomUUID(),
        startedAt: now,
        completedAt: now,
        durationMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        fallbackUsed: false,
      },
    });

    if (!roadmapResult.success) {
      console.log(
        "[AI ZOD ERROR] Roadmap validation failed:",
        JSON.stringify(roadmapResult.error.issues, null, 2),
      );
      return null;
    }

    return {
      blueprint: blueprintResult.data,
      roadmap: roadmapResult.data,
    };
  }

  private createProvider(selection: ModelSelection): AIProvider | undefined {
    const apiKey = this.getApiKey(selection.provider);
    if (!apiKey) return undefined;

    if (this.providerFactory) {
      return this.providerFactory(selection.provider, apiKey);
    }

    switch (selection.provider) {
      case "openai":
        return new OpenAIProvider(apiKey);
      case "anthropic":
        return new AnthropicProvider(apiKey);
      case "openrouter":
        return new OpenRouterProvider(apiKey);
      case "mock":
        return new MockAIProvider(apiKey);
      case "opencode-go":
        return new OpencodeGoProvider(apiKey);
      default:
        return undefined;
    }
  }

  private async tryFallback(
    decision: RouterDecision,
    analysis: AnalysisPack,
    planId: string,
    planVersion: number,
    _startTime: number,
    errorMsg: string,
    depth: number,
  ): Promise<AIGenerationResult<{ blueprint: BlueprintOutput; roadmap: RoadmapOutput }>> {
    const fallbackSelection = decision.fallbackChain[0]!;
    const remainingFallbacks = decision.fallbackChain.slice(1);
    const fbDecision: RouterDecision = {
      ...decision,
      selection: fallbackSelection,
      fallbackChain: remainingFallbacks,
      usedFallback: true,
      reasoning: [
        ...decision.reasoning,
        `Fallback to ${fallbackSelection.provider}/${fallbackSelection.model} after: ${errorMsg}`,
      ],
    };
    return this.callProvider(fbDecision, analysis, planId, planVersion, true, depth + 1);
  }

  private failureResult(
    error: string,
    decision: RouterDecision,
    startTime: number,
  ): AIGenerationResult<{ blueprint: BlueprintOutput; roadmap: RoadmapOutput }> {
    return {
      success: false,
      data: null,
      model: decision.selection.model,
      provider: decision.selection.provider,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: "error",
      fallbackUsed: decision.usedFallback,
      routerDecision: decision,
      durationMs: Date.now() - startTime,
      error,
    };
  }
}
