import type { DraftTask } from "../roadmap/types.js";
import type { AnalysisPack, PhaseAnalysis } from "../analysis/types.js";
import type {
  ExecutionPrompt,
  GeneratedPromptSections,
  AgentTips,
  PromptBundle,
  PromptLineage,
} from "./prompt-bundle-types.js";

const PROMPT_VERSION = 1;

export function generatePrompts(
  tasks: DraftTask[],
  analysis: AnalysisPack,
  planVersion: number,
): PromptBundle {
  const bundleId = crypto.randomUUID();
  const now = new Date().toISOString();
  const prompts: ExecutionPrompt[] = [];

  for (const task of tasks) {
    const phase = analysis.phases.find((p) => p.phaseType === task.phaseType);
    const prompt = buildPrompt(task, phase ?? null, analysis, planVersion, bundleId, now);
    prompts.push(prompt);
  }

  return {
    bundleId,
    planVersion,
    projectId: analysis.projectId,
    sessionId: analysis.sessionId,
    projectName: analysis.projectName,
    createdAt: now,
    prompts,
    promptCount: prompts.length,
  };
}

function buildPrompt(
  task: DraftTask,
  phase: PhaseAnalysis | null,
  analysis: AnalysisPack,
  planVersion: number,
  _bundleId: string,
  now: string,
): ExecutionPrompt {
  const objective = buildObjective(task, phase);
  const context = buildContext(task, phase, analysis);
  const constraints = buildConstraints(task, phase);
  const expectedOutput = buildExpectedOutput(task);
  const validationCriteria = buildValidationCriteria(task, phase);
  const architecturalAlignment = buildArchitecturalAlignment(task, analysis);
  const agentTips = buildAgentTips(task, phase);

  const sections: GeneratedPromptSections = {
    objective,
    context,
    constraints,
    expectedOutput,
    validationCriteria,
    architecturalAlignment,
    agentTips,
  };

  const promptText = formatPromptText(sections, task);

  const lineage: PromptLineage = {
    taskId: task.id,
    planVersion,
    blueprintArtifactId: null,
    analysisSessionId: analysis.sessionId,
    sourcePhaseType: task.phaseType,
  };

  return {
    id: crypto.randomUUID(),
    taskId: task.id,
    planVersion,
    promptVersion: PROMPT_VERSION,
    sections,
    promptText,
    status: task.dependsOnUnresolvedInput ? "needs_review" : "pending",
    createdAt: now,
    lineage,
  };
}

function buildObjective(task: DraftTask, phase: PhaseAnalysis | null): string {
  const phaseName = phase?.phaseName ?? task.phaseType;
  return `Implement the "${task.title}" task for the ${phaseName} phase of the project "${task.description.slice(0, 60)}".`;
}

function buildContext(task: DraftTask, phase: PhaseAnalysis | null, analysis: AnalysisPack): string {
  const parts: string[] = [];
  parts.push(`Project: ${analysis.projectName}.`);
  parts.push(`Phase: ${phase?.phaseName ?? task.phaseType}.`);
  parts.push(`Task: ${task.title}.`);
  if (phase) {
    const reqs = phase.inferredRequirements.slice(0, 3);
    if (reqs.length > 0) {
      parts.push(`Key requirements: ${reqs.join("; ")}`);
    }
    const constraints = phase.likelyConstraints.slice(0, 3);
    if (constraints.length > 0) {
      parts.push(`Constraints: ${constraints.join("; ")}`);
    }
  }
  if (task.uncertaintyNote) {
    parts.push(`Note: ${task.uncertaintyNote}`);
  }
  return parts.join(" ");
}

function buildConstraints(task: DraftTask, phase: PhaseAnalysis | null): string[] {
  const constraints: string[] = [];
  if (phase) {
    for (const c of phase.likelyConstraints) {
      constraints.push(c.length > 120 ? c.slice(0, 117) + "..." : c);
    }
    for (const a of phase.explicitAssumptions) {
      constraints.push(`Assumption to validate: ${a.length > 120 ? a.slice(0, 117) + "..." : a}`);
    }
  }
  constraints.push(`Task priority: ${task.priority}`);
  if (task.dependsOnUnresolvedInput) {
    constraints.push(
      "Warning: this task depends on unresolved input — validate assumptions before finalizing",
    );
  }
  return constraints;
}

function buildExpectedOutput(task: DraftTask): string {
  return `Complete the "${task.title}" task. Deliverables: ${task.acceptanceCriteria.slice(0, 3).join("; ")}.`;
}

function buildValidationCriteria(task: DraftTask, phase: PhaseAnalysis | null): string[] {
  const criteria = [...task.acceptanceCriteria];
  if (phase && phase.uncertaintyAreas.length > 0) {
    criteria.push(`Validate edge cases: ${phase.uncertaintyAreas.slice(0, 2).join("; ")}`);
  }
  if (task.dependencies.length > 0) {
    criteria.push(
      `Integration verified with ${task.dependencies.length} upstream dependenc${task.dependencies.length === 1 ? "y" : "ies"}`,
    );
  }
  return criteria;
}

