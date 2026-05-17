import { eq } from "drizzle-orm";
import { getDb } from "../../db/sqlite/index.js";
import * as schema from "../../db/sqlite/schema/index.js";

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
  status: string,
): void {
  const now = new Date().toISOString();
  const columnMap: Record<string, string> = {
    synthesis: "synthesis_status",
    analysis: "analysis_status",
    blueprint: "blueprint_status",
    roadmap: "roadmap_status",
    taskGraph: "task_graph_status",
    promptGen: "prompt_gen_status",
  };
  const col = columnMap[step];
  if (!col) return;
  getDb()
    .update(schema.workflowRuns)
    .set({ [col]: status, updatedAt: now } as any)
    .where(eq(schema.workflowRuns.id, id))
    .run();
}

export function completeWorkflowRun(
  id: string,
  status: string,
  provider?: string,
  model?: string,
  errorMessage?: string,
): void {
  const now = new Date().toISOString();
  getDb()
    .update(schema.workflowRuns)
    .set({
      status,
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
