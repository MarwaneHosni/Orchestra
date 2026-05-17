import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const questionTypes = ["text", "select", "multi_select", "boolean", "scale"] as const;

export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    phaseType: text("phase_type").notNull(),
    order: integer("order").notNull(),
    text: text("text").notNull(),
    type: text("type", { enum: questionTypes }).notNull(),
    options: text("options"),
    required: integer("required", { mode: "boolean" }).default(false).notNull(),
    dependencyRules: text("dependency_rules"),
    validationRules: text("validation_rules"),
    captureAs: text("capture_as"),
    helpText: text("help_text"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    phaseOrderIdx: index("questions_phase_order_idx").on(table.phaseType, table.order),
  }),
);
