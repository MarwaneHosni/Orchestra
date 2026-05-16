import type { SnapshotRecord, SnapshotStore } from "../versioning/types.js";
import type { GraphStore } from "../task-graph/generator.js";
import type { PromptStore, PromptArtifact } from "../prompt/types.js";
import type { TaskNode } from "../task-graph/types.js";
import type { BlueprintContent } from "../diff/types.js";
import type { ExportRecord, ExportOptions, ExportStore, ExportFormat } from "./types.js";
import { EXPORT_BUNDLE_VERSION, PHASE_LABELS, PHASE_ORDER } from "./types.js";
import { logAudit } from "../audit/logger.js";
import { instrumentExport } from "../metrics/index.js";

export class ExportService {
  constructor(
    private snapshotStore: SnapshotStore,
    private graphStore: GraphStore,
    private promptStore: PromptStore,
    private exportStore: ExportStore,
  ) {}

  exportFullBundle(snapshotId: string, options: ExportOptions): ExportRecord {
    const snapshot = this.snapshotStore.get(snapshotId);
    if (!snapshot) throw new Error(`Snapshot ${snapshotId} not found`);
    if (snapshot.status !== "complete")
      throw new Error(`Snapshot ${snapshotId} has status ${snapshot.status} — cannot export`);

    const graph = this.loadGraph(snapshot);
    const prompts = this.loadPrompts(snapshot);

    let content: string;
    if (options.format === "markdown") {
      content = this.renderMarkdownBundle(snapshot, graph, prompts, options.blueprintContent);
    } else {
      content = this.renderJsonBundle(snapshot, graph, prompts, options.blueprintContent);
    }

    const record = this.saveExport(snapshot, "full_bundle", options.format, content);
    return record;
  }

  exportBlueprint(snapshotId: string, options: ExportOptions): ExportRecord {
    const snapshot = this.snapshotStore.get(snapshotId);
    if (!snapshot) throw new Error(`Snapshot ${snapshotId} not found`);

    const content =
      options.format === "markdown"
        ? this.renderBlueprintMarkdown(snapshot, options.blueprintContent)
        : this.renderBlueprintJson(snapshot, options.blueprintContent);

    return this.saveExport(snapshot, "blueprint", options.format, content);
  }

  exportTaskGraph(snapshotId: string, options: ExportOptions): ExportRecord {
    const snapshot = this.snapshotStore.get(snapshotId);
    if (!snapshot) throw new Error(`Snapshot ${snapshotId} not found`);

    const graph = this.loadGraph(snapshot);
    const content =
      options.format === "markdown"
        ? this.renderTaskGraphMarkdown(snapshot, graph)
        : this.renderTaskGraphJson(snapshot, graph);

    return this.saveExport(snapshot, "task_graph", options.format, content);
  }

  exportPrompts(snapshotId: string, options: ExportOptions): ExportRecord {
    const snapshot = this.snapshotStore.get(snapshotId);
    if (!snapshot) throw new Error(`Snapshot ${snapshotId} not found`);

    const graph = this.loadGraph(snapshot);
    const prompts = this.loadPrompts(snapshot);
    const content =
      options.format === "markdown"
        ? this.renderPromptsMarkdown(snapshot, graph, prompts)
        : this.renderPromptsJson(snapshot, graph, prompts);

    return this.saveExport(snapshot, "prompts", options.format, content);
  }

  getExport(id: string): ExportRecord | undefined {
    return this.exportStore.get(id);
  }

  listExports(projectId: string): ExportRecord[] {
    return this.exportStore.getByProject(projectId);
  }

  listExportsBySnapshot(snapshotId: string): ExportRecord[] {
    return this.exportStore.getBySnapshot(snapshotId);
  }

  private loadGraph(snapshot: SnapshotRecord): TaskNode[] | null {
    if (!snapshot.taskGraphId) return null;
    const g = this.graphStore.getGraph(snapshot.planId ?? "", snapshot.planVersion ?? 0);
    return g?.tasks ?? null;
  }

  private loadPrompts(snapshot: SnapshotRecord) {
    return this.promptStore.getByPlan(snapshot.planId ?? "", snapshot.planVersion ?? 0);
  }

  private saveExport(
    snapshot: SnapshotRecord,
    type: ExportRecord["type"],
    format: ExportFormat,
    content: string,
  ): ExportRecord {
    const record: ExportRecord = {
      id: crypto.randomUUID(),
      snapshotId: snapshot.id,
      projectId: snapshot.projectId,
      format,
      type,
      content,
      bundleVersion: EXPORT_BUNDLE_VERSION,
      snapshotVersion: snapshot.version,
      planVersion: snapshot.planVersion,
      planId: snapshot.planId,
      sourceReason: snapshot.reason,
      lineageRef: snapshot.parentSnapshotId,
      createdAt: new Date().toISOString(),
    };
    this.exportStore.insert(record);

    instrumentExport(snapshot.projectId, format, type);
    logAudit("export.generated", "system", snapshot.projectId, {
      exportId: record.id,
      snapshotId: snapshot.id,
      format: record.format,
      type: record.type,
      projectId: snapshot.projectId,
    });

    return record;
  }

