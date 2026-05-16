import { z } from "zod";
import { uuidSchema } from "./index.js";

export const taskGraphStatusSchema = z.enum(["generating", "complete", "failed", "superseded"]);
export type TaskGraphStatus = z.infer<typeof taskGraphStatusSchema>;

export const taskGraphSchema = z.object({
  id: uuidSchema,
  planId: uuidSchema,
  projectId: uuidSchema,
  planVersion: z.number().int().positive(),
  graphVersion: z.number().int().positive().default(1),
  derivedFromGraphId: uuidSchema.nullable().optional(),
  status: taskGraphStatusSchema.default("generating"),
  taskCount: z.number().int().nonnegative().default(0),
  dependencyCount: z.number().int().nonnegative().default(0),
  failureReason: z.string().nullable().optional(),
  metadata: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TaskGraphRecord = z.infer<typeof taskGraphSchema>;

export const projectSnapshotStatusSchema = z.enum(["creating", "complete", "failed"]);
export type ProjectSnapshotStatus = z.infer<typeof projectSnapshotStatusSchema>;

export const projectSnapshotReasonSchema = z.enum([
  "initial",
  "interview_complete",
  "plan_regenerated",
  "phase_edited",
  "task_graph_regenerated",
  "manual",
]);
export type ProjectSnapshotReason = z.infer<typeof projectSnapshotReasonSchema>;

export const projectSnapshotSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  version: z.number().int().positive(),
  parentSnapshotId: uuidSchema.nullable().optional(),
  reason: projectSnapshotReasonSchema,
  status: projectSnapshotStatusSchema.default("creating"),
  planId: uuidSchema.nullable().optional(),
  planVersion: z.number().int().positive().nullable().optional(),
  blueprintId: uuidSchema.nullable().optional(),
  taskGraphId: uuidSchema.nullable().optional(),
  interviewSessionId: uuidSchema.nullable().optional(),
  answerCount: z.number().int().nonnegative().default(0),
  affectedPhaseTypes: z.array(z.string()).nullable().optional(),
  changeSummary: z.string().nullable().optional(),
  metadata: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});

export type ProjectSnapshotRecord = z.infer<typeof projectSnapshotSchema>;

export const activityEventTypeSchema = z.enum([
  "project.created",
  "interview.started",
  "interview.completed",
  "answer.submitted",
  "answer.edited",
  "plan.generated",
  "plan.regenerated",
  "blueprint.generated",
  "task_graph.generated",
  "task_graph.regenerated",
  "prompts.exported",
  "snapshot.created",
  "phase.insufficient",
  "phase.missing",
  "generation.failed",
]);
export type ActivityEventType = z.infer<typeof activityEventTypeSchema>;

export const activityLogEntrySchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  eventType: activityEventTypeSchema,
  sessionId: uuidSchema.nullable().optional(),
  planId: uuidSchema.nullable().optional(),
  snapshotId: uuidSchema.nullable().optional(),
  description: z.string().min(1),
  metadata: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});

export type ActivityLogEntry = z.infer<typeof activityLogEntrySchema>;
