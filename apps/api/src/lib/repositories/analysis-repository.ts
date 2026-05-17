import { eq } from "drizzle-orm";
import { getDb } from "../../db/sqlite/index.js";
import * as schema from "../../db/sqlite/schema/index.js";
import type { AnalysisPack, PhaseAnalysis } from "../analysis/types.js";

export function saveAnalysisResults(planId: string, analysis: AnalysisPack): void {
  const now = new Date().toISOString();

  for (const phase of analysis.phases) {
    getDb()
      .insert(schema.analysisResults)
      .values({
        id: crypto.randomUUID(),
        planId,
        phaseType: phase.phaseType,
        inputStatus: phase.inputStatus,
        answerCount: phase.answerCount,
        requiredCount: phase.requiredCount,
        inferredRequirements: JSON.stringify(phase.inferredRequirements),
        likelyConstraints: JSON.stringify(phase.likelyConstraints),
        explicitAssumptions: JSON.stringify(phase.explicitAssumptions),
        identifiedRisks: JSON.stringify(phase.identifiedRisks),
        keyDecisions: JSON.stringify(phase.keyDecisions),
        uncertaintyAreas: JSON.stringify(phase.uncertaintyAreas),
        crossPhaseInsights: JSON.stringify({
          contradictions: analysis.crossPhase.contradictions,
          globalAssumptions: analysis.crossPhase.globalAssumptions,
          globalRisks: analysis.crossPhase.globalRisks,
          overallInputStatus: analysis.crossPhase.overallInputStatus,
        }),
        createdAt: now,
      } as any)
      .run();
  }

  // Save a global phase entry for cross-phase data
  getDb()
    .insert(schema.analysisResults)
    .values({
      id: crypto.randomUUID(),
      planId,
      phaseType: "__global__",
      inputStatus: analysis.crossPhase.overallInputStatus,
      answerCount: analysis.summary.totalPhases,
      requiredCount: 0,
      crossPhaseInsights: JSON.stringify({
        contradictions: analysis.crossPhase.contradictions,
        globalAssumptions: analysis.crossPhase.globalAssumptions,
        globalRisks: analysis.crossPhase.globalRisks,
      }),
      createdAt: now,
    } as any)
    .run();
}

export function getAnalysisResults(planId: string): AnalysisPack | null {
  const rows = getDb()
    .select()
    .from(schema.analysisResults)
    .where(eq(schema.analysisResults.planId, planId))
    .all();

  if (rows.length === 0) return null;

  const globalRow = rows.find((r) => r.phaseType === "__global__");
  const phaseRows = rows.filter((r) => r.phaseType !== "__global__");

  const crossPhase = globalRow?.crossPhaseInsights
    ? JSON.parse(globalRow.crossPhaseInsights)
    : { contradictions: [], globalAssumptions: [], globalRisks: [], overallInputStatus: "insufficient" };

  return {
    projectId: "",
    projectName: "",
    sessionId: "",
    generatedAt: new Date().toISOString(),
    phases: phaseRows.map((r) => ({
      phaseType: r.phaseType as any,
      phaseName: r.phaseType,
      inputStatus: r.inputStatus as any,
      answerCount: r.answerCount,
      requiredCount: r.requiredCount,
      missingRequiredCount: Math.max(0, r.requiredCount - r.answerCount),
      findings: [],
      subphases: [],
      inferredRequirements: safeParseJson(r.inferredRequirements),
      likelyConstraints: safeParseJson(r.likelyConstraints),
      explicitAssumptions: safeParseJson(r.explicitAssumptions),
      identifiedRisks: safeParseJson(r.identifiedRisks),
      keyDecisions: safeParseJson(r.keyDecisions) ?? [],
      uncertaintyAreas: safeParseJson(r.uncertaintyAreas),
      dependencies: [],
    })) as unknown as PhaseAnalysis[],
    crossPhase: {
      contradictions: crossPhase.contradictions ?? [],
      globalAssumptions: crossPhase.globalAssumptions ?? [],
      globalRisks: crossPhase.globalRisks ?? [],
      overallInputStatus: crossPhase.overallInputStatus ?? "insufficient",
    },
    summary: {
      totalPhases: phaseRows.length,
      phasesWithSufficientInput: phaseRows.filter((r) => r.inputStatus === "sufficient").length,
      phasesWithInsufficientInput: phaseRows.filter((r) => r.inputStatus === "insufficient").length,
      phasesWithMissingInput: phaseRows.filter((r) => r.inputStatus === "missing").length,
      totalFindings: 0,
      highSeverityFindings: 0,
      totalUncertaintyAreas: 0,
      totalInferredDependencies: 0,
    },
  } as AnalysisPack;
}

function safeParseJson(val: string | null): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
