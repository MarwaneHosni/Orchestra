"use client";

import { useRef, useCallback } from "react";
import { useFocusTrap, useEscapeToClose } from "@/lib/use-focus-trap";
import type { TaskData } from "./task-node";

interface TaskDetailProps {
  task: TaskData;
  allTasks: TaskData[];
  onClose: () => void;
  onShowPrompt: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  ready: "Ready",
  blocked: "Blocked",
  needs_review: "Needs Review",
  pending: "Pending",
  in_progress: "In Progress",
  complete: "Complete",
};

export function TaskDetail({ task, allTasks, onClose, onShowPrompt, onStatusChange }: TaskDetailProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const depNames = task.dependencies.map((d) => allTasks.find((t) => t.id === d.taskId)).filter(Boolean);

  const close = useCallback(() => onClose(), [onClose]);
  useFocusTrap(panelRef, true);
  useEscapeToClose(close, true);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Task details: ${task.title}`}
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border-default bg-bg-elevated sm:w-96"
    >
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Task Details</h2>
        <button
          onClick={onClose}
          aria-label="Close task details"
          className="rounded p-1 text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple"
        >
          <span aria-hidden="true">✗</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-semibold text-text-primary">{task.title}</h3>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded bg-bg-hover px-2 py-0.5 text-xs font-medium">{task.phaseType}</span>
          <span className="rounded bg-bg-hover px-2 py-0.5 text-xs font-medium">{task.type}</span>
          <span className="rounded bg-bg-hover px-2 py-0.5 text-xs font-medium">
            Priority: {task.priority}
          </span>
          <span className="rounded bg-bg-hover px-2 py-0.5 text-xs font-medium">
            {STATUS_LABELS[task.status] ?? task.status}
          </span>
        </div>

        {"failureReason" in task && task.failureReason && (
          <div
            className="mt-4 rounded border border-accent-amber-dim bg-accent-amber-dim/30 p-3 text-sm"
            role="alert"
          >
            <p className="font-medium text-accent-amber">Needs Review</p>
            <p className="mt-1 text-xs text-text-secondary">{task.failureReason}</p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 rounded border border-border-default p-3">
          <input
            type="checkbox"
            id="task-done"
            checked={task.status === "complete"}
            onChange={() => onStatusChange(task.id, task.status === "complete" ? "pending" : "complete")}
            className="h-4 w-4 rounded border-border-default accent-accent-purple focus:ring-accent-purple"
          />
          <label htmlFor="task-done" className="text-sm font-medium text-text-primary">
            {task.status === "complete" ? "Completed" : "Mark as complete"}
          </label>
        </div>

        <div className="mt-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Dependencies
          </h4>
          {depNames.length === 0 ? (
            <p className="text-sm text-text-secondary">No dependencies — first task in chain.</p>
          ) : (
            <ul className="space-y-1.5">
              {depNames.map((t) => (
                <li key={t!.id} className="rounded border border-border-subtle bg-bg-surface px-3 py-2 text-sm">
                  {t!.title}
                </li>
              ))}
            </ul>
          )}
        </div>

        {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Acceptance Criteria
            </h4>
            <ul className="list-inside list-disc space-y-1 text-sm text-text-primary">
              {task.acceptanceCriteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {task.dependencies.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Blocked By
            </h4>
            <ul className="space-y-1.5">
              {task.dependencies.map((d) => {
                const depTask = allTasks.find((t) => t.id === d.taskId);
                return (
                  <li
                    key={d.taskId}
                    className="flex items-center gap-2 rounded border border-accent-red-dim bg-accent-red-dim/30 px-3 py-2 text-sm"
                  >
                    <span className="h-2 w-2 rounded-full bg-accent-red" aria-hidden="true" />
                    <span className="text-accent-red">{depTask?.title ?? d.taskId}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Metadata</h4>
          <div className="space-y-1 text-sm text-text-secondary">
            <p>
              Task ID: <code className="text-xs">{task.id.slice(0, 8)}...</code>
            </p>
            <p>Order: {task.order}</p>
            <p>Phase: {task.phaseType}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle p-4">
        <button
          onClick={() => onShowPrompt(task.id)}
          className="w-full rounded bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent-purple focus:ring-offset-1 focus:ring-offset-bg-elevated"
        >
          View Prompt
        </button>
      </div>
    </div>
  );
}
