import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Fixed Lifecycle — the schema encodes this so AI cannot reorder
// ─────────────────────────────────────────────────────────────

export const PHASE_ORDER = [
  "ideation",
  "requirements",
  "architecture",
  "security",
  "database",
  "backend",
  "frontend",
  "core-features",
  "ai-systems",
  "testing",
  "deployment",
  "monitoring",
] as const;

export const PhaseTypeSchema = z.enum(PHASE_ORDER);
export type PhaseType = z.infer<typeof PhaseTypeSchema>;

export const PHASE_LABELS: Record<PhaseType, string> = {
  ideation: "Ideation & Discovery",
  requirements: "Requirements Engineering",
  architecture: "System Architecture",
  security: "Security Planning",
  database: "Database Design",
  backend: "Backend Design",
  frontend: "Frontend Design",
  "core-features": "Core Feature Implementation",
  "ai-systems": "AI / Advanced Systems",
  testing: "Testing & Validation",
  deployment: "Deployment",
  monitoring: "Monitoring & Maintenance",
};

// ─────────────────────────────────────────────────────────────
// Generation metadata — stamped onto every AI-generated artifact
// ─────────────────────────────────────────────────────────────

export const GenerationMetadataSchema = z.object({
  model: z.string().min(1),
  provider: z.string().min(1),
  generationId: z.string().uuid(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  estimatedCost: z.number().nonnegative(),
  fallbackUsed: z.boolean().default(false),
  routerDecision: z.string().optional(),
});

export type GenerationMetadata = z.infer<typeof GenerationMetadataSchema>;

// ─────────────────────────────────────────────────────────────
// Artifact base — shared fields across all generated outputs
// ─────────────────────────────────────────────────────────────

export const ArtifactBaseSchema = z.object({
  planId: z.string().min(1),
  planVersion: z.number().int().positive(),
  projectId: z.string().uuid(),
  sessionId: z.string().uuid(),
  createdAt: z.string().datetime(),
  schemaVersion: z.literal("orchestra-generated-v1"),
});

// ─────────────────────────────────────────────────────────────
// Blueprint — structured plan output
// ─────────────────────────────────────────────────────────────

export const AnswerRefSchema = z.object({
  questionRef: z.string(),
  questionText: z.string(),
  normalizedValue: z.string(),
});

export const PhaseContentSchema = z.object({
  phaseType: PhaseTypeSchema,
  phaseName: z.string().min(1),
  summary: z.string().min(1),
  narrative: z.string().min(1),
  status: z.enum(["sufficient", "insufficient", "missing", "ai_augmented"]),
  confidence: z.number().min(0).max(1),
  keyDecisions: z.array(z.string()).default([]),
  sourceAnswers: z.array(AnswerRefSchema).default([]),
  executionPrompt: z.string().optional(),
});

export const StructuredItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  source: z.string().min(1),
  sourceQuestionRef: z.string().optional(),
  provenance: z.string().default("ai_generated"),
});

export const BlueprintOutputSchema = ArtifactBaseSchema.extend({
  artifactType: z.literal("blueprint"),
  phases: z
    .array(PhaseContentSchema)
    .length(PHASE_ORDER.length)
    .refine((phases) => phases.every((p, i) => p.phaseType === PHASE_ORDER[i]), {
      message: `Phases must match the fixed lifecycle order: ${PHASE_ORDER.join(", ")}`,
    }),
  assumptions: z.array(StructuredItemSchema).default([]),
  constraints: z.array(StructuredItemSchema).default([]),
  risks: z.array(StructuredItemSchema).default([]),
  overallConfidence: z.number().min(0).max(1),
  overallSummary: z.string().min(1),
  generationMetadata: GenerationMetadataSchema,
});

export type BlueprintOutput = z.infer<typeof BlueprintOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Roadmap — sequenced phases with dependencies and time estimates
// ─────────────────────────────────────────────────────────────

export const RoadmapPhaseSchema = z.object({
  phaseType: PhaseTypeSchema,
  phaseName: z.string().min(1),
  order: z.number().int().nonnegative(),
  estimatedDuration: z.string().optional(),
  effort: z.enum(["small", "medium", "large", "unknown"]).default("unknown"),
  prerequisites: z.array(PhaseTypeSchema).default([]),
  rationale: z.string().optional(),
});

export const RoadmapOutputSchema = ArtifactBaseSchema.extend({
  artifactType: z.literal("roadmap"),
  phases: z.array(RoadmapPhaseSchema).length(PHASE_ORDER.length),
  totalEffort: z.enum(["small", "medium", "large"]).optional(),
  recommendedApproach: z.string().optional(),
  generationMetadata: GenerationMetadataSchema,
});

