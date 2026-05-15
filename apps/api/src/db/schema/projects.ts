import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const projectStatuses = ["draft", "active", "archived"] as const;

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description").default("").notNull(),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("projects_user_id_idx").on(table.userId),
  statusIdx: index("projects_status_idx").on(table.status),
}));
