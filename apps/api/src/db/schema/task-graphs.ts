import { pgTable, uuid, integer, timestamp, varchar, text, index, uniqueIndex } from "drizzle-orm/pg-core";
import { plans } from "./plans.js";
import { projects } from "./projects.js";

export const taskGraphStatuses = ["generating", "complete", "failed", "superseded"] as const;

export const taskGraphs = pgTable(
  "task_graphs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .references(() => plans.id)
      .notNull(),
    projectId: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    planVersion: integer("plan_version").notNull(),
    graphVersion: integer("graph_version").default(1).notNull(),
    derivedFromGraphId: uuid("derived_from_graph_id"),
    status: varchar("status", { length: 15 }).default("generating").notNull(),
    taskCount: integer("task_count").default(0).notNull(),
    dependencyCount: integer("dependency_count").default(0).notNull(),
    failureReason: text("failure_reason"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    planIdIdx: index("task_graphs_plan_id_idx").on(table.planId),
    projectIdIdx: index("task_graphs_project_id_idx").on(table.projectId),
    planVersionUnique: uniqueIndex("task_graphs_plan_version_unique").on(table.planId, table.graphVersion),
  }),
);
