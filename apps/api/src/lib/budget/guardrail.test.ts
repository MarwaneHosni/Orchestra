import { describe, expect, it, beforeEach } from "vitest";
import { CircuitBreaker } from "./circuit-breaker.js";
import { AbuseDetector } from "./abuse-detector.js";
import { GuardrailService } from "./guardrail.js";
import { createInMemoryBudgetStore } from "./budget.js";
import { RateLimitedError, OverBudgetError, CircuitOpenError, AbuseBlockedError } from "../errors.js";

// ── CircuitBreaker Tests ──────────────────────────────────────

describe("CircuitBreaker", () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({
      name: "test-provider",
      failureThreshold: 3,
      successThreshold: 2,
      openTimeoutMs: 50,
    });
  });

  it("starts closed", () => {
    expect(cb.getState()).toBe("CLOSED");
    expect(cb.allow()).toBe(true);
  });

  it("opens after failure threshold", () => {
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("CLOSED");
    expect(cb.allow()).toBe(true);
    cb.recordFailure();
    expect(cb.getState()).toBe("OPEN");
    expect(cb.allow()).toBe(false);
  });

  it("transitions to half-open after timeout", async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("OPEN");
    expect(cb.allow()).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(cb.allow()).toBe(true);
    expect(cb.getState()).toBe("HALF_OPEN");
  });

  it("closes after success threshold in half-open", async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("OPEN");
    await new Promise((r) => setTimeout(r, 60));
    cb.allow();
    cb.recordSuccess();
    expect(cb.getState()).toBe("HALF_OPEN");
    cb.recordSuccess();
    expect(cb.getState()).toBe("CLOSED");
  });

  it("re-opens on failure in half-open", async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    await new Promise((r) => setTimeout(r, 60));
    cb.allow();
    cb.recordFailure();
    expect(cb.getState()).toBe("OPEN");
  });

  it("resets state", () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("OPEN");
    cb.reset();
    expect(cb.getState()).toBe("CLOSED");
    expect(cb.allow()).toBe(true);
  });

  it("uses defaults when minimal config provided", () => {
    const defaultCb = new CircuitBreaker({ name: "default-test" });
    expect(defaultCb.allow()).toBe(true);
    expect(defaultCb.getFailureCount()).toBe(0);
  });
});

// ── AbuseDetector Tests ───────────────────────────────────────

describe("AbuseDetector", () => {
  let detector: AbuseDetector;

  beforeEach(() => {
    detector = new AbuseDetector({
      failureThreshold: 3,
      windowMs: 500,
      blockDurationMs: 200,
    });
  });

  it("returns alert when threshold crossed", () => {
    detector.recordFailure("proj-1");
    detector.recordFailure("proj-1");
    expect(detector.recordFailure("proj-1")).not.toBeNull();
  });

  it("blocks after threshold crossed", () => {
    detector.recordFailure("proj-1");
    detector.recordFailure("proj-1");
    detector.recordFailure("proj-1");
    expect(detector.isBlocked("proj-1")).toBe(true);
  });

  it("clears after block duration expires", async () => {
    detector.recordFailure("proj-1");
    detector.recordFailure("proj-1");
    detector.recordFailure("proj-1");
    expect(detector.isBlocked("proj-1")).toBe(true);
    await new Promise((r) => setTimeout(r, 250));
    expect(detector.isBlocked("proj-1")).toBe(false);
  });

  it("does not block before threshold", () => {
    detector.recordFailure("proj-1");
    detector.recordFailure("proj-1");
    expect(detector.isBlocked("proj-1")).toBe(false);
    expect(detector.getFailureCount("proj-1")).toBe(2);
  });

  it("uses separate windows per scope", () => {
    detector.recordFailure("proj-a");
    detector.recordFailure("proj-a");
    detector.recordFailure("proj-a");
    expect(detector.isBlocked("proj-a")).toBe(true);
    expect(detector.isBlocked("proj-b")).toBe(false);
  });

  it("clears record on reset", () => {
    detector.recordFailure("proj-1");
    detector.recordFailure("proj-1");
    detector.recordFailure("proj-1");
    expect(detector.isBlocked("proj-1")).toBe(true);
    detector.clear("proj-1");
    expect(detector.isBlocked("proj-1")).toBe(false);
  });

  it("resets all records", () => {
    detector.recordFailure("proj-1");
    detector.recordFailure("proj-2");
    detector.reset();
    expect(detector.getFailureCount("proj-1")).toBe(0);
    expect(detector.getFailureCount("proj-2")).toBe(0);
  });
});

// ── GuardrailService Tests ────────────────────────────────────

