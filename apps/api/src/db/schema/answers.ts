import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { questions } from "./questions.js";
import { projects } from "./projects.js";

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
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    questionProjectIdx: index("answers_question_project_idx").on(table.questionId, table.projectId),
  }),
);
