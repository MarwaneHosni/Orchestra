import type { SnapshotRecord, SnapshotStore } from "../versioning/types.js";
import type { GraphStore } from "../task-graph/generator.js";
import type { PromptStore, PromptArtifact } from "../prompt/types.js";
import type { TaskGraph, TaskNode } from "../task-graph/types.js";
import type {
  VersionDiff,
  SnapshotRef,
  DiffSummary,
  TaskDiff,
  TaskSummary,
  PromptDiff,
  PhaseDiff,
  BlueprintDiff,
  BlueprintItemDiff,
  BlueprintContent,
} from "./types.js";

const ALL_PHASES = [
  "ideation",
  "requirements",
  "architecture",
  "security",
  "database",
  "backend",
  "frontend",
  "core-features",
  "ai-systems",
  "testing",
  "deployment",
  "monitoring",
];

export class DiffService {
  constructor(
    private snapshotStore: SnapshotStore,
    private graphStore: GraphStore,
    private promptStore: PromptStore,
  ) {}

  compare(
    leftSnapshotId: string,
    rightSnapshotId: string,
    leftBlueprint?: BlueprintContent | null,
    rightBlueprint?: BlueprintContent | null,
  ): VersionDiff {
    const left = this.snapshotStore.get(leftSnapshotId);
    const right = this.snapshotStore.get(rightSnapshotId);

    if (!left) throw new Error(`Left snapshot ${leftSnapshotId} not found`);
    if (!right) throw new Error(`Right snapshot ${rightSnapshotId} not found`);

    const leftRef: SnapshotRef = {
      version: left.version,
      reason: left.reason,
      planVersion: left.planVersion,
      createdAt: left.createdAt,
    };
    const rightRef: SnapshotRef = {
      version: right.version,
      reason: right.reason,
      planVersion: right.planVersion,
      createdAt: right.createdAt,
    };

    const leftGraph: TaskGraph | null = left.taskGraphId
      ? (this.graphStore.getGraph(left.planId ?? "", left.planVersion ?? 0) ?? null)
      : null;
    const rightGraph: TaskGraph | null = right.taskGraphId
      ? (this.graphStore.getGraph(right.planId ?? "", right.planVersion ?? 0) ?? null)
      : null;

    const taskDiffs = this.computeTaskDiffs(leftGraph, rightGraph);
    const promptDiffs = this.computePromptDiffs(left, right);
    const phaseDiffs = this.computePhaseDiffs(left, right);
    const blueprintDiff = this.computeBlueprintDiff(leftBlueprint ?? null, rightBlueprint ?? null);

    const affectedTypes = new Set<string>();
    for (const t of taskDiffs) if (t.changeType !== "unchanged") affectedTypes.add(t.phaseType);
    for (const p of promptDiffs) if (p.changeType !== "unchanged") affectedTypes.add(p.phaseType);
    for (const p of phaseDiffs) if (p.changeType !== "unchanged") affectedTypes.add(p.phaseType);

    const hasChanges =
      taskDiffs.some((t) => t.changeType !== "unchanged") ||
      promptDiffs.some((p) => p.changeType !== "unchanged") ||
      (blueprintDiff !== null &&
        (blueprintDiff.assumptions.some((a) => a.changeType !== "unchanged") ||
          blueprintDiff.constraints.some((c) => c.changeType !== "unchanged") ||
          blueprintDiff.risks.some((r) => r.changeType !== "unchanged") ||
          blueprintDiff.phaseSummaries.some(
            (p) => p.summaryChanged || p.confidenceChanged || p.statusChanged,
          )));

    const hasExplicitAffected = right.affectedPhaseTypes !== null && right.affectedPhaseTypes.length > 0;

    const regenerationScope: "full" | "partial" | "none" =
      hasExplicitAffected && hasChanges
        ? "partial"
        : hasChanges && right.planVersion !== left.planVersion
          ? "full"
          : "none";

    const blueprintChanges = blueprintDiff
      ? blueprintDiff.assumptions.filter((a) => a.changeType !== "unchanged").length +
        blueprintDiff.constraints.filter((c) => c.changeType !== "unchanged").length +
        blueprintDiff.risks.filter((r) => r.changeType !== "unchanged").length +
        blueprintDiff.phaseSummaries.filter((p) => p.summaryChanged || p.confidenceChanged || p.statusChanged)
          .length
      : 0;

    const summary: DiffSummary = {
      regenerationScope,
      affectedPhaseTypes: [...affectedTypes],
      phaseChanges: phaseDiffs.filter((d) => d.changeType !== "unchanged").length,
      taskChanges: taskDiffs.filter((d) => d.changeType !== "unchanged").length,
      promptChanges: promptDiffs.filter((d) => d.changeType !== "unchanged").length,
      blueprintChanges,
    };

    return {
      left: leftRef,
      right: rightRef,
      summary,
      phases: phaseDiffs,
      tasks: taskDiffs,
      prompts: promptDiffs,
      blueprint: blueprintDiff,
    };
  }

