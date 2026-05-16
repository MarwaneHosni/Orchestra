import { describe, expect, it } from "vitest";
import {
  BlueprintOutputSchema,
  RoadmapOutputSchema,
  AITaskGraphOutputSchema,
  PromptBundleOutputSchema,
  FullPlanOutputSchema,
  PhaseTypeSchema,
  GenerationMetadataSchema,
  assertPhaseOrder,
  PHASE_ORDER,
} from "./index.js";

// All test UUIDs must pass Zod v4's regex: 3rd group first char [1-8], 4th group first char [89abAB]
const mockGenerationMeta = {
  model: "gpt-4o",
  provider: "openai",
  generationId: "a1b2c3d4-e5f6-4789-8abc-ef0123456789",
  startedAt: "2026-05-16T12:00:00.000Z",
  completedAt: "2026-05-16T12:00:05.000Z",
  durationMs: 5000,
  promptTokens: 500,
  completionTokens: 800,
  totalTokens: 1300,
  estimatedCost: 0.005,
  fallbackUsed: false,
};

const artifactBase = {
  planId: "b2c3d4e5-f6a7-4890-8bcd-f01234567890",
  planVersion: 1,
  projectId: "c3d4e5f6-a7b8-4901-8cde-f01234567891",
  sessionId: "d4e5f6a7-b8c9-4a12-8def-012345678912",
  createdAt: "2026-05-16T12:00:05.000Z",
  schemaVersion: "orchestra-generated-v1" as const,
};

