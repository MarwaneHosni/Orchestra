import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const riskLikelihoods = ["low", "medium", "high"] as const;
export const riskStatuses = ["identified", "mitigated", "accepted", "realized"] as const;

export const risks = pgTable(
  "risks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    phaseType: varchar("phase_type", { length: 30 }).notNull(),
    description: text("description").notNull(),
    likelihood: varchar("likelihood", { length: 10 }).default("medium").notNull(),
    impact: varchar("impact", { length: 10 }).default("medium").notNull(),
    mitigation: text("mitigation"),
    status: varchar("status", { length: 15 }).default("identified").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("risks_project_id_idx").on(table.projectId),
  }),
);
