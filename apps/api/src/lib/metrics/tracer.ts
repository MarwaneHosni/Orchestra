import type { Span, TraceExporter } from "./types.js";
import { getMetrics } from "./registry.js";
import { globalLogExporter } from "./exporters.js";

let _exporter: TraceExporter = globalLogExporter;

export function setTraceExporter(exporter: TraceExporter): void {
  _exporter = exporter;
}

export function getTraceExporter(): TraceExporter {
  return _exporter;
}

export class Tracer {
  private activeSpans = new Map<string, Span>();

  startSpan(operationName: string, parentSpanId?: string): Span {
    const spanId = crypto.randomUUID();
    const span: Span = {
      spanId,
      parentSpanId: parentSpanId ?? null,
      operationName,
      startTime: Date.now(),
      endTime: null,
      durationMs: null,
      status: "ok",
      tags: {},
      error: null,
    };
    this.activeSpans.set(spanId, span);
    return span;
  }

  endSpan(span: Span, status?: "ok" | "error", error?: string | null): void {
    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.status = status ?? "ok";
    if (error) span.error = error;
    this.activeSpans.delete(span.spanId);
    _exporter.export({ ...span });

    const metrics = getMetrics();
    const labels = [
      { name: "operation", value: operationNameFromSpan(span.operationName) },
      { name: "status", value: span.status },
    ];
    if (span.tags["provider"]) labels.push({ name: "provider", value: span.tags["provider"] });

    metrics.histogram("trace_span_duration_ms", "Duration of traced spans").observe(labels, span.durationMs);
    metrics.counter("trace_spans_total", "Total traced spans").inc(labels);
    if (span.status === "error") {
      metrics.counter("trace_span_errors_total", "Traced span errors").inc(labels);
    }
  }

  hasActiveSpan(spanId: string): boolean {
    return this.activeSpans.has(spanId);
  }

  reset(): void {
    this.activeSpans.clear();
  }
}

function operationNameFromSpan(name: string): string {
  const parts = name.split(".");
  return parts.length >= 2 ? parts.slice(0, 2).join(".") : name;
}

export const globalTracer = new Tracer();

export function getTracer(): Tracer {
  return globalTracer;
}
