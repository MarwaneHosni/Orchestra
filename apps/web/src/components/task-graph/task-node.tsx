"use client";

import { SectionDivider } from "@/components/ui/badge";

const STATUS_DOT_COLOR: Record<string, string> = {
  ready: "var(--color-accent-green)",
  blocked: "var(--color-accent-red)",
  needs_review: "var(--color-accent-amber)",
  pending: "var(--color-text-muted)",
  in_progress: "var(--color-accent-purple)",
  complete: "var(--color-accent-green)",
};

const STATUS_LABELS: Record<string, string> = {
  ready: "Ready",
  blocked: "Blocked",
  needs_review: "Needs Review",
  pending: "Pending",
  in_progress: "In Progress",
  complete: "Complete",
};

export interface TaskData {
  id: string;
  planId?: string;
  phaseType: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  order: number;
  dependencies: { taskId: string; type: string }[];
  acceptanceCriteria?: string[];
  failureReason?: string | null;
  estimatedPromptRounds?: number;
}

interface TaskNodeProps {
  task: TaskData;
  index: number;
  total: number;
  isSelected: boolean;
  onSelect: (task: TaskData) => void;
}

export function TaskNodeView({ task, index, total, isSelected, onSelect }: TaskNodeProps) {
  const dotColor = STATUS_DOT_COLOR[task.status] ?? "var(--color-text-muted)";

  return (
    <div className="flex gap-0" style={{ minHeight: 44, overflow: "hidden" }}>
      {/* Connector rail */}
      <div className="flex flex-col items-center" style={{ width: 24, flexShrink: 0 }}>
        {index > 0 && (
          <div style={{ width: 1, height: 6, background: "var(--color-border-default)" }} />
        )}
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        {index < total - 1 && (
          <div style={{ flex: 1, width: 1, background: "var(--color-border-subtle)" }} />
        )}
      </div>

      {/* Task card */}
      <button
        onClick={() => onSelect(task)}
        aria-pressed={isSelected}
        aria-label={`${task.title} — ${STATUS_LABELS[task.status] ?? task.status} — ${task.dependencies.length} dep${task.dependencies.length !== 1 ? "s" : ""}`}
        style={{
          flex: 1,
          borderRadius: 3,
          border: `1px solid ${isSelected ? "var(--color-accent-purple)" : "var(--color-border-subtle)"}`,
          background: isSelected ? "var(--color-accent-purple-dim)" : "var(--color-bg-surface)",
          padding: "12px 18px",
          textAlign: "left",
          fontFamily: "'JetBrains Mono', monospace",
          marginBottom: index < total - 1 ? 0 : 0,
        }}
        className="transition-colors duration-150 hover:bg-bg-hover focus:outline-none focus:shadow-[0_0_0_2px_var(--color-accent-purple-dim)]"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {task.title}
          </span>
          <span style={{ fontSize: 11, color: dotColor, whiteSpace: "nowrap" }}>
            [{STATUS_LABELS[task.status] ?? task.status}]
          </span>
        </div>
        <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--color-text-secondary)" }}>
          <span>{task.type}</span>
          {task.dependencies.length > 0 && (
            <span>
              ← {task.dependencies.length} dep{task.dependencies.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

interface DependencyConnectorProps {
  tasks: TaskData[];
  dependencies: { taskId: string; dependsOnTaskId: string; dependencyType: string }[];
}

function DependencyArrows({ tasks, dependencies }: DependencyConnectorProps) {
  const taskIndex = new Map(tasks.map((t, i) => [t.id, i]));
  const svgHeight = tasks.length * 50;
  if (tasks.length === 0) return null;

  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  for (const dep of dependencies) {
    const fromIdx = taskIndex.get(dep.dependsOnTaskId);
    const toIdx = taskIndex.get(dep.taskId);
    if (fromIdx === undefined || toIdx === undefined) continue;

    const y1 = fromIdx * 50 + 22;
    const y2 = toIdx * 50 + 22;
    const midY = (y1 + y2) / 2;

    lines.push({ x1: 24, y1, x2: 24, y2: midY });
    lines.push({ x1: 24, y1: midY, x2: 40, y2: midY });
    lines.push({ x1: 40, y1: midY, x2: 40, y2 });
    lines.push({ x1: 7, y1: y2, x2: 16, y2: y2 - 4 });
    lines.push({ x1: 7, y1: y2, x2: 16, y2: y2 + 4 });
  }

  return (
    <svg
      style={{ position: "absolute", left: 0, top: 0, width: 48, height: svgHeight, pointerEvents: "none", zIndex: 0 }}
      aria-hidden="true"
    >
      {lines.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="var(--color-border-default)"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

interface TaskChainProps {
  tasks: TaskData[];
  dependencies: { taskId: string; dependsOnTaskId: string; dependencyType: string }[];
  selectedId?: string;
  onSelect: (task: TaskData) => void;
}

export function TaskChain({ tasks, dependencies, selectedId, onSelect }: TaskChainProps) {
  if (tasks.length === 0) return null;

  const phaseDeps = dependencies.filter(
    (d) => tasks.some((t) => t.id === d.taskId) || tasks.some((t) => t.id === d.dependsOnTaskId),
  );

  return (
    <div style={{ position: "relative" }}>
      {phaseDeps.length > 0 && (
        <DependencyArrows tasks={tasks} dependencies={phaseDeps} />
      )}
      <div className="space-y-0">
        {tasks.map((task, i) => (
          <TaskNodeView
            key={task.id}
            task={task}
            index={i}
            total={tasks.length}
            isSelected={selectedId === task.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
