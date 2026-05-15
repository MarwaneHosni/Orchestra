import { pgTable, uuid, integer, timestamp, varchar, text, boolean, index } from "drizzle-orm/pg-core";

export const questionTypes = ["text", "select", "multi_select", "boolean", "scale"] as const;

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phaseType: varchar("phase_type", { length: 30 }).notNull(),
    order: integer("order").notNull(),
    text: text("text").notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    options: text("options"),
    required: boolean("required").default(true).notNull(),
    dependencyRules: text("dependency_rules"),
    validationRules: text("validation_rules"),
    captureAs: text("capture_as"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    phaseTypeOrderIdx: index("questions_phase_type_order_idx").on(table.phaseType, table.order),
  }),
);
