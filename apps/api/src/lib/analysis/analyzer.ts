import type { SynthesisContextPack, SynthesizedAnswer, PhaseAnswerGroup } from "../synthesis/types.js";
import { PHASE_LABELS } from "../interview/questions.js";
import type { PhaseType } from "../contract/output-schema.js";
import { PHASE_ORDER } from "../contract/output-schema.js";
import type {
  AnalysisPack,
  PhaseAnalysis,
  AnalysisFinding,
  FindingKind,
  FindingSeverity,
  SourceLink,
  CrossPhaseInsights,
  AnalysisSummary,
  PhaseInputStatus,
  PhaseDependency,
} from "./types.js";

export function analyzeAnswers(pack: SynthesisContextPack): AnalysisPack {
  const phases: PhaseAnalysis[] = [];
  let totalFindings = 0;
  let highSeverityFindings = 0;
  let phasesSufficient = 0;
  let phasesInsufficient = 0;
  let phasesMissing = 0;
  let totalUncertaintyAreas = 0;

  for (const phaseGroup of pack.phases) {
    const analysis = analyzePhase(phaseGroup, pack);
    phases.push(analysis);
  }

  // Compute dependencies after all phases are analyzed (needs full picture)
  let totalInferredDependencies = 0;
  for (const analysis of phases) {
    const deps = computePhaseDependencies(analysis, phases);
    analysis.dependencies = deps;
    totalInferredDependencies += deps.length;
    totalFindings += analysis.findings.length;
    highSeverityFindings += analysis.findings.filter((f) => f.severity === "high").length;
    totalUncertaintyAreas += analysis.uncertaintyAreas.length;
    if (analysis.inputStatus === "sufficient") phasesSufficient++;
    else if (analysis.inputStatus === "insufficient") phasesInsufficient++;
    else phasesMissing++;
  }

  const crossPhase = buildCrossPhaseInsights(pack, phases);

  const summary: AnalysisSummary = {
    totalPhases: phases.length,
    phasesWithSufficientInput: phasesSufficient,
    phasesWithInsufficientInput: phasesInsufficient,
    phasesWithMissingInput: phasesMissing,
    totalFindings,
    highSeverityFindings,
    totalUncertaintyAreas,
    totalInferredDependencies,
  };

  return {
    projectId: pack.projectId,
    projectName: pack.projectName,
    sessionId: pack.sessionId,
    generatedAt: new Date().toISOString(),
    phases,
    crossPhase,
    summary,
  };
}

