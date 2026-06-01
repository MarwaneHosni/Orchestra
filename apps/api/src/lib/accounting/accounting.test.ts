import { describe, expect, it } from "vitest";
import { estimateCost, calculateActualCost } from "./estimator.js";
import { createUsageRecord, createInMemoryUsageStore, buildSummary } from "./recorder.js";
import { getPricing, MODEL_PRICING } from "./pricing.js";
import { createAccumulatedUsage, accumulateUsage, sumAttempts, sumSuccessfulAttempts, sumFailedAttempts, attemptKey } from "./streaming.js";
import { queryUsageRecords, buildDiagnostics, getUsageStoreSize } from "./reporter.js";
import type { UsageAttempt } from "./streaming.js";

describe("MODEL_PRICING", () => {
  it("has entries for all known models", () => {
    expect(MODEL_PRICING.length).toBeGreaterThan(0);
    for (const p of MODEL_PRICING) {
      expect(p.promptPricePer1K).toBeGreaterThanOrEqual(0);
      expect(p.completionPricePer1K).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns pricing for gpt-4o-mini", () => {
    const p = getPricing("openai", "gpt-4o-mini");
    expect(p).toBeDefined();
    expect(p!.promptPricePer1K).toBe(0.00015);
  });
});

describe("estimateCost", () => {
  it("computes cost for known model", () => {
    const est = estimateCost({
      provider: "openai",
      model: "gpt-4o",
      promptTokenEstimate: 1000,
      completionTokenEstimate: 500,
    });
    expect(est.estimatedPromptTokens).toBe(1000);
    expect(est.estimatedCompletionTokens).toBe(500);
    // (1000/1000)*0.0025 + (500/1000)*0.01 = 0.0025 + 0.005 = 0.0075
    expect(est.estimatedCost).toBe(0.0075);
  });

  it("returns zero cost for unknown model", () => {
    const est = estimateCost({ provider: "unknown", model: "fake-model" });
    expect(est.estimatedCost).toBe(0);
  });

  it("uses defaults when no token estimates provided", () => {
    const est = estimateCost({ provider: "openai", model: "gpt-4o-mini" });
    expect(est.estimatedPromptTokens).toBe(500);
    expect(est.estimatedCompletionTokens).toBe(500);
    expect(est.estimatedCost).toBeGreaterThan(0);
  });
});

describe("calculateActualCost", () => {
  it("computes cost from actual token usage", () => {
    const cost = calculateActualCost("openai", "gpt-4o-mini", 1500, 300);
    const expected = (1500 / 1000) * 0.00015 + (300 / 1000) * 0.0006;
    expect(cost).toBe(Math.round(expected * 1_000_000) / 1_000_000);
  });

  it("returns 0 for unknown model", () => {
    expect(calculateActualCost("unknown", "fake", 100, 100)).toBe(0);
  });
});

describe("createUsageRecord", () => {
  it("creates a usage record with estimate-only data", () => {
    const record = createUsageRecord({
      projectId: "proj-1",
      userId: "user-1",
      taskType: "clarification",
      provider: "openai",
      model: "gpt-4o-mini",
      estimatedPromptTokens: 300,
      estimatedCompletionTokens: 200,
      estimatedCost: 0.001,
      status: "estimated",
    });
    expect(record.status).toBe("estimated");
    expect(record.actualPromptTokens).toBeNull();
    expect(record.actualTotalTokens).toBeNull();
    expect(record.actualCost).toBeNull();
  });

  it("creates a completed usage record with actual tokens", () => {
    const record = createUsageRecord({
      projectId: "proj-1",
      userId: "user-1",
      sessionId: "sess-1",
      taskType: "architecture",
      provider: "openai",
      model: "gpt-4o",
      estimatedPromptTokens: 1000,
      estimatedCompletionTokens: 500,
      estimatedCost: 0.0075,
      actualPromptTokens: 1200,
      actualCompletionTokens: 400,
      status: "completed",
      requestId: "req-abc",
    });
    expect(record.status).toBe("completed");
    expect(record.actualPromptTokens).toBe(1200);
    expect(record.actualTotalTokens).toBe(1600);
    expect(record.actualCost).toBeGreaterThan(0);
    expect(record.sessionId).toBe("sess-1");
    expect(record.requestId).toBe("req-abc");
  });
});

describe("UsageStore", () => {
  it("stores and retrieves records by project", () => {
    const store = createInMemoryUsageStore();
    const r1 = createUsageRecord({
      projectId: "proj-a",
      userId: "u1",
      taskType: "summary",
      provider: "openai",
      model: "gpt-4o-mini",
      estimatedPromptTokens: 100,
      estimatedCompletionTokens: 50,
      estimatedCost: 0.001,
      status: "completed",
      actualPromptTokens: 90,
      actualCompletionTokens: 40,
    });
    const r2 = createUsageRecord({
      projectId: "proj-b",
      userId: "u1",
      taskType: "roadmap",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      estimatedPromptTokens: 500,
      estimatedCompletionTokens: 300,
      estimatedCost: 0.01,
      status: "estimated",
    });
    store.insertRecord(r1);
    store.insertRecord(r2);

    const projA = store.getRecordsByProject("proj-a");
    expect(projA).toHaveLength(1);

    const projB = store.getRecordsByProject("proj-b");
    expect(projB).toHaveLength(1);

    const all = store.getAllRecords();
    expect(all).toHaveLength(2);
  });

  it("retrieves records by user", () => {
    const store = createInMemoryUsageStore();
    store.insertRecord(
      createUsageRecord({
        projectId: "p1",
        userId: "u1",
        taskType: "summary",
        provider: "openai",
        model: "gpt-4o-mini",
        estimatedPromptTokens: 100,
        estimatedCompletionTokens: 50,
        estimatedCost: 0.001,
        status: "completed",
        actualPromptTokens: 90,
        actualCompletionTokens: 40,
      }),
    );
    store.insertRecord(
      createUsageRecord({
        projectId: "p2",
        userId: "u2",
        taskType: "roadmap",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        estimatedPromptTokens: 500,
        estimatedCompletionTokens: 300,
        estimatedCost: 0.01,
        status: "estimated",
      }),
    );

    const u1 = store.getRecordsByUser("u1");
    expect(u1).toHaveLength(1);
  });
});

describe("buildSummary", () => {
  it("returns empty summary for no records", () => {
    const s = buildSummary([]);
    expect(s.totalGenerations).toBe(0);
    expect(s.totalCost).toBe(0);
  });

  it("aggregates tokens and cost across records", () => {
    const store = createInMemoryUsageStore();
    store.insertRecord(
      createUsageRecord({
        projectId: "p1",
        userId: "u1",
        taskType: "architecture",
        provider: "openai",
        model: "gpt-4o",
        estimatedPromptTokens: 500,
        estimatedCompletionTokens: 500,
        estimatedCost: 0.01,
        status: "completed",
        actualPromptTokens: 600,
        actualCompletionTokens: 400,
      }),
    );
    store.insertRecord(
      createUsageRecord({
        projectId: "p1",
        userId: "u1",
        taskType: "summary",
        provider: "openai",
        model: "gpt-4o-mini",
        estimatedPromptTokens: 100,
        estimatedCompletionTokens: 100,
        estimatedCost: 0.001,
        status: "completed",
        actualPromptTokens: 80,
        actualCompletionTokens: 60,
      }),
    );

    const s = buildSummary(store.getAllRecords());
    expect(s.totalGenerations).toBe(2);
    expect(s.totalTokens).toBe(1140); // 1000 + 140
    expect(s.byModel["openai/gpt-4o"]).toBeDefined();
    expect(s.byModel["openai/gpt-4o-mini"]).toBeDefined();
    expect(s.byTaskType["architecture"]).toBeDefined();
    expect(s.byTaskType["summary"]).toBeDefined();
    expect(s.byProvider["openai"]).toBeDefined();
    expect(s.byProvider["openai"].generations).toBe(2);
  });
});

describe("streaming accumulator", () => {
  it("creates zeroed accumulator", () => {
    const acc = createAccumulatedUsage();
    expect(acc.promptTokens).toBe(0);
    expect(acc.completionTokens).toBe(0);
    expect(acc.totalTokens).toBe(0);
  });

  it("accumulates partial chunks", () => {
    const acc = createAccumulatedUsage();
    const r1 = accumulateUsage(acc, { promptTokens: 10, completionTokens: 5 });
    expect(r1.promptTokens).toBe(10);
    expect(r1.completionTokens).toBe(5);
    expect(r1.totalTokens).toBe(15);

    const r2 = accumulateUsage(r1, { promptTokens: 5, completionTokens: 3 });
    expect(r2.promptTokens).toBe(15);
    expect(r2.completionTokens).toBe(8);
    expect(r2.totalTokens).toBe(23);
  });

  it("handles empty chunk", () => {
    const acc = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };
    const r = accumulateUsage(acc, {});
    expect(r.promptTokens).toBe(10);
    expect(r.completionTokens).toBe(5);
    expect(r.totalTokens).toBe(15);
  });

  it("accumulates with explicit totalTokens", () => {
    const acc = createAccumulatedUsage();
    const r = accumulateUsage(acc, { promptTokens: 10, completionTokens: 5, totalTokens: 20 });
    expect(r.totalTokens).toBe(20);
  });

  it("sumAttempts aggregates all attempts", () => {
    const a1: UsageAttempt = { provider: "openai", model: "gpt-4o", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, durationMs: 100, success: true };
    const a2: UsageAttempt = { provider: "openai", model: "gpt-4o-mini", usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 }, durationMs: 50, success: false };
    const total = sumAttempts([a1, a2]);
    expect(total.promptTokens).toBe(13);
    expect(total.completionTokens).toBe(7);
    expect(total.totalTokens).toBe(20);
  });

  it("sumSuccessfulAttempts excludes failed", () => {
    const a1: UsageAttempt = { provider: "openai", model: "gpt-4o", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, durationMs: 100, success: true };
    const a2: UsageAttempt = { provider: "openai", model: "gpt-4o-mini", usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 }, durationMs: 50, success: false };
    const total = sumSuccessfulAttempts([a1, a2]);
    expect(total.promptTokens).toBe(10);
    expect(total.completionTokens).toBe(5);
    expect(total.totalTokens).toBe(15);
  });

  it("sumFailedAttempts excludes successful", () => {
    const a1: UsageAttempt = { provider: "openai", model: "gpt-4o", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, durationMs: 100, success: true };
    const a2: UsageAttempt = { provider: "openai", model: "gpt-4o-mini", usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 }, durationMs: 50, success: false };
    const total = sumFailedAttempts([a1, a2]);
    expect(total.promptTokens).toBe(3);
    expect(total.completionTokens).toBe(2);
    expect(total.totalTokens).toBe(5);
  });

  it("attemptKey returns provider/model string", () => {
    const a: UsageAttempt = { provider: "openai", model: "gpt-4o", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, durationMs: 0, success: true };
    expect(attemptKey(a)).toBe("openai/gpt-4o");
  });
});

