import type { TaskGraph } from "../task-graph/types.js";

export interface SnapshotRecord {
  id: string;
  projectId: string;
  version: number;
  parentSnapshotId: string | null;
  reason: string;
  status: "creating" | "complete" | "failed";
  planId: string | null;
  planVersion: number | null;
  blueprintId: string | null;
  taskGraphId: string | null;
  interviewSessionId: string | null;
  answerCount: number;
  affectedPhaseTypes: string[] | null;
  changeSummary: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface RegenerationOptions {
  planId: string;
  blueprintId?: string | null;
  sessionId?: string | null;
  forceFullRegeneration?: boolean;
}

export interface RegenerationResult {
  snapshot: SnapshotRecord;
  taskGraph: TaskGraph | null;
  affectedPhases: number;
  affectedTasks: number;
  affectedPrompts: number;
  escalatedToFull: boolean;
  reason: string;
}

export const CROSS_CUTTING_PHASES = new Set(["ideation", "requirements", "architecture"]);

const ALL_PHASES = [
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

/**
 * Rules for escalation: if a change touches any of these phase types,
 * partial regeneration cannot be used and the system must escalate
 * to a full re-snapshot.
 */
export const PHASE_ESCALATION_RULES: Record<string, "partial" | "escalate"> = {
  ideation: "escalate",
  requirements: "escalate",
  architecture: "escalate",
  security: "partial",
  database: "partial",
  backend: "partial",
  frontend: "partial",
  "core-features": "partial",
  "ai-systems": "partial",
  testing: "partial",
  deployment: "partial",
  monitoring: "partial",
};

/**
 * Dependent phases: if phase X changes, which other phases are affected?
 * An empty array means only the phase itself is affected.
 */
export const DEPENDENT_PHASES: Record<string, string[]> = {
  ideation: ALL_PHASES.filter((p) => p !== "ideation"),
  requirements: ALL_PHASES.filter((p) => p !== "ideation" && p !== "requirements"),
  architecture: ALL_PHASES.filter((p) => p !== "ideation" && p !== "requirements" && p !== "architecture"),
  security: ["security"],
  database: ["database", "backend", "frontend", "core-features", "testing"],
  backend: ["backend", "frontend", "testing"],
  frontend: ["frontend", "testing"],
  "core-features": ["core-features", "testing"],
  "ai-systems": ["ai-systems", "testing"],
  testing: ["testing"],
  deployment: ["deployment", "monitoring"],
  monitoring: ["monitoring"],
};

export interface SnapshotStore {
  insert(r: SnapshotRecord): void;
  get(id: string): SnapshotRecord | undefined;
  getByProject(projectId: string): SnapshotRecord[];
  getLatestByProject(projectId: string): SnapshotRecord | undefined;
  updateStatus(id: string, status: "complete" | "failed", failureReason: string | null): void;
}
