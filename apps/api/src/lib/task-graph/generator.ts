import type { TaskGraph, TaskNode, DependencyEdge, PhaseInput, TaskType, TaskPriority } from "./types.js";
import { PHASE_ORDER, TASK_COUNTS } from "./types.js";

export interface GraphStore {
  saveGraph(graph: TaskGraph): void;
  getGraph(planId: string, version: number): TaskGraph | undefined;
  getGraphsByPlan(planId: string): TaskGraph[];
}

export function createInMemoryGraphStore(): GraphStore {
  const graphs: TaskGraph[] = [];
  return {
    saveGraph(g) {
      graphs.push(g);
    },
    getGraph(planId, version) {
      return graphs.find((g) => g.planId === planId && g.planVersion === version);
    },
    getGraphsByPlan(planId) {
      return graphs.filter((g) => g.planId === planId);
    },
  };
}

export function generateTasks(planId: string, planVersion: number, phases: PhaseInput[]): TaskGraph {
  if (!planId) throw new Error("planId is required");
  if (planVersion < 1) throw new Error("planVersion must be >= 1");
  if (!phases || phases.length === 0) throw new Error("At least one phase is required");

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

    // For insufficient phases, add a pending_input task
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
      };
      tasks.push(pendingTask);
    }
  }

  computeDependencies(tasks, dependencies);
  computeStatuses(tasks, dependencies);

  const graph: TaskGraph = { planId, planVersion, tasks, dependencies };
  return graph;
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

  const title = isFirst
    ? `Set up ${phase.phaseName} foundations`
    : isCore
      ? `Implement ${phase.phaseName} core logic`
      : `Verify ${phase.phaseName} implementation`;

  const type: TaskType = isFirst ? "config" : isLast ? "test" : "code";
  const priority: TaskPriority = isFirst || index <= 1 ? "high" : "medium";
  const estimatedRounds = isFirst ? 1 : isCore ? 3 : 2;

  return {
    id: crypto.randomUUID(),
    planId,
    phaseType,
    title,
    type,
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

  // Within-phase: sequential dependencies (prereq → core → verification)
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

  // Cross-phase: last task of phase N blocks first task of phase N+1
  for (let i = 1; i < phaseOrder.length; i++) {
    const prevPhase = phaseGroups.get(phaseOrder[i - 1]!)!;
    const currPhase = phaseGroups.get(phaseOrder[i]!)!;
    const lastPrev = prevPhase.reduce((a, b) => (a.order > b.order ? a : b));
    const firstCurr = currPhase.reduce((a, b) => (a.order < b.order ? a : b));
    dependencies.push({ taskId: firstCurr.id, dependsOnTaskId: lastPrev.id, dependencyType: "blocks" });
  }
}

function computeStatuses(tasks: TaskNode[], dependencies: DependencyEdge[]): void {
  // Never overwrite status of review-type tasks (they are explicitly set)
  const depMap = new Map<string, string[]>();
  for (const dep of dependencies) {
    const list = depMap.get(dep.taskId) ?? [];
    list.push(dep.dependsOnTaskId);
    depMap.set(dep.taskId, list);
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  for (const task of tasks) {
    if (task.type === "review" || task.status === "needs_review") continue; // preserve explicitly set status

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
