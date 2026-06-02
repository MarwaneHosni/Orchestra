"use client";

import { useProgress, type GenerationStatus } from "@/lib/use-progress";
import { cn } from "@/lib/utils";

interface GenerationProgressProps {
  workflowId: string | null;
  onCancel?: () => void;
}

const STATUS_DOT: Record<GenerationStatus, string> = {
  starting: "bg-text-muted",
  running: "bg-accent-purple",
  retrying: "bg-accent-amber",
  warning: "bg-accent-amber",
  failed: "bg-accent-red",
  cancelled: "bg-text-muted",
  completed: "bg-accent-green",
};

const STATUS_LABELS: Record<GenerationStatus, string> = {
  starting: "Starting",
  running: "In progress",
  retrying: "Retrying",
  warning: "Warning",
  failed: "Failed",
  cancelled: "Cancelled",
  completed: "Complete",
};

function StatusIndicator({ status }: { status: GenerationStatus }) {
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} />
      <span className={cn(
        status === "failed" && "text-accent-red",
        status === "completed" && "text-accent-green",
        status === "retrying" || status === "warning" ? "text-accent-amber" : "text-text-secondary",
      )}>
        {STATUS_LABELS[status]}
      </span>
    </span>
  );
}

export function GenerationProgress({ workflowId, onCancel }: GenerationProgressProps) {
  const { stages, status, progressFraction, statusMessage, cancel } = useProgress(workflowId);

  if (!workflowId) return null;

  const canCancel = status === "running" || status === "starting" || status === "retrying" || status === "warning";

  const handleCancel = async () => {
    await cancel();
    onCancel?.();
  };

  return (
    <div className="space-y-4 rounded border border-border-default bg-bg-elevated p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIndicator status={status} />
          {status === "running" && (
            <span className="text-xs text-text-muted">{Math.round(progressFraction * 100)}%</span>
          )}
        </div>
      </div>

      <p className="text-sm text-text-secondary">{statusMessage}</p>

      {canCancel && onCancel && (
        <div className="flex justify-end">
          <button
            onClick={handleCancel}
            className="rounded border border-accent-red-dim bg-bg-surface px-3 py-1.5 text-xs font-medium text-accent-red hover:bg-accent-red-dim/30"
          >
            Cancel
          </button>
        </div>
      )}

      {status === "cancelled" && (
        <p className="text-sm text-text-muted">Generation was cancelled. You can try again when ready.</p>
      )}
      {status === "failed" && (
        <p className="text-sm text-accent-red">Generation failed. You can try again when ready.</p>
      )}

      {status !== "completed" && status !== "failed" && status !== "cancelled" && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out",
              status === "retrying" ? "bg-accent-amber" : "bg-accent-purple",
            )}
            style={{ width: `${Math.max(2, Math.round(progressFraction * 100))}%` }}
          />
        </div>
      )}

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
                "flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors",
                isActive && "bg-accent-purple-dim text-accent-purple",
                isDone && "text-text-muted",
                isFailed && "bg-accent-red-dim/30 text-accent-red",
                isPending && "text-text-muted",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  isActive && "bg-accent-purple",
                  isDone && "bg-accent-green",
                  isFailed && "bg-accent-red",
                  isPending && "bg-text-muted",
                )}
              />
              <span className="flex-1">{s.label}</span>
              {s.attempt > 1 && (
                <span className="rounded bg-accent-amber-dim px-1.5 py-0.5 text-xs text-accent-amber">
                  attempt {s.attempt}
                </span>
              )}
              {isDone && <span className="text-accent-green text-xs">✓</span>}
              {isFailed && <span className="text-accent-red text-xs">✗</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