describe("GenerationMetadataSchema", () => {
  it("validates a complete metadata object", () => {
    const result = GenerationMetadataSchema.safeParse(mockGenerationMeta);
    expect(result.success).toBe(true);
  });

  it("requires all fields", () => {
    const result = GenerationMetadataSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("defaults fallbackUsed to false", () => {
    const { fallbackUsed: _fb, ...rest } = mockGenerationMeta;
    void _fb;
    const result = GenerationMetadataSchema.safeParse(rest);
    expect(result.success).toBe(true);
    expect(result.data?.fallbackUsed).toBe(false);
  });
});

describe("PhaseTypeSchema", () => {
  it("accepts valid phase types", () => {
    for (const phase of PHASE_ORDER) {
      expect(PhaseTypeSchema.safeParse(phase).success).toBe(true);
    }
  });

  it("rejects unknown phase types", () => {
    expect(PhaseTypeSchema.safeParse("unknown_phase").success).toBe(false);
    expect(PhaseTypeSchema.safeParse("design").success).toBe(false);
    expect(PhaseTypeSchema.safeParse("").success).toBe(false);
  });
});

describe("BlueprintOutputSchema", () => {
  const validBlueprint = {
    ...artifactBase,
    artifactType: "blueprint" as const,
    phases: PHASE_ORDER.map((phase) => ({
      phaseType: phase,
      phaseName: "Test Phase",
      summary: "A high-level summary of this phase",
      narrative: "A detailed narrative written by the AI describing goals, approach, and tradeoffs.",
      status: "sufficient" as const,
      confidence: 0.85,
      keyDecisions: ["Use PostgreSQL for persistence"],
      sourceAnswers: [
        { questionRef: "ideation.1", questionText: "What problem?", normalizedValue: "Build a chat app" },
      ],
    })),
    assumptions: [
      {
        id: "assumption-1",
        description: "Users have internet",
        source: "ideation.1",
        provenance: "ai_generated",
      },
    ],
    constraints: [],
    risks: [],
    overallConfidence: 0.85,
    overallSummary: "A comprehensive plan for building a chat application.",
    generationMetadata: mockGenerationMeta,
  };

  it("validates a complete blueprint", () => {
    const result = BlueprintOutputSchema.safeParse(validBlueprint);
    if (!result.success) console.error(result.error.issues);
    expect(result.success).toBe(true);
  });

  it("rejects blueprints with wrong phase count", () => {
    const bad = { ...validBlueprint, phases: validBlueprint.phases.slice(0, 6) };
    expect(BlueprintOutputSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects blueprints with wrong phase order", () => {
    const reversed = [...validBlueprint.phases].reverse();
    const bad = { ...validBlueprint, phases: reversed };
    expect(BlueprintOutputSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects blueprints with unknown phase type", () => {
    const bad = {
      ...validBlueprint,
      phases: validBlueprint.phases.map((p, i) => (i === 3 ? { ...p, phaseType: "bogus" } : p)),
    };
    expect(BlueprintOutputSchema.safeParse(bad).success).toBe(false);
  });

  it("defaults empty arrays for optional collections", () => {
    const minimal = {
      ...artifactBase,
      artifactType: "blueprint" as const,
      phases: validBlueprint.phases,
      overallConfidence: 0.8,
      overallSummary: "A plan.",
      generationMetadata: mockGenerationMeta,
    };
    const result = BlueprintOutputSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    expect(result.data?.assumptions).toEqual([]);
    expect(result.data?.constraints).toEqual([]);
    expect(result.data?.risks).toEqual([]);
  });
});

describe("RoadmapOutputSchema", () => {
  const validRoadmap = {
    ...artifactBase,
    artifactType: "roadmap" as const,
    phases: PHASE_ORDER.map((phase, i) => ({
      phaseType: phase,
      phaseName: "Test Phase",
      order: i,
      estimatedDuration: "2 weeks",
      effort: "medium" as const,
      prerequisites: i > 0 ? [PHASE_ORDER[i - 1]] : [],
      rationale: "This phase comes first because it establishes the foundation.",
    })),
    totalEffort: "large" as const,
    recommendedApproach: "Iterative delivery with 2-week sprints.",
    generationMetadata: mockGenerationMeta,
  };

  it("validates a complete roadmap", () => {
    const result = RoadmapOutputSchema.safeParse(validRoadmap);
    expect(result.success).toBe(true);
  });

  it("rejects roadmap with wrong phase count", () => {
    const bad = { ...validRoadmap, phases: validRoadmap.phases.slice(0, 3) };
    expect(RoadmapOutputSchema.safeParse(bad).success).toBe(false);
  });
});

describe("AITaskGraphOutputSchema", () => {
  const validGraph = {
    ...artifactBase,
    artifactType: "task_graph" as const,
    tasks: [
      {
        id: "e5f6a7b8-c9d4-4a12-8f01-234567890123",
        phaseType: "ideation",
        title: "Define user personas",
        description: "Identify primary user groups and their goals.",
        type: "docs" as const,
        priority: "high" as const,
        status: "pending" as const,
        order: 0,
        dependencies: [],
        acceptanceCriteria: ["Personas documented and reviewed"],
        estimatedPromptRounds: 2,
      },
      {
        id: "f6a7b8c9-d4e5-4a12-8f01-234567890123",
        phaseType: "ideation",
        title: "Draft problem statement",
        type: "docs" as const,
        status: "pending" as const,
        order: 1,
        dependencies: ["e5f6a7b8-c9d4-4a12-8f01-234567890123"],
        acceptanceCriteria: [],
      },
    ],
    phaseTaskCounts: { ideation: 2 },
    generationMetadata: mockGenerationMeta,
  };

  it("validates a complete task graph", () => {
    const result = AITaskGraphOutputSchema.safeParse(validGraph);
    expect(result.success).toBe(true);
  });

  it("rejects task with unknown phase type", () => {
    const bad = { ...validGraph, tasks: [{ ...validGraph.tasks[0]!, phaseType: "nope" }] };
    expect(AITaskGraphOutputSchema.safeParse(bad).success).toBe(false);
  });
});

describe("PromptBundleOutputSchema", () => {
  const validBundle = {
    ...artifactBase,
    artifactType: "prompt_bundle" as const,
    taskCount: 1,
    promptCount: 1,
    prompts: [
      {
        id: "a7b8c9d4-e5f6-4a12-8f01-234567890123",
        taskId: "e5f6a7b8-c9d4-4a12-8f01-234567890123",
        planId: artifactBase.planId,
        planVersion: 1,
        promptText: "You are building a chat application...",
        sections: {
          objective: "Build the chat UI component",
          context: "This is a real-time messaging app",
          constraints: ["Must work offline-first"],
          expectedOutput: "A React component with tests",
          validationCriteria: ["All tests pass"],
          architecturalAlignment: "Follows the existing component pattern",
          agentTips: ["Handle empty state"],
        },
        version: 1,
        status: "complete" as const,
        validationErrors: [],
        createdAt: "2026-05-16T12:00:05.000Z",
      },
    ],
    generationMetadata: mockGenerationMeta,
  };

  it("validates a complete prompt bundle", () => {
    const result = PromptBundleOutputSchema.safeParse(validBundle);
    expect(result.success).toBe(true);
  });

  it("requires at least objective, context, and expectedOutput in sections", () => {
    const bad = {
      ...validBundle,
      prompts: [{ ...validBundle.prompts[0]!, sections: { objective: "", context: "", expectedOutput: "" } }],
    };
    const result = PromptBundleOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe("FullPlanOutputSchema", () => {
  it("validates a complete plan with all artifacts", () => {
    const fullPlan = {
      ...artifactBase,
      artifactType: "full_plan" as const,
      blueprint: (() => {
        const bp = BlueprintOutputSchema.parse({
          ...artifactBase,
          artifactType: "blueprint",
          phases: PHASE_ORDER.map((phase) => ({
            phaseType: phase,
            phaseName: "Test",
            summary: "Summary",
            narrative: "A detailed narrative for this phase.",
            status: "sufficient" as const,
            confidence: 0.8,
            keyDecisions: [],
            sourceAnswers: [],
          })),
          overallConfidence: 0.8,
          overallSummary: "Overall summary of the plan.",
          generationMetadata: mockGenerationMeta,
        });
        return bp;
      })(),
      roadmap: RoadmapOutputSchema.parse({
        ...artifactBase,
        artifactType: "roadmap",
        phases: PHASE_ORDER.map((phase, i) => ({
          phaseType: phase,
          phaseName: "Test",
          order: i,
          effort: "medium" as const,
          prerequisites: [],
        })),
        generationMetadata: mockGenerationMeta,
      }),
      taskGraph: AITaskGraphOutputSchema.parse({
        ...artifactBase,
        artifactType: "task_graph",
        tasks: [
          {
            id: "b8c9d4e5-f6a7-4a12-8f01-234567890123",
            phaseType: "ideation",
            title: "Test task",
            type: "docs" as const,
            status: "pending" as const,
            order: 0,
            dependencies: [],
            acceptanceCriteria: [],
          },
        ],
        phaseTaskCounts: { ideation: 1 },
        generationMetadata: mockGenerationMeta,
      }),
      promptBundle: PromptBundleOutputSchema.parse({
        ...artifactBase,
        artifactType: "prompt_bundle",
        taskCount: 0,
        promptCount: 0,
        prompts: [],
        generationMetadata: mockGenerationMeta,
      }),
    };
    const result = FullPlanOutputSchema.safeParse(fullPlan);
    expect(result.success).toBe(true);
  });
});

describe("assertPhaseOrder", () => {
  it("passes for correct order", () => {
    expect(() => assertPhaseOrder([...PHASE_ORDER])).not.toThrow();
  });

  it("throws for wrong length", () => {
    expect(() => assertPhaseOrder(["ideation"])).toThrow();
  });

  it("throws for wrong order", () => {
    const reversed = [...PHASE_ORDER].reverse();
    expect(() => assertPhaseOrder(reversed)).toThrow();
  });

  it("throws for out-of-place phase", () => {
    const swapped = [...PHASE_ORDER];
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    expect(() => assertPhaseOrder(swapped)).toThrow();
  });
});
