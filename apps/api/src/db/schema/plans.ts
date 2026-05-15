import { pgTable, uuid, integer, timestamp, varchar, text, index, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const planStatuses = ["generating", "complete", "failed"] as const;

export const plans = pgTable("plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  version: integer("version").default(1).notNull(),
  status: varchar("status", { length: 20 }).default("generating").notNull(),
  generationParameters: text("generation_parameters"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("plans_project_id_idx").on(table.projectId),
  projectVersionUnique: uniqueIndex("plans_project_version_unique").on(table.projectId, table.version),
}));
