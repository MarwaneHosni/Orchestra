import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { projects } from "./projects.js";

export const planStatuses = ["generating", "complete", "failed"] as const;

export const plans = sqliteTable(
  "plans",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    version: integer("version").notNull(),
    status: text("status", { enum: planStatuses }).default("generating").notNull(),
    staleAt: text("stale_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    projectIdIdx: index("plans_project_id_idx").on(table.projectId),
    projectVersionUnique: uniqueIndex("plans_project_version_unique").on(table.projectId, table.version),
  }),
);
