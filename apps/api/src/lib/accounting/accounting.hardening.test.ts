import { describe, expect, it, beforeEach } from "vitest";
import { estimateCost, calculateActualCost, estimatePromptTokens, estimateCompletionTokens } from "./estimator.js";
import { createUsageRecord, createInMemoryUsageStore, buildSummary } from "./recorder.js";
import { getPricing, MODEL_PRICING } from "./pricing.js";
import { createAccumulatedUsage, accumulateUsage, sumAttempts, sumSuccessfulAttempts, sumFailedAttempts } from "./streaming.js";
import { queryUsageRecords, buildDiagnostics } from "./reporter.js";
import type { UsageAttempt } from "./streaming.js";
import type { UsageRecord } from "./types.js";

// ── 1. PRICING CORRECTNESS ──────────────────────────────────────

describe("pricing correctness", () => {

  it("every known model has non-negative prices", () => {
    expect(MODEL_PRICING.length).toBeGreaterThanOrEqual(19);
    for (const p of MODEL_PRICING) {
      expect(p.promptPricePer1K).toBeGreaterThanOrEqual(0);
      expect(p.completionPricePer1K).toBeGreaterThanOrEqual(0);
      expect(p.provider).toBeTruthy();
      expect(p.model).toBeTruthy();
    }
  });

  it("returns correct pricing for openai gpt-4o", () => {
    const p = getPricing("openai", "gpt-4o");
    expect(p).toBeDefined();
    expect(p!.promptPricePer1K).toBe(0.0025);
    expect(p!.completionPricePer1K).toBe(0.01);
  });

  it("returns correct pricing for anthropic claude-sonnet-4", () => {
    const p = getPricing("anthropic", "claude-sonnet-4-20250514");
    expect(p).toBeDefined();
    expect(p!.promptPricePer1K).toBe(0.003);
    expect(p!.completionPricePer1K).toBe(0.015);
  });

  it("provider-specific overrides: openrouter vs openai for same model", () => {
    const direct = getPricing("openai", "gpt-4o-mini");
    const viaRouter = getPricing("openrouter", "openai/gpt-4o-mini");
    expect(direct).toBeDefined();
    expect(viaRouter).toBeDefined();
    expect(direct!.promptPricePer1K).toBe(viaRouter!.promptPricePer1K);
    expect(direct!.completionPricePer1K).toBe(viaRouter!.completionPricePer1K);
  });

  it("all opencode-go models are free", () => {
    const goModels = MODEL_PRICING.filter((p) => p.provider === "opencode-go");
    expect(goModels.length).toBeGreaterThanOrEqual(10);
    for (const m of goModels) {
      expect(m.promptPricePer1K).toBe(0);
      expect(m.completionPricePer1K).toBe(0);
    }
  });

  it("deepseek flash free tier is free", () => {
    const p = getPricing("openrouter", "deepseek/deepseek-v4-flash:free");
    expect(p).toBeDefined();
    expect(p!.promptPricePer1K).toBe(0);
    expect(p!.completionPricePer1K).toBe(0);
  });

  it("unknown model returns undefined", () => {
    expect(getPricing("unknown", "nonexistent-v99")).toBeUndefined();
    expect(getPricing("openai", "gpt-5-nonexistent")).toBeUndefined();
  });

  it("unknown provider returns undefined", () => {
    expect(getPricing("nonexistent-provider", "gpt-4o")).toBeUndefined();
  });

  it("calculateActualCost uses getPricing consistently", () => {
    const cost = calculateActualCost("openai", "gpt-4o-mini", 2000, 1000);
    const pricing = getPricing("openai", "gpt-4o-mini")!;
    const expected = (2000 / 1000) * pricing.promptPricePer1K + (1000 / 1000) * pricing.completionPricePer1K;
    expect(cost).toBe(Math.round(expected * 1_000_000) / 1_000_000);
  });

  it("calculateActualCost returns 0 for unknown model", () => {
    expect(calculateActualCost("unknown", "fake", 9999, 9999)).toBe(0);
  });

  it("estimateCost computes matching cost for known model", () => {
    const est = estimateCost({ provider: "openai", model: "gpt-4o", promptTokenEstimate: 2000, completionTokenEstimate: 1000 });
    const direct = calculateActualCost("openai", "gpt-4o", 2000, 1000);
    expect(est.estimatedCost).toBe(direct);
  });

  it("estimateCost returns 0 for unknown model even with estimates", () => {
    const est = estimateCost({ provider: "ghost", model: "phantom", promptTokenEstimate: 5000, completionTokenEstimate: 5000 });
    expect(est.estimatedCost).toBe(0);
    expect(est.estimatedPromptTokens).toBe(5000);
    expect(est.estimatedCompletionTokens).toBe(5000);
  });
});

