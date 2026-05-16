export interface SnapshotRef {
  version: number;
  reason: string;
  planVersion: number | null;
  createdAt: string;
}

export interface DiffSummary {
  regenerationScope: "full" | "partial" | "none";
  affectedPhaseTypes: string[];
  phaseChanges: number;
  taskChanges: number;
  promptChanges: number;
  blueprintChanges: number;
}

export interface TaskSummary {
  order: number;
  phaseType: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  depCount: number;
  hasFailureReason: boolean;
}

export interface TaskDiff {
  phaseType: string;
  order: number;
  changeType: "added" | "removed" | "modified" | "unchanged";
  left: TaskSummary | null;
  right: TaskSummary | null;
}

export interface PromptDiff {
  phaseType: string;
  changeType: "added" | "removed" | "modified" | "unchanged";
  textChanged: boolean;
  statusChanged: boolean;
  leftStatus: string | null;
  rightStatus: string | null;
}

export interface PhaseDiff {
  phaseType: string;
  changeType: "added" | "removed" | "modified" | "unchanged";
  statusChanged: boolean;
  confidenceChanged: boolean;
  left: { status: string; confidence: number } | null;
  right: { status: string; confidence: number } | null;
}

export interface BlueprintItemDiff {
  changeType: "added" | "removed" | "modified" | "unchanged";
  description: string;
}

export interface BlueprintDiff {
  assumptions: BlueprintItemDiff[];
  constraints: BlueprintItemDiff[];
  risks: BlueprintItemDiff[];
  phaseSummaries: {
    phaseType: string;
    summaryChanged: boolean;
    confidenceChanged: boolean;
    statusChanged: boolean;
    leftSummary: string | null;
    rightSummary: string | null;
  }[];
}

export interface BlueprintContent {
  phases: { phaseType: string; phaseName: string; summary: string; status: string; confidence: number }[];
  assumptions: { description: string }[];
  constraints: { description: string }[];
  risks: { description: string }[];
}

export interface VersionDiff {
  left: SnapshotRef;
  right: SnapshotRef;
  summary: DiffSummary;
  phases: PhaseDiff[];
  tasks: TaskDiff[];
  prompts: PromptDiff[];
  blueprint: BlueprintDiff | null;
}
