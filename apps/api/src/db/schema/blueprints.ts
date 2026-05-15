import { pgTable, uuid, integer, timestamp, varchar, text, index, uniqueIndex } from "drizzle-orm/pg-core";
import { plans } from "./plans.js";
import { projects } from "./projects.js";

export const blueprintFormats = ["json", "yaml", "markdown"] as const;
export const blueprintStatuses = ["generating", "complete", "failed"] as const;

export const blueprints = pgTable(
  "blueprints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .references(() => plans.id)
      .notNull(),
    projectId: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    content: text("content").notNull(),
    format: varchar("format", { length: 10 }).default("markdown").notNull(),
    version: integer("version").default(1).notNull(),
    status: varchar("status", { length: 15 }).default("generating").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    planIdIdx: index("blueprints_plan_id_idx").on(table.planId),
    projectIdIdx: index("blueprints_project_id_idx").on(table.projectId),
    planVersionUnique: uniqueIndex("blueprints_plan_version_unique").on(table.planId, table.version),
  }),
);
