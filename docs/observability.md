# Observability

## Metrics

All metrics are exposed at `GET /api/v1/metrics` in Prometheus exposition format (text/plain). No external dependencies required.

### Available Metrics

#### Generation Funnel

| Metric                            | Type      | Labels                                           | Description                           |
| --------------------------------- | --------- | ------------------------------------------------ | ------------------------------------- |
| `generation_funnel_total`         | Counter   | `status` (attempted/completed/failed), `release` | Counts generation lifecycle events    |
| `generation_failures_by_category` | Counter   | `status`, `error_category`, `release`            | Generation failures by error category |
| `generation_phases_per_run`       | Histogram | `release`                                        | Number of phases per generation run   |

#### Provider Calls

| Metric                            | Type      | Labels                                          | Description                    |
| --------------------------------- | --------- | ----------------------------------------------- | ------------------------------ |
| `provider_generations_total`      | Counter   | `provider`, `model`, `release`                  | Total provider generations     |
| `provider_generation_duration_ms` | Histogram | `provider`, `model`, `release`                  | Provider generation latency    |
| `provider_errors_total`           | Counter   | `provider`, `model`, `status_code`, `release`   | Provider errors by status code |
| `provider_validations_total`      | Counter   | `provider`, `status` (valid/invalid), `release` | Credential validation attempts |

#### Export Usage

| Metric               | Type    | Labels                      | Description                               |
| -------------------- | ------- | --------------------------- | ----------------------------------------- |
| `export_usage_total` | Counter | `format`, `type`, `release` | Export events by format and artifact type |

#### Regeneration

| Metric                         | Type      | Labels                            | Description                               |
| ------------------------------ | --------- | --------------------------------- | ----------------------------------------- |
| `regeneration_total`           | Counter   | `scope` (full/partial), `release` | Regeneration runs by scope                |
| `regeneration_affected_phases` | Histogram | `release`                         | Number of phases affected by regeneration |

#### Guardrails

| Metric                   | Type    | Labels                           | Description                                                                                    |
| ------------------------ | ------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `guardrail_blocks_total` | Counter | `action`, `operation`, `release` | Guardrail blocks by action (rate_limited/over_budget/circuit_open/abuse_blocked) and operation |

#### Tracing

| Metric                    | Type      | Labels                            | Description              |
| ------------------------- | --------- | --------------------------------- | ------------------------ |
| `trace_spans_total`       | Counter   | `operation`, `status`, `provider` | Total traced spans       |
| `trace_span_errors_total` | Counter   | `operation`, `status`, `provider` | Traced span errors       |
| `trace_span_duration_ms`  | Histogram | `operation`, `status`, `provider` | Duration of traced spans |

#### Build Info

| Metric       | Type  | Labels    | Description                                      |
| ------------ | ----- | --------- | ------------------------------------------------ |
| `build_info` | Gauge | `release` | Always 1. Build version for release correlation. |

### Prometheus Scrape Configuration

```yaml
scrape_configs:
  - job_name: "orchestra"
    scrape_interval: 15s
    static_configs:
      - targets: ["localhost:3000"]
    metrics_path: "/api/v1/metrics"
```

## Tracing

The tracer emits structured span events to stdout with `_trace: true` flag. Each span includes:

| Field           | Description                                   |
| --------------- | --------------------------------------------- |
| `spanId`        | Unique span ID (UUID)                         |
| `parentSpanId`  | Parent span ID for correlation                |
| `operationName` | Operation identifier (e.g. `provider.openai`) |
| `durationMs`    | Duration in milliseconds                      |
| `status`        | `ok` or `error`                               |
| `tags`          | Provider, model, and other context            |
| `error`         | Error message (if status=error)               |
| `release`       | Build version                                 |
| `startTime`     | ISO 8601 timestamp                            |

### Trace Export

Traces are exported via the `TraceExporter` interface. The default `LogExporter` writes to stdout:

```json
{
  "_trace": true,
  "spanId": "...",
  "operationName": "provider.openai",
  "durationMs": 1234,
  "status": "ok",
  "tags": { "provider": "openai", "model": "gpt-4o" },
  "release": "0.1.0",
  "startTime": "2026-05-16T12:00:00.000Z"
}
```

To replace with a custom exporter (e.g., OpenTelemetry):

```typescript
import { setTraceExporter } from "./lib/metrics/index.js";
setTraceExporter({
  export(span) {
    /* send to OTel collector */
  },
});
```

## Alerting Rules

### Critical Alerts (Pager)

| Alert                    | Condition                                                                       | For | Description                         |
| ------------------------ | ------------------------------------------------------------------------------- | --- | ----------------------------------- |
| `ProviderErrorRateHigh`  | `rate(provider_errors_total[5m]) / rate(provider_generations_total[5m]) > 0.05` | 5m  | >5% provider error rate             |
| `CircuitBreakerOpen`     | `guardrail_blocks_total{action="circuit_open"} > 0`                             | 1m  | Circuit breaker is open             |
| `GenerationFailureSpike` | `rate(generation_funnel_total{status="failed"}[5m]) > 5`                        | 5m  | >5 generation failures in 5 minutes |

