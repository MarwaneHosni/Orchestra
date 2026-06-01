import type { MetricLabel } from "./types.js";
import { getMetrics } from "./registry.js";
import { getTracer } from "./tracer.js";
import { RELEASE_VERSION } from "./types.js";

export function instrumentProviderCall<T>(
  provider: string,
  model: string,
  operation: () => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  const metrics = getMetrics();
  const span = tracer.startSpan(`provider.${provider}`);

  span.tags["provider"] = provider;
  span.tags["model"] = model;

  const baseLabels: MetricLabel[] = [
    { name: "provider", value: provider },
    { name: "model", value: model },
    { name: "release", value: RELEASE_VERSION },
  ];

  const start = Date.now();

  return operation()
    .then((result) => {
      const duration = Date.now() - start;
      metrics
        .histogram("provider_generation_duration_ms", "Provider generation latency by provider and model")
        .observe(baseLabels, duration);
      metrics
        .counter("provider_generations_total", "Total provider generations by provider and model")
        .inc(baseLabels);
      tracer.endSpan(span, "ok");
      return result;
    })
    .catch((err) => {
      const duration = Date.now() - start;
      const statusCode = err?.statusCode ?? err?.status ?? "unknown";
      const errorLabels: MetricLabel[] = [...baseLabels, { name: "status_code", value: String(statusCode) }];
      metrics
        .histogram("provider_generation_duration_ms", "Provider generation latency")
        .observe(baseLabels, duration);
      metrics.counter("provider_generations_total", "Total provider generations").inc(baseLabels);
      metrics
        .counter("provider_errors_total", "Provider errors by provider, model, and status code")
        .inc(errorLabels);
      tracer.endSpan(span, "error", err instanceof Error ? err.message : String(err));
      throw err;
    });
}

export function instrumentGenerationFunnel(
  _projectId: string,
  status: "attempted" | "completed" | "failed",
  metadata?: { phaseCount?: number; confidence?: number; errorCategory?: string },
): void {
  const metrics = getMetrics();
  const labels: MetricLabel[] = [
    { name: "status", value: status },
    { name: "release", value: RELEASE_VERSION },
  ];
  metrics.counter("generation_funnel_total", "Generation funnel: attempted → completed → failed").inc(labels);
  if (status === "completed" && metadata?.phaseCount) {
    metrics
      .histogram("generation_phases_per_run", "Number of phases per generation run")
      .observe([{ name: "release", value: RELEASE_VERSION }], metadata.phaseCount);
  }
  if (status === "failed" && metadata?.errorCategory) {
    metrics
      .counter("generation_failures_by_category", "Generation failures categorized")
      .inc([...labels, { name: "error_category", value: metadata.errorCategory }]);
  }
}

export function instrumentExport(_projectId: string, format: string, type: string): void {
  const metrics = getMetrics();
  const labels: MetricLabel[] = [
    { name: "format", value: format },
    { name: "type", value: type },
    { name: "release", value: RELEASE_VERSION },
  ];
  metrics.counter("export_usage_total", "Export usage by format and type").inc(labels);
}

export function instrumentTokenUsage(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): void {
  const metrics = getMetrics();
  const labels: MetricLabel[] = [
    { name: "provider", value: provider },
    { name: "model", value: model },
    { name: "release", value: RELEASE_VERSION },
  ];
  metrics
    .gauge("provider_prompt_tokens", "Prompt tokens per generation by provider and model")
    .set(labels, promptTokens);
  metrics
    .gauge("provider_completion_tokens", "Completion tokens per generation by provider and model")
    .set(labels, completionTokens);
  metrics
    .counter("provider_tokens_total", "Total tokens consumed by provider and model")
    .inc(labels, promptTokens + completionTokens);
}

export function instrumentRegeneration(scope: "full" | "partial", affectedPhases?: number): void {
  const metrics = getMetrics();
  const labels: MetricLabel[] = [
    { name: "scope", value: scope },
    { name: "release", value: RELEASE_VERSION },
  ];
  metrics.counter("regeneration_total", "Regeneration runs by scope").inc(labels);
  if (affectedPhases !== undefined) {
    metrics
      .histogram("regeneration_affected_phases", "Number of phases affected by regeneration")
      .observe([{ name: "release", value: RELEASE_VERSION }], affectedPhases);
  }
}

