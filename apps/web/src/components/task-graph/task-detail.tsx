"use client";

import type { TaskData } from "./task-node";

interface TaskDetailProps {
  task: TaskData;
  allTasks: TaskData[];
  onClose: () => void;
  onShowPrompt: (taskId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  ready: "Ready",
  blocked: "Blocked",
  needs_review: "Needs Review",
  pending: "Pending",
  in_progress: "In Progress",
  complete: "Complete",
};

export function TaskDetail({ task, allTasks, onClose, onShowPrompt }: TaskDetailProps) {
  const depNames = task.dependencies.map((d) => allTasks.find((t) => t.id === d.taskId)).filter(Boolean);

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-surface shadow-xl sm:w-96">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Task Details</h2>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-base font-semibold text-text-primary">{task.title}</h3>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium">{task.phaseType}</span>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium">{task.type}</span>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium">
            Priority: {task.priority}
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium">
            {STATUS_LABELS[task.status] ?? task.status}
          </span>
        </div>

        {"failureReason" in task && task.failureReason && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-medium">Needs Review</p>
            <p className="mt-1 text-xs">{task.failureReason}</p>
          </div>
        )}

        <div className="mt-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Dependencies
          </h4>
          {depNames.length === 0 ? (
            <p className="text-sm text-text-secondary">No dependencies — first task in chain.</p>
          ) : (
            <div className="space-y-1.5">
              {depNames.map((t) => (
                <div key={t!.id} className="rounded-lg border border-border bg-gray-50 px-3 py-2 text-sm">
                  {t!.title}
                </div>
              ))}
            </div>
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
            <div className="space-y-1.5">
              {task.dependencies.map((d) => {
                const depTask = allTasks.find((t) => t.id === d.taskId);
                return (
                  <div
                    key={d.taskId}
                    className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm"
                  >
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-red-700">{depTask?.title ?? d.taskId}</span>
                  </div>
                );
              })}
            </div>
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

      <div className="border-t border-border p-4">
        <button
          onClick={() => onShowPrompt(task.id)}
          className="w-full rounded-lg bg-orchestra-600 px-4 py-2 text-sm font-medium text-white hover:bg-orchestra-700"
        >
          View Prompt
        </button>
      </div>
    </div>
  );
}
