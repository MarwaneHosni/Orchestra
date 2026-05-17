import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { interviewSessions } from "./interview-sessions.js";

export const answerConfidences = ["high", "medium", "low"] as const;
export const answerProvenances = ["user", "ai_suggested", "ai_generated"] as const;

export const answers = sqliteTable(
  "answers",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id").notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => interviewSessions.id),
    value: text("value").notNull(),
    confidence: text("confidence", { enum: answerConfidences }).default("medium").notNull(),
    provenance: text("provenance", { enum: answerProvenances }).default("user").notNull(),
    version: integer("version").default(1).notNull(),
    isLatest: integer("is_latest", { mode: "boolean" }).default(true).notNull(),
    supersededAt: text("superseded_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    sessionIdx: index("answers_session_idx").on(table.sessionId),
    questionSessionIdx: index("answers_question_session_idx").on(table.questionId, table.sessionId),
    latestIdx: index("answers_latest_idx").on(table.sessionId, table.isLatest),
  }),
);
