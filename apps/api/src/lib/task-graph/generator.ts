import type { TaskGraph, TaskNode, DependencyEdge, PhaseInput, TaskType, TaskPriority } from "./types.js";
import { PHASE_ORDER, TASK_COUNTS } from "./types.js";

export interface GraphStore {
  saveGraph(graph: TaskGraph): void;
  getGraph(planId: string, version: number): TaskGraph | undefined;
  getGraphsByPlan(planId: string): TaskGraph[];
  updateTaskStatus(
    planId: string,
    planVersion: number,
    taskId: string,
    newStatus: string,
  ): TaskNode | undefined;
  replacePhaseTasks(
    planId: string,
    planVersion: number,
    phaseType: string,
    oldTaskIds: string[],
    newTasks: TaskNode[],
    newDeps: DependencyEdge[],
  ): TaskGraph | undefined;
}

export function createInMemoryGraphStore(): GraphStore {
  const byKey = new Map<string, TaskGraph>();
  const byPlan = new Map<string, TaskGraph[]>();

  function planKey(planId: string, version: number): string {
    return `${planId}::${version}`;
  }

  function getPlanList(planId: string): TaskGraph[] {
    let list = byPlan.get(planId);
    if (!list) {
      list = [];
      byPlan.set(planId, list);
    }
    return list;
  }

  return {
    saveGraph(g) {
      const key = planKey(g.planId, g.planVersion);
      if (byKey.has(key)) return;
      byKey.set(key, g);
      getPlanList(g.planId).push(g);
    },
    getGraph(planId, version) {
      return byKey.get(planKey(planId, version));
    },
    getGraphsByPlan(planId) {
      return [...getPlanList(planId)];
    },
    updateTaskStatus(planId, planVersion, taskId, newStatus) {
      const key = planKey(planId, planVersion);
      const graph = byKey.get(key);
      if (!graph) return undefined;
      const task = graph.tasks.find((t) => t.id === taskId);
      if (!task) return undefined;
      task.status = newStatus as TaskNode["status"];
      return { ...task };
    },
    replacePhaseTasks(planId, planVersion, _phaseType, oldTaskIds, newTasks, newDeps) {
      const key = planKey(planId, planVersion);
      const graph = byKey.get(key);
      if (!graph) return undefined;
      const oldSet = new Set(oldTaskIds);
      graph.tasks = graph.tasks.filter((t) => !oldSet.has(t.id)).concat(newTasks);
      graph.tasks.sort((a, b) => a.order - b.order);
      graph.dependencies = graph.dependencies
        .filter((d) => !oldSet.has(d.taskId) && !oldSet.has(d.dependsOnTaskId))
        .concat(newDeps);
      return graph;
    },
  };
}