describe("GuardrailService", () => {
  let guardrail: GuardrailService;
  let store: ReturnType<typeof createInMemoryBudgetStore>;

  const userId = "user-1";
  const projectId = "proj-1";

  beforeEach(() => {
    store = createInMemoryBudgetStore();
    guardrail = new GuardrailService(store);
  });

  describe("checkGeneration", () => {
    it("allows generation under all limits", () => {
      const result = guardrail.checkGeneration(projectId, userId, 0.001, 100);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.blockedBy).toBeNull();
    });

    it("blocks when generation exceeds rate limit", () => {
      const tightGuardrail = new GuardrailService(store, {
        rateLimitGeneration: { maxRequests: 2, windowMs: 60_000 },
      });
      tightGuardrail.checkGeneration(projectId, userId, 0.001, 100);
      tightGuardrail.checkGeneration(projectId, userId, 0.001, 100);
      const result = tightGuardrail.checkGeneration(projectId, userId, 0.001, 100);
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe("rate_limit");
      expect(result.reason).toContain("Rate limit");
    });

    it("blocks when over budget", () => {
      guardrail.budget.setProjectBudget(projectId, { maxEstimatedCost: 0.01 });
      guardrail.budget.recordOutcome(projectId, 0.01, 1000, "completed");
      const result = guardrail.checkGeneration(projectId, userId, 0.001, 100);
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe("budget");
      expect(result.reason).toContain("exceed remaining budget");
    });

    it("blocks when circuit breaker is open", () => {
      guardrail.ensureCircuitBreaker("provider", {
        failureThreshold: 1,
        successThreshold: 1,
        openTimeoutMs: 60_000,
      });
      guardrail.getCircuitBreaker("provider")!.recordFailure();
      const result = guardrail.checkGeneration(projectId, userId, 0.001, 100);
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe("circuit_breaker");
      expect(result.reason).toContain("Circuit");
    });

    it("blocks when abuse detected", () => {
      const abuseGuardrail = new GuardrailService(store, {
        abuseConfig: { failureThreshold: 1, windowMs: 500, blockDurationMs: 1000 },
      });
      abuseGuardrail.abuseDetector.recordFailure(projectId);
      const result = abuseGuardrail.checkGeneration(projectId, userId, 0.001, 100);
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe("abuse_detection");
      expect(result.reason).toContain("blocked");
    });

    it("legitimate workflow succeeds with normal limits", () => {
      guardrail.budget.setProjectBudget(projectId, { maxEstimatedCost: 100 });
      for (let i = 0; i < 10; i++) {
        const result = guardrail.checkGeneration(projectId, userId, 0.001, 100);
        expect(result.allowed).toBe(true);
      }
    });

    it("returns retryAfterMs for rate limited", () => {
      const tightGuardrail = new GuardrailService(store, {
        rateLimitGeneration: { maxRequests: 1, windowMs: 60_000 },
      });
      tightGuardrail.checkGeneration(projectId, userId, 0.001, 100);
      const result = tightGuardrail.checkGeneration(projectId, userId, 0.001, 100);
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });
  });

  describe("checkRegeneration", () => {
    it("allows regeneration under rate limit", () => {
      const result = guardrail.checkRegeneration(projectId, userId);
      expect(result.allowed).toBe(true);
    });

    it("blocks regeneration exceeding rate limit", () => {
      const tightGuardrail = new GuardrailService(store, {
        rateLimitRegeneration: { maxRequests: 1, windowMs: 60_000 },
      });
      tightGuardrail.checkRegeneration(projectId, userId);
      const result = tightGuardrail.checkRegeneration(projectId, userId);
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe("rate_limit");
    });
  });

  describe("checkExport", () => {
    it("allows export under rate limit", () => {
      const result = guardrail.checkExport(userId);
      expect(result.allowed).toBe(true);
    });

    it("blocks exports exceeding rate limit", () => {
      const tightGuardrail = new GuardrailService(store, {
        rateLimitExport: { maxRequests: 1, windowMs: 60_000 },
      });
      tightGuardrail.checkExport(userId);
      const result = tightGuardrail.checkExport(userId);
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe("rate_limit");
    });
  });

  describe("checkProviderValidation", () => {
    it("allows validation under rate limit", () => {
      const result = guardrail.checkProviderValidation("cred-1", userId);
      expect(result.allowed).toBe(true);
    });

    it("blocks validations exceeding rate limit", () => {
      const tightGuardrail = new GuardrailService(store, {
        rateLimitProviderValidation: { maxRequests: 1, windowMs: 60_000 },
      });
      tightGuardrail.checkProviderValidation("cred-1", userId);
      const result = tightGuardrail.checkProviderValidation("cred-1", userId);
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe("rate_limit");
    });
  });

  describe("circuit breaker management", () => {
    it("ensureCircuitBreaker creates if not exists", () => {
      const cb = guardrail.ensureCircuitBreaker("custom-op", {
        failureThreshold: 2,
        openTimeoutMs: 1000,
      });
      expect(cb.getName()).toBe("custom-op");
      expect(guardrail.getCircuitBreaker("custom-op")).toBe(cb);
    });

    it("ensureCircuitBreaker returns existing if already created", () => {
      const cb1 = guardrail.ensureCircuitBreaker("shared", { failureThreshold: 3 });
      const cb2 = guardrail.ensureCircuitBreaker("shared", { failureThreshold: 5 });
      expect(cb1).toBe(cb2);
      expect(cb1.getState()).toBe("CLOSED");
    });
  });

  describe("error types", () => {
    it("RateLimitedError has correct shape", () => {
      const err = new RateLimitedError("Too fast", 30_000, "generation");
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe("RATE_LIMITED");
      expect(err.retryAfterMs).toBe(30_000);
      expect(err.limitName).toBe("generation");
    });

    it("OverBudgetError has correct shape", () => {
      const err = new OverBudgetError("Over budget", "proj-1");
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("OVER_BUDGET");
      expect(err.scope).toBe("proj-1");
    });

    it("CircuitOpenError has correct shape", () => {
      const err = new CircuitOpenError("Circuit open", "openai");
      expect(err.statusCode).toBe(503);
      expect(err.code).toBe("CIRCUIT_OPEN");
      expect(err.circuitName).toBe("openai");
    });

    it("AbuseBlockedError has correct shape", () => {
      const err = new AbuseBlockedError("Abuse detected", "proj-1");
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe("ABUSE_BLOCKED");
      expect(err.scope).toBe("proj-1");
    });
  });
});
