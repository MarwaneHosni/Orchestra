export interface ModelPricing {
  provider: string;
  model: string;
  promptPricePer1K: number;
  completionPricePer1K: number;
}

export interface UsageEstimate {
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  estimatedCost: number;
  model: string;
  provider: string;
}

export interface UsageRecord {
  id: string;
  projectId: string;
  userId: string;
  sessionId: string | null;
  taskType: string;
  provider: string;
  model: string;
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  estimatedCost: number;
  actualPromptTokens: number | null;
  actualCompletionTokens: number | null;
  actualTotalTokens: number | null;
  actualCost: number | null;
  status: "estimated" | "completed" | "failed";
  requestId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UsageSummary {
  totalGenerations: number;
  totalTokens: number;
  totalCost: number;
  byModel: Record<string, { generations: number; tokens: number; cost: number }>;
  byTaskType: Record<string, { generations: number; tokens: number; cost: number }>;
  byProvider: Record<string, { generations: number; tokens: number; cost: number }>;
}
