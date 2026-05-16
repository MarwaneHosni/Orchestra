import type { MetricLabel, CounterMetric, GaugeMetric, HistogramMetric } from "./types.js";
import { RELEASE_VERSION } from "./types.js";

function labelKey(labels: MetricLabel[]): string {
  return labels
    .map((l) => `${l.name}::${l.value}`)
    .sort()
    .join("|");
}

function formatLabels(labels: MetricLabel[]): string {
  if (labels.length === 0) return "";
  const parts = labels.map((l) => `${l.name}="${escapeLabelValue(l.value)}"`);
  return `{${parts.join(",")}}`;
}

function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export class MetricsRegistry {
  private counters = new Map<string, CounterMetric>();
  private gauges = new Map<string, GaugeMetric>();
  private histograms = new Map<string, HistogramMetric>();

  counter(name: string, help: string): Counter {
    if (!this.counters.has(name)) {
      this.counters.set(name, { type: "counter", name, help, samples: [] });
    }
    return new Counter(name, this.counters.get(name)!);
  }

  gauge(name: string, help: string): Gauge {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, { type: "gauge", name, help, samples: [] });
    }
    return new Gauge(name, this.gauges.get(name)!);
  }

  histogram(name: string, help: string, buckets?: number[]): Histogram {
    const defaultBuckets = [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120];
    if (!this.histograms.has(name)) {
      this.histograms.set(name, {
        type: "histogram",
        name,
        help,
        buckets: buckets ?? defaultBuckets,
        samples: new Map(),
      });
    }
    return new Histogram(name, this.histograms.get(name)!);
  }

  renderPrometheus(): string {
    const lines: string[] = [];
    for (const m of this.counters.values()) {
      lines.push(`# HELP ${m.name} ${m.help}`);
      lines.push(`# TYPE ${m.name} counter`);
      for (const s of m.samples) {
        lines.push(`${m.name}${formatLabels(s.labels)} ${s.value}`);
      }
    }
    for (const m of this.gauges.values()) {
      lines.push(`# HELP ${m.name} ${m.help}`);
      lines.push(`# TYPE ${m.name} gauge`);
      for (const s of m.samples) {
        lines.push(`${m.name}${formatLabels(s.labels)} ${s.value}`);
      }
    }
    for (const m of this.histograms.values()) {
      lines.push(`# HELP ${m.name} ${m.help}`);
      lines.push(`# TYPE ${m.name} histogram`);
      for (const [key, data] of m.samples) {
        const labelStr = formatLabels(parseLabelKey(key));
        for (const b of data.buckets) {
          lines.push(`${m.name}_bucket${labelStr}{le="${b.le}"} ${b.count}`);
        }
        lines.push(`${m.name}_bucket${labelStr}{le="+Inf"} ${data.count}`);
        lines.push(`${m.name}_sum${labelStr} ${data.sum}`);
        lines.push(`${m.name}_count${labelStr} ${data.count}`);
      }
    }
    lines.push(`# HELP build_info Build metadata`);
    lines.push(`# TYPE build_info gauge`);
    lines.push(`build_info{release="${escapeLabelValue(RELEASE_VERSION)}"} 1`);
    return lines.join("\n") + "\n";
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

function parseLabelKey(key: string): MetricLabel[] {
  if (!key) return [];
  return key.split("|").map((part) => {
    const idx = part.indexOf("::");
    if (idx === -1) return { name: part, value: "" };
    return { name: part.slice(0, idx), value: part.slice(idx + 2) };
  });
}

class Counter {
  constructor(
    _name: string,
    private metric: CounterMetric,
  ) {
    void _name;
  }

  inc(labels?: MetricLabel[], value?: number): void {
    const resolved = labels ?? [];
    const key = labelKey(resolved);
    const existing = this.metric.samples.find((s) => labelKey(s.labels) === key);
    if (existing) {
      existing.value += value ?? 1;
    } else {
      this.metric.samples.push({ labels: resolved, value: value ?? 1 });
    }
  }

  reset(): void {
    this.metric.samples = [];
  }
}

class Gauge {
  constructor(
    _name: string,
    private metric: GaugeMetric,
  ) {
    void _name;
  }

  set(labels: MetricLabel[], value: number): void {
    const key = labelKey(labels);
    const existing = this.metric.samples.find((s) => labelKey(s.labels) === key);
    if (existing) {
      existing.value = value;
    } else {
      this.metric.samples.push({ labels, value });
    }
  }

  inc(labels: MetricLabel[], value?: number): void {
    const key = labelKey(labels);
    const existing = this.metric.samples.find((s) => labelKey(s.labels) === key);
    if (existing) {
      existing.value += value ?? 1;
    } else {
      this.metric.samples.push({ labels, value: value ?? 1 });
    }
  }
}

class Histogram {
  constructor(
    _name: string,
    private metric: HistogramMetric,
  ) {
    void _name;
  }

  observe(labels: MetricLabel[], value: number): void {
    const key = labelKey(labels);
    let entry = this.metric.samples.get(key);
    if (!entry) {
      const buckets = this.metric.buckets.map((le) => ({ le: String(le), count: 0 }));
      entry = { buckets, sum: 0, count: 0 };
      this.metric.samples.set(key, entry);
    }
    entry.count++;
    entry.sum += value;
    for (const b of entry.buckets) {
      if (value <= parseFloat(b.le)) b.count++;
    }
  }

  reset(): void {
    this.metric.samples.clear();
  }
}

export const globalMetrics = new MetricsRegistry();

export function getMetrics(): MetricsRegistry {
  return globalMetrics;
}
