import type { Span, TraceExporter } from "./types.js";
import { RELEASE_VERSION } from "./types.js";
import { createModuleLogger } from "../logging/logger.js";

const traceLog = createModuleLogger("trace");

export const globalLogExporter: TraceExporter = {
  export(span: Span) {
    traceLog.info({
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      operationName: span.operationName,
      durationMs: span.durationMs,
      status: span.status,
      tags: span.tags,
      error: span.error,
      release: RELEASE_VERSION,
    }, span.operationName);
  },
};