### Warning Alerts (Ticket)

| Alert                   | Condition                                                                         | For | Description                 |
| ----------------------- | --------------------------------------------------------------------------------- | --- | --------------------------- |
| `BudgetBlockedRequests` | `rate(guardrail_blocks_total{action="over_budget"}[5m]) > 0`                      | 5m  | Budget is blocking requests |
| `RateLimitHit`          | `rate(guardrail_blocks_total{action="rate_limited"}[5m]) > 10`                    | 5m  | High rate limit hit rate    |
| `HighProviderLatency`   | `histogram_quantile(0.99, rate(provider_generation_duration_ms_bucket[5m])) > 30` | 5m  | p99 provider latency > 30s  |
| `AbuseBlocked`          | `rate(guardrail_blocks_total{action="abuse_blocked"}[5m]) > 0`                    | 5m  | Abuse detection is blocking |
| `HighExportUsage`       | `rate(export_usage_total[5m]) > 10`                                               | 5m  | >10 exports per minute      |

### Prometheus Alerting Rules

```yaml
groups:
  - name: orchestra-critical
    rules:
      - alert: ProviderErrorRateHigh
        expr: |
          rate(provider_errors_total[5m]) / rate(provider_generations_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Provider error rate >5%"

      - alert: CircuitBreakerOpen
        expr: rate(guardrail_blocks_total{action="circuit_open"}[1m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Circuit breaker is open"

      - alert: GenerationFailureSpike
        expr: rate(generation_funnel_total{status="failed"}[5m]) > 5
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Generation failure spike detected"

  - name: orchestra-warnings
    rules:
      - alert: BudgetBlockedRequests
        expr: rate(guardrail_blocks_total{action="over_budget"}[5m]) > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Budget blocking requests"

      - alert: HighProviderLatency
        expr: |
          histogram_quantile(0.99, rate(provider_generation_duration_ms_bucket[5m])) > 30
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "p99 provider latency > 30s"
```

## Grafana Dashboard

A JSON dashboard definition is available in `docs/grafana-dashboard.json`. Import it into Grafana to get:

1. **Generation Overview** — Funnel counts (attempted/completed/failed) over time
2. **Provider Performance** — Latency histograms and error rates by provider
3. **Guardrail Activity** — Rate limit hits, budget blocks, circuit breaker state
4. **Export & Regeneration** — Usage counts over time
5. **Build Version** — Release correlation for error tracking

### Dashboard Panels

| Panel                          | Metric                                                                   | Type                                     |
| ------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------- |
| Generation Rate                | `rate(generation_funnel_total[5m])`                                      | Stacked bar (attempted/completed/failed) |
| Generation Phases              | `generation_phases_per_run_count`                                        | Stat                                     |
| Provider Latency (p50/p95/p99) | `histogram_quantile(0.5/0.95/0.99, rate(...))`                           | Time series                              |
| Provider Error Rate            | `rate(provider_errors_total[5m]) / rate(provider_generations_total[5m])` | Time series                              |
| Guardrail Blocks               | `rate(guardrail_blocks_total[5m])`                                       | Stacked bar by action                    |
| Export Rate                    | `rate(export_usage_total[5m])`                                           | Time series                              |
| Regeneration Rate              | `rate(regeneration_total[5m])`                                           | Time series                              |
| Current Build                  | `build_info`                                                             | Stat                                     |

## Release Correlation

Every metric and trace includes a `release` label populated from:

1. `SOURCE_VERSION` environment variable (set by CI/CD pipelines)
2. Falls back to `npm_package_version` from package.json (`0.1.0`)
3. Final fallback: `"0.1.0"`

This allows correlating error spikes with specific deployments.

## Sensitive Data Protection

The following are NEVER included in metrics labels or trace tags:

- API keys, auth tokens, or credentials
- Prompt text, user answers, or generation output
- Raw request/response bodies
- Project names or user identifiers (only UUIDs)

The `redactObject()` function in `lib/audit/redactor.ts` provides additional protection for audit log entries.

## Architecture

```
Request → InstrumentationWrapper → Service
                                      │
                         ┌────────────┼────────────┐
                         ▼            ▼            ▼
                    Metrics      Tracer       Audit Log
                   (in-memory)   (stdout)     (stdout)
                         │
                         ▼
                  /api/v1/metrics
                  (Prometheus format)
```

All observability data is in-memory by default, lost on restart. For production deployments, configure:

1. **Prometheus** to scrape `/api/v1/metrics`
2. **Log aggregator** (e.g., Loki, ELK) to index stdout with `_trace: true` and `_audit: true` filters
3. **Grafana** with the provided dashboard definition