function analyzePhase(phaseGroup: PhaseAnswerGroup, pack: SynthesisContextPack): PhaseAnalysis {
  const { phaseType, phaseName, answers, answeredCount, requiredCount, missingRequiredCount } = phaseGroup;
  const findings: AnalysisFinding[] = [];
  const inferredRequirements: string[] = [];
  const likelyConstraints: string[] = [];
  const explicitAssumptions: string[] = [];
  const identifiedRisks: string[] = [];
  const keyDecisions: { description: string; sourceRef: string }[] = [];
  const uncertaintyAreas: string[] = [];

  let inputStatus: PhaseInputStatus;
  if (missingRequiredCount > 0 && answeredCount === 0) {
    inputStatus = "missing";
  } else if (missingRequiredCount > 0) {
    inputStatus = "insufficient";
  } else {
    inputStatus = "sufficient";
  }

  for (const answer of answers) {
    const sourceLinks = makeSourceLink(answer);

    // Check for weak answers — uncertainties and ambiguities
    if (answer.isVague) {
      findings.push({
        kind: "ambiguity",
        severity: "medium",
        description: `Vague answer to "${answer.questionText.slice(0, 80)}": "${answer.normalizedValue.slice(0, 120)}"`,
        sources: sourceLinks,
      });
      uncertaintyAreas.push(`Answer to "${answer.questionText.slice(0, 60)}" uses uncertain language`);
    }

    if (answer.isTooShort) {
      findings.push({
        kind: "insufficient_input",
        severity: "medium",
        description: `Answer too short (${answer.rawValue.trim().length} chars) for "${answer.questionText.slice(0, 80)}"`,
        sources: sourceLinks,
      });
    }

    if (answer.userConfidence === "low") {
      findings.push({
        kind: "uncertainty",
        severity: "medium",
        description: `User expressed low confidence in answer to "${answer.questionText.slice(0, 80)}"`,
        sources: sourceLinks,
      });
      uncertaintyAreas.push(`Low confidence in "${answer.questionText.slice(0, 60)}"`);
    }

    if (answer.isSkipped && answer.required) {
      findings.push({
        kind: "insufficient_input",
        severity: "high",
        description: `Required question "${answer.questionText.slice(0, 80)}" was skipped (empty answer)`,
        sources: sourceLinks,
      });
    }

    // Extract captureAs items
    if (answer.captureAs === "assumption") {
      explicitAssumptions.push(answer.normalizedValue);
      keyDecisions.push({
        description: `Assumption: ${answer.normalizedValue}`,
        sourceRef: answer.questionRef,
      });
    } else if (answer.captureAs === "constraint") {
      likelyConstraints.push(answer.normalizedValue);
      keyDecisions.push({
        description: `Constraint: ${answer.normalizedValue}`,
        sourceRef: answer.questionRef,
      });
    } else if (answer.captureAs === "risk") {
      identifiedRisks.push(answer.normalizedValue);
      keyDecisions.push({
        description: `Risk: ${answer.normalizedValue}`,
        sourceRef: answer.questionRef,
      });
    }

    // For text and structured answers that are substantive, record as inferred requirements
    if (
      answer.isPresent &&
      !answer.isSkipped &&
      answer.required &&
      answer.type === "text" &&
      !answer.isVague &&
      !answer.isTooShort
    ) {
      inferredRequirements.push(answer.normalizedValue);
    }
  }

  // Check for phase gaps
  for (const gap of pack.gaps) {
    if (gap.phaseType !== phaseType) continue;
    if (gap.type === "missing_required") {
      findings.push({
        kind: "insufficient_input",
        severity: "high",
        description: `Required question unanswered: "${gap.questionText.slice(0, 100)}"`,
        sources: [{ questionRef: gap.questionRef, questionText: gap.questionText, excerpt: "" }],
      });
    }
    if (gap.type === "missing_due_to_gate") {
      findings.push({
        kind: "ambiguity",
        severity: "medium",
        description: `Question "${gap.questionText.slice(0, 80)}" hidden by unsatisfied gate (${gap.gateQuestionRef ?? "unknown"})`,
        sources: [{ questionRef: gap.questionRef, questionText: gap.questionText, excerpt: "" }],
      });
    }
  }

  // Check for contradictions in this phase
  for (const contra of pack.contradictions) {
    if (answers.some((a) => a.questionRef === contra.questionRef)) {
      findings.push({
        kind: "contradiction",
        severity: "high",
        description: contra.description,
        sources: [
          { questionRef: contra.questionRef, questionText: contra.questionText, excerpt: contra.actualValue },
          { questionRef: contra.gateQuestionRef, questionText: contra.gateQuestionText, excerpt: "" },
        ],
      });
    }
  }

  // Add finding if phase is missing
  if (inputStatus === "missing") {
    findings.push({
      kind: "insufficient_input",
      severity: "high",
      description: `Phase "${phaseName}" has no answers — all ${requiredCount} required questions unanswered`,
      sources: [],
    });
  }

  const subphases = answers.map((a) => ({
    order: a.order,
    questionRef: a.questionRef,
    questionText: a.questionText,
    answerValue: a.normalizedValue,
    answerPresent: a.isPresent,
    userConfidence: a.userConfidence,
    flags: a.flags
      .filter((f) => f.type !== "edited")
      .map((f) => ({
        kind: mapFlagKind(f.type) as FindingKind,
        severity: f.severity as FindingSeverity,
        message: f.message,
      })),
    captureAs: a.captureAs,
  }));

  return {
    phaseType: phaseType as PhaseType,
    phaseName: phaseName || (PHASE_LABELS[phaseType] ?? phaseType),
    inputStatus,
    answerCount: answeredCount,
    requiredCount,
    missingRequiredCount,
    findings,
    subphases,
    inferredRequirements: [...new Set(inferredRequirements)],
    likelyConstraints: [...new Set(likelyConstraints)],
    explicitAssumptions: [...new Set(explicitAssumptions)],
    identifiedRisks: [...new Set(identifiedRisks)],
    keyDecisions,
    uncertaintyAreas: [...new Set(uncertaintyAreas)],
    dependencies: [],
  };
}

