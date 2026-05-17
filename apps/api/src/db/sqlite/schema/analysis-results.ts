import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";
import { plans } from "./plans.js";

export const analysisResults = sqliteTable(
  "analysis_results",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    phaseType: text("phase_type").notNull(),
    inputStatus: text("input_status", { enum: ["sufficient", "insufficient", "missing"] }).notNull(),
    answerCount: integer("answer_count").default(0).notNull(),
    requiredCount: integer("required_count").default(0).notNull(),
    inferredRequirements: text("inferred_requirements"),
    likelyConstraints: text("likely_constraints"),
    explicitAssumptions: text("explicit_assumptions"),
    identifiedRisks: text("identified_risks"),
    keyDecisions: text("key_decisions"),
    uncertaintyAreas: text("uncertainty_areas"),
    crossPhaseInsights: text("cross_phase_insights"),
    overallConfidence: real("overall_confidence"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    planIdIdx: index("analysis_results_plan_id_idx").on(table.planId),
    phaseTypeIdx: index("analysis_results_phase_type_idx").on(table.phaseType),
  }),
);