// ── 2. TOKEN ESTIMATION ─────────────────────────────────────────

describe("token estimation", () => {

  it("estimatePromptTokens counts role overhead", () => {
    const msgs = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "world" },
    ];
    const tokens = estimatePromptTokens(msgs);
    // user=4 chars + 2 overhead = 6, "hello"=5 = 11
    // assistant=9 chars + 2 overhead = 11, "world"=5 = 16
    // total chars = 27, tokens = ceil(27 * 0.25) = ceil(6.75) = 7
    expect(tokens).toBe(7);
  });

  it("estimatePromptTokens handles empty messages", () => {
    expect(estimatePromptTokens([])).toBe(0);
  });

  it("estimatePromptTokens handles long content", () => {
    const msg = { role: "user", content: "a".repeat(1000) };
    const tokens = estimatePromptTokens([msg]);
    const chars = "user".length + 2 + 1000;
    expect(tokens).toBe(Math.ceil(chars * 0.25));
  });

  it("estimateCompletionTokens counts output", () => {
    expect(estimateCompletionTokens("hello world")).toBe(Math.ceil(11 * 0.25));
  });

  it("estimateCompletionTokens returns 0 for empty", () => {
    expect(estimateCompletionTokens("")).toBe(0);
  });

  it("estimateCost uses provided token estimates", () => {
    const est = estimateCost({ provider: "openai", model: "gpt-4o-mini", promptTokenEstimate: 100, completionTokenEstimate: 200 });
    expect(est.estimatedPromptTokens).toBe(100);
    expect(est.estimatedCompletionTokens).toBe(200);
  });

  it("estimateCost falls back to 500 when no estimates given", () => {
    const est = estimateCost({ provider: "openai", model: "gpt-4o-mini" });
    expect(est.estimatedPromptTokens).toBe(500);
    expect(est.estimatedCompletionTokens).toBe(500);
  });
});

// ── 3. END-TO-END USAGE PROPAGATION ─────────────────────────────