export interface PhaseValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePhases(phases: PhaseInput[]): PhaseValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!phases || phases.length === 0) {
    errors.push("At least one phase is required");
    return { valid: false, errors, warnings };
  }

  const seen = new Set<string>();
  for (const phase of phases) {
    if (!phase.phaseType || phase.phaseType.trim().length === 0) {
      errors.push("Phase type is required");
      continue;
    }
    if (!PHASE_ORDER.includes(phase.phaseType)) {
      errors.push(`Unknown phase type: "${phase.phaseType}"`);
    }
    if (seen.has(phase.phaseType)) {
      errors.push(`Duplicate phase type: "${phase.phaseType}"`);
    }
    seen.add(phase.phaseType);

    if (!phase.phaseName || phase.phaseName.trim().length === 0) {
      errors.push(`Phase "${phase.phaseType}" has no name`);
    }
    if (phase.confidence < 0 || phase.confidence > 1) {
      errors.push(`Phase "${phase.phaseType}" confidence must be between 0 and 1, got ${phase.confidence}`);
    }
    if (!phase.summary || phase.summary.trim().length < 5) {
      errors.push(`Phase "${phase.phaseType}" summary is too short (min 5 chars)`);
    }
    if (phase.status === "sufficient" && phase.confidence < 0.4) {
      warnings.push(
        `Phase "${phase.phaseType}" is marked sufficient but confidence is very low (${phase.confidence})`,
      );
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function generateTasks(planId: string, planVersion: number, phases: PhaseInput[]): TaskGraph {
  const validation = validatePhases(phases);
  if (!planId) throw new Error("planId is required");
  if (planVersion < 1) throw new Error("planVersion must be >= 1");
  if (!validation.valid) throw new Error(`Invalid phases: ${validation.errors.join("; ")}`);

  const tasks: TaskNode[] = [];
  const dependencies: DependencyEdge[] = [];
  let globalOrder = 0;

  for (const phase of phases) {
    const type = phase.phaseType;
    if (!PHASE_ORDER.includes(type)) continue;

    if (phase.status === "missing") {
      const task: TaskNode = {
        id: crypto.randomUUID(),
        planId,
        phaseType: type,
        title: `Review ${phase.phaseName} — insufficient input`,
        type: "review",
        priority: "high",
        status: "needs_review",
        order: globalOrder++,
        dependencies: [],
        acceptanceCriteria: [`Provide sufficient input for ${phase.phaseName}`],
        estimatedPromptRounds: 1,
        failureReason: `Phase "${phase.phaseName}" has status "missing" — cannot decompose into tasks`,
      };
      tasks.push(task);
      continue;
    }

    const countRange = TASK_COUNTS[type] ?? { min: 2, max: 3 };
    const baseCount = phase.status === "insufficient" ? Math.max(1, countRange.min - 1) : countRange.min;

    for (let i = 0; i < baseCount; i++) {
      const task = createTask(planId, type, phase, i, baseCount, globalOrder++);
      tasks.push(task);
    }

    if (phase.status === "insufficient") {
      const pendingTask: TaskNode = {
        id: crypto.randomUUID(),
        planId,
        phaseType: type,
        title: `Provide additional input for ${phase.phaseName}`,
        type: "pending_input",
        priority: "medium",
        status: "needs_review",
        order: globalOrder++,
        dependencies: [],
        acceptanceCriteria: [`Provide missing details for ${phase.phaseName}`],
        estimatedPromptRounds: 1,
        failureReason: `Phase "${phase.phaseName}" has status "insufficient" — some tasks may lack full context`,
      };
      tasks.push(pendingTask);
    }
  }

  computeDependencies(tasks, dependencies);
  computeStatuses(tasks, dependencies);

  const graph: TaskGraph = { planId, planVersion, tasks, dependencies };
  return graph;
}

export function deriveGraph(
  planId: string,
  newPlanVersion: number,
  phases: PhaseInput[],
  fromGraph: TaskGraph,
): TaskGraph {
  const graph = generateTasks(planId, newPlanVersion, phases);
  graph.derivedFromPlanVersion = fromGraph.planVersion;
  return graph;
}

function getFirstSentence(text: string): string | null {
  const cleaned = text.replace(/^##\s+\S+[\s:-]*/gm, "").trim();
  const match = cleaned.match(/^([^.!?]*[.!?])/);
  if (match && match[1]!.length > 15) return match[1]!.trim();
  if (cleaned.length > 15) {
    const truncated = cleaned.slice(0, 100);
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > 15 ? truncated.slice(0, lastSpace) : truncated) + ".";
  }
  return null;
}

function extractObjective(executionPrompt: string): string | null {
  const match = executionPrompt.match(/## Objective[\s:-]*\n([\s\S]*?)(?=\n## |$)/);
  if (!match) return null;
  return getFirstSentence(match[1]!.trim());
}

function extractVerificationPhrase(phase: PhaseInput): string | null {
  const decisions = phase.keyDecisions;
  if (decisions && decisions.length > 0) {
    const last = decisions[decisions.length - 1];
    if (last && last.length > 10 && !last.toLowerCase().includes("implement"))
      return `Verify ${last[0]!.toLowerCase() + last.slice(1)}`;
  }
  if (phase.executionPrompt) {
    const fromObjective = extractObjective(phase.executionPrompt);
    if (fromObjective) {
      const clean = fromObjective.replace(/^(Build|Create|Design|Implement|Set up|Develop)\s+/i, "").trim();
      return `Verify ${clean}`;
    }
  }
  if (phase.narrative) {
    const fromNarrative = getFirstSentence(phase.narrative);
    if (fromNarrative) {
      const clean = fromNarrative.replace(/^(Build|Create|Design|Implement|Set up|Develop)\s+/i, "").trim();
      return `Verify ${clean}`;
    }
  }
  return null;
}

function deriveTaskTitle(
  phase: PhaseInput,
  index: number,
  _total: number,
  isFirst: boolean,
  isCore: boolean,
  isLast: boolean,
): string {
  const decisions = phase.keyDecisions;
  const narrative = phase.narrative;
  const prompt = phase.executionPrompt;

  if (isFirst && prompt) {
    const fromObjective = extractObjective(prompt);
    if (fromObjective) return fromObjective;
  }
  if (isFirst && narrative) {
    const fromNarrative = getFirstSentence(narrative);
    if (fromNarrative) return fromNarrative;
  }

  if (isCore && decisions && decisions.length > 0) {
    const decisionIdx = Math.min(index - 1, decisions.length - 1);
    const decision = decisions[decisionIdx];
    if (decision && decision.length > 10 && decision.length < 120) return decision;
  }
  if (isCore && narrative) {
    const fromNarrative = getFirstSentence(narrative);
    if (fromNarrative) return fromNarrative;
  }

  if (isLast) {
    const fromPhase = extractVerificationPhrase(phase);
    if (fromPhase) return fromPhase;
    return `Verify ${phase.phaseName} implementation`;
  }

  if (isFirst) return `Set up ${phase.phaseName} foundations`;
  return `Implement ${phase.phaseName} core logic`;
}

function createTask(
  planId: string,
  phaseType: string,
  phase: PhaseInput,
  index: number,
  total: number,
  order: number,
): TaskNode {
  const isCore = index > 0 && index < total - 1;
  const isFirst = index === 0;
  const isLast = index === total - 1 && total > 1;
  const title = deriveTaskTitle(phase, index, total, isFirst, isCore, isLast);
  const taskType: TaskType = isFirst ? "config" : isLast ? "test" : "code";
  const priority: TaskPriority = isFirst || index <= 1 ? "high" : "medium";
  const estimatedRounds = isFirst ? 1 : isCore ? 3 : 2;
  return {
    id: crypto.randomUUID(),
    planId,
    phaseType,
    title,
    type: taskType,
    priority,
    status: "pending",
    order,
    dependencies: [],
    acceptanceCriteria: [`${title} meets ${phase.phaseName} requirements`],
    estimatedPromptRounds: estimatedRounds,
  };
}

function computeDependencies(tasks: TaskNode[], dependencies: DependencyEdge[]): void {
  const phaseGroups = new Map<string, TaskNode[]>();
  for (const t of tasks) {
    const list = phaseGroups.get(t.phaseType) ?? [];
    list.push(t);
    phaseGroups.set(t.phaseType, list);
  }
  const phaseOrder = PHASE_ORDER.filter((p) => phaseGroups.has(p));

  for (const [, group] of phaseGroups) {
    group.sort((a, b) => a.order - b.order);
    for (let i = 1; i < group.length; i++) {
      dependencies.push({
        taskId: group[i]!.id,
        dependsOnTaskId: group[i - 1]!.id,
        dependencyType: "blocks",
      });
    }
  }

  for (let i = 1; i < phaseOrder.length; i++) {
    const prevPhase = phaseGroups.get(phaseOrder[i - 1]!)!;
    const currPhase = phaseGroups.get(phaseOrder[i]!)!;
    const lastPrev = prevPhase.reduce((a, b) => (a.order > b.order ? a : b));
    const firstCurr = currPhase.reduce((a, b) => (a.order < b.order ? a : b));
    dependencies.push({ taskId: firstCurr.id, dependsOnTaskId: lastPrev.id, dependencyType: "blocks" });
  }
}

export function computeStatuses(tasks: TaskNode[], dependencies: DependencyEdge[]): void {
  const depMap = new Map<string, string[]>();
  for (const dep of dependencies) {
    const list = depMap.get(dep.taskId) ?? [];
    list.push(dep.dependsOnTaskId);
    depMap.set(dep.taskId, list);
  }
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  for (const task of tasks) {
    if (task.type === "review" || task.status === "needs_review") continue;
    const prereqs = depMap.get(task.id);
    if (!prereqs || prereqs.length === 0) {
      task.status = "ready";
      continue;
    }
    const allComplete = prereqs.every((pid) => {
      const t = taskMap.get(pid);
      return t && t.status === "complete";
    });
    const anyBlocked = prereqs.some((pid) => {
      const t = taskMap.get(pid);
      return t && t.type === "review";
    });
    if (anyBlocked || !allComplete) {
      task.status = "blocked";
    } else {
      task.status = "ready";
    }
  }
}
