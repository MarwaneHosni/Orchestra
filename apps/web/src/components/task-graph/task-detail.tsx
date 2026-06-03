"use client";

import { StatusBadge } from "@/components/ui/badge";
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
  const depNames = task.dependencies.map((d) => allTasks.find((t) => t.id === d.taskId)).filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--color-border-subtle)", padding: "14px 16px", flexShrink: 0 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>Task Details</h2>
        <button
          onClick={onClose}
          aria-label="Close task details"
          style={{ borderRadius: 3, padding: "4px 8px", fontSize: 14, color: "var(--color-text-secondary)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          className="hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple"
        >
          ✗
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>
          {task.title}
        </h3>

        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
          <span style={{ color: "var(--color-text-secondary)" }}>{task.phaseType}</span>
          <span style={{ color: "var(--color-text-muted)" }}>·</span>
          <span style={{ color: "var(--color-text-secondary)" }}>{task.type}</span>
          <span style={{ color: "var(--color-text-muted)" }}>·</span>
          <span style={{ color: "var(--color-text-secondary)" }}>Priority: {task.priority}</span>
          <StatusBadge status={task.status} label={STATUS_LABELS[task.status] ?? task.status} />
        </div>

        {"failureReason" in task && task.failureReason && (
          <div
            style={{ marginTop: 14, borderRadius: 3, border: "1px solid var(--color-accent-amber-dim)", borderLeft: "3px solid var(--color-accent-amber)", background: "var(--color-accent-amber-dim)", padding: "10px 14px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}
            role="alert"
          >
            <p style={{ color: "var(--color-accent-amber)", fontWeight: 500 }}>▲ Needs Review</p>
            <p style={{ marginTop: 4, fontSize: 12, color: "var(--color-text-secondary)" }}>{task.failureReason}</p>
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, borderRadius: 3, border: "1px solid var(--color-border-default)", padding: "12px 14px" }}>
          <input
            type="checkbox"
            id="task-done"
            checked={task.status === "complete"}
            onChange={() => onStatusChange(task.id, task.status === "complete" ? "pending" : "complete")}
            style={{ width: 16, height: 16, accentColor: "var(--color-accent-purple)", cursor: "pointer" }}
          />
          <label htmlFor="task-done" style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", fontFamily: "'JetBrains Mono', monospace", cursor: "pointer" }}>
            {task.status === "complete" ? "Completed" : "Mark as complete"}
          </label>
        </div>

        <div style={{ marginTop: 20 }}>
          <h4 style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary)", fontFamily: "'JetBrains Mono', monospace" }}>
            Dependencies
          </h4>
          {depNames.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", fontFamily: "'JetBrains Mono', monospace" }}>No dependencies — first task in chain.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {depNames.map((t) => (
                <div key={t!.id} style={{ borderRadius: 3, border: "1px solid var(--color-border-subtle)", background: "var(--color-bg-surface)", padding: "10px 12px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: "var(--color-text-primary)" }}>
                  {t!.title}
                </div>
              ))}
            </div>
          )}
        </div>

        {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h4 style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary)", fontFamily: "'JetBrains Mono', monospace" }}>
              Acceptance Criteria
            </h4>
            <ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--color-text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>
              {task.acceptanceCriteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {task.dependencies.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h4 style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary)", fontFamily: "'JetBrains Mono', monospace" }}>
              Blocked By
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {task.dependencies.map((d) => {
                const depTask = allTasks.find((t) => t.id === d.taskId);
                return (
                  <div
                    key={d.taskId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      borderRadius: 3,
                      border: "1px solid var(--color-accent-red-dim)",
                      background: "var(--color-accent-red-dim)",
                      padding: "10px 12px",
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent-red)", flexShrink: 0 }} />
                    <span style={{ color: "var(--color-accent-red)" }}>{depTask?.title ?? d.taskId}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <h4 style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary)", fontFamily: "'JetBrains Mono', monospace" }}>
            Metadata
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--color-text-secondary)", fontFamily: "'JetBrains Mono', monospace" }}>
            <p>Task ID: <code style={{ fontSize: 12, fontFamily: "inherit" }}>{task.id.slice(0, 8)}...</code></p>
            <p>Order: {task.order}</p>
            <p>Phase: {task.phaseType}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--color-border-subtle)", padding: "12px 16px", flexShrink: 0 }}>
        <button
          onClick={() => onShowPrompt(task.id)}
          style={{ width: "100%", borderRadius: 3, padding: "10px 18px", fontSize: 13, fontFamily: "inherit", border: "1px solid var(--color-accent-purple)", background: "var(--color-accent-purple)", color: "#fff", fontWeight: 500, cursor: "pointer" }}
          className="hover:opacity-88 active:scale-[0.98] transition-[opacity,transform] duration-150 focus:outline-none focus:ring-2 focus:ring-accent-purple focus:ring-offset-1 focus:ring-offset-bg-elevated"
        >
          View Prompt
        </button>
      </div>
    </div>
  );
}
