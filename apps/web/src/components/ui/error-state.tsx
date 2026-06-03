"use client";

import { TerminalTitle } from "@/components/ui/terminal-title";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px 20px",
        borderRadius: 3,
        border: "1px solid var(--color-accent-red-dim)",
        background: "var(--color-accent-red-dim)",
      }}
      className={className}
      role="alert"
    >
      <span style={{ marginBottom: 8, color: "var(--color-accent-red)", fontSize: 18 }} aria-hidden="true">✗</span>
      <TerminalTitle as="h3" style={{ marginBottom: 4, fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{title}</TerminalTitle>
      <p style={{ marginBottom: 20, maxWidth: 320, fontSize: 12, color: "var(--color-text-secondary)", textAlign: "center" }}>{message}</p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