  // ── Markdown Renderers ──────────────────────────────────────

  private renderMarkdownBundle(
    snapshot: SnapshotRecord,
    graph: TaskNode[] | null,
    prompts: PromptArtifact[],
    blueprintContent?: BlueprintContent | null,
  ): string {
    const lines: string[] = [];
    lines.push(`# Orchestra Project Export`, "");
    lines.push(`> **Bundle version:** ${EXPORT_BUNDLE_VERSION}`);
    lines.push(`> **Snapshot:** v${snapshot.version} — ${snapshot.reason}`);
    lines.push(`> **Date:** ${new Date(snapshot.createdAt).toISOString()}`);
    if (snapshot.parentSnapshotId) lines.push(`> **Derived from:** snapshot ${snapshot.parentSnapshotId}`);
    if (snapshot.affectedPhaseTypes) {
      lines.push(`> **Regeneration scope:** partial — affected ${snapshot.affectedPhaseTypes.join(", ")}`);
    }
    lines.push("");

    lines.push(this.renderBlueprintMarkdown(snapshot, blueprintContent));
    lines.push("---", "");
    lines.push(this.renderTaskGraphMarkdown(snapshot, graph));
    lines.push("---", "");
    lines.push(this.renderPromptsMarkdown(snapshot, graph, prompts));

    return lines.join("\n");
  }

  private renderBlueprintMarkdown(
    snapshot: SnapshotRecord,
    blueprintContent?: BlueprintContent | null,
  ): string {
    const lines: string[] = [];
    lines.push("## Blueprint", "");
    lines.push(`**Plan version:** v${snapshot.planVersion ?? "?"}`);
    lines.push(`**Snapshot reason:** ${snapshot.reason}`);
    lines.push(`**Answers recorded:** ${snapshot.answerCount}`);
    if (snapshot.affectedPhaseTypes) {
      lines.push(`**Regeneration scope:** partial — ${snapshot.affectedPhaseTypes.join(", ")}`);
    }
    if (snapshot.changeSummary) {
      lines.push("", `**Summary:** ${snapshot.changeSummary}`, "");
    }

    if (blueprintContent) {
      lines.push("", "### Phases", "");
      for (const p of blueprintContent.phases) {
        const label = PHASE_LABELS[p.phaseType] ?? p.phaseName;
        lines.push(
          `- **${label}** — ${p.status} (confidence: ${Math.round(p.confidence * 100)}%)`,
          `  - ${p.summary}`,
        );
      }

      if (blueprintContent.assumptions.length > 0) {
        lines.push("", "### Assumptions", "");
        for (const a of blueprintContent.assumptions) {
          lines.push(`- ${a.description}`);
        }
      }

      if (blueprintContent.constraints.length > 0) {
        lines.push("", "### Constraints", "");
        for (const c of blueprintContent.constraints) {
          lines.push(`- ${c.description}`);
        }
      }

      if (blueprintContent.risks.length > 0) {
        lines.push("", "### Risks", "");
        for (const r of blueprintContent.risks) {
          lines.push(`- ${r.description}`);
        }
      }
    }

    return lines.join("\n");
  }

