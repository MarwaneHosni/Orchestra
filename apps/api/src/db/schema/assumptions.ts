import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const assumptionConfidences = ["high", "medium", "low"] as const;
export const assumptionStatuses = ["active", "validated", "invalidated"] as const;

export const assumptions = pgTable(
  "assumptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    phaseType: varchar("phase_type", { length: 30 }).notNull(),
    description: text("description").notNull(),
    confidence: varchar("confidence", { length: 10 }).default("medium").notNull(),
    status: varchar("status", { length: 15 }).default("active").notNull(),
    provenance: varchar("provenance", { length: 20 }).default("user").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("assumptions_project_id_idx").on(table.projectId),
  }),
);
