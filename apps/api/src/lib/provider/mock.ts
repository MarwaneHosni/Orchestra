import type { AIProvider, GenerationInput, GenerationResult, ValidationResult, ModelInfo } from "./types.js";
import { PHASE_ORDER, PHASE_LABELS } from "../contract/output-schema.js";

export class MockAIProvider implements AIProvider {
  readonly provider = "mock";

  constructor(_apiKey?: string) {
    void _apiKey;
  }

  async validate(): Promise<ValidationResult> {
    return { valid: true, models: [{ id: "mock-blueprint-v1", provider: "mock" }] };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [{ id: "mock-blueprint-v1", provider: "mock" }];
  }

  async generate(_input: GenerationInput): Promise<GenerationResult> {
    const phases = PHASE_ORDER.map((phaseType, _i) => ({
      phaseType,
      phaseName: PHASE_LABELS[phaseType] ?? phaseType,
      summary: `AI-generated summary for ${PHASE_LABELS[phaseType] ?? phaseType}. Focus on key goals and deliverables.`,
      narrative:
        `AI-authored narrative for the ${PHASE_LABELS[phaseType] ?? phaseType} phase. ` +
        `This phase covers essential project requirements based on interview analysis. ` +
        `Key decisions include technology selection, architectural patterns, and implementation priorities. ` +
        `Tradeoffs considered include performance vs. maintainability, cost vs. features, and speed vs. quality.`,
      status: "sufficient" as const,
      confidence: 0.82,
      keyDecisions: [
        `Use industry-standard approach for ${PHASE_LABELS[phaseType] ?? phaseType}`,
        `Prioritize maintainability and testability`,
      ],
      sourceAnswers: [],
    }));

    const roadmapPhases = PHASE_ORDER.map((phaseType, i) => ({
      phaseType,
      phaseName: PHASE_LABELS[phaseType] ?? phaseType,
      order: i,
      effort: i < 4 ? ("medium" as const) : i < 8 ? ("large" as const) : ("medium" as const),
      prerequisites: i > 0 ? [PHASE_ORDER[i - 1]!] : [],
    }));

    const content = JSON.stringify({
      phases,
      assumptions: [
        { description: "Users have stable internet connectivity for web-based features" },
        { description: "The primary audience is technically literate" },
      ],
      constraints: [
        { description: "Must support modern browsers (Chrome, Firefox, Safari, Edge)" },
        { description: "API response times should be under 500ms for 95% of requests" },
      ],
      risks: [
        { description: "Third-party service dependencies may introduce latency" },
        { description: "Scope creep could delay the delivery timeline" },
      ],
      overallConfidence: 0.85,
      overallSummary:
        "A comprehensive AI-generated project plan covering all 12 lifecycle phases with detailed implementation guidance and risk mitigation strategies.",
      roadmapPhases,
      totalEffort: "large",
      recommendedApproach:
        "Iterative delivery with 2-week sprints, starting with core functionality and adding features incrementally.",
    });

    // Simulate a short processing delay
    await new Promise((r) => setTimeout(r, 50));

    return {
      content,
      model: "mock-blueprint-v1",
      usage: { promptTokens: 500, completionTokens: content.length, totalTokens: 500 + content.length },
      finishReason: "stop",
    };
  }
}
