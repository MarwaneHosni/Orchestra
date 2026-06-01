"use client";

import { useProgress, type GenerationStatus } from "@/lib/use-progress";
import { cn } from "@/lib/utils";

interface GenerationProgressProps {
  workflowId: string | null;
  onCancel?: () => void;
}

const STATUS_CONFIG: Record<GenerationStatus, { bg: string; text: string; label: string }> = {
  starting: { bg: "bg-gray-100", text: "text-gray-500", label: "Starting" },
  running: { bg: "bg-blue-50", text: "text-blue-700", label: "In progress" },
  retrying: { bg: "bg-amber-50", text: "text-amber-700", label: "Retrying" },
  warning: { bg: "bg-amber-50", text: "text-amber-700", label: "Warning" },
  failed: { bg: "bg-red-50", text: "text-red-700", label: "Failed" },
  cancelled: { bg: "bg-gray-100", text: "text-gray-500", label: "Cancelled" },
  completed: { bg: "bg-green-50", text: "text-green-700", label: "Complete" },
};

function StatusIndicator({ status }: { status: GenerationStatus }) {
  const cfg = STATUS_CONFIG[status];
  const colors: Record<GenerationStatus, string> = {
    starting: "bg-gray-400",
    running: "bg-blue-500",
    retrying: "bg-amber-500",
    warning: "bg-amber-400",
    failed: "bg-red-500",
    cancelled: "bg-gray-400",
    completed: "bg-green-500",
  };

  return (
    <span className="flex items-center gap-2 text-sm">
      <span className={cn("h-2 w-2 rounded-full", colors[status])} />
      <span className={cfg.text}>{cfg.label}</span>
    </span>
  );
}

export function GenerationProgress({ workflowId, onCancel }: GenerationProgressProps) {
  const { stages, status, progressFraction, statusMessage, cancel } = useProgress(workflowId);

  if (!workflowId) return null;

  const cfg = STATUS_CONFIG[status];
  const canCancel = status === "running" || status === "starting" || status === "retrying" || status === "warning";

  const handleCancel = async () => {
    await cancel();
    onCancel?.();
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIndicator status={status} />
          {status === "running" && (
            <span className="text-xs text-gray-400">
              {Math.round(progressFraction * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Status message */}
      <p className="text-sm text-text-secondary">{statusMessage}</p>

      {/* Cancel button */}
      {canCancel && onCancel && (
        <div className="flex justify-end">
          <button
            onClick={handleCancel}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Terminal state messages */}
      {status === "cancelled" && (
        <p className="text-sm text-gray-500">Generation was cancelled. You can try again when ready.</p>
      )}
      {status === "failed" && (
        <p className="text-sm text-red-600">Generation failed. You can try again when ready.</p>
      )}

      {/* Progress bar (real, not fake — driven by stage completions) */}
      {status !== "completed" && status !== "failed" && status !== "cancelled" && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out",
              status === "retrying" ? "bg-amber-500" : "bg-orchestra-500",
            )}
            style={{ width: `${Math.max(2, Math.round(progressFraction * 100))}%` }}
          />
        </div>
      )}

      {/* Stage list */}
      <div className="space-y-1.5">
        {stages.map((s) => {
          const isActive = s.status === "active";
          const isDone = s.status === "done";
          const isFailed = s.status === "failed";
          const isPending = s.status === "pending";

          return (
            <div
              key={s.stage}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive && "bg-orchestra-50 text-orchestra-700",
                isDone && "text-gray-500",
                isFailed && "bg-red-50 text-red-700",
                isPending && "text-gray-400",
              )}
            >
              {/* Stage dot */}
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  isActive && "bg-orchestra-500",
                  isDone && "bg-green-400",
                  isFailed && "bg-red-500",
                  isPending && "bg-gray-300",
                )}
              />

              {/* Stage label */}
              <span className="flex-1">{s.label}</span>

              {/* Attempt badge */}
              {s.attempt > 1 && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                  attempt {s.attempt}
                </span>
              )}

              {/* Status icon */}
              {isDone && <span className="text-green-500">&#10003;</span>}
              {isFailed && <span className="text-red-500">&#10007;</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
