import { pgTable, uuid, text, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { questions } from "./questions.js";
import { projects } from "./projects.js";
import { interviewSessions } from "./interview_sessions.js";

export const answerConfidences = ["high", "medium", "low"] as const;
export const answerProvenances = ["user", "ai_suggested", "ai_generated"] as const;

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .references(() => questions.id)
      .notNull(),
    projectId: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    interviewSessionId: uuid("interview_session_id").references(() => interviewSessions.id),
    value: text("value").notNull(),
    confidence: varchar("confidence", { length: 10 }).default("medium").notNull(),
    provenance: varchar("provenance", { length: 15 }).default("user").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    questionProjectIdx: index("answers_question_project_idx").on(table.questionId, table.projectId),
    sessionIdx: index("answers_session_idx").on(table.interviewSessionId),
  }),
);
