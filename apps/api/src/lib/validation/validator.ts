import { PHASE_ORDER } from "../contract/output-schema.js";
import type { BlueprintOutput } from "../contract/output-schema.js";
import type { Roadmap, TaskDraft } from "../roadmap/types.js";
import type { PromptBundle } from "../prompt/prompt-bundle-types.js";
import type { AnalysisPack } from "../analysis/types.js";
import type {
  ValidationResult,
  ValidationIssue,
  ValidationOutcome,
  ValidationStats,
  ArtifactType,
} from "./types.js";

export function validateAll(artifacts: {
  blueprint?: BlueprintOutput | undefined;
  roadmap?: Roadmap | undefined;
  taskDraft?: TaskDraft | undefined;
  promptBundle?: PromptBundle | undefined;
  analysis?: AnalysisPack | undefined;
}): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (artifacts.blueprint) issues.push(...validateBlueprint(artifacts.blueprint));
  if (artifacts.roadmap) issues.push(...validateRoadmap(artifacts.roadmap));
  if (artifacts.taskDraft) issues.push(...validateTaskDraft(artifacts.taskDraft));
  if (artifacts.promptBundle) issues.push(...validatePromptBundle(artifacts.promptBundle));
  if (artifacts.analysis) issues.push(...validateAnalysis(artifacts.analysis));

  // Cross-artifact consistency checks
  if (artifacts.blueprint && artifacts.roadmap) {
    issues.push(...checkBlueprintRoadmapConsistency(artifacts.blueprint, artifacts.roadmap));
  }
  if (artifacts.taskDraft && artifacts.blueprint) {
    issues.push(...checkTaskBlueprintConsistency(artifacts.taskDraft, artifacts.blueprint));
  }

  const outcome = computeOutcome(issues);
  const stats = computeStats(issues);

  return { outcome, issues, stats };
}

// ── Blueprint validation ─────────────────────────────────────

function validateBlueprint(bp: BlueprintOutput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const t = "blueprint" as ArtifactType;

  // Phase count
  if (bp.phases.length !== PHASE_ORDER.length) {
    issues.push({
      artifactType: t,
      code: "BP001",
      severity: "error",
      message: `Expected ${PHASE_ORDER.length} phases, got ${bp.phases.length}`,
    });
  }

  // Phase order and completeness
  for (let i = 0; i < bp.phases.length; i++) {
    const phase = bp.phases[i]!;
    if (phase.phaseType !== PHASE_ORDER[i]) {
      issues.push({
        artifactType: t,
        code: "BP002",
        severity: "error",
        message: `Phase at index ${i} is "${phase.phaseType}", expected "${PHASE_ORDER[i]}"`,
        phaseType: phase.phaseType,
      });
    }
    if (!phase.summary || phase.summary.length < 10) {
      issues.push({
        artifactType: t,
        code: "BP003",
        severity: "error",
        message: `Phase "${phase.phaseType}" summary is too short or missing`,
        phaseType: phase.phaseType,
        field: "summary",
      });
    }
    if (!phase.narrative || phase.narrative.length < 50) {
      issues.push({
        artifactType: t,
        code: "BP004",
        severity: "error",
        message: `Phase "${phase.phaseType}" narrative is too short or missing`,
        phaseType: phase.phaseType,
        field: "narrative",
      });
    }
    if (phase.confidence < 0 || phase.confidence > 1) {
      issues.push({
        artifactType: t,
        code: "BP005",
        severity: "error",
        message: `Phase "${phase.phaseType}" confidence ${phase.confidence} out of range [0,1]`,
        phaseType: phase.phaseType,
        field: "confidence",
      });
    }
  }

  // Required top-level fields
  if (!bp.overallSummary || bp.overallSummary.length < 10) {
    issues.push({
      artifactType: t,
      code: "BP006",
      severity: "error",
      message: "overallSummary is too short or missing",
      field: "overallSummary",
    });
  }

  return issues;
}

// ── Roadmap validation ───────────────────────────────────────