function buildCrossPhaseInsights(pack: SynthesisContextPack, phases: PhaseAnalysis[]): CrossPhaseInsights {
  const globalAssumptions: string[] = [];
  const globalRisks: string[] = [];
  const contradictions: CrossPhaseInsights["contradictions"] = [];
  let overallInputStatus: CrossPhaseInsights["overallInputStatus"] = "sufficient";

  // Collect all contradictions across phases
  for (const contra of pack.contradictions) {
    contradictions.push({
      description: contra.description,
      between: [contra.questionRef, contra.gateQuestionRef],
      severity: "high",
      sources: [
        { questionRef: contra.questionRef, questionText: contra.questionText, excerpt: contra.actualValue },
        { questionRef: contra.gateQuestionRef, questionText: contra.gateQuestionText, excerpt: "" },
      ],
    });
  }

  // Collect global assumptions and risks from captureAs answers
  for (const answer of pack.allAnswers) {
    if (answer.captureAs === "assumption") {
      globalAssumptions.push(answer.normalizedValue);
    } else if (answer.captureAs === "risk") {
      globalRisks.push(answer.normalizedValue);
    }
  }

  // Determine overall input status
  const hasMissing = phases.some((p) => p.inputStatus === "missing");
  const hasInsufficient = phases.some((p) => p.inputStatus === "insufficient");
  if (hasMissing || hasInsufficient) {
    overallInputStatus = "mixed";
  }

  return {
    contradictions,
    globalAssumptions: [...new Set(globalAssumptions)],
    globalRisks: [...new Set(globalRisks)],
    overallInputStatus,
  };
}

function computePhaseDependencies(phase: PhaseAnalysis, allPhases: PhaseAnalysis[]): PhaseDependency[] {
  const deps: PhaseDependency[] = [];
  const currentIndex = PHASE_ORDER.indexOf(phase.phaseType);

  // Lifecycle dependencies: each phase depends on all prior phases
  for (let i = 0; i < currentIndex; i++) {
    const priorPhase = allPhases[i]!;
    deps.push({
      dependsOnPhase: priorPhase.phaseType,
      reason: `${priorPhase.phaseName} must be completed before ${phase.phaseName} — fixed lifecycle ordering`,
      sourceRef: "lifecycle",
      nature: "lifecycle",
    });
  }

  // Inferred dependencies: if this phase's answers reference concepts from other phases
  const phaseAnswerTexts = phase.findings.flatMap((f) => f.sources).map((s) => s.excerpt.toLowerCase());

  if (phaseAnswerTexts.length > 0) {
    for (let i = 0; i < currentIndex; i++) {
      const priorPhase = allPhases[i]!;
      const priorKeywords = priorPhase.keyDecisions.map((d) => d.description.toLowerCase());
      const matchesPrior = priorKeywords.some((kw) =>
        phaseAnswerTexts.some((text) => text.includes(kw.slice(0, 30))),
      );
      if (matchesPrior) {
        deps.push({
          dependsOnPhase: priorPhase.phaseType,
          reason: `Answers in ${phase.phaseName} reference decisions from ${priorPhase.phaseName}`,
          sourceRef: "inferred",
          nature: "inferred_from_answers",
        });
      }
    }
  }

  return deps;
}

function mapFlagKind(flagType: string): string {
  switch (flagType) {
    case "vague":
      return "ambiguity";
    case "missing":
    case "too_short":
    case "skipped":
      return "insufficient_input";
    case "low_confidence":
      return "uncertainty";
    case "contradicts_gate":
      return "contradiction";
    default:
      return "insufficient_input";
  }
}

function makeSourceLink(answer: SynthesizedAnswer): SourceLink[] {
  if (!answer.isPresent || !answer.rawValue) return [];
  return [
    {
      questionRef: answer.questionRef,
      questionText: answer.questionText,
      excerpt: answer.normalizedValue.slice(0, 200),
    },
  ];
}
