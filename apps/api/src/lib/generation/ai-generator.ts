import type { AIProvider, GenerationInput, TokenUsage, GenerationResult } from "../provider/types.js";
import { OpenAIProvider } from "../provider/openai.js";
import { AnthropicProvider } from "../provider/anthropic.js";
import { OpenRouterProvider } from "../provider/openrouter.js";
import { MockAIProvider } from "../provider/mock.js";
import { OpencodeGoProvider } from "../provider/opencode-go.js";
import type { RouterService } from "../router/router.js";
import type { RouterDecision, ModelSelection, UserPreferences } from "../router/types.js";
import type { AnalysisPack } from "../analysis/types.js";
import type { BlueprintOutput, RoadmapOutput, PhaseType, ProjectSummary } from "../contract/output-schema.js";
import { BlueprintOutputSchema, RoadmapOutputSchema, ProjectSummarySchema, PHASE_ORDER } from "../contract/output-schema.js";
import { PHASE_LABELS } from "../interview/questions.js";
import { instrumentProviderCall, instrumentTokenUsage } from "../metrics/index.js";
import { calculateActualCost } from "../accounting/index.js";
import type { AIGenerationResult } from "./prompts.js";
import { buildSystemPrompt, buildAnalysisMessage, buildProjectSummarySystemPrompt, buildProjectSummaryMessage } from "./prompts.js";
import type { UsageAttempt } from "../accounting/streaming.js";
import { globalCache } from "../cache/cache-service.js";
import { buildCacheKey } from "../cache/key-builder.js";
import { createModuleLogger } from "../logging/logger.js";

const log = createModuleLogger("ai-generator");

export interface SummaryResult {
  summary: ProjectSummary | null;
  model?: string;
  provider?: string;
  durationMs: number;
  error?: string;
}

/**
 * Call a provider's generate() with automatic retries on transient errors.
 * Each retry creates a fresh provider instance (new HTTP client) so that
 * stale connection pools are not reused. Delays between attempts give the
 * network time to recover.
 *
 * Throws if all attempts fail — the caller handles fallback logic.
 */
