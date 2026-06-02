"use client";

import { useProgress, type GenerationStatus } from "@/lib/use-progress";
import { cn } from "@/lib/utils";

interface GenerationProgressProps {
  workflowId: string | null;
  onCancel?: () => void;
}

const STATUS_DOT: Record<GenerationStatus, string> = {
  starting: "var(--color-text-muted)",
  running: "var(--color-accent-purple)",
  retrying: "var(--color-accent-amber)",
  warning: "var(--color-accent-amber)",
  failed: "var(--color-accent-red)",
  cancelled: "var(--color-text-muted)",
  completed: "var(--color-accent-green)",
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
    <span className="flex items-center gap-2" style={{ fontSize: 14 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_DOT[status], display: "inline-block", flexShrink: 0 }} />
      <span style={{
        color: status === "failed" ? "var(--color-accent-red)" :
               status === "completed" ? "var(--color-accent-green)" :
               status === "retrying" || status === "warning" ? "var(--color-accent-amber)" :
               "var(--color-text-secondary)"
      }}>
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
    <div style={{ borderRadius: 3, padding: "14px 16px" }} className="space-y-4 border border-border-subtle bg-bg-elevated">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIndicator status={status} />
          {status === "running" && (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {Math.round(progressFraction * 100)}%
            </span>
          )}
        </div>
      </div>

      <p style={{ fontSize: 14 }} className="text-text-secondary">{statusMessage}</p>

      {canCancel && onCancel && (
        <div className="flex justify-end">
          <button
            onClick={handleCancel}
            style={{ borderRadius: 3, padding: "6px 12px", fontSize: 12 }}
            className="border border-accent-red text-accent-red bg-transparent hover:bg-accent-red-dim font-medium transition-[color,background-color,border-color,opacity] duration-150"
          >
            Cancel
          </button>
        </div>
      )}

      {status === "cancelled" && (
        <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>Generation was cancelled. You can try again when ready.</p>
      )}
      {status === "failed" && (
        <p style={{ fontSize: 14, color: "var(--color-accent-red)" }}>Generation failed. You can try again when ready.</p>
      )}

      <div className="space-y-1">
        {stages.map((s) => {
          const isActive = s.status === "active";
          const isDone = s.status === "done";
          const isFailed = s.status === "failed";
          const isPending = s.status === "pending";

          return (
            <div
              key={s.stage}
              style={{
                borderRadius: 2,
                padding: "4px 10px",
                fontSize: 14,
              }}
              className={cn(
                "flex items-center gap-3 transition-colors",
                isActive && "bg-accent-purple-dim text-accent-purple",
                isDone && "text-text-muted",
                isFailed && "bg-accent-red-dim/30 text-accent-red",
                isPending && "text-text-muted",
              )}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "inline-block",
                  background: isActive ? "var(--color-accent-purple)" :
                              isDone ? "var(--color-accent-green)" :
                              isFailed ? "var(--color-accent-red)" :
                              "var(--color-text-muted)",
                }}
              />
              <span className="flex-1">{s.label}</span>
              {s.attempt > 1 && (
                <span
                  style={{ borderRadius: 2, padding: "1px 5px", fontSize: 12 }}
                  className="bg-accent-amber-dim text-accent-amber"
                >
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
