import { pgTable, uuid, integer, timestamp, varchar, text, index, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { plans } from "./plans.js";
import { blueprints } from "./blueprints.js";
import { taskGraphs } from "./task-graphs.js";
import { interviewSessions } from "./interview_sessions.js";

export const projectSnapshotStatuses = ["creating", "complete", "failed"] as const;
export const projectSnapshotReasons = [
  "initial",
  "interview_complete",
  "plan_regenerated",
  "phase_edited",
  "task_graph_regenerated",
  "manual",
] as const;

export const projectSnapshots = pgTable(
  "project_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    version: integer("version").notNull(),
    parentSnapshotId: uuid("parent_snapshot_id"),
    reason: varchar("reason", { length: 30 }).notNull(),
    status: varchar("status", { length: 15 }).default("creating").notNull(),
    planId: uuid("plan_id").references(() => plans.id),
    planVersion: integer("plan_version"),
    blueprintId: uuid("blueprint_id").references(() => blueprints.id),
    taskGraphId: uuid("task_graph_id").references(() => taskGraphs.id),
    interviewSessionId: uuid("interview_session_id").references(() => interviewSessions.id),
    answerCount: integer("answer_count").default(0).notNull(),
    affectedPhaseTypes: text("affected_phase_types"),
    changeSummary: text("change_summary"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("project_snapshots_project_id_idx").on(table.projectId),
    projectVersionUnique: uniqueIndex("project_snapshots_project_version_unique").on(
      table.projectId,
      table.version,
    ),
    parentSnapshotIdIdx: index("project_snapshots_parent_idx").on(table.parentSnapshotId),
  }),
);
