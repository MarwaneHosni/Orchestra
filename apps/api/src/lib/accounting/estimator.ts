import type { UsageEstimate } from "./types.js";
import { getPricing } from "./pricing.js";

const TOKENS_PER_CHAR = 0.25;

export function estimatePromptTokens(messages: { role: string; content: string }[]): number {
  let totalChars = 0;
  for (const m of messages) {
    totalChars += m.role.length + 2;
    totalChars += m.content.length;
  }
  return Math.ceil(totalChars * TOKENS_PER_CHAR);
}

export function estimateCompletionTokens(responseContent: string): number {
  return Math.ceil(responseContent.length * TOKENS_PER_CHAR);
}

export interface EstimationInput {
  provider: string;
  model: string;
  promptTokenEstimate?: number;
  completionTokenEstimate?: number;
}

export function estimateCost(input: EstimationInput): UsageEstimate {
  const pricing = getPricing(input.provider, input.model);
  const promptTokens = input.promptTokenEstimate ?? 500;
  const completionTokens = input.completionTokenEstimate ?? 500;

  if (!pricing) {
    return {
      estimatedPromptTokens: promptTokens,
      estimatedCompletionTokens: completionTokens,
      estimatedCost: 0,
      model: input.model,
      provider: input.provider,
    };
  }

  const promptCost = (promptTokens / 1000) * pricing.promptPricePer1K;
  const completionCost = (completionTokens / 1000) * pricing.completionPricePer1K;

  return {
    estimatedPromptTokens: promptTokens,
    estimatedCompletionTokens: completionTokens,
    estimatedCost: Math.round((promptCost + completionCost) * 1_000_000) / 1_000_000,
    model: input.model,
    provider: input.provider,
  };
}

export function calculateActualCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = getPricing(provider, model);
  if (!pricing) return 0;
  const cost =
    (promptTokens / 1000) * pricing.promptPricePer1K +
    (completionTokens / 1000) * pricing.completionPricePer1K;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
