import type { ModelPricing } from "./types.js";
import { createModuleLogger } from "../logging/logger.js";

const log = createModuleLogger("pricing");

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
  {
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash:free",
    promptPricePer1K: 0,
    completionPricePer1K: 0,
  },

  // OpenCode Go (currently free tier — all models shared quota)
  { provider: "opencode-go", model: "deepseek-v4-flash", promptPricePer1K: 0, completionPricePer1K: 0 },
  { provider: "opencode-go", model: "deepseek-v4-pro", promptPricePer1K: 0, completionPricePer1K: 0 },
  { provider: "opencode-go", model: "glm-5.1", promptPricePer1K: 0, completionPricePer1K: 0 },
  { provider: "opencode-go", model: "glm-5", promptPricePer1K: 0, completionPricePer1K: 0 },
  { provider: "opencode-go", model: "kimi-k2.5", promptPricePer1K: 0, completionPricePer1K: 0 },
  { provider: "opencode-go", model: "kimi-k2.6", promptPricePer1K: 0, completionPricePer1K: 0 },
  { provider: "opencode-go", model: "mimo-v2.5", promptPricePer1K: 0, completionPricePer1K: 0 },
  { provider: "opencode-go", model: "mimo-v2.5-pro", promptPricePer1K: 0, completionPricePer1K: 0 },
  { provider: "opencode-go", model: "qwen3.6-plus", promptPricePer1K: 0, completionPricePer1K: 0 },
  { provider: "opencode-go", model: "qwen3.5-plus", promptPricePer1K: 0, completionPricePer1K: 0 },
];

const _unknownPricingWarnings = new Set<string>();

export function getPricing(provider: string, model: string): ModelPricing | undefined {
  const found = MODEL_PRICING.find((p) => p.provider === provider && p.model === model);
  if (!found) {
    const key = `${provider}/${model}`;
    if (!_unknownPricingWarnings.has(key)) {
      _unknownPricingWarnings.add(key);
      log.warn({ key }, "unknown_pricing_entry");
    }
  }
  return found;
}
