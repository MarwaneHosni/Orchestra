import type { TokenUsage } from "../provider/types.js";

export function createAccumulatedUsage(): TokenUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

export function accumulateUsage(
  acc: TokenUsage,
  chunk: Partial<TokenUsage>,
): TokenUsage {
  const promptDelta = chunk.promptTokens ?? 0;
  const completionDelta = chunk.completionTokens ?? 0;
  const totalDelta = chunk.totalTokens ?? (promptDelta + completionDelta);
  return {
    promptTokens: acc.promptTokens + promptDelta,
    completionTokens: acc.completionTokens + completionDelta,
    totalTokens: acc.totalTokens + totalDelta,
  };
}

export interface UsageAttempt {
  provider: string;
  model: string;
  usage: TokenUsage;
  durationMs: number;
  success: boolean;
  error?: string | undefined;
}

export function attemptKey(attempt: UsageAttempt): string {
  return `${attempt.provider}/${attempt.model}`;
}

export function sumAttempts(attempts: UsageAttempt[]): TokenUsage {
  const acc = createAccumulatedUsage();
  for (const a of attempts) {
    acc.promptTokens += a.usage.promptTokens;
    acc.completionTokens += a.usage.completionTokens;
    acc.totalTokens += a.usage.totalTokens;
  }
  return acc;
}

export function sumSuccessfulAttempts(attempts: UsageAttempt[]): TokenUsage {
  return sumAttempts(attempts.filter((a) => a.success));
}

export function sumFailedAttempts(attempts: UsageAttempt[]): TokenUsage {
  return sumAttempts(attempts.filter((a) => !a.success));
}
