import type { PhaseType } from "../contract/output-schema.js";

// ─────────────────────────────────────────────────────────────
// Roadmap
// ─────────────────────────────────────────────────────────────

export interface RoadmapMilestone {
  phaseType: PhaseType;
  phaseName: string;
  order: number;
  title: string;
  description: string;
  keyDeliverables: string[];
  estimatedEffort: "small" | "medium" | "large";
  dependsOn: PhaseType[];
}

export interface Roadmap {
  projectId: string;
  projectName: string;
  sessionId: string;
  generatedAt: string;
  milestones: RoadmapMilestone[];
  totalEffort: "small" | "medium" | "large";
}

// ─────────────────────────────────────────────────────────────
// Task Draft
// ─────────────────────────────────────────────────────────────

export type TaskKind = "code" | "config" | "test" | "docs" | "review" | "deploy" | "other";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface DependencyRef {
  taskId: string;
  kind: "blocks" | "triggers" | "input_from";
}

export interface DraftTask {
  id: string;
  phaseType: PhaseType;
  title: string;
  description: string;
  kind: TaskKind;
  priority: TaskPriority;
  order: number;
  acceptanceCriteria: string[];
  dependencies: DependencyRef[];
  dependsOnUnresolvedInput: boolean;
  uncertaintyNote: string | null;
}

export interface TaskDraft {
  projectId: string;
  projectName: string;
  sessionId: string;
  generatedAt: string;
  tasks: DraftTask[];
  dependencyCount: number;
  tasksWithUnresolvedInput: number;
}

// ─────────────────────────────────────────────────────────────
// Combined draft output
// ─────────────────────────────────────────────────────────────

export interface RoadmapAndTasks {
  roadmap: Roadmap;
  taskDraft: TaskDraft;
}
