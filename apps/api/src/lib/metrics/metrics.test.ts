import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { MetricsRegistry, getMetrics, globalMetrics } from "./registry.js";
import { Tracer, setTraceExporter } from "./tracer.js";
import { globalLogExporter } from "./exporters.js";
import {
  instrumentProviderCall,
  instrumentGenerationFunnel,
  instrumentExport,
  instrumentRegeneration,
  instrumentGuardrailAction,
  instrumentProviderValidation,
} from "./instrumentation.js";

// ── MetricsRegistry Tests ─────────────────────────────────────

describe("MetricsRegistry", () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  describe("counters", () => {
    it("increments a counter", () => {
      const c = registry.counter("test_count", "Test counter");
      c.inc();
      const rendered = registry.renderPrometheus();
      expect(rendered).toContain("# HELP test_count Test counter");
      expect(rendered).toContain("# TYPE test_count counter");
      expect(rendered).toContain("test_count 1");
    });

    it("increments with labels", () => {
      const c = registry.counter("labeled_count", "Labeled counter");
      c.inc([{ name: "status", value: "ok" }]);
      c.inc([{ name: "status", value: "ok" }]);
      c.inc([{ name: "status", value: "error" }]);
      const rendered = registry.renderPrometheus();
      expect(rendered).toContain('labeled_count{status="ok"} 2');
      expect(rendered).toContain('labeled_count{status="error"} 1');
    });

    it("increments by specific value", () => {
      const c = registry.counter("val_count", "Value counter");
      c.inc([], 5);
      expect(registry.renderPrometheus()).toContain("val_count 5");
    });

    it("resets to zero", () => {
      const c = registry.counter("resettable", "Resettable");
      c.inc();
      c.reset();
      expect(registry.renderPrometheus()).not.toContain("resettable 1");
    });
  });

  describe("gauges", () => {
    it("sets and reports a gauge", () => {
      const g = registry.gauge("active_jobs", "Active jobs");
      g.set([{ name: "queue", value: "generation" }], 5);
      expect(registry.renderPrometheus()).toContain('active_jobs{queue="generation"} 5');
    });

    it("increments a gauge", () => {
      const g = registry.gauge("connections", "DB connections");
      g.set([], 10);
      g.inc([], 1);
      expect(registry.renderPrometheus()).toContain("connections 11");
    });
  });

  describe("histograms", () => {
    it("records observations", () => {
      const h = registry.histogram("request_duration", "Request duration", [0.1, 0.5, 1]);
      h.observe([{ name: "method", value: "GET" }], 0.3);
      h.observe([{ name: "method", value: "GET" }], 0.7);
      const rendered = registry.renderPrometheus();
      expect(rendered).toContain("# TYPE request_duration histogram");
      expect(rendered).toContain('request_duration_bucket{method="GET"}{le="0.1"} 0');
      expect(rendered).toContain('request_duration_bucket{method="GET"}{le="0.5"} 1');
      expect(rendered).toContain('request_duration_bucket{method="GET"}{le="1"} 2');
      expect(rendered).toContain('request_duration_sum{method="GET"} 1');
      expect(rendered).toContain('request_duration_count{method="GET"} 2');
    });

    it("uses default buckets when not specified", () => {
      const h = registry.histogram("default_buckets", "Default buckets");
      h.observe([], 0.05);
      const rendered = registry.renderPrometheus();
      expect(rendered).toContain('default_buckets_bucket{le="0.1"}');
    });

    it("resets", () => {
      const h = registry.histogram("resettable_hist", "Resettable");
      h.observe([], 1);
      h.reset();
      expect(registry.renderPrometheus()).not.toContain("resettable_hist_count");
    });
  });

  describe("build_info gauge", () => {
    it("is always present in output", () => {
      const rendered = registry.renderPrometheus();
      expect(rendered).toContain("build_info");
      expect(rendered).toContain("release=");
    });
  });

  describe("label escaping", () => {
    it("escapes special characters in label values", () => {
      const c = registry.counter("escape_test", "Escape test");
      c.inc([{ name: "value", value: 'he"llo\nworld' }]);
      const rendered = registry.renderPrometheus();
      expect(rendered).toContain('escape_test{value="he\\"llo\\nworld"} 1');
    });
  });
});

// ── Tracer Tests ──────────────────────────────────────────────