function buildArchitecturalAlignment(task: DraftTask, analysis: AnalysisPack): string {
  const phase = analysis.phases.find((p) => p.phaseType === task.phaseType);
  const parts: string[] = [];
  parts.push(
    `This task is part of the "${phase?.phaseName ?? task.phaseType}" phase in the project lifecycle.`,
  );
  if (phase) {
    const deps = phase.dependencies.filter((d) => d.nature === "lifecycle");
    if (deps.length > 0) {
      parts.push(`Depends on prior phases: ${deps.map((d) => d.dependsOnPhase).join(", ")}.`);
    }
  }
  return parts.join(" ");
}

function buildAgentTips(task: DraftTask, phase: PhaseAnalysis | null): AgentTips {
  const security: string[] = [];
  const edgeCases: string[] = [];
  const dependencyWarnings: string[] = [];
  const commonBugs: string[] = [];

  if (phase) {
    for (const risk of phase.identifiedRisks) {
      if (risk.toLowerCase().includes("security") || risk.toLowerCase().includes("auth")) {
        security.push(`Addressed risk: ${risk.length > 80 ? risk.slice(0, 77) + "..." : risk}`);
      }
      if (risk.toLowerCase().includes("edge") || risk.toLowerCase().includes("boundary")) {
        edgeCases.push(`Addressed risk: ${risk.length > 80 ? risk.slice(0, 77) + "..." : risk}`);
      }
    }
    for (const area of phase.uncertaintyAreas) {
      edgeCases.push(`Uncertain area: ${area.length > 80 ? area.slice(0, 77) + "..." : area}`);
    }
  }

  if (task.dependsOnUnresolvedInput) {
    dependencyWarnings.push("Task depends on unresolved assumptions — validate before merging");
  }

  if (task.dependencies.length > 0) {
    dependencyWarnings.push(`Verify compatibility with ${task.dependencies.length} upstream task(s)`);
  }

  if (task.kind === "code") {
    commonBugs.push("Handle empty states and error states for all inputs");
    commonBugs.push("Add input validation and sanitization");
    security.push("Validate and sanitize all external inputs");
  }
  if (task.kind === "test") {
    commonBugs.push("Cover both happy path and error paths");
    edgeCases.push("Test boundary conditions and edge cases");
  }
  if (task.kind === "config") {
    commonBugs.push("Use environment-specific configuration patterns");
    security.push("Avoid hardcoding secrets in configuration");
  }
  if (task.kind === "review") {
    commonBugs.push("Document all identified gaps and action items");
  }

  return {
    security: [...new Set(security)],
    edgeCases: [...new Set(edgeCases)],
    dependencyWarnings: [...new Set(dependencyWarnings)],
    commonBugs: [...new Set(commonBugs)],
  };
}

function formatPromptText(sections: GeneratedPromptSections, task: DraftTask): string {
  const lines: string[] = [];
  lines.push(`# ${task.title}`);
  lines.push("");
  lines.push(`## Objective`);
  lines.push(sections.objective);
  lines.push("");
  lines.push(`## Context`);
  lines.push(sections.context);
  lines.push("");
  lines.push(`## Constraints`);
  for (const c of sections.constraints) {
    lines.push(`- ${c}`);
  }
  lines.push("");
  lines.push(`## Expected Output`);
  lines.push(sections.expectedOutput);
  lines.push("");
  lines.push(`## Validation Criteria`);
  for (const v of sections.validationCriteria) {
    lines.push(`- ${v}`);
  }
  lines.push("");
  lines.push(`## Architectural Alignment`);
  lines.push(sections.architecturalAlignment);
  lines.push("");
  lines.push(`## Agent Tips`);
  if (sections.agentTips.security.length > 0) {
    lines.push(`### Security`);
    for (const s of sections.agentTips.security) {
      lines.push(`- ${s}`);
    }
    lines.push("");
  }
  if (sections.agentTips.edgeCases.length > 0) {
    lines.push(`### Edge Cases`);
    for (const e of sections.agentTips.edgeCases) {
      lines.push(`- ${e}`);
    }
    lines.push("");
  }
  if (sections.agentTips.dependencyWarnings.length > 0) {
    lines.push(`### Dependency Warnings`);
    for (const d of sections.agentTips.dependencyWarnings) {
      lines.push(`- ${d}`);
    }
    lines.push("");
  }
  if (sections.agentTips.commonBugs.length > 0) {
    lines.push(`### Common Bugs`);
    for (const b of sections.agentTips.commonBugs) {
      lines.push(`- ${b}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
