"use client";

import { useState, useEffect } from "react";
import { useProgress } from "@/lib/use-progress";
import { cn } from "@/lib/utils";

interface GenerationProgressProps {
  workflowId: string | null;
  onCancel?: () => void;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function IndeterminateBar() {
  return (
    <div
      style={{
        height: 4,
        borderRadius: 2,
        background: "var(--color-border-subtle)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        className="progress-indeterminate"
        style={{
          height: "100%",
          width: "40%",
          borderRadius: 2,
          background: "var(--color-accent-purple)",
          position: "absolute",
          left: 0,
          top: 0,
        }}
      />
    </div>
  );
}

function FilledBar({ value }: { value: number }) {
  return (
    <div style={{ height: 4, borderRadius: 2, background: "var(--color-border-subtle)", overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${Math.min(100, Math.max(0, value))}%`,
          borderRadius: 2,
          background: "var(--color-accent-purple)",
          transition: "width 0.5s ease-in-out",
        }}
      />
    </div>
  );
}

export function GenerationProgress({ workflowId, onCancel }: GenerationProgressProps) {
  const { stages, status, detail, elapsed, subtask, progressValue, cancel } = useProgress(workflowId);
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

  const canCancel =
    status === "running" || status === "starting" || status === "retrying" || status === "warning";

  const handleCancel = async () => {
    await cancel();
    onCancel?.();
  };

  // Only show stages that have been reached (not pending)
  const visibleStages = stages.filter((s) => s.status !== "pending");
  const hasDetail = detail || subtask !== undefined || progressValue !== undefined;

  return (
    <div
      style={{ borderRadius: 3, padding: "18px 20px" }}
      className="space-y-2 border border-border-subtle bg-bg-elevated"
    >
      {/* Animated stages — only show reached stages */}
      {visibleStages.length > 0 && (
        <div className="space-y-1">
          {visibleStages.map((s, i) => {
            const isActive = s.status === "active";
            const isDone = s.status === "done";
            const isFailed = s.status === "failed";

            return (
              <div
                key={s.stage}
                className="stage-reveal"
                style={{ animationDelay: `${Math.min(i * 0.15, 1)}s` }}
              >
                <div
                  style={{
                    borderRadius: 2,
                    padding: "8px 10px",
                    fontSize: 14,
                  }}
                  className={cn(
                    "flex items-center gap-3 transition-colors",
                    isActive && "bg-accent-purple-dim text-accent-purple",
                    isDone && "text-text-muted",
                    isFailed && "bg-accent-red-dim/30 text-accent-red",
                  )}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "inline-block",
                      background: isActive
                        ? "var(--color-accent-purple)"
                        : isDone
                          ? "var(--color-accent-green)"
                          : isFailed
                            ? "var(--color-accent-red)"
                            : "var(--color-text-muted)",
                      boxShadow: isActive ? "0 0 0 4px var(--color-accent-purple-dim)" : "none",
                    }}
                  />
                  <span style={{ fontWeight: isActive ? 500 : 400 }} className="flex-1">
                    {s.label}
                  </span>
                  {s.attempt > 1 && (
                    <span
                      style={{ borderRadius: 2, padding: "1px 5px", fontSize: 12 }}
                      className="bg-accent-amber-dim text-accent-amber"
                    >
                      attempt {s.attempt}
                    </span>
                  )}
                  {isDone && (
                    <span className="text-accent-green text-xs" style={{ fontWeight: 600 }}>
                      ✓
                    </span>
                  )}
                  {isFailed && <span className="text-accent-red text-xs">✗</span>}
                </div>

                {/* Activity detail nested under the active stage */}
                {isActive && hasDetail && (
                  <div style={{ padding: "6px 0 6px 26px" }}>
                    {detail && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{detail}</span>
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
              </div>
            );
          })}
        </div>
      )}

      {canCancel && onCancel && (
        <div className="flex justify-end" style={{ paddingTop: 4 }}>
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
        <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          Generation was cancelled. You can try again when ready.
        </p>
      )}
      {status === "failed" && (
        <p style={{ fontSize: 14, color: "var(--color-accent-red)" }}>
          Generation failed. You can try again when ready.
        </p>
      )}

      <style>{`
        @keyframes progress-indeterminate {
          0% { left: -40%; }
          100% { left: 100%; }
        }
        .progress-indeterminate {
          animation: progress-indeterminate 2s ease-in-out infinite;
        }
        @keyframes stage-slide-in {
          0% { opacity: 0; transform: translateX(-10px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .stage-reveal {
          animation: stage-slide-in 0.4s ease-out both;
        }
      `}</style>
    </div>
  );
}
