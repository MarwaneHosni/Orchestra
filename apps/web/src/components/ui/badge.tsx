export function StatusBadge({
  status,
  label,
}: {
  status: "sufficient" | "insufficient" | "missing" | "ready" | "blocked" | "needs_review" | "pending" | "complete" | string;
  label?: string;
}) {
  const colors: Record<string, string> = {
    sufficient: "var(--color-accent-green)",
    ready: "var(--color-accent-green)",
    complete: "var(--color-accent-green)",
    insufficient: "var(--color-accent-amber)",
    needs_review: "var(--color-accent-amber)",
    blocked: "var(--color-accent-red)",
    failed: "var(--color-accent-red)",
    error: "var(--color-accent-red)",
    missing: "var(--color-text-muted)",
    pending: "var(--color-text-muted)",
    draft: "var(--color-text-muted)",
  };

  const defaultLabels: Record<string, string> = {
    sufficient: "ready",
    ready: "ready",
    complete: "done",
    insufficient: "insufficient",
    needs_review: "needs review",
    blocked: "blocked",
    failed: "failed",
    missing: "missing",
    pending: "pending",
    draft: "draft",
  };

  const color = colors[status] ?? "var(--color-text-muted)";
  const text = label ?? defaultLabels[status] ?? status;

  return (
    <span
      style={{ color, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
      aria-label={text}
    >
      [{text}]
    </span>
  );
}

export function SectionDivider({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 py-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
      <span
        style={{
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          whiteSpace: "nowrap",
        }}
      >
        ── {title}{count !== undefined ? ` (${count})` : ""}
      </span>
      <span
        style={{
          flex: 1,
          borderTop: "1px solid var(--color-border-subtle)",
          display: "inline-block",
          alignSelf: "center",
        }}
      />
    </div>
  );
}
