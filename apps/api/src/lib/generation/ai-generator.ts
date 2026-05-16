import type { AIProvider, GenerationInput } from "../provider/types.js";
import { OpenAIProvider } from "../provider/openai.js";
import { AnthropicProvider } from "../provider/anthropic.js";
import { OpenRouterProvider } from "../provider/openrouter.js";
import type { RouterService } from "../router/router.js";
import type { RouterDecision, ModelSelection } from "../router/types.js";
import type { AnalysisPack } from "../analysis/types.js";
import type { BlueprintOutput, RoadmapOutput } from "../contract/output-schema.js";
import { BlueprintOutputSchema, RoadmapOutputSchema } from "../contract/output-schema.js";
import { instrumentProviderCall } from "../metrics/index.js";
import type { AIGenerationResult } from "./prompts.js";
import { buildSystemPrompt, buildAnalysisMessage } from "./prompts.js";

export class AIBlueprintGenerator {
  constructor(
    private router: RouterService,
    private getApiKey: (provider: string) => string | undefined,
    private providerFactory?: (provider: string, apiKey: string) => AIProvider | undefined,
  ) {}

  async generate(
    analysis: AnalysisPack,
    planId: string,
    planVersion: number,
  ): Promise<AIGenerationResult<{ blueprint: BlueprintOutput; roadmap: RoadmapOutput }>> {
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
  ): Promise<AIGenerationResult<{ blueprint: BlueprintOutput; roadmap: RoadmapOutput }>> {
    const startTime = Date.now();
    const selection = decision.selection;

    const provider = this.createProvider(selection);
    if (!provider) {
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
        return this.callProvider(fbDecision, analysis, planId, planVersion, true);
      }
      return this.failureResult(`No provider available for ${selection.provider}`, decision, startTime);
    }

    const systemPrompt = buildSystemPrompt();
    const messages = buildAnalysisMessage(analysis);

    const input: GenerationInput = {
      model: selection.model,
      systemPrompt,
      messages,
      temperature: 0.3,
      maxTokens: 2000,
    };

    try {
      const result = await instrumentProviderCall(selection.provider, selection.model, () =>
        provider.generate(input),
      );

      const parsed = this.parseBlueprintResponse(result.content, analysis, planId, planVersion);

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
        );
      }

      return this.failureResult("AI response could not be parsed as valid JSON", decision, startTime);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (decision.fallbackChain.length > 0) {
        return this.tryFallback(decision, analysis, planId, planVersion, startTime, errorMsg);
      }
      return this.failureResult(errorMsg, decision, startTime);
    }
  }

  private parseBlueprintResponse(
    content: string,
    analysis: AnalysisPack,
    planId: string,
    planVersion: number,
  ): { blueprint: BlueprintOutput; roadmap: RoadmapOutput } | null {
    let parsed: unknown;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== "object") return null;

    const data = parsed as Record<string, unknown>;
    const now = new Date().toISOString();

    // Build blueprint
    const blueprintResult = BlueprintOutputSchema.safeParse({
      planId,
      planVersion,
      projectId: analysis.projectId,
      sessionId: analysis.sessionId,
      createdAt: now,
      schemaVersion: "orchestra-generated-v1",
      artifactType: "blueprint",
      phases: data.phases,
      assumptions: data.assumptions ?? [],
      constraints: data.constraints ?? [],
      risks: data.risks ?? [],
      overallConfidence: data.overallConfidence ?? 0.5,
      overallSummary: data.overallSummary ?? "",
      generationMetadata: {
        model: "",
        provider: "",
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

    if (!blueprintResult.success) return null;

    // Build roadmap
    const roadmapResult = RoadmapOutputSchema.safeParse({
      planId,
      planVersion,
      projectId: analysis.projectId,
      sessionId: analysis.sessionId,
      createdAt: now,
      schemaVersion: "orchestra-generated-v1",
      artifactType: "roadmap",
      phases: data.roadmapPhases ?? data.phases,
      totalEffort: data.totalEffort ?? "medium",
      recommendedApproach: data.recommendedApproach,
      generationMetadata: {
        model: "",
        provider: "",
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

    if (!roadmapResult.success) return null;

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
    return this.callProvider(fbDecision, analysis, planId, planVersion, true);
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
