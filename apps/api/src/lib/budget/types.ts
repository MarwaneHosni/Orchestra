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