describe("usage propagation end-to-end", () => {

  it("full flow: provider usage → cost → record → summary", () => {
    // Simulate what the pipeline does
    const providerUsage = { promptTokens: 1500, completionTokens: 300, totalTokens: 1800 };
    const provider = "openai";
    const model = "gpt-4o-mini";

    const actualCost = calculateActualCost(provider, model, providerUsage.promptTokens, providerUsage.completionTokens);

    const record = createUsageRecord({
      projectId: "proj-e2e",
      userId: "u1",
      sessionId: "sess-1",
      taskType: "blueprint",
      provider,
      model,
      estimatedPromptTokens: 500,
      estimatedCompletionTokens: 500,
      estimatedCost: 0.001,
      actualPromptTokens: providerUsage.promptTokens,
      actualCompletionTokens: providerUsage.completionTokens,
      status: "completed",
    });

    expect(record.actualPromptTokens).toBe(1500);
    expect(record.actualCompletionTokens).toBe(300);
    expect(record.actualTotalTokens).toBe(1800);
    expect(record.actualCost).toBe(actualCost);

    const store = createInMemoryUsageStore();
    store.insertRecord(record);
    const summary = buildSummary(store.getAllRecords());

    expect(summary.totalGenerations).toBe(1);
    expect(summary.totalTokens).toBe(1800);
    expect(summary.totalCost).toBe(actualCost);
    expect(summary.byProvider["openai"].generations).toBe(1);
    expect(summary.byModel["openai/gpt-4o-mini"]).toBeDefined();
  });

  it("multiple records aggregate correctly", () => {
    const store = createInMemoryUsageStore();
    store.insertRecord(createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "blueprint",
      provider: "openai", model: "gpt-4o-mini",
      estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.01,
      status: "completed", actualPromptTokens: 100, actualCompletionTokens: 50,
    }));
    store.insertRecord(createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "roadmap",
      provider: "anthropic", model: "claude-sonnet-4-20250514",
      estimatedPromptTokens: 200, estimatedCompletionTokens: 100, estimatedCost: 0.02,
      status: "completed", actualPromptTokens: 200, actualCompletionTokens: 100,
    }));
    store.insertRecord(createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "blueprint",
      provider: "opencode-go", model: "deepseek-v4-flash",
      estimatedPromptTokens: 50, estimatedCompletionTokens: 25, estimatedCost: 0,
      status: "completed", actualPromptTokens: 50, actualCompletionTokens: 25,
    }));

    const summary = buildSummary(store.getAllRecords());
    expect(summary.totalGenerations).toBe(3);
    expect(summary.totalTokens).toBe(525);
    expect(summary.byProvider["openai"]).toBeDefined();
    expect(summary.byProvider["anthropic"]).toBeDefined();
    expect(summary.byProvider["opencode-go"]).toBeDefined();
    expect(summary.byTaskType["blueprint"]).toBeDefined();
    expect(summary.byTaskType["roadmap"]).toBeDefined();
  });

  it("retry attempts tracked separately from successful", () => {
    const store = createInMemoryUsageStore();
    store.insertRecord(createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "blueprint",
      provider: "openai", model: "gpt-4o",
      estimatedPromptTokens: 500, estimatedCompletionTokens: 300, estimatedCost: 0.01,
      status: "failed", retryAttempt: 1,
      actualPromptTokens: 500, actualCompletionTokens: 300,
    }));
    store.insertRecord(createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "blueprint",
      provider: "openai", model: "gpt-4o",
      estimatedPromptTokens: 500, estimatedCompletionTokens: 300, estimatedCost: 0.01,
      status: "completed",
      actualPromptTokens: 500, actualCompletionTokens: 300,
    }));

    const summary = buildSummary(store.getAllRecords());
    const diag = buildDiagnostics(store.getAllRecords());

    expect(summary.totalGenerations).toBe(2);
    expect(summary.totalTokens).toBe(1600);
    expect(diag.failedAttempts).toBe(1);
    expect(diag.recordsWithRetries).toBe(1);
  });

  it("fallback attempts use different provider pricing", () => {
    const store = createInMemoryUsageStore();
    // Primary: openai/gpt-4o (failed, expensive prompt)
    store.insertRecord(createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "blueprint",
      provider: "openai", model: "gpt-4o",
      estimatedPromptTokens: 1000, estimatedCompletionTokens: 0, estimatedCost: 0.01,
      status: "failed", fallbackAttempt: 0,
      actualPromptTokens: 1000, actualCompletionTokens: 0,
    }));
    // Fallback: openai/gpt-4o-mini (succeeded, cheaper)
    store.insertRecord(createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "blueprint",
      provider: "openai", model: "gpt-4o-mini",
      estimatedPromptTokens: 1000, estimatedCompletionTokens: 500, estimatedCost: 0.01,
      status: "completed", fallbackAttempt: 1,
      actualPromptTokens: 1000, actualCompletionTokens: 500,
    }));

    const diag = buildDiagnostics(store.getAllRecords());
    const summary = buildSummary(store.getAllRecords());

    expect(diag.failedAttempts).toBe(1);
    expect(diag.recordsWithFallbacks).toBe(1);
    expect(summary.totalGenerations).toBe(2);
    // gpt-4o cost: (1000/1000)*0.0025 + 0 = 0.0025
    // gpt-4o-mini cost: (1000/1000)*0.00015 + (500/1000)*0.0006 = 0.00015 + 0.0003 = 0.00045
    expect(summary.totalCost).toBeGreaterThan(0);
    expect(summary.byProvider["openai"].generations).toBe(2);
  });
});

