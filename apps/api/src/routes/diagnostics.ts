import type { FastifyInstance } from "fastify";
import { captureStoreSnapshot, getLastHeapUsage, reportMemoryMetrics } from "../lib/metrics/memory-watch.js";

export async function registerDiagnosticsRoutes(app: FastifyInstance) {
  app.get("/api/v1/diagnostics", async (_request, _reply) => {
    const storeSizes: Record<string, () => number> = {};

    // Metrics registry
    try {
      const { getMetrics } = await import("../lib/metrics/registry.js");
      const metrics = getMetrics();
      storeSizes["metrics_counters"] = () => (metrics as any).counters?.size ?? 0;
      storeSizes["metrics_gauges"] = () => (metrics as any).gauges?.size ?? 0;
      storeSizes["metrics_histograms"] = () => (metrics as any).histograms?.size ?? 0;
    } catch {
      // fallback
    }

    // Store sizes
    try {
      const { getStoreSizes } = await import("../lib/shared-stores.js");
      const sizes = getStoreSizes();
      storeSizes["graph_store_byKey"] = () => sizes.graph_byKey;
      storeSizes["graph_store_byPlan"] = () => sizes.graph_byPlan;
      storeSizes["prompt_store_byTask"] = () => sizes.prompt_byTask;
      storeSizes["prompt_store_byPlan"] = () => sizes.prompt_byPlan;
    } catch {
      // fallback
    }

    // Usage store
    try {
      const { getUsageStore } = await import("../lib/generation/orchestrator.js");
      const { getUsageStoreSize } = await import("../lib/accounting/reporter.js");
      storeSizes["usage_records"] = () => getUsageStoreSize(getUsageStore());
    } catch {
      // fallback
    }

    // AI cache
    try {
      const { globalCache } = await import("../lib/cache/cache-service.js");
      storeSizes["ai_cache_entries"] = () => globalCache.getEntryCount() as unknown as number;
    } catch {
      // fallback
    }

    reportMemoryMetrics();
    const snapshot = captureStoreSnapshot(storeSizes);

    return {
      healthy: true,
      timestamp: snapshot.timestamp,
      memory: snapshot.memory,
      stores: snapshot.stores,
      lastHeapUsage: getLastHeapUsage()
        ? {
            heapUsedMb: Math.round((getLastHeapUsage()!.heapUsed / 1024 / 1024) * 100) / 100,
            rssMb: Math.round((getLastHeapUsage()!.rss / 1024 / 1024) * 100) / 100,
          }
        : null,
    };
  });
}
