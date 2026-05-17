import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    status: text("status", { enum: ["draft", "active", "archived"] })
      .default("draft")
      .notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    statusIdx: index("projects_status_idx").on(table.status),
  }),
);
