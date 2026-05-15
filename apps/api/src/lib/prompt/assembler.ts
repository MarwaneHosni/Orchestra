import type { PromptSection, AgentTips, PromptArtifact, PromptStore } from "./types.js";
import { formatPrompt } from "./templates.js";
import { validatePrompt } from "./validator.js";
import type { TaskNode } from "../task-graph/types.js";

export interface TaskContext {
  task: TaskNode;
  planName: string;
  allTasks: TaskNode[];
  predecessorOutputs: string[];
  phaseSummary: string;
}

export function assemblePrompt(context: TaskContext, store?: PromptStore, planVersion = 1): PromptArtifact {
  const sections = buildSections(context);
  const promptText = formatPrompt(sections);

  const artifact: PromptArtifact = {
    id: crypto.randomUUID(),
    taskId: context.task.id,
    planId: context.task.planId,
    planVersion,
    promptText,
    sections,
    version: 1,
    status: "complete",
    failureReason: null,
    createdAt: new Date().toISOString(),
  };

  const validation = validatePrompt(artifact);
  if (!validation.valid) {
    artifact.status = "failed";
    artifact.failureReason = validation.errors.join("; ");
  } else if (validation.warnings.length > 0) {
    artifact.status = "needs_review";
    artifact.failureReason = validation.warnings.join("; ");
  }

  if (store) store.save(artifact);

  return artifact;
}

function buildSections(context: TaskContext): PromptSection {
  const task = context.task;
  const predecessorNames =
    context.predecessorOutputs.length > 0
      ? context.predecessorOutputs.map((o) => `- ${o}`).join("\n")
      : "None — this is the first task in the sequence.";

  const relatedTaskTitles = context.allTasks
    .filter((t) => t.id !== task.id && task.dependencies.some((d) => d.taskId === t.id))
    .map((t) => `- ${t.title} (${t.phaseType})`)
    .join("\n");

  return {
    objective: `Implement: ${task.title}`,
    context: [
      `Phase: ${task.phaseType}`,
      `Task type: ${task.type}`,
      `Priority: ${task.priority}`,
      ``,
      `Phase summary: ${context.phaseSummary}`,
      ``,
      `Predecessor outputs:`,
      predecessorNames,
      ``,
      `Related tasks:`,
      relatedTaskTitles || "No related tasks.",
      ``,
      `This task is ${task.dependencies.length > 0 ? `blocked by ${task.dependencies.length} predecessor(s)` : "the first task — no dependencies"} and is estimated to require ${task.estimatedPromptRounds} prompt round(s).`,
    ].join("\n"),

    constraints: buildConstraints(task, context),

    expectedOutput: [
      `Complete the following work:`,
      ``,
      `1. ${task.title}`,
      `2. Ensure the output meets the acceptance criteria below`,
      `3. If applicable, update or create the relevant files in the project`,
    ].join("\n"),

    validationCriteria:
      task.acceptanceCriteria.length > 0 ? task.acceptanceCriteria : [`Task "${task.title}" is complete`],

    architecturalAlignment: [
      `This task is part of the "${task.phaseType}" phase.`,
      `The overall project "${context.planName}" follows the architecture defined in the project blueprint.`,
      `This task contributes to: ${task.title}`,
      task.type === "config"
        ? "Configuration tasks establish the foundation for subsequent implementation tasks."
        : "",
      task.type === "test"
        ? "Verification tasks validate that implementation meets the defined criteria."
        : "",
      task.type === "code"
        ? "Implementation tasks build the core functionality specified in this phase."
        : "",
    ]
      .filter(Boolean)
      .join("\n"),

    agentTips: buildAgentTips(task, context),
  };
}

function buildConstraints(task: TaskNode, _context: TaskContext): string[] {
  const constraints: string[] = [
    `Task must be completable within ${task.estimatedPromptRounds} prompt round(s)`,
    `Output must be coherent and independently verifiable`,
    `Follow the existing project conventions and code style`,
  ];

  if (task.type === "config") {
    constraints.push("Configuration must not break existing functionality");
    constraints.push("Use environment variables for configurable values");
  }

  if (task.type === "test") {
    constraints.push("Tests must be reproducible and not depend on external state");
    constraints.push("Aim for at least 80% coverage on the target module");
  }

  if (task.type === "code") {
    constraints.push("Implementation must handle error cases and edge conditions");
    constraints.push("Follow the Single Responsibility Principle");
  }

  return constraints;
}

function buildAgentTips(task: TaskNode, _context: TaskContext): AgentTips {
  const tips: AgentTips = {
    security: [
      "Validate all inputs and sanitize outputs",
      "Do not hardcode secrets, API keys, or credentials",
      "Use parameterized queries to prevent injection attacks",
      "Apply least-privilege principles to any permissions",
    ],
    edgeCases: [
      "Consider empty states: what happens when there is no data?",
      "Consider error states: what happens when a dependency fails?",
      "Consider boundary conditions: maximum input sizes, concurrent access",
    ],
    dependencyWarnings: [
      "Ensure all imported modules and packages are declared in the project",
      "Check that type definitions match between interfaces and implementations",
      "Verify that environment variables referenced in this task are documented",
    ],
    commonBugs: [
      "Off-by-one errors in loops and array indexing",
      "Race conditions in async operations without proper synchronization",
      "Silent error swallowing — ensure errors are logged or propagated",
      "Inconsistent naming or type mismatches between related modules",
    ],
  };

  if (task.type === "code") {
    tips.commonBugs.push("Unhandled promise rejections in async code");
    tips.commonBugs.push("Memory leaks from unclosed connections or listeners");
  }

  if (task.type === "config") {
    tips.security.push(
      "Configuration files should not contain secrets — use environment variables or secret references",
    );
    tips.commonBugs.push("Default configuration values may not be appropriate for production");
  }

  return tips;
}
