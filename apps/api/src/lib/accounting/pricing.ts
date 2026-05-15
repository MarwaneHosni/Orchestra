import type { ModelPricing } from "./types.js";

export const MODEL_PRICING: ModelPricing[] = [
  // OpenAI
  { provider: "openai", model: "gpt-4o-mini", promptPricePer1K: 0.00015, completionPricePer1K: 0.0006 },
  { provider: "openai", model: "gpt-4o", promptPricePer1K: 0.0025, completionPricePer1K: 0.01 },
  { provider: "openai", model: "gpt-4.1", promptPricePer1K: 0.002, completionPricePer1K: 0.008 },

  // Anthropic
  {
    provider: "anthropic",
    model: "claude-3-5-haiku-latest",
    promptPricePer1K: 0.0008,
    completionPricePer1K: 0.004,
  },
  {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    promptPricePer1K: 0.003,
    completionPricePer1K: 0.015,
  },

  // OpenRouter (pass-through pricing — approximate)
  {
    provider: "openrouter",
    model: "openai/gpt-4o-mini",
    promptPricePer1K: 0.00015,
    completionPricePer1K: 0.0006,
  },
  { provider: "openrouter", model: "openai/gpt-4o", promptPricePer1K: 0.0025, completionPricePer1K: 0.01 },
  {
    provider: "openrouter",
    model: "anthropic/claude-sonnet-4",
    promptPricePer1K: 0.003,
    completionPricePer1K: 0.015,
  },
];

export function getPricing(provider: string, model: string): ModelPricing | undefined {
  return MODEL_PRICING.find((p) => p.provider === provider && p.model === model);
}
