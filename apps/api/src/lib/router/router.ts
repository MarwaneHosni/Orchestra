import type {
  ModelSelection,
  ModelTier,
  RouterDecision,
  TaskType,
  UserPreferences,
  ProviderStatus,
} from "./types.js";
import { getPolicy } from "./policy.js";

const TIER_RANK: Record<ModelTier, number> = { cheap: 0, balanced: 1, strong: 2 };

function meetsTierThreshold(tier: ModelTier, threshold: ModelTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[threshold];
}

export class RouterService {
  constructor(private getProviderStatus: (provider: string) => ProviderStatus) {}

  select(taskType: TaskType, preferences?: UserPreferences): RouterDecision {
    const policy = getPolicy(taskType);
    if (!policy) {
      throw new Error(`No routing policy for task type: ${taskType}`);
    }

    const reasoning: string[] = [];
    reasoning.push(`Policy for "${taskType}" requires minimum tier "${policy.minTier}"`);

    const candidateChain = this.buildCandidateChain(policy.preferred, policy.minTier, preferences, reasoning);

    const selection = this.findAvailable(candidateChain, reasoning);
    if (selection) {
      reasoning.push(`Selected primary: ${selection.provider}/${selection.model} (${selection.tier})`);
      // Include remaining unused preferred models before dedicated fallbacks
      const idx = candidateChain.indexOf(selection);
      const remaining = idx >= 0 ? candidateChain.slice(idx + 1) : [];
      return {
        taskType,
        selection,
        fallbackChain: [...remaining, ...policy.fallback],
        usedFallback: false,
        reasoning,
        timestamp: new Date().toISOString(),
      };
    }

    reasoning.push("No preferred model available, trying fallbacks");
    const fallbackSelection = this.findAvailable(policy.fallback, reasoning);
    if (fallbackSelection) {
      reasoning.push(
        `Selected fallback: ${fallbackSelection.provider}/${fallbackSelection.model} (${fallbackSelection.tier})`,
      );
      const fbIdx = policy.fallback.indexOf(fallbackSelection);
      const remaining = fbIdx >= 0 ? policy.fallback.slice(fbIdx + 1) : [];
      return {
        taskType,
        selection: fallbackSelection,
        fallbackChain: remaining,
        usedFallback: true,
        reasoning,
        timestamp: new Date().toISOString(),
      };
    }

    throw new Error(
      `No available provider for task type "${taskType}". All preferred and fallback models are unavailable.`,
    );
  }

  private buildCandidateChain(
    preferred: ModelSelection[],
    policyMinTier: ModelTier,
    preferences?: UserPreferences,
    reasoning?: string[],
  ): ModelSelection[] {
    const effectiveThreshold: ModelTier = preferences?.qualityThreshold ?? policyMinTier;
    if (preferences?.qualityThreshold && reasoning) {
      reasoning.push(`User quality threshold: "${preferences.qualityThreshold}"`);
    }

    const chain: ModelSelection[] = [];

    if (preferences?.preferredProvider && preferences?.preferredModel) {
      const userPick: ModelSelection = {
        provider: preferences.preferredProvider,
        model: preferences.preferredModel,
        tier: effectiveThreshold,
      };
      chain.push(userPick);
    }

    const filtered = preferred.filter((m) => meetsTierThreshold(m.tier, effectiveThreshold));

    if (preferences?.preferredProvider) {
      const providerMatch = filtered.filter((m) => m.provider === preferences.preferredProvider);
      if (providerMatch.length > 0 && reasoning) {
        reasoning.push(
          `Filtered to provider "${preferences.preferredProvider}" meeting tier "${effectiveThreshold}"`,
        );
      }
      chain.push(...providerMatch);
    }

    chain.push(...filtered);

    if (reasoning && chain.length === 0) {
      reasoning.push(`No models meet quality threshold "${effectiveThreshold}" for any provider`);
    }

    return chain;
  }

  private findAvailable(candidates: ModelSelection[], reasoning: string[]): ModelSelection | null {
    for (const candidate of candidates) {
      const status = this.getProviderStatus(candidate.provider);
      if (status.available) {
        return candidate;
      }
      reasoning.push(`Skipped ${candidate.provider}/${candidate.model}: provider unavailable`);
    }
    return null;
  }
}
