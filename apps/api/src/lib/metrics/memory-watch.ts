import { getMetrics } from "./registry.js";
import { RELEASE_VERSION } from "./types.js";

/**
 * Periodic memory and store-size observability.
 * Call `reportMemoryMetrics()` on a timer (e.g. every 60s) to track
 * heap usage and bounded-store sizes as Prometheus metrics.
 */

let _lastHeapUsage: { heapUsed: number; heapTotal: number; external: number; rss: number } | null = null;

export function getLastHeapUsage() {
  return _lastHeapUsage;
}

export function reportMemoryMetrics(): void {
  const metrics = getMetrics();
  const mem = process.memoryUsage();

  _lastHeapUsage = {
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    rss: mem.rss,
  };

  const releaseLabel = [{ name: "release", value: RELEASE_VERSION }];

  metrics.gauge("process_heap_bytes", "Node.js process heap memory in bytes").set(releaseLabel, mem.heapUsed);
  metrics
    .gauge("process_heap_total_bytes", "Node.js process total heap size in bytes")
    .set(releaseLabel, mem.heapTotal);
  metrics.gauge("process_rss_bytes", "Node.js process resident set size in bytes").set(releaseLabel, mem.rss);
  metrics
    .gauge("process_external_bytes", "Node.js process external memory in bytes")
    .set(releaseLabel, mem.external);
}

/**
 * Returns a snapshot of all observable store sizes for diagnostics.
 */
export interface StoreSizeSnapshot {
  timestamp: string;
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
  };
  stores: Record<string, number>;
}

export function captureStoreSnapshot(storeSizes: Record<string, number>): StoreSizeSnapshot {
  const mem = process.memoryUsage();
  const stores: Record<string, number> = {};
  for (const [name, size] of Object.entries(storeSizes)) {
    stores[name] = size;
  }
  return {
    timestamp: new Date().toISOString(),
    memory: {
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
    },
    stores,
  };
}

/**
 * Register a periodic memory-reporting interval.
 * Returns the timer handle so it can be cleared on shutdown.
 */
export function startMemoryWatch(
  getStoreSizes: () => Record<string, number>,
  intervalMs = 60_000,
): ReturnType<typeof setInterval> {
  const timer = setInterval(() => {
    reportMemoryMetrics();
    const snapshot = captureStoreSnapshot(getStoreSizes());
    const metrics = getMetrics();
    const releaseLabel = [{ name: "release", value: RELEASE_VERSION }];
    for (const [name, size] of Object.entries(snapshot.stores)) {
      metrics
        .gauge(`store_size_${name}`, `Size of in-memory store: ${name}`)
        .set([...releaseLabel, { name: "store", value: name }], size);
    }
  }, intervalMs);
  timer.unref();
  return timer;
}
