import type { ClassifiedFailure, RetryConfig, RetryState } from "./types.js";
import { DEFAULT_RETRY } from "./types.js";

export function classifyFailure(error: unknown): ClassifiedFailure {
  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = (error as { statusCode: number }).statusCode;

    if (statusCode === 429) {
      return {
        category: "fallback_eligible",
        message: "Rate limited by provider. Switching to alternate model or provider.",
        operatorMessage: `Provider returned 429 rate limit. statusCode=${statusCode}`,
        statusCode,
      };
    }

    if (statusCode >= 500) {
      return {
        category: "retryable",
        message: "Provider temporarily unavailable. Retrying with backoff.",
        operatorMessage: `Provider returned ${statusCode}. Retrying with exponential backoff.`,
        statusCode,
      };
    }

    if (statusCode === 401 || statusCode === 403) {
      return {
        category: "terminal",
        message: "Provider authentication failed. Check your API key.",
        operatorMessage: `Provider auth failure (${statusCode}). API key may be invalid or expired.`,
        statusCode,
      };
    }

    if (statusCode === 400) {
      return {
        category: "terminal",
        message: "Request was rejected by the provider. Verify the input.",
        operatorMessage: `Provider returned 400. This may indicate an invalid model name or malformed request.`,
        statusCode,
      };
    }
  }

  if (error && typeof error === "object" && error instanceof TypeError) {
    if ((error as Error).message?.includes("fetch") || (error as Error).message?.includes("network")) {
      return {
        category: "retryable",
        message: "Network error contacting provider. Retrying.",
        operatorMessage: `Network error: ${(error as Error).message}. Check connectivity and provider status.`,
        statusCode: null,
      };
    }
    if ((error as Error).message?.includes("abort")) {
      return {
        category: "retryable",
        message: "Request timed out. Retrying.",
        operatorMessage: `Request timed out: ${(error as Error).message}. Provider may be slow or unreachable.`,
        statusCode: null,
      };
    }
  }

  return {
    category: "terminal",
    message: "An unexpected error occurred during generation.",
    operatorMessage: `Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
    statusCode: null,
  };
}

export function createRetryState(): RetryState {
  return { attempt: 0, nextDelayMs: DEFAULT_RETRY.baseDelayMs };
}

export function shouldRetry(state: RetryState, config?: RetryConfig): boolean {
  const cfg = config ?? DEFAULT_RETRY;
  return state.attempt < cfg.maxRetries;
}

export function computeBackoff(state: RetryState): number {
  const delay = state.nextDelayMs;
  state.attempt++;
  state.nextDelayMs = Math.min(state.nextDelayMs * 2, 30_000);
  return delay;
}

/**
 * Execute an async operation with bounded retry and observable audit events.
 * Emits `retry.attempt` on each retry and `retry.exhausted` when all retries
 * are consumed without success.
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  context: { operationName: string; scopeId: string },
  config?: RetryConfig,
): Promise<T> {
  const cfg = config ?? DEFAULT_RETRY;
  const { operationName, scopeId } = context;
  const state = createRetryState();

  // Dynamically import logAudit to avoid circular deps
  const { logAudit } = await import("../audit/logger.js");

  while (true) {
    try {
      return await operation();
    } catch (err) {
      const classified = classifyFailure(err);

      if (classified.category === "terminal" || !shouldRetry(state, cfg)) {
        if (state.attempt > 0) {
          logAudit("retry.exhausted", scopeId, operationName, {
            operationName,
            scopeId,
            attempts: state.attempt,
            finalError: classified.operatorMessage,
            category: classified.category,
          });
        }
        throw err;
      }

      // Emit audit event for each retry attempt
      logAudit("retry.attempt", scopeId, operationName, {
        operationName,
        scopeId,
        attempt: state.attempt + 1,
        maxRetries: cfg.maxRetries,
        delayMs: state.nextDelayMs,
        errorCategory: classified.category,
        errorMessage: classified.operatorMessage,
      });

      const delay = computeBackoff(state);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
