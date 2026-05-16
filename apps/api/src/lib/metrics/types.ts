export type MetricType = "counter" | "gauge" | "histogram";

export interface MetricLabel {
  name: string;
  value: string;
}

export interface MetricSample {
  labels: MetricLabel[];
  value: number;
}

export interface CounterMetric {
  type: "counter";
  name: string;
  help: string;
  samples: MetricSample[];
}

export interface GaugeMetric {
  type: "gauge";
  name: string;
  help: string;
  samples: MetricSample[];
}

export interface HistogramBucket {
  le: string;
  count: number;
}

export interface HistogramMetric {
  type: "histogram";
  name: string;
  help: string;
  buckets: number[];
  samples: Map<string, { buckets: HistogramBucket[]; sum: number; count: number }>;
}

export interface Span {
  spanId: string;
  parentSpanId: string | null;
  operationName: string;
  startTime: number;
  endTime: number | null;
  durationMs: number | null;
  status: "ok" | "error";
  tags: Record<string, string>;
  error?: string | null;
}

export interface TraceExporter {
  export(span: Span): void;
}

export const RELEASE_VERSION = process.env.SOURCE_VERSION ?? process.env.npm_package_version ?? "0.1.0";
