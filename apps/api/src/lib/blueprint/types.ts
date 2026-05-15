import { z } from "zod";

export const AmbiguityFlagSchema = z.object({
  type: z.enum(["missing", "too_short", "low_confidence", "vague", "conflicting"]),
  questionRef: z.string().optional(),
  message: z.string(),
  severity: z.enum(["low", "medium", "high"]),
});

export type AmbiguityFlag = z.infer<typeof AmbiguityFlagSchema>;

export const PhaseAnswerSchema = z.object({
  questionRef: z.string(),
  questionText: z.string(),
  normalizedValue: z.string(),
  originalValue: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  required: z.boolean(),
});

export type PhaseAnswer = z.infer<typeof PhaseAnswerSchema>;

export const PhaseBlueprintSchema = z.object({
  phaseType: z.string(),
  phaseName: z.string(),
  summary: z.string(),
  status: z.enum(["sufficient", "insufficient", "missing"]),
  confidence: z.number().min(0).max(1),
  answers: z.array(PhaseAnswerSchema),
  ambiguityFlags: z.array(AmbiguityFlagSchema),
});

export type PhaseBlueprint = z.infer<typeof PhaseBlueprintSchema>;

export const StructuredItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  source: z.string(),
  provenance: z.string(),
});

export type StructuredItem = z.infer<typeof StructuredItemSchema>;

export const BlueprintOutputSchema = z.object({
  projectId: z.string(),
  sessionId: z.string(),
  planVersion: z.number().int().positive(),
  generatedAt: z.string().datetime(),
  projectName: z.string(),
  projectDescription: z.string(),
  phases: z.array(PhaseBlueprintSchema),
  assumptions: z.array(StructuredItemSchema),
  constraints: z.array(StructuredItemSchema),
  risks: z.array(StructuredItemSchema),
  overallConfidence: z.number().min(0).max(1),
  ambiguityFlags: z.array(AmbiguityFlagSchema),
});

export type BlueprintOutput = z.infer<typeof BlueprintOutputSchema>;
