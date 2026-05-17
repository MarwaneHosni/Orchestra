import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { plans } from "./plans.js";
import { projects } from "./projects.js";

export const taskGraphStatuses = ["generating", "complete", "failed", "superseded"] as const;

export const taskGraphs = sqliteTable(
  "task_graphs",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    planVersion: integer("plan_version").notNull(),
    graphVersion: integer("graph_version").default(1).notNull(),
    derivedFromGraphId: text("derived_from_graph_id"),
    status: text("status", { enum: taskGraphStatuses }).default("generating").notNull(),
    taskCount: integer("task_count").default(0).notNull(),
    dependencyCount: integer("dependency_count").default(0).notNull(),
    failureReason: text("failure_reason"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    planIdIdx: index("task_graphs_plan_id_idx").on(table.planId),
    projectIdIdx: index("task_graphs_project_id_idx").on(table.projectId),
    planVersionUnique: uniqueIndex("task_graphs_plan_version_unique").on(table.planId, table.graphVersion),
  }),
);