// ── 4. STREAMING ACCUMULATION HARDENING ─────────────────────────

describe("streaming accumulation hardening", () => {

  it("accumulates across many small chunks", () => {
    let acc = createAccumulatedUsage();
    for (let i = 0; i < 100; i++) {
      acc = accumulateUsage(acc, { promptTokens: 1, completionTokens: 2 });
    }
    expect(acc.promptTokens).toBe(100);
    expect(acc.completionTokens).toBe(200);
    expect(acc.totalTokens).toBe(300);
  });

  it("accumulates with only prompt tokens (no completion yet)", () => {
    let acc = createAccumulatedUsage();
    acc = accumulateUsage(acc, { promptTokens: 50 });
    expect(acc.promptTokens).toBe(50);
    expect(acc.completionTokens).toBe(0);
    expect(acc.totalTokens).toBe(50);
  });

  it("accumulates with only completion tokens (streaming output)", () => {
    let acc = createAccumulatedUsage();
    acc = accumulateUsage(acc, { completionTokens: 5 });
    acc = accumulateUsage(acc, { completionTokens: 10 });
    acc = accumulateUsage(acc, { completionTokens: 3 });
    expect(acc.promptTokens).toBe(0);
    expect(acc.completionTokens).toBe(18);
    expect(acc.totalTokens).toBe(18);
  });

  it("survives interruption mid-stream", () => {
    let acc = createAccumulatedUsage();
    acc = accumulateUsage(acc, { promptTokens: 100, completionTokens: 0 });
    acc = accumulateUsage(acc, { completionTokens: 20 });
    acc = accumulateUsage(acc, { completionTokens: 15 });
    // Simulate interruption — data before interruption is preserved
    expect(acc.promptTokens).toBe(100);
    expect(acc.completionTokens).toBe(35);
    expect(acc.totalTokens).toBe(135);
  });
});

// ── 5. ATTEMPT ACCOUNTING HARDENING ─────────────────────────────

describe("attempt accounting hardening", () => {

  const makeAttempt = (overrides: Partial<UsageAttempt> & { provider: string; model: string }): UsageAttempt => ({
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    durationMs: 0,
    success: true,
    ...overrides,
  });

  it("sumAttempts sums across mixed success/failure", () => {
    const attempts: UsageAttempt[] = [
      makeAttempt({ provider: "openai", model: "gpt-4o", usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }, success: false }),
      makeAttempt({ provider: "openai", model: "gpt-4o-mini", usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }, success: true }),
      makeAttempt({ provider: "anthropic", model: "claude-sonnet-4-20250514", usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 }, success: false }),
    ];
    const total = sumAttempts(attempts);
    expect(total.promptTokens).toBe(400);
    expect(total.completionTokens).toBe(200);
    expect(total.totalTokens).toBe(600);
  });

  it("sumSuccessfulAttempts only counts successful", () => {
    const attempts: UsageAttempt[] = [
      makeAttempt({ provider: "openai", model: "gpt-4o", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, success: false }),
      makeAttempt({ provider: "openai", model: "gpt-4o", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, success: true }),
    ];
    const s = sumSuccessfulAttempts(attempts);
    expect(s.promptTokens).toBe(10);
    expect(s.completionTokens).toBe(5);
  });

  it("sumFailedAttempts only counts failed", () => {
    const attempts: UsageAttempt[] = [
      makeAttempt({ provider: "openai", model: "gpt-4o", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, success: false }),
      makeAttempt({ provider: "openai", model: "gpt-4o", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, success: true }),
    ];
    const f = sumFailedAttempts(attempts);
    expect(f.promptTokens).toBe(10);
    expect(f.completionTokens).toBe(5);
  });

  it("empty attempts sum to zero", () => {
    const total = sumAttempts([]);
    expect(total.promptTokens).toBe(0);
    expect(total.completionTokens).toBe(0);
    expect(total.totalTokens).toBe(0);
  });
});

// ── 6. MISSING / INCONSISTENT METADATA ──────────────────────────

