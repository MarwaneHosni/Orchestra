import { logAudit } from "../audit/logger.js";
import { instrumentGuardrailAction } from "../metrics/index.js";
import { InMemoryRateLimiter } from "./rate-limiter.js";
import { BudgetEnforcer } from "./budget.js";
import type { BudgetStore } from "./budget.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { AbuseDetector } from "./abuse-detector.js";
import type { GuardrailCheckResult, GuardrailOperation } from "./types.js";
import {
  OPERATION_GENERATION,
  OPERATION_REGENERATION,
  OPERATION_EXPORT,
  OPERATION_PROVIDER_VALIDATION,
} from "./types.js";

export interface GuardrailServiceOptions {
  rateLimitGeneration?: { maxRequests: number; windowMs: number };
  rateLimitRegeneration?: { maxRequests: number; windowMs: number };
  rateLimitExport?: { maxRequests: number; windowMs: number };
  rateLimitProviderValidation?: { maxRequests: number; windowMs: number };
  circuitBreakerConfigs?: Array<{
    name: string;
    failureThreshold: number;
    successThreshold: number;
    openTimeoutMs: number;
  }>;
  abuseConfig?: { failureThreshold: number; windowMs: number; blockDurationMs: number };
}

const DEFAULT_GENERATION_RATE = { maxRequests: 10, windowMs: 60_000 };
const DEFAULT_REGENERATION_RATE = { maxRequests: 5, windowMs: 60_000 };
const DEFAULT_EXPORT_RATE = { maxRequests: 30, windowMs: 60_000 };
const DEFAULT_PROVIDER_VALIDATION_RATE = { maxRequests: 20, windowMs: 60_000 };

export class GuardrailService {
  readonly budget: BudgetEnforcer;
  readonly circuitBreakers = new Map<string, CircuitBreaker>();
  readonly abuseDetector: AbuseDetector;

  private limiters: Map<string, InMemoryRateLimiter>;

  constructor(budgetStore: BudgetStore, options?: GuardrailServiceOptions) {
    this.budget = new BudgetEnforcer(budgetStore);
    this.abuseDetector = new AbuseDetector(options?.abuseConfig);

    this.limiters = new Map();
    this.limiters.set(
      OPERATION_GENERATION,
      new InMemoryRateLimiter(options?.rateLimitGeneration ?? DEFAULT_GENERATION_RATE),
    );
    this.limiters.set(
      OPERATION_REGENERATION,
      new InMemoryRateLimiter(options?.rateLimitRegeneration ?? DEFAULT_REGENERATION_RATE),
    );
    this.limiters.set(
      OPERATION_EXPORT,
      new InMemoryRateLimiter(options?.rateLimitExport ?? DEFAULT_EXPORT_RATE),
    );
    this.limiters.set(
      OPERATION_PROVIDER_VALIDATION,
      new InMemoryRateLimiter(options?.rateLimitProviderValidation ?? DEFAULT_PROVIDER_VALIDATION_RATE),
    );

    if (options?.circuitBreakerConfigs) {
      for (const cfg of options.circuitBreakerConfigs) {
        this.circuitBreakers.set(cfg.name, new CircuitBreaker(cfg));
      }
    }
  }

  getLimiter(op: GuardrailOperation): InMemoryRateLimiter {
    const limiter = this.limiters.get(op);
    if (!limiter) throw new Error(`No rate limiter configured for operation: ${op}`);
    return limiter;
  }

  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  ensureCircuitBreaker(
    name: string,
    overrides?: {
      failureThreshold?: number;
      successThreshold?: number;
      openTimeoutMs?: number;
    },
  ): CircuitBreaker {
    let cb = this.circuitBreakers.get(name);
    if (!cb) {
      cb = new CircuitBreaker({ name, ...overrides });
      this.circuitBreakers.set(name, cb);
    }
    return cb;
  }

  checkOperation(op: GuardrailOperation, rateLimitKey: string): { result: GuardrailCheckResult } {
    const rateResult = this.getLimiter(op).check(rateLimitKey);
    if (!rateResult.allowed) {
      instrumentGuardrailAction("rate_limited", op);
      logAudit("guardrail.rate_limited", rateLimitKey, op, {
        operation: op,
        rateLimitKey,
        remaining: rateResult.remaining,
        resetAt: rateResult.resetAt,
      });
      return {
        result: {
          allowed: false,
          reason: rateResult.reason ?? "Rate limit exceeded",
          retryAfterMs: Math.max(0, rateResult.resetAt - Date.now()),
          blockedBy: "rate_limit",
        },
      };
    }
    return {
      result: { allowed: true, reason: null, retryAfterMs: null, blockedBy: null },
    };
  }

