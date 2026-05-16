import type { Span, TraceExporter } from "./types.js";
import { RELEASE_VERSION } from "./types.js";

export const globalLogExporter: TraceExporter = {
  export(span: Span) {
    console.log(
      JSON.stringify({
        _trace: true,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        operationName: span.operationName,
        durationMs: span.durationMs,
        status: span.status,
        tags: span.tags,
        error: span.error,
        release: RELEASE_VERSION,
        startTime: new Date(span.startTime).toISOString(),
      }),
    );
  },
};
