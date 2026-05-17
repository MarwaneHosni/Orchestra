import { eq } from "drizzle-orm";
import { getDb } from "../../db/sqlite/index.js";
import * as schema from "../../db/sqlite/schema/index.js";
import { validateStepTransition, validateWorkflowTransition, validateRequiredFields } from "./validation.js";

export interface WorkflowRunRecord {
  id: string;
  planId: string;
  status: string;
  stepStatuses: {
    synthesis: string;
    analysis: string;
    blueprint: string;
    roadmap: string;
    taskGraph: string;
    promptGen: string;
  };
  provider?: string;
  model?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

const STEP_KEYS: (keyof WorkflowRunRecord["stepStatuses"])[] = [
  "synthesis",
  "analysis",
  "blueprint",
  "roadmap",
  "taskGraph",
  "promptGen",
];

function rowToRecord(row: typeof schema.workflowRuns.$inferSelect): WorkflowRunRecord {
  return {
    id: row.id,
    planId: row.planId,
    status: row.status,
    stepStatuses: {
      synthesis: row.synthesisStatus,
      analysis: row.analysisStatus,
      blueprint: row.blueprintStatus,
      roadmap: row.roadmapStatus,
      taskGraph: row.taskGraphStatus,
      promptGen: row.promptGenStatus,
    },
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? undefined,
  } as WorkflowRunRecord;
}

export function createWorkflowRun(id: string, planId: string): WorkflowRunRecord {
  validateRequiredFields("WorkflowRun", { id, planId }, ["id", "planId"]);
  const now = new Date().toISOString();
  getDb()
    .insert(schema.workflowRuns)
    .values({
      id,
      planId,
      status: "running",
      synthesisStatus: "running",
      analysisStatus: "pending",
      blueprintStatus: "pending",
      roadmapStatus: "pending",
      taskGraphStatus: "pending",
      promptGenStatus: "pending",
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    } as any)
    .run();
  return getWorkflowRun(id)!;
}

export function getWorkflowRun(id: string): WorkflowRunRecord | undefined {
  const row = getDb().select().from(schema.workflowRuns).where(eq(schema.workflowRuns.id, id)).get();
  return row ? rowToRecord(row) : undefined;
}

export function updateWorkflowStep(
  id: string,
  step: keyof WorkflowRunRecord["stepStatuses"],
  newStatus: string,
): void {
  const run = getWorkflowRun(id);
  if (!run) throw new Error(`Workflow run '${id}' not found`);

  const stepKey = step as string;
  const currentStatus = run.stepStatuses[step];
  validateStepTransition(stepKey, currentStatus, newStatus);

  const now = new Date().toISOString();
  const columnMap: Record<string, string> = {
    synthesis: "synthesis_status",
    analysis: "analysis_status",
    blueprint: "blueprint_status",
    roadmap: "roadmap_status",
    taskGraph: "task_graph_status",
    promptGen: "prompt_gen_status",
  };
  const col = columnMap[stepKey];
  if (!col) return;

  getDb()
    .update(schema.workflowRuns)
    .set({ [col]: newStatus, updatedAt: now } as any)
    .where(eq(schema.workflowRuns.id, id))
    .run();
}

export function completeWorkflowRun(
  id: string,
  finalStatus: string,
  provider?: string,
  model?: string,
  errorMessage?: string,
): void {
  const run = getWorkflowRun(id);
  if (!run) throw new Error(`Workflow run '${id}' not found`);

  validateWorkflowTransition(run.status, finalStatus);

  const now = new Date().toISOString();
  getDb()
    .update(schema.workflowRuns)
    .set({
      status: finalStatus,
      provider: provider ?? null,
      model: model ?? null,
      errorMessage: errorMessage ?? null,
      completedAt: now,
      updatedAt: now,
    } as any)
    .where(eq(schema.workflowRuns.id, id))
    .run();
}

export function findLatestWorkflowRun(planId: string): WorkflowRunRecord | undefined {
  const rows = getDb().select().from(schema.workflowRuns).where(eq(schema.workflowRuns.planId, planId)).all();
  if (rows.length === 0) return undefined;
  const sorted = rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return rowToRecord(sorted[0]!);
}

export function detectInterruptedWorkflows(): WorkflowRunRecord[] {
  const rows = getDb()
    .select()
    .from(schema.workflowRuns)
    .where(eq(schema.workflowRuns.status, "running"))
    .all();
  return rows.map(rowToRecord);
}

export function repairIncompleteStep(id: string, step: keyof WorkflowRunRecord["stepStatuses"]): void {
  const run = getWorkflowRun(id);
  if (!run) return;
  // Mark a step as failed if it was left in "running" on crash
  if (run.stepStatuses[step] === "running" || run.stepStatuses[step] === "pending") {
    updateWorkflowStep(id, step, "failed");
  }
  // If all steps are failed/completed, mark the whole workflow as failed
  const runAfter = getWorkflowRun(id)!;
  const allDone = STEP_KEYS.every(
    (k) => runAfter.stepStatuses[k] === "completed" || runAfter.stepStatuses[k] === "failed",
  );
  if (allDone && runAfter.status === "running") {
    completeWorkflowRun(id, "failed", undefined, undefined, "Workflow interrupted — steps did not complete");
  }
}
