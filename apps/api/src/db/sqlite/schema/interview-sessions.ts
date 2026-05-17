import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { projects } from "./projects.js";

export const interviewSessionStatuses = [
  "draft",
  "in_progress",
  "waiting_for_answers",
  "ready_for_generation",
  "completed",
] as const;

export const interviewSessions = sqliteTable(
  "interview_sessions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    status: text("status", { enum: interviewSessionStatuses }).default("draft").notNull(),
    currentPhaseIndex: integer("current_phase_index").default(0).notNull(),
    currentQuestionIndex: integer("current_question_index").default(0).notNull(),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    projectIdIdx: index("sessions_project_id_idx").on(table.projectId),
    statusIdx: index("sessions_status_idx").on(table.status),
  }),
);
