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

    // Graph store
    try {
      const { graphStore } = await import("../lib/shared-stores.js");
      storeSizes["graph_store_byKey"] = () => (graphStore as any).byKey?.size ?? 0;
      storeSizes["graph_store_byPlan"] = () => (graphStore as any).byPlan?.size ?? 0;
    } catch {
      // fallback
    }

    // Prompt store
    try {
      const { promptStore } = await import("../lib/shared-stores.js");
      storeSizes["prompt_store_byTask"] = () => (promptStore as any).byTask?.size ?? 0;
      storeSizes["prompt_store_byPlan"] = () => (promptStore as any).byPlan?.size ?? 0;
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