export async function generateWithRetry(
  providerFactory: () => AIProvider | undefined,
  input: GenerationInput,
): Promise<GenerationResult> {
  const delays = [3000, 8000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, delays[attempt - 1]));
    const provider = providerFactory();
    if (!provider) break;
    try {
      return await provider.generate(input);
    } catch (err) {
      if (attempt < delays.length) continue;
      throw err;
    }
  }
  throw new Error("Provider unavailable or all retries exhausted");
}

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
      return this.callProvider(decision, analysis, planId, planVersion);
    } catch (err) {
      return {
        success: false,
        data: null,
        model: "unknown",
        provider: "unknown",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        attempts: [],
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

  async generateProjectSummary(blueprint: BlueprintOutput, preferences?: UserPreferences): Promise<SummaryResult> {
    const overallStartTime = Date.now();
    const systemPrompt = buildProjectSummarySystemPrompt();
    const messages = buildProjectSummaryMessage(blueprint);

    let currentDecision: RouterDecision;
    try {
      currentDecision = this.router.select("summary", preferences);
    } catch (err) {
      return { summary: null, durationMs: Date.now() - overallStartTime, error: "Router selection failed" };
    }

    const MAX_ATTEMPTS = 3;
    for (let attemptCount = 0; attemptCount < MAX_ATTEMPTS; attemptCount++) {
      const selection = currentDecision.selection;

      const provider = this.createProvider(selection);
      if (!provider) {
        const next = this.advanceFallback(currentDecision, `No provider for ${selection.provider}`);
        if (!next) break;
        currentDecision = next;
        continue;
      }

      const input: GenerationInput = {
        model: selection.model,
        systemPrompt,
        messages,
        temperature: 0.3,
      };

      try {
        const result = await instrumentProviderCall(selection.provider, selection.model, () =>
          generateWithRetry(() => this.createProvider(selection), input),
        );

        const content = result.content.trim();
        const summary = this.extractProjectSummary(content);
        if (summary) {
          log.info({ model: result.model, provider: selection.provider, attempt: attemptCount }, "summary_generated");
          return { summary, model: result.model, provider: selection.provider, durationMs: Date.now() - overallStartTime };
        }

        log.warn({ preview: content.slice(0, 200), attempt: attemptCount }, "summary_parse_failed");
        const next = this.advanceFallback(currentDecision, "Failed to parse summary JSON");
        if (!next) break;
        currentDecision = next;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.warn({ err: errorMsg, attempt: attemptCount, provider: selection.provider }, "summary_provider_error");
        const next = this.advanceFallback(currentDecision, errorMsg);
        if (!next) break;
        currentDecision = next;
      }
    }

    return { summary: null, durationMs: Date.now() - overallStartTime, error: "All attempts failed" };
  }

  private extractProjectSummary(content: string): ProjectSummary | null {
    // Brace-depth JSON extraction — same approach as parseBlueprintResponse
    let best: unknown = null;
    let bestSize = 0;
    let searchFrom = 0;
    while (searchFrom < content.length) {
      const openIdx = content.indexOf("{", searchFrom);
      if (openIdx < 0) break;
      let depth = 0;
      let inString = false;
      let closeIdx = -1;
      for (let i = openIdx; i < content.length; i++) {
        const ch = content[i];
        if (inString) {
          if (ch === "\\") i++;
          else if (ch === '"') inString = false;
        } else {
          if (ch === '"') inString = true;
          else if (ch === "{") depth++;
          else if (ch === "}") {
            depth--;
            if (depth === 0) { closeIdx = i; break; }
          }
        }
      }
      if (closeIdx < 0) break;
      const candidate = content.slice(openIdx, closeIdx + 1);
      try {
        const obj = JSON.parse(candidate);
        if (obj && typeof obj === "object" && (obj as Record<string, unknown>).projectOverview) {
          const size = candidate.length;
          if (size > bestSize) { best = obj; bestSize = size; }
        }
      } catch { /* skip */ }
      searchFrom = openIdx + 1;
    }

    if (!best) return null;
    const validated = ProjectSummarySchema.safeParse(best);
    return validated.success ? validated.data : null;
  }

  private recordAttempt(
    provider: string,
    model: string,
    usage: TokenUsage,
    startTime: number,
    success: boolean,
    error?: string,
  ): UsageAttempt {
    return {
      provider,
      model,
      usage: { ...usage },
      durationMs: Date.now() - startTime,
      success,
      error,
    };
  }

  private buildSuccessResult(
    parsed: { blueprint: BlueprintOutput; roadmap: RoadmapOutput },
    result: GenerationResult,
    provider: string,
    decision: RouterDecision,
    startTime: number,
    isFallback: boolean,
    attempts: UsageAttempt[],
  ): AIGenerationResult<{ blueprint: BlueprintOutput; roadmap: RoadmapOutput }> {
    return {
      success: true,
      data: parsed,
      model: result.model,
      provider,
      usage: result.usage,
      attempts,
      finishReason: result.finishReason,
      fallbackUsed: isFallback,
      routerDecision: decision,
      durationMs: Date.now() - startTime,
    };
  }

  private async callProvider(
    decision: RouterDecision,
    analysis: AnalysisPack,
    planId: string,
    planVersion: number,
  ): Promise<AIGenerationResult<{ blueprint: BlueprintOutput; roadmap: RoadmapOutput }>> {
    const MAX_ATTEMPTS = 5;
    const systemPrompt = buildSystemPrompt();
    const messages = buildAnalysisMessage(analysis, this.projectDescription);

    // Iterative fallback loop: each iteration tries the current decision's selection.
    // On failure, advances to the next fallback in the chain.
    let currentDecision = decision;
    let attempts: UsageAttempt[] = [];
    let overallStartTime = Date.now();

    for (let attemptCount = 0; attemptCount <= MAX_ATTEMPTS; attemptCount++) {
      const isFallback = attemptCount > 0;
      const startTime = Date.now();
      const selection = currentDecision.selection;

      log.debug({ attempt: attemptCount, selection: { provider: selection.provider, model: selection.model, tier: selection.tier }, fallbackChain: currentDecision.fallbackChain.length }, "provider_attempt");

      const provider = this.createProvider(selection);
      if (!provider) {
        console.log("[DEBUG GENERATOR] createProvider returned undefined:", {
          attempt: attemptCount,
          provider: selection.provider,
          model: selection.model,
        });
        const attempt = this.recordAttempt(
          selection.provider, selection.model,
          { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          startTime, false, "Provider not created",
        );
        attempts.push(attempt);

        const next = this.advanceFallback(currentDecision, `No provider for ${selection.provider}`);
        if (!next) {
          return this.failureResult(`No provider available for ${selection.provider}`, currentDecision, overallStartTime, attempts);
        }
        currentDecision = next;
        continue;
      }

      const input: GenerationInput = {
        model: selection.model,
        systemPrompt,
        messages,
        temperature: 0.7,
      };

      // Cache check
      const cacheKeyInput = { systemPrompt, messages, model: selection.model, provider: selection.provider, temperature: 0.7 };
      const keyResult = buildCacheKey(cacheKeyInput);
      const cached = await globalCache.lookup(cacheKeyInput);

      if (cached) {
        log.info({ cacheKey: keyResult.cacheKey, model: selection.model, provider: selection.provider }, "cache_hit");
        const cacheResult: GenerationResult = {
          content: cached.responseContent,
          model: cached.responseModel,
          usage: cached.usage,
          finishReason: cached.finishReason,
        };
        const parsed = this.parseBlueprintResponse(
          cacheResult.content, analysis, planId, planVersion,
          selection.provider, cacheResult.model, cacheResult.usage,
          startTime, 0, isFallback,
        );
        if (parsed) {
          const attempt = this.recordAttempt(selection.provider, cacheResult.model, cacheResult.usage, startTime, true);
          return this.buildSuccessResult(parsed, cacheResult, selection.provider, currentDecision, startTime, isFallback, [...attempts, attempt]);
        }
      }

      // Live provider call
      try {
        const result = await instrumentProviderCall(selection.provider, selection.model, () =>
          generateWithRetry(() => this.createProvider(selection), input),
        );

        instrumentTokenUsage(selection.provider, result.model, result.usage.promptTokens, result.usage.completionTokens);

        const parsed = this.parseBlueprintResponse(
          result.content, analysis, planId, planVersion,
          selection.provider, result.model, result.usage,
          startTime, Date.now() - startTime, isFallback,
        );

        if (parsed) {
          // Cache the successful result
          globalCache.store({
            cacheKey: keyResult.cacheKey, keyResult,
            model: selection.model, provider: selection.provider, temperature: 0.7, result,
          }).catch((err) => log.warn({ err }, "cache_write_error"));

          const attempt = this.recordAttempt(selection.provider, result.model, result.usage, startTime, true);
          return this.buildSuccessResult(parsed, result, selection.provider, currentDecision, startTime, isFallback, [...attempts, attempt]);
        }

        // Parse failure — record and try fallback
        const failAttempt = this.recordAttempt(selection.provider, result.model, result.usage, startTime, false, "AI response could not be parsed as valid JSON");
        attempts.push(failAttempt);

        const next = this.advanceFallback(currentDecision, "AI response could not be parsed as valid JSON");
        if (!next) {
          return this.failureResult("AI response could not be parsed as valid JSON", currentDecision, overallStartTime, attempts);
        }
        currentDecision = next;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const failAttempt = this.recordAttempt(selection.provider, selection.model, { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, startTime, false, errorMsg);
        attempts.push(failAttempt);

        const next = this.advanceFallback(currentDecision, errorMsg);
        if (!next) {
          console.log("[DEBUG GENERATOR] No fallback available, failing:", {
            attemptCount,
            error: errorMsg,
            lastProvider: selection.provider,
            lastModel: selection.model,
          });
          return this.failureResult(errorMsg, currentDecision, overallStartTime, attempts);
        }
        console.log("[DEBUG GENERATOR] Fallback:", JSON.stringify({
          attempt: attemptCount,
          from: `${selection.provider}/${selection.model}`,
          to: `${next.selection.provider}/${next.selection.model}`,
          reason: errorMsg,
          remainingFallbacks: next.fallbackChain.length,
        }));
        currentDecision = next;
      }
    }

    return this.failureResult("Max retry depth exceeded", currentDecision, overallStartTime, attempts);
  }

  private advanceFallback(decision: RouterDecision, errorMsg: string): RouterDecision | null {
    if (decision.fallbackChain.length === 0) return null;
    const fallbackSelection = decision.fallbackChain[0]!;
    const remaining = decision.fallbackChain.slice(1);
    return {
      ...decision,
      selection: fallbackSelection,
      fallbackChain: remaining,
      usedFallback: true,
      reasoning: [...decision.reasoning, `Fallback to ${fallbackSelection.provider}/${fallbackSelection.model} after: ${errorMsg}`],
    };
  }

  private parseBlueprintResponse(
    content: string,
    analysis: AnalysisPack,
    planId: string,
    planVersion: number,
    provider: string,
    model: string,
    usage: TokenUsage,
    startTime: number,
    durationMs: number,
    isFallback: boolean,
  ): { blueprint: BlueprintOutput; roadmap: RoadmapOutput } | null {
    // Log first 500 chars of AI response for debugging
    log.debug({ provider, model, length: content.length, preview: content.slice(0, 500) }, "raw_response");

    let parsed: unknown;
    // Find the outermost valid JSON object in the response by tracking brace depth.
    // This handles code fences (```json), reasoning text, and scattered content.
    {
      let best: unknown = null;
      let bestSize = 0;
      let searchFrom = 0;
      // Iterate all positions of '{' in the content
      while (searchFrom < content.length) {
        const openIdx = content.indexOf("{", searchFrom);
        if (openIdx < 0) break;
        // Walk forward tracking brace depth to find matching }
        let depth = 0;
        let inString = false;
        let closeIdx = -1;
        for (let i = openIdx; i < content.length; i++) {
          const ch = content[i];
          if (inString) {
            if (ch === "\\")
              i++; // skip escaped char
            else if (ch === '"') inString = false;
          } else {
            if (ch === '"') inString = true;
            else if (ch === "{") depth++;
            else if (ch === "}") {
              depth--;
              if (depth === 0) {
                closeIdx = i;
                break;
              }
            }
          }
        }
        if (closeIdx < 0) break; // unbalanced braces, stop searching
        const candidate = content.slice(openIdx, closeIdx + 1);
        try {
          const obj = JSON.parse(candidate);
          if (obj && typeof obj === "object") {
            const hasKey = ["phases", "roadmapPhases", "tasks"].some(
              (k) => (obj as Record<string, unknown>)[k] !== undefined,
            );
            const size = candidate.length;
            if (hasKey && size > bestSize) {
              best = obj;
              bestSize = size;
            }
          }
        } catch {
          // skip invalid JSON
        }
        searchFrom = openIdx + 1;
      }
      parsed = best;
    }
    log.debug({
      found: !!parsed,
      hasPhases: parsed !== null && typeof parsed === "object" && "phases" in (parsed as Record<string, unknown>),
      rawLength: content.length,
      parsedLength: parsed ? JSON.stringify(parsed).length : 0,
    }, "parse_result");
    if (!parsed) {
      log.warn({ rawLength: content.length }, "no_valid_json_found");
      return null;
    }

    if (!parsed || typeof parsed !== "object") {
      log.warn({}, "parsed_value_not_object");
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
        startedAt: new Date(startTime).toISOString(),
        completedAt: now,
        durationMs,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        estimatedCost: calculateActualCost(provider, model, usage.promptTokens, usage.completionTokens),
        fallbackUsed: isFallback,
      },
    });

    if (!blueprintResult.success) {
      log.warn({ issues: blueprintResult.error.issues }, "blueprint_zod_error");
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
        startedAt: new Date(startTime).toISOString(),
        completedAt: now,
        durationMs,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        estimatedCost: calculateActualCost(provider, model, usage.promptTokens, usage.completionTokens),
        fallbackUsed: isFallback,
      },
    });

    if (!roadmapResult.success) {
      log.warn({ issues: roadmapResult.error.issues }, "roadmap_zod_error");
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

  private failureResult(
    error: string,
    decision: RouterDecision,
    startTime: number,
    attempts: UsageAttempt[],
  ): AIGenerationResult<{ blueprint: BlueprintOutput; roadmap: RoadmapOutput }> {
    return {
      success: false,
      data: null,
      model: decision.selection.model,
      provider: decision.selection.provider,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      attempts,
      finishReason: "error",
      fallbackUsed: decision.usedFallback,
      routerDecision: decision,
      durationMs: Date.now() - startTime,
      error,
    };
  }
}
