"use client";

const STATUS_GLYPH: Record<string, { glyph: string; color: string; halo: string }> = {
  ready:       { glyph: "●", color: "var(--color-accent-green)",  halo: "0 0 0 3px var(--color-accent-green-dim)" },
  blocked:     { glyph: "●", color: "var(--color-accent-red)",    halo: "0 0 0 3px var(--color-accent-red-dim)" },
  needs_review:{ glyph: "◐", color: "var(--color-accent-amber)",  halo: "0 0 0 3px var(--color-accent-amber-dim)" },
  pending:     { glyph: "○", color: "var(--color-text-muted)",    halo: "none" },
  in_progress: { glyph: "●", color: "var(--color-accent-purple)", halo: "0 0 0 3px var(--color-accent-purple-dim)" },
  complete:    { glyph: "✓", color: "var(--color-accent-green)",  halo: "0 0 0 3px var(--color-accent-green-dim)" },
};

const STATUS_LABELS: Record<string, string> = {
  ready: "Ready",
  blocked: "Blocked",
  needs_review: "Needs Review",
  pending: "Pending",
  in_progress: "In Progress",
  complete: "Complete",
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
  isSelected: boolean;
  onSelect: (task: TaskData) => void;
  hasDependencies: boolean;
  indent: boolean;
}

export function TaskNodeView({ task, isSelected, onSelect, indent }: TaskNodeProps) {
  const g = STATUS_GLYPH[task.status] ?? STATUS_GLYPH.pending;

  return (
    <button
      onClick={() => onSelect(task)}
      aria-pressed={isSelected}
      style={{
        display: "block",
        textAlign: "left",
        borderRadius: 3,
        borderTop: "1px solid var(--color-border-subtle)",
        borderRight: "1px solid var(--color-border-subtle)",
        borderBottom: "1px solid var(--color-border-subtle)",
        borderLeft: isSelected
          ? "3px solid var(--color-accent-purple)"
          : task.dependencies.length > 0
            ? "2px solid var(--color-border-default)"
            : "1px solid var(--color-border-subtle)",
        background: isSelected ? "var(--color-accent-purple-dim)" : "var(--color-bg-surface)",
        padding: "12px 14px",
        marginTop: 4,
        marginBottom: 4,
        marginRight: 0,
        cursor: "pointer",
        fontFamily: "'JetBrains Mono', monospace",
        marginLeft: indent ? 20 : 0,
        width: indent ? "calc(100% - 20px)" : "100%",
        transition: "border-color 150ms, background 150ms",
      }}
      className="hover:border-border-strong hover:bg-bg-elevated focus:outline-none focus:shadow-[0_0_0_2px_var(--color-accent-purple-dim)]"
      aria-label={`${task.title} — ${STATUS_LABELS[task.status] ?? task.status} — ${task.dependencies.length} dep${task.dependencies.length !== 1 ? "s" : ""}`}
    >
      {/* Line 1: Glyph + Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span
          style={{
            width: 16,
            height: 16,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            lineHeight: 1,
            color: g.color,
            boxShadow: g.halo,
            borderRadius: g.glyph === "◐" ? 0 : "50%",
          }}
        >
          {g.glyph}
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-text-primary)",
          }}
        >
          {task.title}
        </span>
      </div>

      {/* Line 2: Metadata chips + status */}
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, minWidth: 0, fontSize: 11, color: "var(--color-text-muted)" }}>
        <TypePill type={task.type} />
        <span>·</span>
        <span>{task.dependencies.length > 0 ? `+${task.dependencies.length} dep${task.dependencies.length !== 1 ? "s" : ""}` : "no deps"}</span>
        <span>·</span>
        <span>priority: {task.priority}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: g.color, whiteSpace: "nowrap" }}>
          [{STATUS_LABELS[task.status] ?? task.status}]
        </span>
      </div>
    </button>
  );
}

function TypePill({ type }: { type: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        border: "1px solid var(--color-border-default)",
        borderRadius: 2,
        padding: "0 5px",
        fontSize: 10,
        color: "var(--color-text-secondary)",
      }}
    >
      {type}
    </span>
  );
}