describe("missing and inconsistent metadata", () => {

  it("handles unknown model name gracefully", () => {
    const cost = calculateActualCost("openai", "completely-unknown-model", 100, 50);
    expect(cost).toBe(0);
  });

  it("handles empty string model and provider", () => {
    const cost = calculateActualCost("", "", 100, 50);
    expect(cost).toBe(0);
  });

  it("createUsageRecord allows null actuals for estimated records", () => {
    const r = createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "summary",
      provider: "openai", model: "gpt-4o-mini",
      estimatedPromptTokens: 500, estimatedCompletionTokens: 200, estimatedCost: 0.001,
      status: "estimated",
    });
    expect(r.actualPromptTokens).toBeNull();
    expect(r.actualCompletionTokens).toBeNull();
    expect(r.actualTotalTokens).toBeNull();
    expect(r.actualCost).toBeNull();
  });

  it("createUsageRecord accepts partial actuals", () => {
    const r = createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "blueprint",
      provider: "openai", model: "gpt-4o",
      estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.01,
      actualPromptTokens: 100,
      // actualCompletionTokens omitted
      status: "completed",
    });
    expect(r.actualPromptTokens).toBe(100);
    expect(r.actualCompletionTokens).toBeNull();
    expect(r.actualTotalTokens).toBeNull();
  });

  it("buildSummary does not crash on records with all-null actuals", () => {
    const store = createInMemoryUsageStore();
    store.insertRecord(createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "summary",
      provider: "openai", model: "gpt-4o-mini",
      estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.001,
      status: "estimated",
    }));
    const s = buildSummary(store.getAllRecords());
    expect(s.totalGenerations).toBe(1);
    expect(s.totalTokens).toBe(0);
    expect(s.totalCost).toBe(0);
  });

  it("mixed records with and without actuals build correct summary", () => {
    const store = createInMemoryUsageStore();
    store.insertRecord(createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "blueprint",
      provider: "openai", model: "gpt-4o",
      estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.01,
      status: "completed",
      actualPromptTokens: 100, actualCompletionTokens: 50,
    }));
    store.insertRecord(createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "blueprint",
      provider: "openai", model: "gpt-4o",
      estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.01,
      status: "estimated",
    }));
    const s = buildSummary(store.getAllRecords());
    expect(s.totalGenerations).toBe(2);
    expect(s.totalTokens).toBe(150); // only the completed record counts tokens
    expect(s.byProvider["openai"].generations).toBe(2);
    expect(s.byProvider["openai"].tokens).toBe(150);
  });

  it("buildDiagnostics counts missing cost and tokens", () => {
    const store = createInMemoryUsageStore();
    store.insertRecord(createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "blueprint",
      provider: "openai", model: "gpt-4o",
      estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.01,
      status: "failed",
    }));
    const diag = buildDiagnostics(store.getAllRecords());
    expect(diag.recordsWithMissingCost).toBe(1);
    expect(diag.recordsWithMissingTokens).toBe(1);
    expect(diag.recordsWithMissingModel).toBe(0);
    expect(diag.recordsWithMissingProvider).toBe(0);
  });

  it("interrupted streaming (partial data) preserved in diagnostics", () => {
    // Simulate: streaming started, got some output tokens, then failed
    const store = createInMemoryUsageStore();
    store.insertRecord(createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "blueprint",
      provider: "openai", model: "gpt-4o",
      estimatedPromptTokens: 1000, estimatedCompletionTokens: 500, estimatedCost: 0.01,
      status: "failed",
      actualPromptTokens: 1000, actualCompletionTokens: 200, // only partial completion
    }));
    const diag = buildDiagnostics(store.getAllRecords());
    expect(diag.failedAttempts).toBe(1);
    expect(diag.totalRecords).toBe(1);

    const summary = buildSummary(store.getAllRecords());
    expect(summary.totalTokens).toBe(1200); // 1000 prompt + 200 partial completion
  });
});

// ── 7. REGRESSION: NO HARDCODED PRICING ─────────────────────────