export function instrumentGuardrailAction(
  action: "rate_limited" | "over_budget" | "circuit_open" | "abuse_blocked",
  operation: string,
): void {
  const metrics = getMetrics();
  const labels: MetricLabel[] = [
    { name: "action", value: action },
    { name: "operation", value: operation },
    { name: "release", value: RELEASE_VERSION },
  ];
  metrics.counter("guardrail_blocks_total", "Guardrail blocks by action and operation").inc(labels);
}

export function instrumentProviderValidation(provider: string, status: "valid" | "invalid"): void {
  const metrics = getMetrics();
  const labels: MetricLabel[] = [
    { name: "provider", value: provider },
    { name: "status", value: status },
    { name: "release", value: RELEASE_VERSION },
  ];
  metrics
    .counter("provider_validations_total", "Provider credential validations by provider and status")
    .inc(labels);
}

export function instrumentCacheAction(
  action: "hit" | "miss" | "store" | "store_duplicate" | "store_error" | "invalidate" | "stale_check",
  provider: string,
): void {
  const metrics = getMetrics();
  const labels: MetricLabel[] = [
    { name: "action", value: action },
    { name: "provider", value: provider },
    { name: "release", value: RELEASE_VERSION },
  ];
  metrics.counter("ai_cache_actions_total", "AI cache actions: hit, miss, store, invalidate").inc(labels);
}

export function instrumentCacheLatency(
  action: "lookup" | "store" | "invalidate",
  provider: string,
  durationMs: number,
): void {
  const metrics = getMetrics();
  const labels: MetricLabel[] = [
    { name: "action", value: action },
    { name: "provider", value: provider },
    { name: "release", value: RELEASE_VERSION },
  ];
  metrics
    .histogram("ai_cache_operation_duration_ms", "Duration of cache operations by action and provider")
    .observe(labels, durationMs);
}

export function instrumentCacheCostSavings(
  provider: string,
  tokensSaved: number,
  costSaved: number,
): void {
  const metrics = getMetrics();
  const labels: MetricLabel[] = [
    { name: "provider", value: provider },
    { name: "release", value: RELEASE_VERSION },
  ];
  metrics
    .counter("ai_cache_tokens_saved_total", "Total tokens saved by cache hits, by provider")
    .inc(labels, tokensSaved);
  metrics
    .counter("ai_cache_cost_saved_total", "Total estimated cost saved by cache hits, by provider")
    .inc(labels, costSaved);
}

export function instrumentCacheStaleEntry(provider: string): void {
  const metrics = getMetrics();
  const labels: MetricLabel[] = [
    { name: "provider", value: provider },
    { name: "release", value: RELEASE_VERSION },
  ];
  metrics.counter("ai_cache_stale_entries_total", "Stale cache entries detected and rejected").inc(labels);
}

export function instrumentInterviewProgress(action: "start" | "question_answered" | "question_skipped" | "abandoned" | "completed" | "quick_mode_used" | "advanced_mode_used"): void {
  const metrics = getMetrics();
  const labels: MetricLabel[] = [
    { name: "action", value: action },
    { name: "release", value: RELEASE_VERSION },
  ];
  metrics.counter("interview_actions_total", "Interview actions: start, answer, skip, abandon, complete, mode").inc(labels);
}

export function instrumentInterviewDuration(minutes: number, mode: "quick" | "advanced"): void {
  const metrics = getMetrics();
  const labels: MetricLabel[] = [
    { name: "mode", value: mode },
    { name: "release", value: RELEASE_VERSION },
  ];
  metrics.histogram("interview_duration_minutes", "Interview duration in minutes by mode").observe(labels, minutes);
}

export function instrumentInterviewSkippedQuestions(count: number): void {
  const metrics = getMetrics();
  const labels: MetricLabel[] = [
    { name: "release", value: RELEASE_VERSION },
  ];
  metrics.histogram("interview_skipped_questions", "Number of questions skipped per interview").observe(labels, count);
}

export function instrumentQuickModeUsage(_projectId: string): void {
  const metrics = getMetrics();
  const labels: MetricLabel[] = [
    { name: "action", value: "quick_mode_used" },
    { name: "release", value: RELEASE_VERSION },
  ];
  metrics.counter("interview_quick_mode_total", "Quick Mode usage count").inc(labels);
}
