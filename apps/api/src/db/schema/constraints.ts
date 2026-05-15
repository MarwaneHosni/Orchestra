import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const constraintTypes = ["technical", "business", "time", "resource", "legal"] as const;
export const constraintSeverities = ["critical", "major", "minor"] as const;

export const constraints = pgTable(
  "constraints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    phaseType: varchar("phase_type", { length: 30 }).notNull(),
    description: text("description").notNull(),
    type: varchar("type", { length: 15 }).default("technical").notNull(),
    severity: varchar("severity", { length: 10 }).default("major").notNull(),
    provenance: varchar("provenance", { length: 20 }).default("user").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("constraints_project_id_idx").on(table.projectId),
  }),
);
