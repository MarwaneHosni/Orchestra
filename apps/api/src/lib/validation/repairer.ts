import { PHASE_ORDER } from "../contract/output-schema.js";
import type { BlueprintOutput } from "../contract/output-schema.js";
import type { Roadmap, TaskDraft } from "../roadmap/types.js";
import type { PromptBundle } from "../prompt/prompt-bundle-types.js";
import { validateAll } from "./validator.js";
import type { ValidationResult, RepairResult, RepairFix, ValidationIssue } from "./types.js";

export interface RepairContext {
  projectName: string;
}

export function repairBlueprint(
  bp: BlueprintOutput,
  result: ValidationResult,
): { artifact: BlueprintOutput; repair: RepairResult } {
  const fixes: RepairFix[] = [];
  const remaining: ValidationIssue[] = [];
  const repaired = structuredClone(bp);

  for (const issue of result.issues) {
    if (issue.artifactType !== "blueprint") {
      remaining.push(issue);
      continue;
    }

    switch (issue.code) {
      case "BP003": {
        const phase = repaired.phases.find((p) => p.phaseType === issue.phaseType);
        if (phase && (!phase.summary || phase.summary.length < 10)) {
          phase.summary = `Planning phase covering ${phase.phaseType} considerations, requirements, and implementation approach.`;
          fixes.push({
            artifactType: "blueprint",
            field: `phases.${phase.phaseType}.summary`,
            description: "Generated default summary for empty phase summary",
          });
        }
        break;
      }
      case "BP004": {
        const phase = repaired.phases.find((p) => p.phaseType === issue.phaseType);
        if (phase && (!phase.narrative || phase.narrative.length < 50)) {
          phase.narrative = `This phase addresses all ${phase.phaseType} related concerns. `;
          phase.narrative += `The implementation should follow standard practices for this domain. `;
          phase.narrative += `Key considerations include requirement validation, constraint compliance, and risk mitigation throughout the phase execution.`;
          fixes.push({
            artifactType: "blueprint",
            field: `phases.${phase.phaseType}.narrative`,
            description: "Generated default narrative for empty phase narrative",
          });
        }
        break;
      }
      case "BP006": {
        if (!repaired.overallSummary || repaired.overallSummary.length < 10) {
          repaired.overallSummary = `Project plan covering all ${PHASE_ORDER.length} lifecycle phases with associated requirements, constraints, and implementation guidance.`;
          fixes.push({
            artifactType: "blueprint",
            field: "overallSummary",
            description: "Generated default overall summary",
          });
        }
        break;
      }
      default:
        remaining.push(issue);
    }
  }

  return {
    artifact: repaired,
    repair: { repaired: fixes.length > 0, fixes, remainingIssues: remaining },
  };
}

export function repairRoadmap(
  rm: Roadmap,
  result: ValidationResult,
): { artifact: Roadmap; repair: RepairResult } {
  const fixes: RepairFix[] = [];
  const remaining: ValidationIssue[] = [];
  const repaired = structuredClone(rm);

  for (const issue of result.issues) {
    if (issue.artifactType !== "roadmap") {
      remaining.push(issue);
      continue;
    }

    switch (issue.code) {
      case "RM003": {
        const m = repaired.milestones.find((ms) => ms.phaseType === issue.phaseType);
        if (m && (!m.title || m.title.length < 5)) {
          m.title = `${m.phaseName} — Implementation`;
          fixes.push({
            artifactType: "roadmap",
            field: `milestones.${m.phaseType}.title`,
            description: "Generated default title",
          });
        }
        break;
      }
      case "RM004": {
        const m = repaired.milestones.find((ms) => ms.phaseType === issue.phaseType);
        if (m && (!m.description || m.description.length < 10)) {
          m.description = `Complete the ${m.phaseName} phase including all requirements, constraints, and verification steps.`;
          fixes.push({
            artifactType: "roadmap",
            field: `milestones.${m.phaseType}.description`,
            description: "Generated default description",
          });
        }
        break;
      }
      default:
        remaining.push(issue);
    }
  }

  return {
    artifact: repaired,
    repair: { repaired: fixes.length > 0, fixes, remainingIssues: remaining },
  };
}

