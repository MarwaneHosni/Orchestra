import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { projects } from "./projects.js";

export const activityEventTypes = [
  "project.created",
  "project.updated",
  "project.deleted",
  "session.created",
  "session.completed",
  "answer.submitted",
  "answer.edited",
  "plan.generated",
  "plan.regenerated",
  "blueprint.generated",
  "credential.created",
  "credential.updated",
  "credential.deleted",
  "credential.validated",
  "generation.attempted",
  "generation.completed",
  "retry.attempt",
  "retry.exhausted",
  "export.created",
  "snapshot.created",
] as const;

export const activityLog = sqliteTable(
  "activity_log",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    eventType: text("event_type", { enum: activityEventTypes }).notNull(),
    actorId: text("actor_id"),
    resourceId: text("resource_id"),
    description: text("description"),
    metadata: text("metadata"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    projectIdIdx: index("activity_log_project_id_idx").on(table.projectId),
    eventTypeIdx: index("activity_log_event_type_idx").on(table.eventType),
    projectCreatedIdx: index("activity_log_project_created_idx").on(table.projectId, table.createdAt),
  }),
);
