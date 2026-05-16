import type { AnalysisPack, PhaseAnalysis } from "../analysis/types.js";
import type { PhaseType } from "../contract/output-schema.js";
import { PHASE_ORDER } from "../contract/output-schema.js";
import type { Roadmap, RoadmapMilestone, TaskDraft, DraftTask, RoadmapAndTasks } from "./types.js";

export function buildRoadmapAndTasks(analysis: AnalysisPack): RoadmapAndTasks {
  const milestones: RoadmapMilestone[] = [];
  const tasks: DraftTask[] = [];
  const phaseTaskIds = new Map<string, string[]>();
  let totalEffortScore = 0;

  for (const phase of analysis.phases) {
    const milestone = buildMilestone(phase);
    milestones.push(milestone);

    totalEffortScore += effortScore(milestone.estimatedEffort);

    const phaseTasks = buildPhaseTasks(phase);
    tasks.push(...phaseTasks);
    phaseTaskIds.set(
      phase.phaseType,
      phaseTasks.map((t) => t.id),
    );
  }

  // Add cross-phase dependencies
  addCrossPhaseDependencies(tasks, phaseTaskIds, analysis);

  const totalEffort: "small" | "medium" | "large" =
    totalEffortScore <= 12 ? "small" : totalEffortScore <= 24 ? "medium" : "large";

  const tasksWithUnresolvedInput = tasks.filter((t) => t.dependsOnUnresolvedInput).length;
  const dependencyCount = tasks.reduce((sum, t) => sum + t.dependencies.length, 0);

  const roadmap: Roadmap = {
    projectId: analysis.projectId,
    projectName: analysis.projectName,
    sessionId: analysis.sessionId,
    generatedAt: new Date().toISOString(),
    milestones,
    totalEffort,
  };

  const taskDraft: TaskDraft = {
    projectId: analysis.projectId,
    projectName: analysis.projectName,
    sessionId: analysis.sessionId,
    generatedAt: new Date().toISOString(),
    tasks,
    dependencyCount,
    tasksWithUnresolvedInput,
  };

  return { roadmap, taskDraft };
}

function buildMilestone(phase: PhaseAnalysis): RoadmapMilestone {
  const hasUncertainties = phase.uncertaintyAreas.length > 0;
  const hasMissing = phase.missingRequiredCount > 0;

  let description: string;
  if (hasMissing) {
    description = `Complete gathering requirements for ${phase.phaseName}. Several required questions remain unanswered — review gaps before proceeding.`;
  } else if (hasUncertainties) {
    description = `Implement ${phase.phaseName} phase. Some areas have uncertainty — validate assumptions during execution.`;
  } else {
    description = `Implement ${phase.phaseName} based on defined requirements and constraints.`;
  }

  const keyDeliverables: string[] = [];
  for (const req of phase.inferredRequirements.slice(0, 3)) {
    keyDeliverables.push(req.length > 80 ? req.slice(0, 77) + "..." : req);
  }
  if (phase.explicitAssumptions.length > 0) {
    keyDeliverables.push(`Validate ${phase.explicitAssumptions.length} recorded assumptions`);
  }
  if (keyDeliverables.length === 0) {
    keyDeliverables.push(`Complete ${phase.phaseName} phase deliverables`);
  }

  const phaseIndex = PHASE_ORDER.indexOf(phase.phaseType as PhaseType);
  const dependsOn = phaseIndex > 0 ? [PHASE_ORDER[phaseIndex - 1] as PhaseType] : [];

  const reqCount = phase.requiredCount;
  const effort: "small" | "medium" | "large" = reqCount <= 2 ? "small" : reqCount <= 5 ? "medium" : "large";

  return {
    phaseType: phase.phaseType,
    phaseName: phase.phaseName,
    order: phaseIndex,
    title: `${phase.phaseName} — ${hasMissing ? "Gap Review" : hasUncertainties ? "Implementation with Validation" : "Full Implementation"}`,
    description,
    keyDeliverables,
    estimatedEffort: effort,
    dependsOn,
  };
}