function validateRoadmap(rm: Roadmap): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const t = "roadmap" as ArtifactType;

  if (rm.milestones.length !== PHASE_ORDER.length) {
    issues.push({
      artifactType: t,
      code: "RM001",
      severity: "error",
      message: `Expected ${PHASE_ORDER.length} milestones, got ${rm.milestones.length}`,
    });
  }

  for (let i = 0; i < rm.milestones.length; i++) {
    const m = rm.milestones[i]!;
    if (m.phaseType !== PHASE_ORDER[i]) {
      issues.push({
        artifactType: t,
        code: "RM002",
        severity: "error",
        message: `Milestone at index ${i} is "${m.phaseType}", expected "${PHASE_ORDER[i]}"`,
        phaseType: m.phaseType,
      });
    }
    if (!m.title || m.title.length < 5) {
      issues.push({
        artifactType: t,
        code: "RM003",
        severity: "error",
        message: `Milestone "${m.phaseType}" title is too short`,
        phaseType: m.phaseType,
        field: "title",
      });
    }
    if (!m.description || m.description.length < 10) {
      issues.push({
        artifactType: t,
        code: "RM004",
        severity: "error",
        message: `Milestone "${m.phaseType}" description is too short`,
        phaseType: m.phaseType,
        field: "description",
      });
    }
  }

  return issues;
}

// ── Task draft validation ────────────────────────────────────

function validateTaskDraft(td: TaskDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const t = "task_graph" as ArtifactType;

  if (td.tasks.length === 0) {
    issues.push({ artifactType: t, code: "TK001", severity: "error", message: "Task draft has zero tasks" });
  }

  const taskIds = new Set<string>();
  for (const task of td.tasks) {
    // Unique IDs
    if (taskIds.has(task.id)) {
      issues.push({
        artifactType: t,
        code: "TK002",
        severity: "error",
        message: `Duplicate task ID: ${task.id}`,
        phaseType: task.phaseType,
        field: "id",
      });
    }
    taskIds.add(task.id);

    // Valid phase
    if (!PHASE_ORDER.includes(task.phaseType)) {
      issues.push({
        artifactType: t,
        code: "TK003",
        severity: "error",
        message: `Task "${task.id}" has unknown phase "${task.phaseType}"`,
        phaseType: task.phaseType,
        field: "phaseType",
      });
    }

    // Title
    if (!task.title || task.title.length < 5) {
      issues.push({
        artifactType: t,
        code: "TK004",
        severity: "error",
        message: `Task "${task.id}" title is too short`,
        phaseType: task.phaseType,
        field: "title",
      });
    }

    // Acceptance criteria
    if (task.acceptanceCriteria.length === 0) {
      issues.push({
        artifactType: t,
        code: "TK005",
        severity: "warning",
        message: `Task "${task.id}" has no acceptance criteria`,
        phaseType: task.phaseType,
        field: "acceptanceCriteria",
      });
    }

    // Dependency check — ensure all deps reference existing tasks
    for (const dep of task.dependencies) {
      if (!taskIds.has(dep.taskId) && !td.tasks.find((t2) => t2.id === dep.taskId)) {
        issues.push({
          artifactType: t,
          code: "TK006",
          severity: "error",
          message: `Task "${task.id}" depends on non-existent task "${dep.taskId}"`,
          phaseType: task.phaseType,
          field: "dependencies",
        });
      }
    }
  }

  // Phase coverage: check that every lifecycle phase has at least one task
  const phasesWithTasks = new Set(td.tasks.map((t) => t.phaseType));
  for (const phase of PHASE_ORDER) {
    if (!phasesWithTasks.has(phase)) {
      issues.push({
        artifactType: t,
        code: "TK007",
        severity: "warning",
        message: `No tasks for phase "${phase}"`,
        phaseType: phase,
      });
    }
  }

  return issues;
}

// ── Prompt bundle validation ─────────────────────────────────