export function repairPromptBundle(
  pb: PromptBundle,
  result: ValidationResult,
): { artifact: PromptBundle; repair: RepairResult } {
  const fixes: RepairFix[] = [];
  const remaining: ValidationIssue[] = [];
  const repaired = structuredClone(pb);

  for (const issue of result.issues) {
    if (issue.artifactType !== "prompt_bundle") {
      remaining.push(issue);
      continue;
    }

    switch (issue.code) {
      case "PB003": {
        for (const prompt of repaired.prompts) {
          if (prompt.sections.objective.length < 10) {
            prompt.sections.objective = `Implement the assigned task for the ${prompt.lineage.sourcePhaseType} phase of the project.`;
            fixes.push({
              artifactType: "prompt_bundle",
              field: `prompts.${prompt.id}.objective`,
              description: "Generated default objective",
            });
          }
        }
        break;
      }
      case "PB005": {
        for (const prompt of repaired.prompts) {
          if (prompt.sections.expectedOutput.length < 10) {
            prompt.sections.expectedOutput = `Complete the task deliverables and verify alignment with all acceptance criteria.`;
            fixes.push({
              artifactType: "prompt_bundle",
              field: `prompts.${prompt.id}.expectedOutput`,
              description: "Generated default expected output",
            });
          }
        }
        break;
      }
      default:
        remaining.push(issue);
    }
  }

  return {
    artifact: repaired,
    repair: { repaired: fixes.length > 0, fixes, remainingIssues: remaining },
  };
}

export function attemptRepair(
  artifacts: {
    blueprint?: BlueprintOutput | null;
    roadmap?: Roadmap | null;
    taskDraft?: TaskDraft | null;
    promptBundle?: PromptBundle | null;
  },
  result: ValidationResult,
  _context?: Record<string, never>,
): {
  blueprint?: BlueprintOutput | null;
  roadmap?: Roadmap | null;
  taskDraft?: TaskDraft | null;
  promptBundle?: PromptBundle | null;
  repairs: RepairResult[];
  remainingIssues: ValidationIssue[];
} {
  const repairs: RepairResult[] = [];
  let remainingIssues = result.issues;

  let bp = artifacts.blueprint;
  let rm = artifacts.roadmap;
  let pb = artifacts.promptBundle;

  if (bp) {
    const bpResult = repairBlueprint(bp, result);
    bp = bpResult.artifact;
    repairs.push(bpResult.repair);
    remainingIssues = bpResult.repair.remainingIssues;
  }

  if (rm) {
    const rmResult = repairRoadmap(rm, result);
    rm = rmResult.artifact;
    repairs.push(rmResult.repair);
    remainingIssues = [...remainingIssues, ...rmResult.repair.remainingIssues];
  }

  if (pb) {
    const pbResult = repairPromptBundle(pb, result);
    pb = pbResult.artifact;
    repairs.push(pbResult.repair);
    remainingIssues = [...remainingIssues, ...pbResult.repair.remainingIssues];
  }

  // Re-validate after repairs
  if (bp !== undefined || rm !== undefined || artifacts.taskDraft !== undefined || pb !== undefined) {
    const recheck = validateAll({
      blueprint: bp ?? undefined,
      roadmap: rm ?? undefined,
      taskDraft: artifacts.taskDraft ?? undefined,
      promptBundle: pb ?? undefined,
    });
    remainingIssues = recheck.issues;
  }

  return {
    blueprint: bp ?? undefined,
    roadmap: rm ?? undefined,
    taskDraft: artifacts.taskDraft ?? undefined,
    promptBundle: pb ?? undefined,
    repairs,
    remainingIssues,
  } as {
    blueprint?: BlueprintOutput;
    roadmap?: Roadmap;
    taskDraft?: TaskDraft;
    promptBundle?: PromptBundle;
    repairs: RepairResult[];
    remainingIssues: ValidationIssue[];
  };
}
