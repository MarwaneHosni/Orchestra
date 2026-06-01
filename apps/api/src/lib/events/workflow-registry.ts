import type { ProgressEventEnvelope } from "./progress-emitter.js";

interface WorkflowState {
  workflowId: string;
  startTime: number;
  lastEventTime: number;
  stage: string;
  eventHistory: ProgressEventEnvelope[];
  abortController: AbortController | null;
}

const workflows = new Map<string, WorkflowState>();
const MAX_HISTORY = 20;

export function registerWorkflow(workflowId: string): void {
  if (workflows.has(workflowId)) return;
  workflows.set(workflowId, {
    workflowId,
    startTime: Date.now(),
    lastEventTime: Date.now(),
    stage: "synthesis",
    eventHistory: [],
    abortController: new AbortController(),
  });
}

export function unregisterWorkflow(workflowId: string): void {
  workflows.delete(workflowId);
}

export function recordEvent(event: ProgressEventEnvelope): void {
  const wf = workflows.get(event.workflowId);
  if (!wf) return;
  wf.stage = event.stage;
  wf.lastEventTime = Date.now();
  wf.eventHistory.push(event);
  if (wf.eventHistory.length > MAX_HISTORY) {
    wf.eventHistory = wf.eventHistory.slice(-MAX_HISTORY);
  }
}

export function getWorkflowState(workflowId: string): WorkflowState | undefined {
  return workflows.get(workflowId);
}

export function getRecentEvents(workflowId: string): ProgressEventEnvelope[] {
  return workflows.get(workflowId)?.eventHistory ?? [];
}

export function cancelWorkflow(workflowId: string): boolean {
  const wf = workflows.get(workflowId);
  if (!wf) return false;
  if (wf.abortController) {
    wf.abortController.abort();
    wf.abortController = null;
  }
  return true;
}

export function isWorkflowActive(workflowId: string): boolean {
  const wf = workflows.get(workflowId);
  if (!wf) return false;
  return wf.abortController !== null;
}

export function getStalledWorkflows(timeoutMs: number): string[] {
  const now = Date.now();
  const stalled: string[] = [];
  for (const [id, wf] of workflows) {
    if (wf.abortController && (now - wf.lastEventTime) > timeoutMs) {
      stalled.push(id);
    }
  }
  return stalled;
}

export function getAllActiveWorkflows(): string[] {
  return [...workflows.entries()]
    .filter(([, wf]) => wf.abortController !== null)
    .map(([id]) => id);
}
