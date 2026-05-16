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
