export interface BudgetConfig {
  projectId: string;
  maxEstimatedCost: number;
  maxGenerationsPerMonth: number;
  maxTokensPerMonth: number;
}

export interface BudgetState {
  projectId: string;
  currentMonthGenerations: number;
  currentMonthTokens: number;
  currentMonthCost: number;
  lastResetAt: string;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason: string | null;
  estimatedCost: number;
  estimatedTokens: number;
  currentMonthCost: number;
  currentMonthGenerations: number;
  remainingBudget: number;
}

export type GenerationOutcome = "completed" | "failed";

export type FailureCategory = "retryable" | "fallback_eligible" | "terminal";

export interface ClassifiedFailure {
  category: FailureCategory;
  message: string;
  operatorMessage: string;
  statusCode: number | null;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
}

export interface RetryState {
  attempt: number;
  nextDelayMs: number;
}

export const DEFAULT_RETRY: RetryConfig = { maxRetries: 3, baseDelayMs: 1000 };
export const DEFAULT_BUDGET: Omit<BudgetConfig, "projectId"> = {
  maxEstimatedCost: 50,
  maxGenerationsPerMonth: 1000,
  maxTokensPerMonth: 10_000_000,
};

// ── Circuit Breaker ───────────────────────────────────────────

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;
  successThreshold: number;
  openTimeoutMs: number;
}

export const DEFAULT_CIRCUIT_BREAKER: Omit<CircuitBreakerConfig, "name"> = {
  failureThreshold: 5,
  successThreshold: 3,
  openTimeoutMs: 30_000,
};

// ── Abuse Detection ───────────────────────────────────────────

export interface AbuseConfig {
  failureThreshold: number;
  windowMs: number;
  blockDurationMs: number;
}

export interface AbuseRecord {
  failures: { timestamp: number }[];
  blockedUntil: number | null;
}

export const DEFAULT_ABUSE_CONFIG: AbuseConfig = {
  failureThreshold: 10,
  windowMs: 300_000,
  blockDurationMs: 600_000,
};

// ── Guardrail Result ──────────────────────────────────────────

export interface GuardrailCheckResult {
  allowed: boolean;
  reason: string | null;
  retryAfterMs: number | null;
  blockedBy: "rate_limit" | "budget" | "circuit_breaker" | "abuse_detection" | null;
}

export const OPERATION_GENERATION = "generation";
export const OPERATION_REGENERATION = "regeneration";
export const OPERATION_EXPORT = "export";
export const OPERATION_PROVIDER_VALIDATION = "provider_validation";
export type GuardrailOperation =
  | typeof OPERATION_GENERATION
  | typeof OPERATION_REGENERATION
  | typeof OPERATION_EXPORT
  | typeof OPERATION_PROVIDER_VALIDATION;
