import type { ClassifiedFailure } from "./types.js";

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