  private renderTaskGraphMarkdown(_snapshot: SnapshotRecord, graph: TaskNode[] | null): string {
    const lines: string[] = [];
    lines.push("## Task Graph", "");

    if (!graph || graph.length === 0) {
      lines.push("_No tasks generated._", "");
      return lines.join("\n");
    }

    lines.push(`**Total tasks:** ${graph.length}`, "");

    for (const phaseType of PHASE_ORDER) {
      const phaseTasks = graph.filter((t) => t.phaseType === phaseType).sort((a, b) => a.order - b.order);
      if (phaseTasks.length === 0) continue;

      lines.push(`### ${PHASE_LABELS[phaseType] ?? phaseType}`, "");
      for (const task of phaseTasks) {
        const depCount = task.dependencies.length;
        lines.push(
          `- **${task.title}** [${task.type}] — ${task.status}` +
            (depCount > 0 ? ` (${depCount} dep${depCount !== 1 ? "s" : ""})` : "") +
            (task.failureReason ? ` ⚠ ${task.failureReason}` : ""),
        );
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  private renderPromptsMarkdown(
    _snapshot: SnapshotRecord,
    graph: TaskNode[] | null,
    prompts: PromptArtifact[],
  ): string {
    const lines: string[] = [];
    lines.push("## AI Prompt Bundle", "");
    lines.push(`**Total prompts:** ${prompts.length}`, "");

    if (!graph) {
      lines.push("_No task graph available for ordering._", "");
      return lines.join("\n");
    }

    const sorted = [...graph].sort((a, b) => a.order - b.order);

    for (const task of sorted) {
      const prompt = prompts.find((p) => p.taskId === task.id);
      if (!prompt) continue;

      lines.push(`---`, "");
      lines.push(`### Task ${task.order}: ${task.title}`, "");
      lines.push(`- **Phase:** ${PHASE_LABELS[task.phaseType] ?? task.phaseType}`);
      lines.push(`- **Type:** ${task.type} | **Status:** ${task.status}`);
      lines.push(`- **Prompt status:** ${prompt.status}`);
      if (prompt.failureReason) lines.push(`- **Note:** ${prompt.failureReason}`);
      lines.push("", prompt.promptText, "");
    }

    return lines.join("\n");
  }

  // ── JSON Renderers ──────────────────────────────────────────

  private renderJsonBundle(
    snapshot: SnapshotRecord,
    graph: TaskNode[] | null,
    prompts: PromptArtifact[],
    blueprintContent?: BlueprintContent | null,
  ): string {
    const bundle: Record<string, unknown> = {
      exportFormat: EXPORT_BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      snapshot: {
        version: snapshot.version,
        reason: snapshot.reason,
        planVersion: snapshot.planVersion,
        parentSnapshotId: snapshot.parentSnapshotId,
        createdAt: snapshot.createdAt,
      },
      blueprint: blueprintContent ?? {
        planVersion: snapshot.planVersion,
        snapshotReason: snapshot.reason,
        answerCount: snapshot.answerCount,
        affectedPhaseTypes: snapshot.affectedPhaseTypes,
        changeSummary: snapshot.changeSummary,
      },
      taskGraph: graph
        ? graph.map((t) => ({
            order: t.order,
            phaseType: t.phaseType,
            title: t.title,
            type: t.type,
            priority: t.priority,
            status: t.status,
            dependencies: t.dependencies.map((d) => ({ type: d.type })),
            acceptanceCriteria: t.acceptanceCriteria,
            failureReason: t.failureReason ?? null,
          }))
        : [],
      prompts: prompts.map((p) => ({
        taskId: p.taskId,
        promptText: p.promptText,
        status: p.status,
        failureReason: p.failureReason,
        sections: p.sections,
      })),
      metadata: {
        bundleVersion: EXPORT_BUNDLE_VERSION,
        snapshotVersion: snapshot.version,
        planVersion: snapshot.planVersion,
        graphTaskCount: graph?.length ?? 0,
        promptCount: prompts.length,
      },
    };

    return JSON.stringify(bundle, null, 2);
  }

  private renderBlueprintJson(snapshot: SnapshotRecord, blueprintContent?: BlueprintContent | null): string {
    return JSON.stringify(
      {
        exportType: "blueprint",
        bundleVersion: EXPORT_BUNDLE_VERSION,
        exportedAt: new Date().toISOString(),
        snapshotVersion: snapshot.version,
        reason: snapshot.reason,
        planVersion: snapshot.planVersion,
        answerCount: snapshot.answerCount,
        affectedPhaseTypes: snapshot.affectedPhaseTypes,
        changeSummary: snapshot.changeSummary,
        regenerationScope: snapshot.affectedPhaseTypes
          ? `partial — ${snapshot.affectedPhaseTypes.join(", ")}`
          : "full",
        phases: blueprintContent?.phases ?? [],
        assumptions: blueprintContent?.assumptions ?? [],
        constraints: blueprintContent?.constraints ?? [],
        risks: blueprintContent?.risks ?? [],
      },
      null,
      2,
    );
  }

  private renderTaskGraphJson(snapshot: SnapshotRecord, graph: TaskNode[] | null): string {
    return JSON.stringify(
      {
        exportType: "task_graph",
        bundleVersion: EXPORT_BUNDLE_VERSION,
        exportedAt: new Date().toISOString(),
        snapshotVersion: snapshot.version,
        planVersion: snapshot.planVersion,
        tasks: graph
          ? graph.map((t) => ({
              order: t.order,
              phaseType: t.phaseType,
              title: t.title,
              type: t.type,
              priority: t.priority,
              status: t.status,
              dependencies: t.dependencies.map((d) => ({ type: d.type })),
              acceptanceCriteria: t.acceptanceCriteria,
              failureReason: t.failureReason ?? null,
            }))
          : [],
      },
      null,
      2,
    );
  }

  private renderPromptsJson(
    snapshot: SnapshotRecord,
    graph: TaskNode[] | null,
    prompts: PromptArtifact[],
  ): string {
    const taskMap = new Map(graph?.map((t) => [t.id, t]) ?? []);
    return JSON.stringify(
      {
        exportType: "prompts",
        bundleVersion: EXPORT_BUNDLE_VERSION,
        exportedAt: new Date().toISOString(),
        snapshotVersion: snapshot.version,
        planVersion: snapshot.planVersion,
        prompts: prompts.map((p) => {
          const task = taskMap.get(p.taskId);
          return {
            taskOrder: task?.order ?? null,
            phaseType: task?.phaseType ?? null,
            taskTitle: task?.title ?? null,
            status: p.status,
            failureReason: p.failureReason,
            promptText: p.promptText,
          };
        }),
      },
      null,
      2,
    );
  }
}
