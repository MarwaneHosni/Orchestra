import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { projects } from "./projects.js";

export const ideas = sqliteTable(
  "ideas",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    rawDescription: text("raw_description").notNull(),
    refinedDescription: text("refined_description"),
    status: text("status", { enum: ["raw", "refining", "refined"] })
      .default("raw")
      .notNull(),
    provenance: text("provenance").default("user").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    projectIdIdx: index("ideas_project_id_idx").on(table.projectId),
  }),
);
