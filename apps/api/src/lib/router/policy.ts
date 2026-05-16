import type { RoutingPolicy } from "./types.js";

export const POLICIES: RoutingPolicy[] = [
  {
    taskType: "clarification",
    minTier: "cheap",
    preferred: [
      { provider: "openrouter", model: "deepseek/deepseek-v4-flash:free", tier: "cheap" },
      { provider: "openai", model: "gpt-4o-mini", tier: "cheap" },
      { provider: "anthropic", model: "claude-3-5-haiku-latest", tier: "cheap" },
    ],
    fallback: [
      { provider: "openai", model: "gpt-4o", tier: "balanced" },
      { provider: "anthropic", model: "claude-sonnet-4-20250514", tier: "balanced" },
    ],
  },
  {
    taskType: "roadmap",
    minTier: "balanced",
    preferred: [
      { provider: "openai", model: "gpt-4o", tier: "balanced" },
      { provider: "anthropic", model: "claude-sonnet-4-20250514", tier: "balanced" },
    ],
    fallback: [
      { provider: "openrouter", model: "deepseek/deepseek-v4-flash:free", tier: "cheap" },
      { provider: "openai", model: "gpt-4o-mini", tier: "cheap" },
      { provider: "anthropic", model: "claude-3-5-haiku-latest", tier: "cheap" },
      { provider: "openrouter", model: "openai/gpt-4o", tier: "balanced" },
    ],
  },
  {
    taskType: "architecture",
    minTier: "strong",
    preferred: [
      { provider: "openai", model: "gpt-4.1", tier: "strong" },
      { provider: "anthropic", model: "claude-sonnet-4-20250514", tier: "strong" },
    ],
    fallback: [
      { provider: "openai", model: "gpt-4o", tier: "balanced" },
      { provider: "anthropic", model: "claude-sonnet-4-20250514", tier: "balanced" },
      { provider: "openrouter", model: "anthropic/claude-sonnet-4", tier: "strong" },
    ],
  },
  {
    taskType: "prompt_generation",
    minTier: "balanced",
    preferred: [
      { provider: "openai", model: "gpt-4o", tier: "balanced" },
      { provider: "anthropic", model: "claude-sonnet-4-20250514", tier: "balanced" },
    ],
    fallback: [
      { provider: "openrouter", model: "deepseek/deepseek-v4-flash:free", tier: "cheap" },
      { provider: "openai", model: "gpt-4o-mini", tier: "cheap" },
      { provider: "openrouter", model: "openai/gpt-4o", tier: "balanced" },
    ],
  },
  {
    taskType: "summary",
    minTier: "cheap",
    preferred: [
      { provider: "openrouter", model: "deepseek/deepseek-v4-flash:free", tier: "cheap" },
      { provider: "openai", model: "gpt-4o-mini", tier: "cheap" },
      { provider: "anthropic", model: "claude-3-5-haiku-latest", tier: "cheap" },
    ],
    fallback: [
      { provider: "openai", model: "gpt-4o", tier: "balanced" },
      { provider: "openrouter", model: "openai/gpt-4o-mini", tier: "cheap" },
    ],
  },
  {
    taskType: "blueprint",
    minTier: "balanced",
    preferred: [
      { provider: "openai", model: "gpt-4.1", tier: "strong" },
      { provider: "anthropic", model: "claude-sonnet-4-20250514", tier: "strong" },
    ],
    fallback: [
      { provider: "openai", model: "gpt-4o", tier: "balanced" },
      { provider: "openrouter", model: "anthropic/claude-sonnet-4", tier: "strong" },
    ],
  },
];

export function getPolicy(taskType: string): RoutingPolicy | undefined {
  return POLICIES.find((p) => p.taskType === taskType);
}
