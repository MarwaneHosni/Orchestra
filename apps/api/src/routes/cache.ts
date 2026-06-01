import type { FastifyInstance } from "fastify";

export async function registerCacheRoutes(app: FastifyInstance) {
  app.get("/api/v1/cache/stats", async () => {
    const { globalCache } = await import("../lib/cache/cache-service.js");
    return globalCache.getStats();
  });

  app.get("/api/v1/cache/entry-count", async () => {
    const { globalCache } = await import("../lib/cache/cache-service.js");
    return { entryCount: await globalCache.getEntryCount() };
  });

  app.post("/api/v1/cache/invalidate", async (request) => {
    const { globalCache } = await import("../lib/cache/cache-service.js");
    const body = (request.body ?? {}) as { provider?: string; model?: string; all?: boolean };
    let count = 0;
    if (body.all) {
      count = await globalCache.invalidateAll();
    } else if (body.provider) {
      count = await globalCache.invalidateByProvider(body.provider);
    } else if (body.model) {
      count = await globalCache.invalidateByModel(body.model);
    } else {
      count = await globalCache.invalidateAll();
    }
    return { invalidated: count };
  });
}
