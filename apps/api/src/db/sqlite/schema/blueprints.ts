import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { plans } from "./plans.js";
import { projects } from "./projects.js";

export const blueprintFormats = ["json", "yaml", "markdown"] as const;
export const blueprintStatuses = ["generating", "complete", "failed"] as const;

export const blueprints = sqliteTable(
  "blueprints",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    content: text("content").notNull(),
    format: text("format", { enum: blueprintFormats }).default("json").notNull(),
    version: integer("version").default(1).notNull(),
    status: text("status", { enum: blueprintStatuses }).default("generating").notNull(),
    staleAt: text("stale_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    planIdIdx: index("blueprints_plan_id_idx").on(table.planId),
    projectIdIdx: index("blueprints_project_id_idx").on(table.projectId),
    planVersionUnique: uniqueIndex("blueprints_plan_version_unique").on(table.planId, table.version),
  }),
);
