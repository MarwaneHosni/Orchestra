"use client";

export type ToastType = "info" | "ok" | "warn" | "err";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

const PREFIX: Record<ToastType, string> = {
  info: "[info]",
  ok: "[ok]",
  warn: "[warn]",
  err: "[err]",
};

const PREFIX_COLOR: Record<ToastType, string> = {
  info: "var(--color-accent-purple)",
  ok: "var(--color-accent-green)",
  warn: "var(--color-accent-amber)",
  err: "var(--color-accent-red)",
};

const BORDER_COLOR: Record<ToastType, string> = {
  info: "var(--color-accent-purple)",
  ok: "var(--color-accent-green)",
  warn: "var(--color-accent-amber)",
  err: "var(--color-accent-red)",
};

export function Toast({ toast }: { toast: Toast }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-default)",
        borderLeft: `3px solid ${BORDER_COLOR[toast.type]}`,
        padding: "10px 14px",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        color: "var(--color-text-primary)",
        borderRadius: 2,
        maxWidth: 420,
      }}
    >
      <span style={{ color: PREFIX_COLOR[toast.type], marginRight: 8 }}>{PREFIX[toast.type]}</span>
      {toast.message}
    </div>
  );
}
