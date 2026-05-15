import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const interviewSessionStatuses = ["draft", "in_progress", "complete"] as const;

export const interviewSessions = pgTable(
  "interview_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    status: varchar("status", { length: 20 }).default("draft").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("interview_sessions_project_id_idx").on(table.projectId),
  }),
);
