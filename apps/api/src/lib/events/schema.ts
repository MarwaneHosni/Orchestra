// ── Event Schema Version ──────────────────────────────────────────
export const PROGRESS_SCHEMA_VERSION = 1;

// ── Stage Definitions ─────────────────────────────────────────────
export const STAGE_ORDER = [
  "synthesis",
  "analysis",
  "blueprint",
  "roadmap",
  "taskGraph",
  "promptGen",
  "summary",
  "complete",
] as const;

export type StageName = (typeof STAGE_ORDER)[number];

export interface StageDefinition {
  name: StageName;
  label: string;
  description: string;
}

export const STAGE_DEFINITIONS: Record<StageName, StageDefinition> = {
  synthesis: { name: "synthesis", label: "Analyzing your answers", description: "Building context pack from interview answers" },
  analysis: { name: "analysis", label: "Building project analysis", description: "Running deterministic analysis on synthesized data" },
  blueprint: { name: "blueprint", label: "Generating project plan with AI", description: "Calling AI provider to generate blueprint and roadmap" },
  roadmap: { name: "roadmap", label: "Creating roadmap", description: "Generating phase roadmap from blueprint" },
  taskGraph: { name: "taskGraph", label: "Decomposing into tasks", description: "Breaking phases into executable tasks" },
  promptGen: { name: "promptGen", label: "Assembling execution prompts", description: "Building per-task execution prompts" },
  summary: { name: "summary", label: "Generating project summary", description: "Synthesizing project overview and key decisions" },
  complete: { name: "complete", label: "Done", description: "Generation complete" },
};

// ── Event Types ───────────────────────────────────────────────────
export type EventType =
  | "started"
  | "stage_started"
  | "stage_completed"
  | "stage_failed"
  | "retrying"
  | "warning"
  | "cancelled"
  | "completed";

// ── Event Envelope ────────────────────────────────────────────────
export interface ProgressEventEnvelope {
  schemaVersion: number;
  eventId: string;
  eventType: EventType;
  workflowId: string;
  stage: StageName;
  sequence: number;
  createdAt: string;
  payload: ProgressEventPayload;
}

export type ProgressEventPayload =
  | StartedPayload
  | StageStartedPayload
  | StageCompletedPayload
  | StageFailedPayload
  | RetryingPayload
  | WarningPayload
  | CancelledPayload
  | CompletedPayload;

// ── Payloads ──────────────────────────────────────────────────────
export interface StartedPayload {
  totalStages: number;
  stages: StageName[];
}

export interface StageStartedPayload {
  stageLabel: string;
  attempt: number;
  model?: string;
  provider?: string;
}

export interface StageCompletedPayload {
  stageLabel: string;
  attempt: number;
  durationMs: number;
  model?: string;
  provider?: string;
}

export interface StageFailedPayload {
  stageLabel: string;
  attempt: number;
  durationMs: number;
  message: string;
  retryable: boolean;
  model?: string;
  provider?: string;
}

export interface RetryingPayload {
  stageLabel: string;
  attempt: number;
  nextAttempt: number;
  nextModel?: string;
  nextProvider?: string;
  message: string;
  retryDelayMs: number;
}

export interface WarningPayload {
  message: string;
  severity: "low" | "medium" | "high";
  detail?: string;
}

export interface CancelledPayload {
  reason: string;
  stageLabel: string;
}

export interface CompletedPayload {
  totalDurationMs: number;
  model?: string;
  provider?: string;
  resultSummary?: string;
}

// ── Helpers ───────────────────────────────────────────────────────
let _sequence = 0;

export function nextSequence(): number {
  _sequence++;
  return _sequence;
}

export function createEvent(
  workflowId: string,
  eventType: EventType,
  stage: StageName,
  payload: ProgressEventPayload,
  sequence?: number,
): ProgressEventEnvelope {
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    eventId: crypto.randomUUID(),
    eventType,
    workflowId,
    stage,
    sequence: sequence ?? nextSequence(),
    createdAt: new Date().toISOString(),
    payload,
  };
}