function buildPhaseTasks(phase: PhaseAnalysis): DraftTask[] {
  const tasks: DraftTask[] = [];
  const phaseIndex = PHASE_ORDER.indexOf(phase.phaseType as PhaseType);
  const hasUncertainty = phase.uncertaintyAreas.length > 0 || phase.missingRequiredCount > 0;
  const baseOrder = phaseIndex * 10;

  // Task 1: Setup / groundwork
  if (phase.inputStatus !== "missing") {
    const uncertaintyNote = hasUncertainty
      ? `Some answers had low confidence or ambiguity — verify before proceeding`
      : null;
    tasks.push({
      id: `task-${phase.phaseType}-setup`,
      phaseType: phase.phaseType,
      title: `Set up ${phase.phaseName} foundations`,
      description: `Establish the base structure for ${phase.phaseName}. ${phase.inferredRequirements.slice(0, 2).join("; ")}`,
      kind: "config",
      priority: "high",
      order: baseOrder,
      acceptanceCriteria: [
        `All ${phase.requiredCount} required ${phase.phaseName} considerations are accounted for`,
        ...phase.likelyConstraints
          .slice(0, 2)
          .map((c) => `Constraint addressed: ${c.length > 60 ? c.slice(0, 57) + "..." : c}`),
        ...(phase.explicitAssumptions.length > 0
          ? [`${phase.explicitAssumptions.length} assumptions documented for validation`]
          : []),
      ],
      dependencies: [],
      dependsOnUnresolvedInput: hasUncertainty,
      uncertaintyNote,
    });
  }

  // Task 2: Core implementation
  if (phase.inputStatus === "sufficient" || phase.inputStatus === "insufficient") {
    const riskNotes = phase.identifiedRisks.slice(0, 2);
    const criteria = [
      `Implementation covers all ${phase.answerCount} answered ${phase.phaseName} requirements`,
      `Acceptance validated against defined constraints`,
      ...riskNotes.map((r) => `Risk mitigation: ${r.length > 60 ? r.slice(0, 57) + "..." : r}`),
    ];

    tasks.push({
      id: `task-${phase.phaseType}-core`,
      phaseType: phase.phaseType,
      title: `Implement ${phase.phaseName} core logic`,
      description: `Build the core implementation for ${phase.phaseName} based on gathered requirements.`,
      kind: "code",
      priority: "medium",
      order: baseOrder + 1,
      acceptanceCriteria: criteria,
      dependencies: [{ taskId: `task-${phase.phaseType}-setup`, kind: "blocks" }],
      dependsOnUnresolvedInput: hasUncertainty,
      uncertaintyNote: hasUncertainty ? `Some inputs had quality flags — verify outputs carefully` : null,
    });
  }

  // Task 3: Verification (if phase has sufficient input)
  if (phase.inputStatus === "sufficient") {
    tasks.push({
      id: `task-${phase.phaseType}-verify`,
      phaseType: phase.phaseType,
      title: `Verify ${phase.phaseName} implementation`,
      description: `Test and validate the ${phase.phaseName} implementation against all requirements and constraints.`,
      kind: "test",
      priority: "medium",
      order: baseOrder + 2,
      acceptanceCriteria: [
        `All ${phase.answerCount} requirements are tested`,
        `No contradictions with prior phase implementations`,
        `Edge cases from uncertainty areas are validated: ${phase.uncertaintyAreas.slice(0, 3).join("; ") || "none identified"}`,
      ],
      dependencies: [
        { taskId: `task-${phase.phaseType}-core`, kind: "blocks" },
        { taskId: `task-${phase.phaseType}-setup`, kind: "blocks" },
      ],
      dependsOnUnresolvedInput: hasUncertainty,
      uncertaintyNote: uncertaintyNote(phase),
    });
  }

  // Task for missing phases: gap review
  if (phase.inputStatus === "missing") {
    tasks.push({
      id: `task-${phase.phaseType}-review`,
      phaseType: phase.phaseType,
      title: `Review ${phase.phaseName} — insufficient input`,
      description: `All ${phase.requiredCount} required questions for ${phase.phaseName} are unanswered. Review gaps and provide input before implementation.`,
      kind: "review",
      priority: "high",
      order: baseOrder,
      acceptanceCriteria: [
        `All ${phase.requiredCount} required questions are answered`,
        `Phase input status upgraded to at least "insufficient"`,
      ],
      dependencies: phase.dependencies
        .filter((d) => d.nature === "lifecycle")
        .map((d) => ({ taskId: `task-${d.dependsOnPhase}-verify`, kind: "input_from" as const })),
      dependsOnUnresolvedInput: true,
      uncertaintyNote: `All ${phase.requiredCount} required questions are unanswered — cannot proceed without input`,
    });
  }

  return tasks;
}

function addCrossPhaseDependencies(
  tasks: DraftTask[],
  _phaseTaskIds: Map<string, string[]>,
  analysis: AnalysisPack,
): void {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // Add lifecycle dependencies from the analysis dependency info
  for (const task of tasks) {
    const phase = analysis.phases.find((p) => p.phaseType === task.phaseType);
    if (!phase) continue;

    for (const dep of phase.dependencies) {
      if (dep.nature !== "lifecycle") continue;
      const priorPhaseId = `task-${dep.dependsOnPhase}-verify`;
      if (taskMap.has(priorPhaseId) && !task.dependencies.some((d) => d.taskId === priorPhaseId)) {
        task.dependencies.push({ taskId: priorPhaseId, kind: "input_from" });
      }
    }
  }
}

function uncertaintyNote(phase: PhaseAnalysis): string | null {
  const parts: string[] = [];
  if (phase.uncertaintyAreas.length > 0) {
    parts.push(`Uncertainty: ${phase.uncertaintyAreas.slice(0, 2).join("; ")}`);
  }
  if (phase.missingRequiredCount > 0) {
    parts.push(`${phase.missingRequiredCount} required questions unanswered`);
  }
  return parts.length > 0 ? parts.join(". ") : null;
}

function effortScore(effort: "small" | "medium" | "large"): number {
  return effort === "large" ? 3 : effort === "medium" ? 2 : 1;
}
