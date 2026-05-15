import { pgTable, uuid, integer, timestamp, varchar, text, index } from "drizzle-orm/pg-core";
import { phases } from "./phases.js";

export const subphaseStatuses = ["pending", "in_progress", "complete"] as const;

export const subphases = pgTable(
  "subphases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phaseId: uuid("phase_id")
      .references(() => phases.id)
      .notNull(),
    order: integer("order").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    aiPrompt: text("ai_prompt"),
    acceptanceCriteria: text("acceptance_criteria"),
    dependencyIds: text("dependency_ids"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    phaseIdOrderIdx: index("subphases_phase_id_order_idx").on(table.phaseId, table.order),
  }),
);