describe("Tracer", () => {
  let tracer: Tracer;
  const exported: any[] = [];

  beforeEach(() => {
    exported.length = 0;
    tracer = new Tracer();
    setTraceExporter({ export: (s) => exported.push(s) });
  });

  afterEach(() => {
    setTraceExporter(globalLogExporter);
  });

  it("creates and ends a span", () => {
    const span = tracer.startSpan("test.op");
    expect(span.operationName).toBe("test.op");
    expect(span.parentSpanId).toBeNull();
    expect(span.endTime).toBeNull();
    tracer.endSpan(span, "ok");
    expect(exported.length).toBe(1);
    expect(exported[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(exported[0].status).toBe("ok");
  });

  it("creates child spans", () => {
    const parent = tracer.startSpan("parent");
    const child = tracer.startSpan("child", parent.spanId);
    expect(child.parentSpanId).toBe(parent.spanId);
    tracer.endSpan(child);
    tracer.endSpan(parent);
    expect(exported.length).toBe(2);
  });

  it("records error status and message", () => {
    const span = tracer.startSpan("failing.op");
    tracer.endSpan(span, "error", "Connection refused");
    expect(exported[0].status).toBe("error");
    expect(exported[0].error).toBe("Connection refused");
  });

  it("hasActiveSpan returns true for pending spans", () => {
    const span = tracer.startSpan("pending");
    expect(tracer.hasActiveSpan(span.spanId)).toBe(true);
    tracer.endSpan(span);
    expect(tracer.hasActiveSpan(span.spanId)).toBe(false);
  });

  it("observes the span duration metric", () => {
    const span = tracer.startSpan("generation.complete");
    tracer.endSpan(span);
    const rendered = getMetrics().renderPrometheus();
    expect(rendered).toContain("trace_span_duration_ms");
    expect(rendered).toContain("trace_spans_total");
  });
});

// ── Instrumentation Wrappers Tests ────────────────────────────

describe("instrumentation wrappers", () => {
  beforeEach(() => {
    globalMetrics.reset();
  });

  it("instrumentGenerationFunnel records counters by status", () => {
    instrumentGenerationFunnel("proj-1", "attempted");
    instrumentGenerationFunnel("proj-1", "completed", { phaseCount: 5 });
    instrumentGenerationFunnel("proj-2", "failed", { errorCategory: "terminal" });
    const rendered = globalMetrics.renderPrometheus();
    expect(rendered).toContain('generation_funnel_total{status="attempted"');
    expect(rendered).toContain('generation_funnel_total{status="completed"');
    expect(rendered).toContain('generation_funnel_total{status="failed"');
    expect(rendered).toContain("generation_failures_by_category");
  });

  it("instrumentExport records by format and type", () => {
    instrumentExport("proj-1", "markdown", "full_bundle");
    instrumentExport("proj-1", "json", "blueprint");
    const rendered = globalMetrics.renderPrometheus();
    const matchMarkdown = rendered.match(/export_usage_total\{format="markdown",type="full_bundle"/);
    const matchJson = rendered.match(/export_usage_total\{format="json",type="blueprint"/);
    expect(matchMarkdown).toBeTruthy();
    expect(matchJson).toBeTruthy();
  });

  it("instrumentRegeneration records by scope", () => {
    instrumentRegeneration("full", 12);
    instrumentRegeneration("partial", 3);
    const rendered = globalMetrics.renderPrometheus();
    expect(rendered).toContain('regeneration_total{scope="full"');
    expect(rendered).toContain('regeneration_total{scope="partial"');
    expect(rendered).toContain("regeneration_affected_phases");
  });

  it("instrumentGuardrailAction records by action and operation", () => {
    instrumentGuardrailAction("rate_limited", "generation");
    instrumentGuardrailAction("over_budget", "generation");
    instrumentGuardrailAction("circuit_open", "openai");
    const rendered = globalMetrics.renderPrometheus();
    expect(rendered).toContain('guardrail_blocks_total{action="rate_limited"');
    expect(rendered).toContain('guardrail_blocks_total{action="over_budget"');
    expect(rendered).toContain('guardrail_blocks_total{action="circuit_open"');
  });

  it("instrumentProviderValidation records by provider and status", () => {
    instrumentProviderValidation("openai", "valid");
    instrumentProviderValidation("anthropic", "invalid");
    const rendered = globalMetrics.renderPrometheus();
    const matchValid = rendered.match(/provider_validations_total\{provider="openai",status="valid"/);
    const matchInvalid = rendered.match(/provider_validations_total\{provider="anthropic",status="invalid"/);
    expect(matchValid).toBeTruthy();
    expect(matchInvalid).toBeTruthy();
  });

  it("all metrics include release label", () => {
    instrumentGenerationFunnel("proj-1", "completed");
    instrumentExport("proj-1", "json", "blueprint");
    const rendered = globalMetrics.renderPrometheus();
    expect(rendered).toContain("release=");
  });

  it("instrumentProviderCall wraps a successful operation with traces and metrics", async () => {
    const result = await instrumentProviderCall("openai", "gpt-4o-mini", async () => "hello");
    expect(result).toBe("hello");
    const rendered = globalMetrics.renderPrometheus();
    expect(rendered).toContain('provider_generations_total{provider="openai",model="gpt-4o-mini"');
    expect(rendered).toContain("provider_generation_duration_ms");
  });

  it("instrumentProviderCall records errors", async () => {
    const err = new Error("API error") as any;
    err.statusCode = 429;
    await expect(
      instrumentProviderCall("anthropic", "claude-sonnet-4", async () => {
        throw err;
      }),
    ).rejects.toThrow("API error");
    const rendered = globalMetrics.renderPrometheus();
    expect(rendered).toContain('provider_errors_total{provider="anthropic"');
  });

  it("no sensitive data in metrics labels", () => {
    const rendered = globalMetrics.renderPrometheus();
    const sensitivePatterns = [/api.key/i, /sk-[a-zA-Z0-9]/, /promptText/i, /user.*input/i];
    for (const pattern of sensitivePatterns) {
      const badLabels = rendered.split("\n").filter((l) => pattern.test(l));
      expect(badLabels.length).toBe(0);
    }
  });
});
