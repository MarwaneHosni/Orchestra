import { describe, expect, it, beforeEach, beforeAll } from "vitest";
import { OrchestrationService } from "../orchestration/orchestration.service.js";
import { createInMemoryStore, replaceStore } from "../orchestration/store.js";
import { getCredentialStore, encryptKey } from "../credentials/store.js";

const TEST_ENCRYPTION_KEY = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
});
import { RouterService } from "../router/router.js";
import {
  estimateCost,
  createUsageRecord,
  createInMemoryUsageStore,
  buildSummary,
} from "../accounting/index.js";
import { BudgetEnforcer, createInMemoryBudgetStore } from "../budget/budget.js";
import { redactValue } from "../audit/redactor.js";

describe("BYOK E2E — provider onboarding", () => {
  beforeEach(() => {
    replaceStore(createInMemoryStore());
  });

  it("connects a provider, validates it, and lists it without exposing secrets", () => {
    const store = getCredentialStore();
    const encrypted = encryptKey("sk-test-secret-key-12345");

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    store.insert({
      id,
      userId: "user-1",
      projectId: null,
      provider: "openai",
      displayName: "My Key",
      status: "unverified",
      encryptedApiKey: encrypted,
      keyReference: null,
      defaultModel: "gpt-4o",
      modelsAvailable: null,
      lastVerifiedAt: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });

    const listed = store.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]!.status).toBe("unverified");
    expect(listed[0]!.provider).toBe("openai");
    expect((listed[0] as any).encryptedApiKey).toBeUndefined();
    expect((listed[0] as any).keyReference).toBeUndefined();

    store.update(id, { status: "valid", lastVerifiedAt: now });
    const validated = store.get(id);
    expect(validated!.status).toBe("valid");
  });
});

describe("BYOK E2E — routing + cost estimation", () => {
  it("selects a model and estimates cost before generation", () => {
    const status = () => ({ provider: "", available: true, validatedAt: new Date().toISOString() });
    const router = new RouterService(status);
    const decision = router.select("architecture");

    expect(decision.selection).toBeDefined();
    expect(decision.reasoning.length).toBeGreaterThan(0);

    const est = estimateCost({
      provider: decision.selection.provider,
      model: decision.selection.model,
      promptTokenEstimate: 2000,
      completionTokenEstimate: 2000,
    });

    expect(est.estimatedCost).toBeGreaterThan(0);
    expect(est.estimatedPromptTokens).toBe(2000);
    expect(est.estimatedCompletionTokens).toBe(2000);
    expect(est.model).toBe(decision.selection.model);
  });
});

describe("BYOK E2E — budget enforcement", () => {
  it("blocks generation when budget is exceeded", () => {
    const store = createInMemoryBudgetStore();
    const budget = new BudgetEnforcer(store);

    budget.setProjectBudget("proj-e2e", { maxEstimatedCost: 0.01 });
    const check1 = budget.checkGeneration("proj-e2e", 0.008, 500);
    expect(check1.allowed).toBe(true);

    budget.recordOutcome("proj-e2e", 0.008, 500, "completed");

    const check2 = budget.checkGeneration("proj-e2e", 0.005, 500);
    expect(check2.allowed).toBe(false);
    expect(check2.reason).toContain("exceed remaining budget");
  });

  it("does not count failed generations against token budget", () => {
    const store = createInMemoryBudgetStore();
    const budget = new BudgetEnforcer(store);

    budget.setProjectBudget("proj-e2e", { maxEstimatedCost: 0.05 });
    budget.recordOutcome("proj-e2e", 0, 0, "failed");

    const check = budget.checkGeneration("proj-e2e", 0.04, 1000);
    expect(check.allowed).toBe(true);
    expect(check.currentMonthGenerations).toBe(1);
    expect(check.currentMonthCost).toBe(0);
  });
});

describe("BYOK E2E — usage recording + summary", () => {
  it("records usage after generation and builds a summary", () => {
    const usageStore = createInMemoryUsageStore();

    const record = createUsageRecord({
      projectId: "proj-e2e",
      userId: "user-1",
      sessionId: "sess-1",
      taskType: "architecture",
      provider: "openai",
      model: "gpt-4o",
      estimatedPromptTokens: 2000,
      estimatedCompletionTokens: 1000,
      estimatedCost: 0.015,
      status: "completed",
      actualPromptTokens: 1800,
      actualCompletionTokens: 900,
    });
    usageStore.insertRecord(record);

    const summary = buildSummary(usageStore.getRecordsByProject("proj-e2e"));
    expect(summary.totalGenerations).toBe(1);
    expect(summary.totalTokens).toBe(2700);
    expect(summary.byProvider["openai"]).toBeDefined();
    expect(summary.byTaskType["architecture"]).toBeDefined();
    expect(summary.byProvider["openai"].generations).toBe(1);
  });
});

describe("BYOK E2E — routing fallback on provider failure", () => {
  it("falls back to alternate provider when primary is unavailable", () => {
    const status = (p: string) => ({
      provider: p,
      available: p === "anthropic",
      validatedAt: p === "anthropic" ? new Date().toISOString() : null,
    });
    const router = new RouterService(status);

    const decision = router.select("clarification");
    expect(decision.selection.provider).toBe("anthropic");
  });

  it("throws when all providers are unavailable", () => {
    const status = () => ({ provider: "", available: false, validatedAt: null });
    const router = new RouterService(status);
    expect(() => router.select("roadmap")).toThrow("No available provider");
  });
});

describe("BYOK E2E — audit logging + redaction", () => {
  it("redacts sensitive values even in error paths", () => {
    const result = redactValue("apiKey", "sk-this-is-a-secret-key-value");
    expect(result).toBe("[REDACTED]");
  });
});

describe("BYOK E2E — generation flow (orchestration integration)", () => {
  it("creates project, answers questions, generates blueprint", () => {
    const store = createInMemoryStore();
    const orch = new OrchestrationService(store);

    const { sessionId } = orch.createProject({ ideaText: "An E2E test project for BYOK verification" });
    orch.startSession(sessionId);

    for (let i = 0; i < 100; i++) {
      const result = orch.getNextQuestion(sessionId);
      if (!result.question) break;
      orch.submitAnswer(
        sessionId,
        (result.question as any).id,
        "E2E test answer with sufficient detail.",
        "high",
      );
    }

    const final = orch.getNextQuestion(sessionId);
    expect(final.question).toBeNull();
    expect(final.answered).toBeGreaterThanOrEqual(final.total);

    const output = orch.generateBlueprint(sessionId) as any;
    expect(output.phases).toHaveLength(12);
    expect(output.overallConfidence).toBeGreaterThan(0);

    const session = store.getSession(sessionId);
    expect(session!.status).toBe("completed");
  });
});
