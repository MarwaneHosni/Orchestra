export type TaskType = "clarification" | "roadmap" | "architecture" | "prompt_generation" | "summary";

export type ModelTier = "cheap" | "balanced" | "strong";

export interface ModelSelection {
  provider: string;
  model: string;
  tier: ModelTier;
}

export interface UserPreferences {
  preferredProvider?: string;
  preferredModel?: string;
  qualityThreshold?: ModelTier;
}

export interface RouterDecision {
  taskType: TaskType;
  selection: ModelSelection;
  fallbackChain: ModelSelection[];
  usedFallback: boolean;
  reasoning: string[];
  timestamp: string;
}

export interface RoutingPolicy {
  taskType: TaskType;
  preferred: ModelSelection[];
  fallback: ModelSelection[];
  minTier: ModelTier;
}

export interface ProviderStatus {
  provider: string;
  available: boolean;
  validatedAt: string | null;
}
