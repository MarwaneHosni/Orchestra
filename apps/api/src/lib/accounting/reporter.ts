import type { UsageRecord, UsageSummary } from "./types.js";
import { buildSummary } from "./recorder.js";

export interface UsageQuery {
  projectId?: string | undefined;
  userId?: string | undefined;
  sessionId?: string | undefined;
  model?: string | undefined;
  provider?: string | undefined;
  status?: "estimated" | "completed" | "failed" | undefined;
  since?: string | undefined;
  until?: string | undefined;
  limit?: number | undefined;
}

export interface UsageReport {
  records: UsageRecord[];
  summary: UsageSummary;
  diagnostics: UsageDiagnostics;
  query: UsageQuery;
}

export interface UsageDiagnostics {
  totalRecords: number;
  recordsWithMissingModel: number;
  recordsWithMissingProvider: number;
  recordsWithMissingCost: number;
  recordsWithMissingTokens: number;
  recordsWithRetries: number;
  recordsWithFallbacks: number;
  retryOverheadTokens: number;
  retryOverheadCost: number;
  failedAttempts: number;
  modelList: string[];
  providerList: string[];
  statusBreakdown: Record<string, number>;
}

export function queryUsageRecords(
  store: { getAllRecords(): UsageRecord[] },
  query: UsageQuery,
): UsageReport {
  let records = store.getAllRecords();

  if (query.projectId) records = records.filter((r) => r.projectId === query.projectId);
  if (query.userId) records = records.filter((r) => r.userId === query.userId);
  if (query.sessionId) records = records.filter((r) => r.sessionId === query.sessionId);
  if (query.model) records = records.filter((r) => r.model === query.model);
  if (query.provider) records = records.filter((r) => r.provider === query.provider);
  if (query.status) records = records.filter((r) => r.status === query.status);
  if (query.since) records = records.filter((r) => r.createdAt >= query.since!);
  if (query.until) records = records.filter((r) => r.createdAt <= query.until!);
  if (query.limit && query.limit > 0) records = records.slice(-query.limit);

  const summary = buildSummary(records);
  const diagnostics = buildDiagnostics(records);

  return { records, summary, diagnostics, query };
}

export function buildDiagnostics(records: UsageRecord[]): UsageDiagnostics {
  let missingModel = 0;
  let missingProvider = 0;
  let missingCost = 0;
  let missingTokens = 0;
  let withRetries = 0;
  let withFallbacks = 0;
  let retryOverheadTokens = 0;
  let retryOverheadCost = 0;
  let failed = 0;
  const models = new Set<string>();
  const providers = new Set<string>();
  const statusBreakdown: Record<string, number> = {};

  for (const r of records) {
    if (!r.model || r.model === "unknown") missingModel++;
    if (!r.provider || r.provider === "unknown") missingProvider++;
    if (r.actualCost == null) missingCost++;
    if (r.actualTotalTokens == null) missingTokens++;
    if (r.retryAttempt > 0) withRetries++;
    if (r.fallbackAttempt > 0) withFallbacks++;
    if (r.status === "failed") failed++;

    models.add(r.model || r.provider ? `${r.provider}/${r.model}` : "unknown");
    providers.add(r.provider || "unknown");

    statusBreakdown[r.status] = (statusBreakdown[r.status] ?? 0) + 1;
  }

  retryOverheadTokens = records
    .filter((r) => r.status === "failed")
    .reduce((sum, r) => sum + (r.actualTotalTokens ?? 0), 0);

  retryOverheadCost = Math.round(
    records
      .filter((r) => r.status === "failed")
      .reduce((sum, r) => sum + (r.actualCost != null ? Number(r.actualCost) : 0), 0) *
      1_000_000,
  ) / 1_000_000;

  return {
    totalRecords: records.length,
    recordsWithMissingModel: missingModel,
    recordsWithMissingProvider: missingProvider,
    recordsWithMissingCost: missingCost,
    recordsWithMissingTokens: missingTokens,
    recordsWithRetries: withRetries,
    recordsWithFallbacks: withFallbacks,
    retryOverheadTokens,
    retryOverheadCost,
    failedAttempts: failed,
    modelList: [...models].sort(),
    providerList: [...providers].sort(),
    statusBreakdown,
  };
}

export function getUsageStoreSize(store: { getAllRecords(): UsageRecord[] }): number {
  return store.getAllRecords().length;
}