describe("reporter", () => {
  it("queryUsageRecords returns empty report for empty store", () => {
    const store = createInMemoryUsageStore();
    const report = queryUsageRecords(store, {});
    expect(report.records).toHaveLength(0);
    expect(report.summary.totalGenerations).toBe(0);
    expect(report.diagnostics.totalRecords).toBe(0);
  });

  it("queryUsageRecords filters by projectId", () => {
    const store = createInMemoryUsageStore();
    store.insertRecord(createUsageRecord({ projectId: "p1", userId: "u1", taskType: "blueprint", provider: "openai", model: "gpt-4o", estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.001, status: "completed", actualPromptTokens: 100, actualCompletionTokens: 50 }));
    store.insertRecord(createUsageRecord({ projectId: "p2", userId: "u2", taskType: "blueprint", provider: "openai", model: "gpt-4o-mini", estimatedPromptTokens: 50, estimatedCompletionTokens: 25, estimatedCost: 0.001, status: "completed", actualPromptTokens: 50, actualCompletionTokens: 25 }));
    const report = queryUsageRecords(store, { projectId: "p1" });
    expect(report.records).toHaveLength(1);
    expect(report.records[0]!.projectId).toBe("p1");
  });

  it("buildDiagnostics detects missing metadata", () => {
    const store = createInMemoryUsageStore();
    store.insertRecord(createUsageRecord({ projectId: "p1", userId: "u1", taskType: "blueprint", provider: "unknown", model: "unknown", estimatedPromptTokens: 0, estimatedCompletionTokens: 0, estimatedCost: 0, status: "failed" }));
    store.insertRecord(createUsageRecord({ projectId: "p1", userId: "u1", taskType: "blueprint", provider: "openai", model: "gpt-4o", estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.001, status: "completed", actualPromptTokens: 100, actualCompletionTokens: 50 }));
    const diag = buildDiagnostics(store.getAllRecords());
    expect(diag.totalRecords).toBe(2);
    expect(diag.recordsWithMissingModel).toBe(1);
    expect(diag.recordsWithMissingProvider).toBe(1);
    expect(diag.recordsWithMissingCost).toBe(1);
    expect(diag.recordsWithMissingTokens).toBe(1);
    expect(diag.failedAttempts).toBe(1);
    expect(diag.providerList).toContain("openai");
    expect(diag.providerList).toContain("unknown");
  });

  it("buildDiagnostics tracks retry/fallback overhead", () => {
    const store = createInMemoryUsageStore();
    store.insertRecord(createUsageRecord({ projectId: "p1", userId: "u1", taskType: "blueprint", provider: "openai", model: "gpt-4o", estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.01, status: "failed", retryAttempt: 1, actualPromptTokens: 100, actualCompletionTokens: 50 }));
    store.insertRecord(createUsageRecord({ projectId: "p1", userId: "u1", taskType: "blueprint", provider: "openai", model: "gpt-4o", estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.01, status: "failed", fallbackAttempt: 1, actualPromptTokens: 100, actualCompletionTokens: 50 }));
    store.insertRecord(createUsageRecord({ projectId: "p1", userId: "u1", taskType: "blueprint", provider: "openai", model: "gpt-4o", estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.01, status: "completed", actualPromptTokens: 100, actualCompletionTokens: 50 }));
    const diag = buildDiagnostics(store.getAllRecords());
    expect(diag.recordsWithRetries).toBe(1);
    expect(diag.recordsWithFallbacks).toBe(1);
    expect(diag.failedAttempts).toBe(2);
  });

  it("queryUsageRecords filters by status", () => {
    const store = createInMemoryUsageStore();
    store.insertRecord(createUsageRecord({ projectId: "p1", userId: "u1", taskType: "blueprint", provider: "openai", model: "gpt-4o", estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.01, status: "completed", actualPromptTokens: 100, actualCompletionTokens: 50 }));
    store.insertRecord(createUsageRecord({ projectId: "p1", userId: "u1", taskType: "blueprint", provider: "openai", model: "gpt-4o", estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.01, status: "failed" }));
    const completed = queryUsageRecords(store, { status: "completed" });
    expect(completed.records).toHaveLength(1);
    expect(completed.records[0]!.status).toBe("completed");
    const failed = queryUsageRecords(store, { status: "failed" });
    expect(failed.records).toHaveLength(1);
    expect(failed.records[0]!.status).toBe("failed");
  });

  it("buildSummary aggregates correctly via reporter", () => {
    const store = createInMemoryUsageStore();
    store.insertRecord(createUsageRecord({ projectId: "p1", userId: "u1", taskType: "blueprint", provider: "openai", model: "gpt-4o", estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.01, status: "completed", actualPromptTokens: 100, actualCompletionTokens: 50 }));
    store.insertRecord(createUsageRecord({ projectId: "p1", userId: "u1", taskType: "blueprint", provider: "openai", model: "gpt-4o-mini", estimatedPromptTokens: 50, estimatedCompletionTokens: 25, estimatedCost: 0.001, status: "completed", actualPromptTokens: 50, actualCompletionTokens: 25 }));
    const report = queryUsageRecords(store, {});
    expect(report.summary.totalGenerations).toBe(2);
    expect(report.summary.totalTokens).toBe(225);
    expect(report.summary.byModel["openai/gpt-4o"]).toBeDefined();
  });

  it("getUsageStoreSize returns record count", () => {
    const store = createInMemoryUsageStore();
    expect(getUsageStoreSize(store)).toBe(0);
    store.insertRecord(createUsageRecord({ projectId: "p1", userId: "u1", taskType: "blueprint", provider: "openai", model: "gpt-4o", estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.001, status: "completed", actualPromptTokens: 100, actualCompletionTokens: 50 }));
    expect(getUsageStoreSize(store)).toBe(1);
  });
});
