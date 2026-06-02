"use client";

import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { border: string; bg: string; dot: string }> = {
  ready: { border: "border-accent-green-dim", bg: "bg-accent-green-dim/30", dot: "bg-accent-green" },
  blocked: { border: "border-accent-red-dim", bg: "bg-accent-red-dim/30", dot: "bg-accent-red" },
  needs_review: { border: "border-accent-amber-dim", bg: "bg-accent-amber-dim/30", dot: "bg-accent-amber" },
  pending: { border: "border-border-subtle", bg: "bg-bg-surface", dot: "bg-border-default" },
  in_progress: { border: "border-accent-purple-dim", bg: "bg-accent-purple-dim/30", dot: "bg-accent-purple" },
  complete: { border: "border-accent-green-dim", bg: "bg-accent-green-dim/20", dot: "bg-accent-green" },
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
  phaseIndex: number;
  isSelected: boolean;
  onSelect: (task: TaskData) => void;
}

export function TaskNodeView({ task, phaseIndex: _phaseIndex, isSelected, onSelect }: TaskNodeProps) {
  const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;

  return (
    <button
      onClick={() => onSelect(task)}
      aria-pressed={isSelected}
      aria-label={`${task.title} — ${STATUS_LABELS[task.status] ?? task.status} — ${task.dependencies.length} dep${task.dependencies.length !== 1 ? "s" : ""}`}
      className={cn(
        "w-full rounded border-2 px-3 py-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-accent-purple focus:ring-offset-1 focus:ring-offset-bg-base",
        cfg.border,
        cfg.bg,
        isSelected && "ring-2 ring-accent-purple ring-offset-1 ring-offset-bg-base",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", cfg.dot)} aria-hidden="true" />
        <span className="sr-only">{STATUS_LABELS[task.status] ?? task.status}</span>
        <span className="truncate text-xs font-medium text-text-primary">{task.title}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-text-secondary">
        {task.type}
        <span aria-label={`${task.dependencies.length} dependenc${task.dependencies.length !== 1 ? "ies" : "y"}`}>
          {task.dependencies.length} dep{task.dependencies.length !== 1 ? "s" : ""}
        </span>
      </div>
    </button>
  );
}
