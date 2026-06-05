"use client";

import { useState, useEffect } from "react";
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

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function StatusIndicator({ status }: { status: GenerationStatus }) {
  return (
    <span className="flex items-center gap-3" style={{ fontSize: 14 }}>
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

function IndeterminateBar() {
  return (
    <div style={{ height: 4, borderRadius: 2, background: "var(--color-border-subtle)", overflow: "hidden", position: "relative" }}>
      <div className="progress-indeterminate" style={{
        height: "100%",
        width: "40%",
        borderRadius: 2,
        background: "var(--color-accent-purple)",
        position: "absolute",
        left: 0,
        top: 0,
      }} />
    </div>
  );
}

function FilledBar({ value }: { value: number }) {
  return (
    <div style={{ height: 4, borderRadius: 2, background: "var(--color-border-subtle)", overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${Math.min(100, Math.max(0, value))}%`,
        borderRadius: 2,
        background: "var(--color-accent-purple)",
        transition: "width 0.5s ease-in-out",
      }} />
    </div>
  );
}

export function GenerationProgress({ workflowId, onCancel }: GenerationProgressProps) {
  const { stages, status, progressFraction, statusMessage, detail, elapsed, subtask, progressValue, cancel } = useProgress(workflowId);
  const [displayElapsed, setDisplayElapsed] = useState(0);

  // Smoothly increment elapsed locally every second
  useEffect(() => {
    if (!detail && !progressValue) return;
    setDisplayElapsed(elapsed);
    const interval = setInterval(() => {
      setDisplayElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [detail, progressValue, elapsed]);

  if (!workflowId) return null;

  const canCancel = status === "running" || status === "starting" || status === "retrying" || status === "warning";

  const handleCancel = async () => {
    await cancel();
    onCancel?.();
  };

  const showActivity = detail || subtask !== undefined || progressValue !== undefined;

  return (
    <div style={{ borderRadius: 3, padding: "18px 20px" }} className="space-y-4 border border-border-subtle bg-bg-elevated">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusIndicator status={status} />
          {status === "running" && (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {Math.round(progressFraction * 100)}%
            </span>
          )}
        </div>
      </div>

      <p style={{ fontSize: 14 }} className="text-text-secondary">{statusMessage}</p>

      {/* Live activity card */}
      {showActivity && (status === "running" || status === "starting") && (
        <div style={{ padding: "12px 0", borderTop: "1px solid var(--color-border-subtle)" }}>
          {detail && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--color-text-primary)", fontWeight: 500 }}>
                {detail}
              </span>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                {formatElapsed(displayElapsed)} elapsed
              </span>
            </div>
          )}

          {progressValue !== undefined ? (
            <FilledBar value={progressValue} />
          ) : detail ? (
            <IndeterminateBar />
          ) : null}

          {subtask && (
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>
              {subtask}
              {progressValue !== undefined && (
                <span style={{ color: "var(--color-text-muted)", marginLeft: 8 }}>
                  {progressValue}%
                </span>
              )}
            </div>
          )}
        </div>
      )}

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

      <style>{`
        @keyframes progress-indeterminate {
          0% { left: -40%; }
          100% { left: 100%; }
        }
        .progress-indeterminate {
          animation: progress-indeterminate 2s ease-in-out infinite;
        }
      `}</style>

      <div className="space-y-1.5">
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
