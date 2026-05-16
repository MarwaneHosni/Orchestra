import { describe, expect, it } from "vitest";
import {
  estimateCost,
  createUsageRecord,
  createInMemoryUsageStore,
  buildSummary,
} from "../accounting/index.js";
import { BudgetEnforcer, createInMemoryBudgetStore } from "../budget/budget.js";
import { RouterService } from "../router/router.js";

describe("Provider routing + usage accounting — connected", () => {
  it("routes a task, estimates cost, enforces budget, records usage", () => {
    const status = () => ({ provider: "", available: true, validatedAt: new Date().toISOString() });
    const router = new RouterService(status);
    const decision = router.select("architecture");

    expect(decision.selection).toBeDefined();
    expect(decision.selection.provider.length).toBeGreaterThan(0);
    expect(decision.selection.model.length).toBeGreaterThan(0);

    const est = estimateCost({
      provider: decision.selection.provider,
      model: decision.selection.model,
      promptTokenEstimate: 2000,
      completionTokenEstimate: 1000,
    });
    expect(est.estimatedCost).toBeGreaterThan(0);

    const budgetStore = createInMemoryBudgetStore();
    const budget = new BudgetEnforcer(budgetStore);
    budget.setProjectBudget("proj-budget", { maxEstimatedCost: 0.05 });

    const check = budget.checkGeneration("proj-budget", est.estimatedCost, est.estimatedPromptTokens);
    expect(check.allowed).toBe(true);

    const usageStore = createInMemoryUsageStore();
    const record = createUsageRecord({
      projectId: "proj-budget",
      userId: "user-1",
      sessionId: "sess-1",
      taskType: "architecture",
      provider: decision.selection.provider,
      model: decision.selection.model,
      estimatedPromptTokens: est.estimatedPromptTokens,
      estimatedCompletionTokens: est.estimatedCompletionTokens,
      estimatedCost: est.estimatedCost,
      status: "completed",
      actualPromptTokens: 1800,
      actualCompletionTokens: 900,
    });
    usageStore.insertRecord(record);

    const summary = buildSummary(usageStore.getRecordsByProject("proj-budget"));
    expect(summary.totalGenerations).toBe(1);
    expect(summary.totalTokens).toBe(2700);
    expect(summary.byProvider[decision.selection.provider]).toBeDefined();
    expect(summary.byProvider[decision.selection.provider].generations).toBe(1);
    expect(summary.byTaskType["architecture"]).toBeDefined();
  });

  it("enforces budget across multiple generations and blocks when exceeded", () => {
    const budgetStore = createInMemoryBudgetStore();
    const usageStore = createInMemoryUsageStore();
    const budget = new BudgetEnforcer(budgetStore);
    const router = new RouterService(() => ({
      provider: "",
      available: true,
      validatedAt: new Date().toISOString(),
    }));

    budget.setProjectBudget("proj-budget-2", { maxEstimatedCost: 0.03 });
    const decision = router.select("roadmap");

    const est = estimateCost({
      provider: decision.selection.provider,
      model: decision.selection.model,
      promptTokenEstimate: 3000,
      completionTokenEstimate: 2000,
    });

    const check1 = budget.checkGeneration("proj-budget-2", est.estimatedCost, est.estimatedPromptTokens);
    expect(check1.allowed).toBe(true);

    const r1 = createUsageRecord({
      projectId: "proj-budget-2",
      userId: "u-1",
      sessionId: "s-1",
      taskType: "roadmap",
      provider: decision.selection.provider,
      model: decision.selection.model,
      estimatedPromptTokens: est.estimatedPromptTokens,
      estimatedCompletionTokens: est.estimatedCompletionTokens,
      estimatedCost: est.estimatedCost,
      status: "completed",
      actualPromptTokens: 2800,
      actualCompletionTokens: 1900,
    });
    usageStore.insertRecord(r1);
    budget.recordOutcome("proj-budget-2", est.estimatedCost, est.estimatedPromptTokens, "completed");

    const check2 = budget.checkGeneration("proj-budget-2", est.estimatedCost, est.estimatedPromptTokens);
    expect(check2.allowed).toBe(false);
    expect(check2.reason).toContain("exceed");

    budget.recordOutcome("proj-budget-2", 0, 0, "failed");
    const failedRecord = createUsageRecord({
      projectId: "proj-budget-2",
      userId: "u-1",
      sessionId: "s-1",
      taskType: "roadmap",
      provider: decision.selection.provider,
      model: decision.selection.model,
      estimatedPromptTokens: 500,
      estimatedCompletionTokens: 500,
      estimatedCost: 0,
      status: "failed",
    });
    usageStore.insertRecord(failedRecord);

    const summary = buildSummary(usageStore.getRecordsByProject("proj-budget-2"));
    expect(summary.totalGenerations).toBe(2);
    expect(summary.totalTokens).toBe(4700);
  });

  it("tracks usage by provider and task type in summary", () => {
    const usageStore = createInMemoryUsageStore();
    const records = [
      createUsageRecord({
        projectId: "proj-sum",
        userId: "u-1",
        sessionId: "s-1",
        taskType: "architecture",
        provider: "openai",
        model: "gpt-4o",
        estimatedPromptTokens: 1000,
        estimatedCompletionTokens: 500,
        estimatedCost: 0.01,
        status: "completed",
        actualPromptTokens: 1000,
        actualCompletionTokens: 500,
      }),
      createUsageRecord({
        projectId: "proj-sum",
        userId: "u-1",
        sessionId: "s-1",
        taskType: "clarification",
        provider: "anthropic",
        model: "claude-3",
        estimatedPromptTokens: 2000,
        estimatedCompletionTokens: 1000,
        estimatedCost: 0.02,
        status: "completed",
        actualPromptTokens: 2000,
        actualCompletionTokens: 1000,
      }),
    ];
    for (const r of records) usageStore.insertRecord(r);

    const summary = buildSummary(usageStore.getRecordsByProject("proj-sum"));
    expect(summary.totalGenerations).toBe(2);
    expect(summary.totalTokens).toBe(4500);
    expect(Object.keys(summary.byProvider)).toHaveLength(2);
    expect(Object.keys(summary.byTaskType)).toHaveLength(2);
  });

  it("falls back to alternate provider when primary is unavailable", () => {
    const status = (p: string) => ({
      provider: p,
      available: p === "anthropic",
      validatedAt: p === "anthropic" ? new Date().toISOString() : null,
    });
    const router = new RouterService(status);

    const decision = router.select("roadmap");
    expect(decision.selection.provider).toBe("anthropic");
  });

  it("throws when all providers are unavailable", () => {
    const status = () => ({ provider: "", available: false, validatedAt: null });
    const router = new RouterService(status);
    expect(() => router.select("roadmap")).toThrow("No available provider");
  });
});