  checkBudget(
    scopeId: string,
    estimatedCost: number,
    estimatedTokens: number,
  ): { result: GuardrailCheckResult } {
    const budgetResult = this.budget.checkGeneration(scopeId, estimatedCost, estimatedTokens);
    if (!budgetResult.allowed) {
      instrumentGuardrailAction("over_budget", "generation");
      logAudit("guardrail.over_budget", scopeId, "generation", {
        scopeId,
        estimatedCost,
        estimatedTokens,
        currentMonthCost: budgetResult.currentMonthCost,
        reason: budgetResult.reason,
      });
      return {
        result: {
          allowed: false,
          reason: budgetResult.reason ?? "Budget limit exceeded",
          retryAfterMs: null,
          blockedBy: "budget",
        },
      };
    }
    return {
      result: { allowed: true, reason: null, retryAfterMs: null, blockedBy: null },
    };
  }

  checkCircuit(circuitName: string): { result: GuardrailCheckResult } {
    const cb = this.getCircuitBreaker(circuitName);
    if (!cb) {
      return {
        result: { allowed: true, reason: null, retryAfterMs: null, blockedBy: null },
      };
    }
    if (!cb.allow()) {
      instrumentGuardrailAction("circuit_open", circuitName);
      logAudit("guardrail.circuit_open", "system", circuitName, {
        circuitName,
        state: cb.getState(),
        failureCount: cb.getFailureCount(),
      });
      const retryAfterMs = 30_000;
      return {
        result: {
          allowed: false,
          reason: `Circuit "${circuitName}" is open — requests temporarily blocked`,
          retryAfterMs,
          blockedBy: "circuit_breaker",
        },
      };
    }
    return {
      result: { allowed: true, reason: null, retryAfterMs: null, blockedBy: null },
    };
  }

  checkAbuse(scope: string): { result: GuardrailCheckResult } {
    if (this.abuseDetector.isBlocked(scope)) {
      const blockedUntil = this.abuseDetector.getBlockedUntil(scope);
      instrumentGuardrailAction("abuse_blocked", scope);
      logAudit("guardrail.abuse_blocked", scope, "abuse_detection", {
        scope,
        blockedUntil,
      });
      return {
        result: {
          allowed: false,
          reason: `Too many failures — temporarily blocked until ${new Date(blockedUntil ?? 0).toISOString()}`,
          retryAfterMs: blockedUntil ? Math.max(0, blockedUntil - Date.now()) : 60_000,
          blockedBy: "abuse_detection",
        },
      };
    }
    return {
      result: { allowed: true, reason: null, retryAfterMs: null, blockedBy: null },
    };
  }

  checkGeneration(
    projectId: string,
    userId: string,
    estimatedCost: number,
    estimatedTokens: number,
  ): GuardrailCheckResult {
    const rateCheck = this.checkOperation(OPERATION_GENERATION, userId);
    if (!rateCheck.result.allowed) return rateCheck.result;

    const budgetCheck = this.checkBudget(projectId, estimatedCost, estimatedTokens);
    if (!budgetCheck.result.allowed) return budgetCheck.result;

    const circuitCheck = this.checkCircuit("provider");
    if (!circuitCheck.result.allowed) return circuitCheck.result;

    const abuseCheck = this.checkAbuse(projectId);
    if (!abuseCheck.result.allowed) return abuseCheck.result;

    return { allowed: true, reason: null, retryAfterMs: null, blockedBy: null };
  }

  checkRegeneration(_projectId: string, userId: string): GuardrailCheckResult {
    const rateCheck = this.checkOperation(OPERATION_REGENERATION, userId);
    if (!rateCheck.result.allowed) return rateCheck.result;

    const circuitCheck = this.checkCircuit("provider");
    if (!circuitCheck.result.allowed) return circuitCheck.result;

    return { allowed: true, reason: null, retryAfterMs: null, blockedBy: null };
  }

  checkExport(userId: string): GuardrailCheckResult {
    const rateCheck = this.checkOperation(OPERATION_EXPORT, userId);
    if (!rateCheck.result.allowed) return rateCheck.result;
    return { allowed: true, reason: null, retryAfterMs: null, blockedBy: null };
  }

  checkProviderValidation(_credentialId: string, userId: string): GuardrailCheckResult {
    const rateCheck = this.checkOperation(OPERATION_PROVIDER_VALIDATION, userId);
    if (!rateCheck.result.allowed) return rateCheck.result;

    const circuitCheck = this.checkCircuit("provider");
    if (!circuitCheck.result.allowed) return circuitCheck.result;

    return { allowed: true, reason: null, retryAfterMs: null, blockedBy: null };
  }
}
