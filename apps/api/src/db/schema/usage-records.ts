import { pgTable, uuid, varchar, text, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { users } from "./users.js";
import { interviewSessions } from "./interview_sessions.js";

export const usageRecordStatuses = ["estimated", "completed", "failed"] as const;

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    sessionId: uuid("session_id").references(() => interviewSessions.id),
    taskType: varchar("task_type", { length: 30 }).notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    estimatedPromptTokens: integer("estimated_prompt_tokens").default(0).notNull(),
    estimatedCompletionTokens: integer("estimated_completion_tokens").default(0).notNull(),
    estimatedCost: numeric("estimated_cost", { precision: 12, scale: 6 }).default("0").notNull(),
    actualPromptTokens: integer("actual_prompt_tokens"),
    actualCompletionTokens: integer("actual_completion_tokens"),
    actualTotalTokens: integer("actual_total_tokens"),
    actualCost: numeric("actual_cost", { precision: 12, scale: 6 }),
    status: varchar("status", { length: 15 }).default("estimated").notNull(),
    requestId: varchar("request_id", { length: 100 }),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("usage_records_project_id_idx").on(table.projectId),
    userIdIdx: index("usage_records_user_id_idx").on(table.userId),
    sessionIdIdx: index("usage_records_session_id_idx").on(table.sessionId),
    createdAtIdx: index("usage_records_created_at_idx").on(table.createdAt),
  }),
);