describe("regression: no hardcoded pricing in production paths", () => {

  it("estimateCost always uses centralized pricing", () => {
    // If getPricing returns undefined, cost is 0
    // If getPricing returns pricing, cost is derived from it
    // Neither path uses hardcoded dollar values
    const withPricing = estimateCost({ provider: "openai", model: "gpt-4o-mini", promptTokenEstimate: 1000, completionTokenEstimate: 500 });
    const pricing = getPricing("openai", "gpt-4o-mini")!;
    const expectedPromptCost = (1000 / 1000) * pricing.promptPricePer1K;
    const expectedCompletionCost = (500 / 1000) * pricing.completionPricePer1K;
    expect(withPricing.estimatedCost).toBe(
      Math.round((expectedPromptCost + expectedCompletionCost) * 1_000_000) / 1_000_000,
    );
  });

  it("calculateActualCost delegates to getPricing", () => {
    // Spy on the connection: calculateActualCost calls getPricing internally
    // We verify by checking known pricing produces expected output
    const cost = calculateActualCost("openai", "gpt-4o-mini", 1000, 500);
    const expected = (1000 / 1000) * 0.00015 + (500 / 1000) * 0.0006;
    expect(cost).toBe(0.00045);
  });

  it("estimator and pricing are connected (calculateActualCost calls getPricing)", () => {
    // If they were disconnected, calling calculateActualCost with known pricing would return 0
    const cost = calculateActualCost("openai", "gpt-4o", 2000, 1000);
    expect(cost).toBeGreaterThan(0);
    // Verify exact: (2000/1000)*0.0025 + (1000/1000)*0.01 = 0.005 + 0.01 = 0.015
    expect(cost).toBe(0.015);
  });

  it("estimateCost and calculateActualCost agree for same tokens", () => {
    const est = estimateCost({ provider: "openai", model: "gpt-4o", promptTokenEstimate: 1500, completionTokenEstimate: 300 });
    const actual = calculateActualCost("openai", "gpt-4o", 1500, 300);
    expect(est.estimatedCost).toBe(actual);
  });
});

// ── 8. USAGE STORE CONSISTENCY ──────────────────────────────────

describe("usage store consistency", () => {

  it("inserted records are retrievable by all accessors", () => {
    const store = createInMemoryUsageStore();
    const r = createUsageRecord({
      projectId: "p1", userId: "u1", sessionId: "s1", taskType: "blueprint",
      provider: "openai", model: "gpt-4o",
      estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.01,
      status: "completed",
      actualPromptTokens: 100, actualCompletionTokens: 50,
    });
    store.insertRecord(r);

    expect(store.getRecordsByProject("p1")).toHaveLength(1);
    expect(store.getRecordsByUser("u1")).toHaveLength(1);
    expect(store.getAllRecords()).toHaveLength(1);
    expect(store.getRecordsByProject("nonexistent")).toHaveLength(0);
    expect(store.getRecordsByUser("nonexistent")).toHaveLength(0);
  });

  it("allRecords returns independent copy", () => {
    const store = createInMemoryUsageStore();
    store.insertRecord(createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "blueprint",
      provider: "openai", model: "gpt-4o",
      estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.01,
      status: "completed",
      actualPromptTokens: 100, actualCompletionTokens: 50,
    }));
    const all = store.getAllRecords();
    all.pop();
    expect(store.getAllRecords()).toHaveLength(1); // original unchanged
  });
});

// ── 9. FUTURE SCALABILITY ASSUMPTIONS ───────────────────────────

