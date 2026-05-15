"use client";

import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  ready: { label: "Ready", className: "border-green-200 bg-green-50", dot: "bg-green-500" },
  blocked: { label: "Blocked", className: "border-red-200 bg-red-50", dot: "bg-red-500" },
  needs_review: { label: "Needs Review", className: "border-amber-200 bg-amber-50", dot: "bg-amber-500" },
  pending: { label: "Pending", className: "border-gray-200 bg-gray-50", dot: "bg-gray-300" },
  in_progress: { label: "In Progress", className: "border-blue-200 bg-blue-50", dot: "bg-blue-500" },
  complete: { label: "Complete", className: "border-green-200 bg-green-100", dot: "bg-green-600" },
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
      className={cn(
        "w-full rounded-lg border-2 px-3 py-2 text-left transition-all hover:shadow-sm",
        cfg.className,
        isSelected && "ring-2 ring-orchestra-500 ring-offset-1",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", cfg.dot)} />
        <span className="truncate text-xs font-medium text-text-primary">{task.title}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-text-secondary">
        <span className="rounded bg-white/60 px-1 py-0.5">{task.type}</span>
        <span>
          {task.dependencies.length} dep{task.dependencies.length !== 1 ? "s" : ""}
        </span>
      </div>
    </button>
  );
}
