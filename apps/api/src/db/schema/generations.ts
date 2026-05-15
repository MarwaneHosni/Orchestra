import { pgTable, uuid, integer, timestamp, varchar, text, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { subphases } from "./subphases.js";

export const generationTypes = ["blueprint", "roadmap", "task_graph", "prompt"] as const;
export const generationStatuses = ["pending", "streaming", "complete", "failed"] as const;

export const generations = pgTable(
  "generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    subphaseId: uuid("subphase_id").references(() => subphases.id),
    type: varchar("type", { length: 20 }).notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    promptText: text("prompt_text"),
    resultText: text("result_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("generations_project_id_idx").on(table.projectId),
    typeIdx: index("generations_type_idx").on(table.type),
  }),
);