function validatePromptBundle(pb: PromptBundle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const t = "prompt_bundle" as ArtifactType;

  if (pb.prompts.length === 0) {
    issues.push({
      artifactType: t,
      code: "PB001",
      severity: "error",
      message: "Prompt bundle has zero prompts",
    });
  }

  const requiredSections = [
    "objective",
    "context",
    "constraints",
    "expectedOutput",
    "validationCriteria",
    "architecturalAlignment",
    "agentTips",
  ];
  const requiredTipSubsections = ["security", "edgeCases", "dependencyWarnings", "commonBugs"];

  for (const prompt of pb.prompts) {
    const sec = prompt.sections;
    // Required sections
    for (const section of requiredSections) {
      if (!(section in sec) || !(sec as unknown as Record<string, unknown>)[section]) {
        issues.push({
          artifactType: t,
          code: "PB002",
          severity: "error",
          message: `Prompt "${prompt.id}" missing section "${section}"`,
          field: section,
        });
      }
    }

    // Section content
    if (sec.objective && sec.objective.length < 10) {
      issues.push({
        artifactType: t,
        code: "PB003",
        severity: "warning",
        message: `Prompt "${prompt.id}" objective is too short`,
        field: "objective",
      });
    }
    if (sec.context && sec.context.length < 10) {
      issues.push({
        artifactType: t,
        code: "PB004",
        severity: "warning",
        message: `Prompt "${prompt.id}" context is too short`,
        field: "context",
      });
    }
    if (!sec.expectedOutput || sec.expectedOutput.length < 10) {
      issues.push({
        artifactType: t,
        code: "PB005",
        severity: "warning",
        message: `Prompt "${prompt.id}" expectedOutput is too short`,
        field: "expectedOutput",
      });
    }

    // Agent tip subsections
    const tipsRecord = sec.agentTips as unknown as Record<string, unknown>;
    for (const sub of requiredTipSubsections) {
      const tips = tipsRecord[sub];
      if (!Array.isArray(tips)) {
        issues.push({
          artifactType: t,
          code: "PB006",
          severity: "error",
          message: `Prompt "${prompt.id}" agentTips.${sub} is not an array`,
          field: `agentTips.${sub}`,
        });
      }
    }

    // Lineage
    if (!prompt.lineage || !prompt.lineage.taskId || !prompt.lineage.sourcePhaseType) {
      issues.push({
        artifactType: t,
        code: "PB007",
        severity: "error",
        message: `Prompt "${prompt.id}" missing lineage information`,
        field: "lineage",
      });
    }
  }

  // Prompt count consistency
  if (pb.promptCount !== pb.prompts.length) {
    issues.push({
      artifactType: t,
      code: "PB008",
      severity: "warning",
      message: `promptCount ${pb.promptCount} != prompts.length ${pb.prompts.length}`,
      field: "promptCount",
    });
  }

  return issues;
}

// ── Analysis validation ──────────────────────────────────────

function validateAnalysis(analysis: AnalysisPack): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const t = "analysis" as ArtifactType;

  if (analysis.phases.length !== PHASE_ORDER.length) {
    issues.push({
      artifactType: t,
      code: "AN001",
      severity: "error",
      message: `Expected ${PHASE_ORDER.length} phase analyses, got ${analysis.phases.length}`,
    });
  }

  for (let i = 0; i < analysis.phases.length; i++) {
    const p = analysis.phases[i]!;
    if (p.phaseType !== PHASE_ORDER[i]) {
      issues.push({
        artifactType: t,
        code: "AN002",
        severity: "error",
        message: `Analysis at index ${i} is "${p.phaseType}", expected "${PHASE_ORDER[i]}"`,
        phaseType: p.phaseType,
      });
    }
  }

  return issues;
}

// ── Cross-artifact consistency ───────────────────────────────

function checkBlueprintRoadmapConsistency(bp: BlueprintOutput, rm: Roadmap): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < PHASE_ORDER.length; i++) {
    const bpPhase = bp.phases[i];
    const rmMilestone = rm.milestones[i];
    if (bpPhase && rmMilestone && bpPhase.phaseType !== rmMilestone.phaseType) {
      issues.push({
        artifactType: "blueprint",
        code: "CR001",
        severity: "error",
        message: `Blueprint phase ${bpPhase.phaseType} at index ${i} doesn't match roadmap milestone ${rmMilestone.phaseType}`,
        phaseType: bpPhase.phaseType,
      });
    }
  }

  return issues;
}

function checkTaskBlueprintConsistency(td: TaskDraft, bp: BlueprintOutput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const bpPhases = new Set(bp.phases.map((p) => p.phaseType));
  const taskPhases = new Set(td.tasks.map((t) => t.phaseType));

  for (const phase of taskPhases) {
    if (!bpPhases.has(phase)) {
      issues.push({
        artifactType: "task_graph",
        code: "CR002",
        severity: "warning",
        message: `Tasks exist for phase "${phase}" not found in blueprint`,
        phaseType: phase,
      });
    }
  }

  return issues;
}

// ── Helpers ──────────────────────────────────────────────────

function computeOutcome(issues: ValidationIssue[]): ValidationOutcome {
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length === 0) return "pass";
  if (errors.length <= 3) return "repairable";
  return "unrecoverable";
}

function computeStats(issues: ValidationIssue[]): ValidationStats {
  return {
    totalChecks: issues.length,
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    repaired: 0,
  };
}
