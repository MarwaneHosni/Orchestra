import { describe, expect, it, beforeEach } from "vitest";
import { BudgetEnforcer, createInMemoryBudgetStore } from "./budget.js";
import { InMemoryRateLimiter } from "./rate-limiter.js";
import { classifyFailure, createRetryState, shouldRetry, computeBackoff } from "./failure-handler.js";

describe("BudgetEnforcer", () => {
  let store: ReturnType<typeof createInMemoryBudgetStore>;
  let budget: BudgetEnforcer;

  beforeEach(() => {
    store = createInMemoryBudgetStore();
    budget = new BudgetEnforcer(store);
  });

  it("allows generation under budget", () => {
    const result = budget.checkGeneration("proj-1", 0.001, 500);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("blocks generation that exceeds cost budget", () => {
    budget.setProjectBudget("proj-1", { maxEstimatedCost: 0.01 });
    // Record a completion that uses most of the budget
    budget.recordOutcome("proj-1", 0.009, 100, "completed");
    const result = budget.checkGeneration("proj-1", 0.005, 100);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("exceed remaining budget");
  });

  it("blocks generation that exceeds monthly generation limit", () => {
    budget.setProjectBudget("proj-1", { maxGenerationsPerMonth: 2 });
    budget.recordOutcome("proj-1", 0, 0, "completed");
    budget.recordOutcome("proj-1", 0, 0, "completed");
    const result = budget.checkGeneration("proj-1", 0.001, 100);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("monthly limit");
  });

  it("allows generation right at the limit", () => {
    budget.setProjectBudget("proj-1", { maxEstimatedCost: 0.02 });
    const result = budget.checkGeneration("proj-1", 0.02, 100);
    expect(result.allowed).toBe(true);
  });

  it("uses defaults when no budget config is set", () => {
    const result = budget.checkGeneration("unknown-proj", 10, 5000);
    expect(result.allowed).toBe(true);
    expect(result.remainingBudget).toBe(50);
  });

  it("records failed generations without counting tokens", () => {
    budget.setProjectBudget("proj-1", { maxEstimatedCost: 1 });
    budget.recordOutcome("proj-1", 0, 0, "failed");
    const result = budget.checkGeneration("proj-1", 0.5, 100);
    expect(result.allowed).toBe(true);
    expect(result.currentMonthGenerations).toBe(1);
    expect(result.currentMonthCost).toBe(0);
  });

  it("enforces user-level budget separately from project", () => {
    budget.setUserBudget("user-1", { maxEstimatedCost: 0.02 });
    budget.setProjectBudget("proj-1", { maxEstimatedCost: 0.1 });
    // Use up user budget
    budget.recordOutcome("user:user-1", 0.02, 100, "completed");
    const userCheck = budget.checkGeneration("user:user-1", 0.01, 100);
    expect(userCheck.allowed).toBe(false);

    // Project budget is separate
    const projectCheck = budget.checkGeneration("proj-1", 0.01, 100);
    expect(projectCheck.allowed).toBe(true);
  });

  it("checkProjectAndUser returns checks for both scopes", () => {
    budget.setUserBudget("user-1", { maxEstimatedCost: 0.01 });
    budget.setProjectBudget("proj-1", { maxEstimatedCost: 0.1 });
    const results = budget.checkProjectAndUser("proj-1", "user-1", 0.05, 100);
    expect(results).toHaveLength(2);
    // User budget is tight
    expect(results[1].allowed).toBe(false);
    // Project budget has room
    expect(results[0].allowed).toBe(true);
  });
});

describe("InMemoryRateLimiter", () => {
  it("allows requests within limit", () => {
    const limiter = new InMemoryRateLimiter({ maxRequests: 3, windowMs: 60_000 });
    expect(limiter.check("key-1").allowed).toBe(true);
    expect(limiter.check("key-1").allowed).toBe(true);
    expect(limiter.check("key-1").allowed).toBe(true);
  });

  it("blocks requests exceeding limit", () => {
    const limiter = new InMemoryRateLimiter({ maxRequests: 2, windowMs: 60_000 });
    limiter.check("key-1");
    limiter.check("key-1");
    const result = limiter.check("key-1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Rate limit exceeded");
  });

  it("reports remaining count", () => {
    const limiter = new InMemoryRateLimiter({ maxRequests: 5, windowMs: 60_000 });
    limiter.check("key-1");
    limiter.check("key-1");
    const result = limiter.check("key-1");
    expect(result.remaining).toBe(2);
  });

  it("resets after window expires", () => {
    const limiter = new InMemoryRateLimiter({ maxRequests: 1, windowMs: 50 });
    limiter.check("key-1");
    const blocked = limiter.check("key-1");
    expect(blocked.allowed).toBe(false);
    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const allowed = limiter.check("key-1");
        expect(allowed.allowed).toBe(true);
        resolve();
      }, 60);
    });
  });

  it("uses separate windows per key", () => {
    const limiter = new InMemoryRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    limiter.check("user-a");
    expect(limiter.check("user-a").allowed).toBe(false);
    expect(limiter.check("user-b").allowed).toBe(true);
  });

  it("can be reset manually", () => {
    const limiter = new InMemoryRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    limiter.check("key-1");
    limiter.reset("key-1");
    expect(limiter.check("key-1").allowed).toBe(true);
  });
});

describe("classifyFailure", () => {
  it("classifies 429 as fallback_eligible", () => {
    const result = classifyFailure({ statusCode: 429 });
    expect(result.category).toBe("fallback_eligible");
  });

  it("classifies 5xx as retryable", () => {
    const result = classifyFailure({ statusCode: 503 });
    expect(result.category).toBe("retryable");
  });

  it("classifies 401 as terminal", () => {
    const result = classifyFailure({ statusCode: 401 });
    expect(result.category).toBe("terminal");
    expect(result.message).toContain("API key");
  });

  it("classifies 400 as terminal", () => {
    const result = classifyFailure({ statusCode: 400 });
    expect(result.category).toBe("terminal");
  });

  it("classifies TypeError(fetch) as retryable", () => {
    const err = new TypeError("fetch failed");
    const result = classifyFailure(err);
    expect(result.category).toBe("retryable");
  });

  it("classifies TypeError(abort) as retryable", () => {
    const err = new TypeError("The operation was aborted");
    const result = classifyFailure(err);
    expect(result.category).toBe("retryable");
  });

  it("classifies unknown errors as terminal", () => {
    const result = classifyFailure("unknown string error");
    expect(result.category).toBe("terminal");
  });
});

describe("retry helpers", () => {
  it("shouldRetry returns true when under max", () => {
    const state = createRetryState();
    expect(shouldRetry(state)).toBe(true);
  });

  it("shouldRetry returns false at max", () => {
    const state = createRetryState();
    state.attempt = 3;
    expect(shouldRetry(state)).toBe(false);
  });

  it("computeBackoff doubles delay each time", () => {
    const state = createRetryState();
    expect(computeBackoff(state)).toBe(1000);
    expect(computeBackoff(state)).toBe(2000);
    expect(computeBackoff(state)).toBe(4000);
  });

  it("computeBackoff caps at 30s", () => {
    const state = createRetryState();
    for (let i = 0; i < 10; i++) computeBackoff(state);
    expect(state.nextDelayMs).toBe(30_000);
  });
});