describe("future scalability", () => {

  it("multi-provider pricing coexists without conflicts", () => {
    // Same model name across providers should have different pricing
    // (Different providers charge different rates)
    const gpt4oOpenAI = getPricing("openai", "gpt-4o");
    const gpt4oOpenRouter = getPricing("openrouter", "openai/gpt-4o");
    expect(gpt4oOpenAI).toBeDefined();
    expect(gpt4oOpenRouter).toBeDefined();
    // They happen to have same pricing in this config, but should exist independently
    expect(gpt4oOpenAI!.provider).toBe("openai");
    expect(gpt4oOpenRouter!.provider).toBe("openrouter");
  });

  it("local model entries work with zero cost", () => {
    // Simulate adding a local model like Ollama
    const localCost = calculateActualCost("ollama", "llama3", 5000, 5000);
    expect(localCost).toBe(0); // not in pricing table yet
    // When added as { provider: "ollama", model: "llama3", promptPricePer1K: 0, completionPricePer1K: 0 }
    // it would return 0 — already handled correctly
  });

  it("batch generation records aggregate independently", () => {
    const store = createInMemoryUsageStore();

    // Simulate 5 generations in a batch
    for (let i = 0; i < 5; i++) {
      store.insertRecord(createUsageRecord({
        projectId: "batch-proj", userId: "u1", taskType: "blueprint",
        provider: "openai", model: "gpt-4o-mini",
        estimatedPromptTokens: 100, estimatedCompletionTokens: 50, estimatedCost: 0.001,
        status: "completed",
        actualPromptTokens: 100, actualCompletionTokens: 50,
      }));
    }

    const summary = buildSummary(store.getAllRecords());
    expect(summary.totalGenerations).toBe(5);
    expect(summary.totalTokens).toBe(750); // 5 * 150
    expect(summary.byProvider["openai"].generations).toBe(5);
  });

  it("routing systems can use UsageRecord fields for decision feedback", () => {
    const r = createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "blueprint",
      provider: "opencode-go", model: "deepseek-v4-flash",
      estimatedPromptTokens: 500, estimatedCompletionTokens: 500, estimatedCost: 0,
      status: "completed",
      actualPromptTokens: 450, actualCompletionTokens: 600,
      retryAttempt: 2,
      fallbackAttempt: 0,
    });

    // Router feedback data points:
    expect(r.provider).toBe("opencode-go");
    expect(r.model).toBe("deepseek-v4-flash");
    expect(r.actualTotalTokens).toBe(1050);
    expect(r.actualCost).toBe(0);
    expect(r.status).toBe("completed");
    expect(r.retryAttempt).toBe(2); // needed 2 retries — poor reliability signal
  });
});

// ── 10. RECORD COST ROUND-TRIPPING ──────────────────────────────

describe("cost round-tripping", () => {

  it("calculateActualCost cost can be reconstructed from record data", () => {
    const record = createUsageRecord({
      projectId: "p1", userId: "u1", taskType: "blueprint",
      provider: "openai", model: "gpt-4o",
      estimatedPromptTokens: 500, estimatedCompletionTokens: 500, estimatedCost: 0.01,
      status: "completed",
      actualPromptTokens: 1000, actualCompletionTokens: 500,
    });

    // Reconstruct cost from the stored token data
    const reconstructedCost = calculateActualCost(
      record.provider,
      record.model,
      record.actualPromptTokens!,
      record.actualCompletionTokens!,
    );
    expect(reconstructedCost).toBe(record.actualCost);
  });

  it("different provider for same tokens gives different cost", () => {
    const openAICost = calculateActualCost("openai", "gpt-4o", 1000, 500);
    const anthropicCost = calculateActualCost("anthropic", "claude-sonnet-4-20250514", 1000, 500);
    // gpt-4o: (1000/1000)*0.0025 + (500/1000)*0.01 = 0.0025 + 0.005 = 0.0075
    // claude-sonnet-4: (1000/1000)*0.003 + (500/1000)*0.015 = 0.003 + 0.0075 = 0.0105
    expect(openAICost).toBe(0.0075);
    expect(anthropicCost).toBe(0.0105);
    expect(anthropicCost).toBeGreaterThan(openAICost);
  });

  it("cost precision is consistent at 6 decimal places", () => {
    const cost = calculateActualCost("openai", "gpt-4o-mini", 1, 1);
    // (1/1000)*0.00015 + (1/1000)*0.0006 = 0.00000015 + 0.0000006 = 0.00000075
    // Math.round(0.00000075 * 1_000_000) / 1_000_000 = Math.round(0.75) / 1_000_000 = 1 / 1_000_000 = 0.000001
    expect(cost).toBe(0.000001);
  });
});