  private computeTaskDiffs(leftGraph: TaskGraph | null, rightGraph: TaskGraph | null): TaskDiff[] {
    const leftTasks = leftGraph?.tasks ?? [];
    const rightTasks = rightGraph?.tasks ?? [];

    const sameGraph =
      leftGraph &&
      rightGraph &&
      leftGraph.planId === rightGraph.planId &&
      leftGraph.planVersion === rightGraph.planVersion;

    const leftMap = new Map<string, TaskNode>();
    const rightMap = new Map<string, TaskNode>();
    for (const t of leftTasks) leftMap.set(`${t.phaseType}:${t.order}`, t);
    for (const t of rightTasks) rightMap.set(`${t.phaseType}:${t.order}`, t);

    const allKeys = new Set([...leftMap.keys(), ...rightMap.keys()]);
    const diffs: TaskDiff[] = [];

    for (const key of allKeys) {
      const lt = leftMap.get(key);
      const rt = rightMap.get(key);
      const parts = key.split(":");
      const phaseType = parts[0] ?? "";
      const order = parseInt(parts[1] ?? "0", 10) || 0;

      if (!lt && rt) {
        diffs.push({ phaseType, order, changeType: "added", left: null, right: toTaskSummary(rt) });
      } else if (lt && !rt) {
        diffs.push({ phaseType, order, changeType: "removed", left: toTaskSummary(lt), right: null });
      } else if (lt && rt) {
        if (sameGraph) {
          diffs.push({
            phaseType,
            order,
            changeType: "unchanged",
            left: toTaskSummary(lt),
            right: toTaskSummary(rt),
          });
        } else {
          const changed =
            lt.title !== rt.title ||
            lt.type !== rt.type ||
            lt.priority !== rt.priority ||
            lt.status !== rt.status ||
            lt.dependencies.length !== rt.dependencies.length ||
            JSON.stringify(lt.acceptanceCriteria) !== JSON.stringify(rt.acceptanceCriteria);
          diffs.push({
            phaseType,
            order,
            changeType: changed ? "modified" : "unchanged",
            left: toTaskSummary(lt),
            right: toTaskSummary(rt),
          });
        }
      }
    }

    diffs.sort((a, b) => a.order - b.order);
    return diffs;
  }

  private computePromptDiffs(left: SnapshotRecord, right: SnapshotRecord): PromptDiff[] {
    const leftPlanId = left.planId ?? "";
    const rightPlanId = right.planId ?? "";
    const leftVersion = left.planVersion ?? 0;
    const rightVersion = right.planVersion ?? 0;

    const leftPrompts = this.promptStore.getByPlan(leftPlanId, leftVersion);
    const rightPrompts = this.promptStore.getByPlan(rightPlanId, rightVersion);

    const leftTasks = left.taskGraphId
      ? (this.graphStore.getGraph(leftPlanId, leftVersion)?.tasks ?? [])
      : [];
    const rightTasks = right.taskGraphId
      ? (this.graphStore.getGraph(rightPlanId, rightVersion)?.tasks ?? [])
      : [];

    const leftByPhase = groupByPhase(leftPrompts, leftTasks);
    const rightByPhase = groupByPhase(rightPrompts, rightTasks);
    const allPhases = [...new Set([...Object.keys(leftByPhase), ...Object.keys(rightByPhase)])];

    const diffs: PromptDiff[] = [];

    for (const phaseType of allPhases) {
      const lp = leftByPhase[phaseType] ?? [];
      const rp = rightByPhase[phaseType] ?? [];
      if (lp.length === 0 && rp.length === 0 && !ALL_PHASES.includes(phaseType)) continue;

      if (lp.length === 0 && rp.length > 0) {
        diffs.push({
          phaseType,
          changeType: "added",
          textChanged: true,
          statusChanged: true,
          leftStatus: null,
          rightStatus: rp[0]?.status ?? null,
        });
      } else if (lp.length > 0 && rp.length === 0) {
        diffs.push({
          phaseType,
          changeType: "removed",
          textChanged: true,
          statusChanged: true,
          leftStatus: lp[0]?.status ?? null,
          rightStatus: null,
        });
      } else {
        const textChanged = lp.some((p, i) => rp[i] && p.promptText !== rp[i]!.promptText);
        const statusChanged = lp.some((p, i) => rp[i] && p.status !== rp[i]!.status);
        diffs.push({
          phaseType,
          changeType: textChanged || statusChanged ? "modified" : "unchanged",
          textChanged,
          statusChanged,
          leftStatus: lp[0]?.status ?? null,
          rightStatus: rp[0]?.status ?? null,
        });
      }
    }

    return diffs;
  }

