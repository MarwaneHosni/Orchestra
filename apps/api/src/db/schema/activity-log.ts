import { pgTable, uuid, timestamp, varchar, text, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { projectSnapshots } from "./project-snapshots.js";

export const activityEventTypes = [
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
] as const;

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    eventType: varchar("event_type", { length: 30 }).notNull(),
    sessionId: uuid("session_id"),
    planId: uuid("plan_id"),
    snapshotId: uuid("snapshot_id").references(() => projectSnapshots.id),
    description: text("description").notNull(),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("activity_log_project_id_idx").on(table.projectId),
    eventTypeIdx: index("activity_log_event_type_idx").on(table.eventType),
    createdAtIdx: index("activity_log_created_at_idx").on(table.createdAt),
    projectCreatedAtIdx: index("activity_log_project_created_idx").on(table.projectId, table.createdAt),
  }),
);