export type RoadmapOutput = z.infer<typeof RoadmapOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Task Graph — decomposed per-phase tasks with dependencies
// ─────────────────────────────────────────────────────────────

export const TaskTypeSchema = z.enum([
  "code",
  "config",
  "test",
  "docs",
  "review",
  "deploy",
  "pending_input",
  "other",
]);

export const TaskPrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const TaskStatusSchema = z.enum([
  "pending",
  "blocked",
  "ready",
  "in_progress",
  "complete",
  "needs_review",
]);

export const AITaskNodeSchema = z.object({
  id: z.string().uuid(),
  phaseType: PhaseTypeSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  type: TaskTypeSchema,
  priority: TaskPrioritySchema.default("medium"),
  status: TaskStatusSchema.default("pending"),
  order: z.number().int().nonnegative(),
  dependencies: z.array(z.string().uuid()).default([]),
  acceptanceCriteria: z.array(z.string()).default([]),
  estimatedPromptRounds: z.number().int().positive().default(1),
  sourcePhase: z.string().optional(),
});

export const AITaskGraphOutputSchema = ArtifactBaseSchema.extend({
  artifactType: z.literal("task_graph"),
  tasks: z.array(AITaskNodeSchema),
  phaseTaskCounts: z.record(z.string(), z.number().int().nonnegative()).default({}),
  generationMetadata: GenerationMetadataSchema,
});

export type AITaskGraphOutput = z.infer<typeof AITaskGraphOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Prompt Bundle — AI execution prompts per task
// ─────────────────────────────────────────────────────────────

export const PromptSectionSchema = z.object({
  objective: z.string().min(1),
  context: z.string().min(1),
  constraints: z.array(z.string()).default([]),
  expectedOutput: z.string().min(1),
  validationCriteria: z.array(z.string()).default([]),
  architecturalAlignment: z.string().optional(),
  agentTips: z.array(z.string()).default([]),
});

export const AIPromptArtifactSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  planId: z.string().uuid(),
  planVersion: z.number().int().positive(),
  promptText: z.string(),
  sections: PromptSectionSchema,
  version: z.number().int().positive().default(1),
  status: z.enum(["pending", "complete", "failed", "needs_review"]).default("pending"),
  validationErrors: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
});

export const PromptBundleOutputSchema = ArtifactBaseSchema.extend({
  artifactType: z.literal("prompt_bundle"),
  taskCount: z.number().int().nonnegative(),
  promptCount: z.number().int().nonnegative(),
  prompts: z.array(AIPromptArtifactSchema),
  generationMetadata: GenerationMetadataSchema,
});

export type PromptBundleOutput = z.infer<typeof PromptBundleOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Project Summary — AI-generated synthesis after all artifacts
// ─────────────────────────────────────────────────────────────

export const ProjectSummarySchema = z.object({
  projectOverview: z.string().min(1),
  keyFeatures: z.array(z.string()).default([]),
  technicalConstraints: z.array(z.string()).default([]),
  businessConditions: z.array(z.string()).default([]),
  architectureHighlights: z.array(z.string()).default([]),
  riskSummary: z.string().default(""),
});

export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

// ─────────────────────────────────────────────────────────────
// Full Plan — all artifacts bundled together
// ─────────────────────────────────────────────────────────────

export const FullPlanOutputSchema = ArtifactBaseSchema.extend({
  artifactType: z.literal("full_plan"),
  blueprint: BlueprintOutputSchema,
  roadmap: RoadmapOutputSchema,
  taskGraph: AITaskGraphOutputSchema,
  promptBundle: PromptBundleOutputSchema,
});

export type FullPlanOutput = z.infer<typeof FullPlanOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Utility: validate phase order at runtime
// ─────────────────────────────────────────────────────────────

export function assertPhaseOrder(phases: string[]): void {
  if (phases.length !== PHASE_ORDER.length) {
    throw new Error(
      `Expected ${PHASE_ORDER.length} phases in order, got ${phases.length}. ` +
        `Required: ${PHASE_ORDER.join(", ")}`,
    );
  }
  for (let i = 0; i < PHASE_ORDER.length; i++) {
    if (phases[i] !== PHASE_ORDER[i]) {
      throw new Error(
        `Phase order mismatch at index ${i}: expected "${PHASE_ORDER[i]}", got "${phases[i]}". ` +
          `Phases must appear in the fixed lifecycle order: ${PHASE_ORDER.join(", ")}`,
      );
    }
  }
}