  private computePhaseDiffs(_left: SnapshotRecord, right: SnapshotRecord): PhaseDiff[] {
    const rightAffected = right.affectedPhaseTypes;
    const changedTypes = rightAffected ?? [];

    return ALL_PHASES.map((phaseType) => {
      const changed = changedTypes.includes(phaseType);
      return {
        phaseType,
        changeType: changed ? "modified" : "unchanged",
        statusChanged: changed,
        confidenceChanged: false,
        left: { status: "unknown", confidence: 0 },
        right: changed ? { status: "regenerated", confidence: 0 } : { status: "unknown", confidence: 0 },
      };
    });
  }

  private computeBlueprintDiff(
    left: BlueprintContent | null,
    right: BlueprintContent | null,
  ): BlueprintDiff | null {
    if (!left && !right) return null;
    if (!left || !right) {
      // One side has blueprint, other doesn't — all items are added/removed
      const source = right ?? left;
      if (!source) return null;
      const items: BlueprintItemDiff[] = (source.assumptions ?? []).map(() => ({
        changeType: left ? ("removed" as const) : ("added" as const),
        description: "",
      }));
      return {
        assumptions: items,
        constraints: items,
        risks: items,
        phaseSummaries: [],
      };
    }

    const assumptions = compareItemArrays(left.assumptions, right.assumptions);
    const constraints = compareItemArrays(left.constraints, right.constraints);
    const risks = compareItemArrays(left.risks, right.risks);

    const leftPhaseMap = new Map(left.phases.map((p) => [p.phaseType, p]));
    const rightPhaseMap = new Map(right.phases.map((p) => [p.phaseType, p]));
    const phaseSummaries = ALL_PHASES.map((phaseType) => {
      const lp = leftPhaseMap.get(phaseType);
      const rp = rightPhaseMap.get(phaseType);
      return {
        phaseType,
        summaryChanged: (lp?.summary ?? "") !== (rp?.summary ?? ""),
        confidenceChanged: (lp?.confidence ?? 0) !== (rp?.confidence ?? 0),
        statusChanged: (lp?.status ?? "") !== (rp?.status ?? ""),
        leftSummary: lp?.summary ?? null,
        rightSummary: rp?.summary ?? null,
      };
    });

    return { assumptions, constraints, risks, phaseSummaries };
  }
}

function toTaskSummary(t: TaskNode): TaskSummary {
  return {
    order: t.order,
    phaseType: t.phaseType,
    title: t.title,
    type: t.type,
    priority: t.priority,
    status: t.status,
    depCount: t.dependencies.length,
    hasFailureReason: !!t.failureReason,
  };
}

function groupByPhase(prompts: PromptArtifact[], tasks: TaskNode[]): Record<string, PromptArtifact[]> {
  const taskPhase = new Map(tasks.map((t) => [t.id, t.phaseType]));
  const groups: Record<string, PromptArtifact[]> = {};
  for (const p of prompts) {
    const phase = taskPhase.get(p.taskId) ?? "unknown";
    if (!groups[phase]) groups[phase] = [];
    groups[phase]!.push(p);
  }
  return groups;
}

function compareItemArrays(
  left: { description: string }[],
  right: { description: string }[],
): BlueprintItemDiff[] {
  const leftDescs = new Set(left.map((a) => a.description));
  const rightDescs = new Set(right.map((a) => a.description));
  const allDescs = new Set([...leftDescs, ...rightDescs]);
  const diffs: BlueprintItemDiff[] = [];

  for (const desc of allDescs) {
    const inLeft = leftDescs.has(desc);
    const inRight = rightDescs.has(desc);
    if (inLeft && !inRight) {
      diffs.push({ changeType: "removed", description: desc });
    } else if (!inLeft && inRight) {
      diffs.push({ changeType: "added", description: desc });
    } else {
      diffs.push({ changeType: "unchanged", description: desc });
    }
  }

  return diffs;
}
