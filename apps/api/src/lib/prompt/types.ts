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
}

export interface PromptArtifact {
  id: string;
  taskId: string;
  planId: string;
  planVersion: number;
  promptText: string;
  sections: PromptSection;
  version: number;
  status: "pending" | "complete" | "failed";
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
  const items: PromptArtifact[] = [];
  return {
    save(a) {
      items.push(a);
    },
    getByTask(taskId) {
      return items.find((a) => a.taskId === taskId);
    },
    getByPlan(planId, planVersion) {
      return items.filter((a) => a.planId === planId && a.planVersion === planVersion);
    },
  };
}
