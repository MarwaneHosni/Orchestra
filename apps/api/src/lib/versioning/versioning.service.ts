import type { SnapshotRecord, SnapshotStore, RegenerationResult } from "./types.js";
import { PHASE_ESCALATION_RULES, DEPENDENT_PHASES } from "./types.js";
import type { TaskGraph, PhaseInput } from "../task-graph/types.js";
import type { GraphStore } from "../task-graph/generator.js";
import type { PromptStore } from "../prompt/types.js";
import { generateTasks, deriveGraph } from "../task-graph/generator.js";
import { assemblePrompt } from "../prompt/assembler.js";
import { logAudit } from "../audit/logger.js";

export class VersioningService {
  constructor(
    private snapshotStore: SnapshotStore,
    private graphStore: GraphStore,
    private promptStore: PromptStore,
  ) {}

  /**
   * Determine whether a set of changed phase types can be regenerated
   * partially or must escalate to a full re-snapshot.
   */
  assessRegenerationScope(changedPhaseTypes: string[]): {
    escalatedToFull: boolean;
    affectedPhaseTypes: string[];
    reason: string;
  } {
    const uniquePhases = [...new Set(changedPhaseTypes)];

    for (const phase of uniquePhases) {
      const rule = PHASE_ESCALATION_RULES[phase];
      if (rule === "escalate") {
        return {
          escalatedToFull: true,
          affectedPhaseTypes: DEPENDENT_PHASES[phase] ?? [phase],
          reason: `Phase "${phase}" is cross-cutting — full re-snapshot required`,
        };
      }
    }

    const affectedSet = new Set<string>();
    for (const phase of uniquePhases) {
      const deps = DEPENDENT_PHASES[phase] ?? [phase];
      for (const d of deps) affectedSet.add(d);
    }

    const allDeps = [...affectedSet];
    return {
      escalatedToFull: false,
      affectedPhaseTypes: allDeps,
      reason: `Partial regeneration: ${uniquePhases.join(", ")} changed, affecting ${allDeps.join(", ")}`,
    };
  }

  /**
   * Create a full project snapshot from the current state.
   * This does NOT generate anything — it snapshots existing artifacts.
   */
  createSnapshot(params: {
    projectId: string;
    reason: string;
    planId?: string | null;
    planVersion?: number | null;
    blueprintId?: string | null;
    taskGraphId?: string | null;
    interviewSessionId?: string | null;
    answerCount?: number;
    affectedPhaseTypes?: string[] | null;
    changeSummary?: string | null;
  }): SnapshotRecord {
    const existing = this.snapshotStore.getByProject(params.projectId);
    const nextVersion = existing.length > 0 ? Math.max(...existing.map((s) => s.version)) + 1 : 1;

    const latest = this.snapshotStore.getLatestByProject(params.projectId);

    const snapshot: SnapshotRecord = {
      id: crypto.randomUUID(),
      projectId: params.projectId,
      version: nextVersion,
      parentSnapshotId: latest?.id ?? null,
      reason: params.reason,
      status: "complete",
      planId: params.planId ?? null,
      planVersion: params.planVersion ?? null,
      blueprintId: params.blueprintId ?? null,
      taskGraphId: params.taskGraphId ?? null,
      interviewSessionId: params.interviewSessionId ?? null,
      answerCount: params.answerCount ?? 0,
      affectedPhaseTypes: params.affectedPhaseTypes ?? null,
      changeSummary: params.changeSummary ?? null,
      failureReason: null,
      createdAt: new Date().toISOString(),
    };

    this.snapshotStore.insert(snapshot);

    const isPartial = snapshot.affectedPhaseTypes !== null && snapshot.affectedPhaseTypes.length > 0;
    const eventType = isPartial ? "snapshot.partial_regenerated" : "snapshot.created";
    logAudit(eventType, "system", snapshot.projectId, {
      snapshotId: snapshot.id,
      version: snapshot.version,
      reason: snapshot.reason,
      projectId: snapshot.projectId,
      planVersion: snapshot.planVersion,
    });

    return snapshot;
  }

  /**
   * Perform regeneration based on changed phase types.
   *
   * 1. Assess escalation: if any changed phase is cross-cutting, escalate to full.
   * 2. Determine affected phases.
   * 3. Generate a new task graph (or derive from the existing one).
   * 4. Assemble prompts for affected tasks.
   * 5. Create a new project snapshot.
   */
  regenerate(params: {
    projectId: string;
    planId: string;
    planVersion: number;
    phases: PhaseInput[];
    sessionId?: string | null;
    changeReason: string;
    changedPhaseTypes: string[];
    forceFullRegeneration?: boolean;
  }): RegenerationResult {
    const scope = this.assessRegenerationScope(params.changedPhaseTypes);
    const escalated = scope.escalatedToFull || params.forceFullRegeneration === true;

    try {
      const existingGraph = this.graphStore.getGraph(params.planId, params.planVersion - 1);

      let taskGraph: TaskGraph;

      if (escalated) {
        taskGraph = generateTasks(params.planId, params.planVersion, params.phases);
      } else if (existingGraph) {
        taskGraph = deriveGraph(params.planId, params.planVersion, params.phases, existingGraph);
      } else {
        taskGraph = generateTasks(params.planId, params.planVersion, params.phases);
      }

      const taskGraphId = crypto.randomUUID();
      this.graphStore.saveGraph(taskGraph);

      let affectedTasks = 0;
      let affectedPrompts = 0;

      const allTasks = taskGraph.tasks;

      if (escalated) {
        for (const task of allTasks) {
          assemblePrompt(
            { task, planName: "Project", allTasks, predecessorOutputs: [], phaseSummary: task.phaseType },
            this.promptStore,
            params.planVersion,
          );
          affectedTasks++;
          affectedPrompts++;
        }
      } else {
        const affectedSet = new Set(scope.affectedPhaseTypes);
        for (const task of allTasks) {
          if (affectedSet.has(task.phaseType)) {
            assemblePrompt(
              { task, planName: "Project", allTasks, predecessorOutputs: [], phaseSummary: task.phaseType },
              this.promptStore,
              params.planVersion,
            );
            affectedTasks++;
            affectedPrompts++;
          }
        }
      }

      const snapshot = this.createSnapshot({
        projectId: params.projectId,
        reason: params.changeReason,
        planId: params.planId,
        planVersion: params.planVersion,
        taskGraphId,
        interviewSessionId: params.sessionId ?? null,
        answerCount: allTasks.length,
        affectedPhaseTypes: escalated ? null : scope.affectedPhaseTypes,
        changeSummary: escalated
          ? `Full regeneration: ${params.changeReason}`
          : `Partial regeneration: affected ${scope.affectedPhaseTypes.join(", ")}`,
      });

      return {
        snapshot,
        taskGraph,
        affectedPhases: escalated ? allTasks.length : scope.affectedPhaseTypes.length,
        affectedTasks,
        affectedPrompts,
        escalatedToFull: escalated,
        reason: scope.reason,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const failedSnapshot = this.createSnapshot({
        projectId: params.projectId,
        reason: `${params.changeReason} (failed)`,
        planId: params.planId,
        planVersion: params.planVersion,
        changeSummary: `Regeneration failed: ${errorMsg}`,
      });
      this.snapshotStore.updateStatus(failedSnapshot.id, "failed", errorMsg);
      logAudit("snapshot.failed", "system", params.projectId, {
        snapshotId: failedSnapshot.id,
        reason: params.changeReason,
        error: errorMsg,
        projectId: params.projectId,
      });
      throw new Error(`Regeneration failed: ${errorMsg}`, { cause: err });
    }
  }
}
