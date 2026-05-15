import { pgTable, uuid, integer, timestamp, varchar, text, index } from "drizzle-orm/pg-core";
import { plans } from "./plans.js";

export const phaseStatuses = ["pending", "in_progress", "complete"] as const;

export const phases = pgTable("phases", {
  id: uuid("id").defaultRandom().primaryKey(),
  planId: uuid("plan_id").references(() => plans.id).notNull(),
  type: varchar("type", { length: 30 }).notNull(),
  order: integer("order").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  content: text("content"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  planIdOrderIdx: index("phases_plan_id_order_idx").on(table.planId, table.order),
}));
