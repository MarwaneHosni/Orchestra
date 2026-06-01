export type TaskType = "code" | "config" | "test" | "docs" | "review" | "deploy" | "pending_input" | "other";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "pending" | "blocked" | "ready" | "in_progress" | "complete" | "needs_review";
export type DepType = "blocks" | "triggers" | "input_from";

export interface TaskNode {
  id: string;
  planId: string;
  phaseType: string;
  title: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  order: number;
  dependencies: { taskId: string; type: DepType }[];
  acceptanceCriteria: string[];
  estimatedPromptRounds: number;
  failureReason?: string;
}

export interface DependencyEdge {
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: DepType;
}

export interface TaskGraph {
  planId: string;
  planVersion: number;
  tasks: TaskNode[];
  dependencies: DependencyEdge[];
  derivedFromPlanVersion?: number;
}

export interface PhaseInput {
  phaseType: string;
  phaseName: string;
  status: "sufficient" | "insufficient" | "missing";
  confidence: number;
  summary: string;
  narrative?: string;
  keyDecisions?: string[];
  executionPrompt?: string;
}

export const PHASE_ORDER = [
  "ideation",
  "requirements",
  "architecture",
  "security",
  "database",
  "backend",
  "frontend",
  "core-features",
  "ai-systems",
  "testing",
  "deployment",
  "monitoring",
];

export const TASK_COUNTS: Record<string, { min: number; max: number }> = {
  ideation: { min: 1, max: 2 },
  requirements: { min: 1, max: 2 },
  architecture: { min: 2, max: 4 },
  security: { min: 1, max: 3 },
  database: { min: 2, max: 4 },
  backend: { min: 3, max: 5 },
  frontend: { min: 3, max: 5 },
  "core-features": { min: 2, max: 4 },
  "ai-systems": { min: 1, max: 3 },
  testing: { min: 2, max: 3 },
  deployment: { min: 1, max: 2 },
  monitoring: { min: 1, max: 2 },
};