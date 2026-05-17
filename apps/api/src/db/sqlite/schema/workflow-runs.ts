import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { plans } from "./plans.js";

export const workflowStepStatuses = ["pending", "running", "completed", "failed"] as const;
export const workflowRunStatuses = ["running", "completed", "failed"] as const;

export const workflowRuns = sqliteTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    status: text("status", { enum: workflowRunStatuses }).default("running").notNull(),
    synthesisStatus: text("synthesis_status", { enum: workflowStepStatuses }).default("pending").notNull(),
    analysisStatus: text("analysis_status", { enum: workflowStepStatuses }).default("pending").notNull(),
    blueprintStatus: text("blueprint_status", { enum: workflowStepStatuses }).default("pending").notNull(),
    roadmapStatus: text("roadmap_status", { enum: workflowStepStatuses }).default("pending").notNull(),
    taskGraphStatus: text("task_graph_status", { enum: workflowStepStatuses }).default("pending").notNull(),
    promptGenStatus: text("prompt_gen_status", { enum: workflowStepStatuses }).default("pending").notNull(),
    provider: text("provider"),
    model: text("model"),
    errorMessage: text("error_message"),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    planIdIdx: index("wf_runs_plan_id_idx").on(table.planId),
    statusIdx: index("wf_runs_status_idx").on(table.status),
  }),
);
