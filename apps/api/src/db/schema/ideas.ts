import { pgTable, uuid, text, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const ideaStatuses = ["raw", "refining", "refined"] as const;

export const ideas = pgTable(
  "ideas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    rawDescription: text("raw_description").notNull(),
    refinedDescription: text("refined_description"),
    status: varchar("status", { length: 20 }).default("raw").notNull(),
    interviewData: text("interview_data"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("ideas_project_id_idx").on(table.projectId),
  }),
);
