import type { TaskNode } from "../task-graph/types.js";

export interface PromptSection {
  objective: string;
  context: string;
  constraints: string[];
  expectedOutput: string;
  validationCriteria: string[];
  architecturalAlignment: string;
  agentTips: AgentTips;
}

export interface AgentTips {
  security: string[];
  edgeCases: string[];
  dependencyWarnings: string[];
  commonBugs: string[];
}

export interface TaskContext {
  task: TaskNode;
  planName: string;
  allTasks: TaskNode[];
  predecessorOutputs: string[];
  phaseSummary: string;
  aiPhaseNarrative?: string;
  aiPhaseSummary?: string;
  aiPhaseStatus?: string;
  aiPhaseConfidence?: number;
  aiKeyDecisions?: string[];
  aiAssumptions?: { id?: string; description: string; source?: string }[];
  aiConstraints?: { id?: string; description: string; source?: string }[];
  aiRisks?: { id?: string; description: string; source?: string }[];
  aiOverallSummary?: string;
}

export interface PromptArtifact {
  id: string;
  taskId: string;
  planId: string;
  planVersion: number;
  promptText: string;
  sections: PromptSection;
  version: number;
  status: "pending" | "complete" | "failed" | "needs_review";
  failureReason: string | null;
  createdAt: string;
}

export interface PromptValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const REQUIRED_SECTIONS = [
  "objective",
  "context",
  "constraints",
  "expectedOutput",
  "validationCriteria",
  "architecturalAlignment",
  "agentTips",
] as const;

export const MIN_PROMPT_LENGTH = 200;
export const MAX_PROMPT_LENGTH = 5000;

export interface PromptStore {
  save(artifact: PromptArtifact): void;
  getByTask(taskId: string): PromptArtifact | undefined;
  getByPlan(planId: string, planVersion: number): PromptArtifact[];
}

export function createInMemoryPromptStore(): PromptStore {
  const byTask = new Map<string, PromptArtifact>();
  const byPlan = new Map<string, PromptArtifact[]>();

  function planKey(planId: string, planVersion: number): string {
    return `${planId}::${planVersion}`;
  }

  function getPlanList(planId: string, planVersion: number): PromptArtifact[] {
    const key = planKey(planId, planVersion);
    let list = byPlan.get(key);
    if (!list) {
      list = [];
      byPlan.set(key, list);
    }
    return list;
  }

  return {
    save(a) {
      getPlanList(a.planId, a.planVersion).push(a);
      byTask.set(a.taskId, a);
    },
    getByTask(taskId) {
      return byTask.get(taskId);
    },
    getByPlan(planId, planVersion) {
      return [...getPlanList(planId, planVersion)];
    },
  };
}
