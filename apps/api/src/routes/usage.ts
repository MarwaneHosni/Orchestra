import type { FastifyInstance } from "fastify";
import { queryUsageRecords, getUsageStoreSize } from "../lib/accounting/reporter.js";

interface QueryParams {
  projectId?: string;
  userId?: string;
  sessionId?: string;
  model?: string;
  provider?: string;
  status?: "estimated" | "completed" | "failed";
  since?: string;
  until?: string;
  limit?: number;
  format?: "full" | "summary" | "diagnostics";
}

export async function registerUsageRoutes(app: FastifyInstance) {
  app.get<{ Querystring: QueryParams }>("/api/v1/usage", async (request) => {
    const query = request.query;

    const { getUsageStore } = await import("../lib/generation/orchestrator.js");
    const store = getUsageStore();

    const format = (query.format ?? "full") as "full" | "summary" | "diagnostics";

    const report = queryUsageRecords(store, {
      projectId: query.projectId,
      userId: query.userId,
      sessionId: query.sessionId,
      model: query.model,
      provider: query.provider,
      status: query.status,
      since: query.since,
      until: query.until,
      limit: query.limit,
    });

    if (format === "summary") {
      return { summary: report.summary, diagnostics: report.diagnostics };
    }
    if (format === "diagnostics") {
      return { diagnostics: report.diagnostics };
    }

    return {
      records: report.records,
      summary: report.summary,
      diagnostics: report.diagnostics,
    };
  });

  app.get("/api/v1/usage/size", async () => {
    const { getUsageStore } = await import("../lib/generation/orchestrator.js");
    return { usageRecords: getUsageStoreSize(getUsageStore()) };
  });
}
