import type { UsageRecord, UsageSummary } from "./types.js";
import { calculateActualCost } from "./estimator.js";

export interface UsageStore {
  insertRecord(r: UsageRecord): void;
  getRecordsByProject(projectId: string): UsageRecord[];
  getRecordsByUser(userId: string): UsageRecord[];
  getAllRecords(): UsageRecord[];
}

export function createInMemoryUsageStore(): UsageStore {
  const records: UsageRecord[] = [];

  return {
    insertRecord(r) {
      records.push(r);
    },
    getRecordsByProject(projectId) {
      return records.filter((r) => r.projectId === projectId);
    },
    getRecordsByUser(userId) {
      return records.filter((r) => r.userId === userId);
    },
    getAllRecords() {
      return [...records];
    },
  };
}

export function createUsageRecord(input: {
  projectId: string;
  userId: string;
  sessionId?: string;
  taskType: string;
  provider: string;
  model: string;
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  estimatedCost: number;
  actualPromptTokens?: number;
  actualCompletionTokens?: number;
  actualCachedTokens?: number;
  retryAttempt?: number;
  fallbackAttempt?: number;
  status: "estimated" | "completed" | "failed";
  requestId?: string;
}): UsageRecord {
  const now = new Date().toISOString();
  const hasActual = input.actualPromptTokens != null && input.actualCompletionTokens != null;
  const total = hasActual ? input.actualPromptTokens! + input.actualCompletionTokens! : null;
  const actualCost = hasActual
    ? calculateActualCost(
        input.provider,
        input.model,
        input.actualPromptTokens!,
        input.actualCompletionTokens!,
      )
    : null;

  return {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    taskType: input.taskType,
    provider: input.provider,
    model: input.model,
    estimatedPromptTokens: input.estimatedPromptTokens,
    estimatedCompletionTokens: input.estimatedCompletionTokens,
    estimatedCost: input.estimatedCost,
    actualPromptTokens: input.actualPromptTokens ?? null,
    actualCompletionTokens: input.actualCompletionTokens ?? null,
    actualCachedTokens: input.actualCachedTokens ?? null,
    actualTotalTokens: total,
    actualCost,
    retryAttempt: input.retryAttempt ?? 0,
    fallbackAttempt: input.fallbackAttempt ?? 0,
    status: input.status,
    requestId: input.requestId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

type Bucket = { generations: number; tokens: number; cost: number };

function addToBucket(map: Record<string, Bucket>, key: string, tokens: number, cost: number): void {
  if (!map[key]) {
    map[key] = { generations: 0, tokens: 0, cost: 0 };
  }
  map[key].generations++;
  map[key].tokens += tokens;
  map[key].cost += cost;
}

export function buildSummary(records: UsageRecord[]): UsageSummary {
  let totalTokens = 0;
  let totalCost = 0;
  const byModel: Record<string, Bucket> = {};
  const byTaskType: Record<string, Bucket> = {};
  const byProvider: Record<string, Bucket> = {};

  for (const r of records) {
    const tokens = r.actualTotalTokens ?? 0;
    const cost = r.actualCost != null ? Number(r.actualCost) : 0;
    totalTokens += tokens;
    totalCost += cost;

    addToBucket(byModel, `${r.provider}/${r.model}`, tokens, cost);
    addToBucket(byTaskType, r.taskType, tokens, cost);
    addToBucket(byProvider, r.provider, tokens, cost);
  }

  totalCost = Math.round(totalCost * 1_000_000) / 1_000_000;

  return { totalGenerations: records.length, totalTokens, totalCost, byModel, byTaskType, byProvider };
}
