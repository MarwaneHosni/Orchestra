"use client";

import { TerminalTitle } from "@/components/ui/terminal-title";
import type { TaskData } from "./task-node";

const STATUS_COLORS: Record<string, string> = {
  ready: "var(--color-accent-green)",
  blocked: "var(--color-accent-red)",
  needs_review: "var(--color-accent-amber)",
  pending: "var(--color-text-muted)",
  in_progress: "var(--color-accent-purple)",
  complete: "var(--color-accent-green)",
};
const STATUS_LABELS: Record<string, string> = {
  ready: "Ready", blocked: "Blocked", needs_review: "Needs Review",
  pending: "Pending", in_progress: "In Progress", complete: "Complete",
};

interface TaskDetailProps {
  task: TaskData;
  allTasks: TaskData[];
  onClose: () => void;
  onShowPrompt: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onSelectTask?: (task: TaskData) => void;
}

const S = {
  ff: "'JetBrains Mono', monospace",
};

export function TaskDetail({ task, allTasks, onClose, onShowPrompt, onStatusChange, onSelectTask }: TaskDetailProps) {
  const depNames = task.dependencies.map((d) => allTasks.find((t) => t.id === d.taskId)).filter(Boolean);
  const st = STATUS_COLORS[task.status] ?? "var(--color-text-muted)";
  const stLabel = STATUS_LABELS[task.status] ?? task.status;
  const checked = task.status === "complete";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: S.ff }}>

      {/* Panel header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--color-border-default)", padding: "16px 20px", flexShrink: 0 }}>
        <TerminalTitle as="span" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Task Details</TerminalTitle>
        <button onClick={onClose} aria-label="Close task details"
          style={{ border: "1px solid var(--color-border-default)", borderRadius: 2, padding: "2px 7px", fontSize: 13, fontFamily: "inherit", color: "var(--color-text-secondary)", background: "transparent", cursor: "pointer" }}
          className="hover:text-text-primary hover:border-border-strong"
        >
          ✗
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* Task title block */}
        <div style={{ padding: "16px 20px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: "var(--color-text-primary)", wordBreak: "break-word" }}>
            {task.title}
          </h3>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4, fontSize: 11, color: "var(--color-text-muted)" }}>
            <span style={{ color: "var(--color-text-secondary)" }}>{task.phaseType}</span>
            <span>·</span>
            <span style={{ color: "var(--color-text-secondary)" }}>{task.type}</span>
            <span>·</span>
            <span style={{ color: "var(--color-text-secondary)" }}>Priority: {task.priority}</span>
            <span>·</span>
            <span style={{ color: st }}>[{stLabel}]</span>
          </div>
        </div>

        {/* Failure reason */}
        {"failureReason" in task && task.failureReason && (
          <div style={{ margin: "0 20px 16px", borderRadius: 3, border: "1px solid var(--color-accent-amber-dim)", borderLeft: "3px solid var(--color-accent-amber)", background: "var(--color-accent-amber-dim)", padding: "10px 14px", fontSize: 13 }}>
            <p style={{ color: "var(--color-accent-amber)", fontWeight: 500 }}>▲ Needs Review</p>
            <p style={{ marginTop: 4, fontSize: 12, color: "var(--color-text-secondary)" }}>{task.failureReason}</p>
          </div>
        )}

        {/* Mark as complete */}
        <div style={{ margin: "0 20px 8px", display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 16, height: 16, borderRadius: 2,
              border: `1px solid ${checked ? "var(--color-accent-green)" : "var(--color-border-strong)"}`,
              background: checked ? "var(--color-accent-green)" : "transparent",
              color: checked ? "var(--color-text-inverse)" : "transparent",
              fontSize: 10, lineHeight: 1, flexShrink: 0, transition: "all 150ms",
            }}>
              {checked ? "✓" : ""}
            </span>
            <input type="checkbox" checked={checked} onChange={() => onStatusChange(task.id, checked ? "pending" : "complete")}
              style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />
            <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>
              {checked ? "✓ completed" : "□ mark as complete"}
            </span>
          </label>
        </div>

        {/* Dependencies section */}
        <SectionBlock title="DEPENDENCIES">
          {depNames.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", fontStyle: "italic", padding: "0 20px" }}>
              no dependencies — first task in chain.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 20px" }}>
              {depNames.map((t) => (
                <button key={t!.id} onClick={() => onSelectTask?.(t!)}
                  style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 3, border: "1px solid var(--color-border-subtle)", background: "var(--color-bg-surface)", padding: "8px 12px", fontSize: 13, fontFamily: "inherit", color: "var(--color-text-primary)", cursor: "pointer", textAlign: "left", width: "100%" }}
                  className="hover:bg-bg-hover hover:border-border-default"
                >
                  <span style={{ color: "var(--color-accent-purple)", flexShrink: 0 }}>→</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                    {t!.id.slice(0, 8)}...
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)", flexShrink: 0 }}>{t!.phaseType}</span>
                  <span style={{ fontSize: 11, color: STATUS_COLORS[t!.status] ?? "var(--color-text-muted)", flexShrink: 0 }}>
                    [{STATUS_LABELS[t!.status] ?? t!.status}]
                  </span>
                </button>
              ))}
            </div>
          )}
        </SectionBlock>

        {/* Acceptance Criteria */}
        {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
          <SectionBlock title="ACCEPTANCE CRITERIA">
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 20px", fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.6 }}>
              {task.acceptanceCriteria.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>{i + 1}.</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </SectionBlock>
        )}

        {/* Blocked By */}
        {task.dependencies.length > 0 && (
          <SectionBlock title="BLOCKED BY">
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 20px" }}>
              {task.dependencies.map((d) => {
                const depTask = allTasks.find((t) => t.id === d.taskId);
                return (
                  <button key={d.taskId} onClick={() => { const t = allTasks.find(x => x.id === d.taskId); if (t) onSelectTask?.(t); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 3, border: "1px solid var(--color-accent-red-dim)", background: "var(--color-accent-red-dim)", padding: "8px 12px", fontSize: 13, fontFamily: "inherit", color: "var(--color-accent-red)", cursor: "pointer", textAlign: "left", width: "100%" }}
                    className="hover:bg-accent-red-dim/50"
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent-red)", flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {depTask?.title ?? d.taskId}
                    </span>
                  </button>
                );
              })}
            </div>
          </SectionBlock>
        )}

        {/* Metadata */}
        <SectionBlock title="METADATA">
          <div style={{ padding: "0 20px", fontSize: 12 }}>
            <MetaRow label="Task ID" value={`${task.id.slice(0, 8)}...`} />
            <MetaRow label="Order" value={String(task.order)} />
            <MetaRow label="Phase" value={task.phaseType} />
            <MetaRow label="Type" value={task.type} isLast />
          </div>
        </SectionBlock>

        {/* Bottom spacer so footer doesn't cover content */}
        <div style={{ height: 1 }} />
      </div>

      {/* Footer */}
      <div style={{ position: "sticky", bottom: 0, padding: "14px 20px", borderTop: "1px solid var(--color-border-default)", background: "var(--color-bg-surface)", flexShrink: 0 }}>
        <button onClick={() => onShowPrompt(task.id)}
          style={{ width: "100%", borderRadius: 3, padding: "10px", fontSize: 13, fontFamily: "inherit", fontWeight: 500, border: "none", background: "var(--color-accent-purple)", color: "#fff", cursor: "pointer" }}
          className="hover:opacity-88 active:scale-[0.98] transition-[opacity,transform] duration-150"
        >
          → view execution prompt
        </button>
      </div>
    </div>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px 8px" }}>
        <span style={{ fontSize: 10, letterSpacing: "0.10em", color: "var(--color-text-muted)", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0 }}>{title}</span>
        <span style={{ flex: 1, borderTop: "1px solid var(--color-border-subtle)", alignSelf: "center" }} />
      </div>
      {children}
    </div>
  );
}

function MetaRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <div style={{ display: "flex", padding: "6px 0", borderBottom: isLast ? "none" : "1px solid var(--color-border-subtle)" }}>
      <span style={{ width: 120, flexShrink: 0, color: "var(--color-text-muted)" }}>{label}</span>
      <span style={{ color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{value}</span>
    </div>
  );
}
