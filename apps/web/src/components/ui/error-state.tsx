"use client";

import { cn } from "@/lib/utils";
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
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
      style={{
        borderRadius: 3,
        border: "1px solid var(--color-accent-red-dim)",
        background: "var(--color-accent-red-dim)",
      }}
      role="alert"
    >
      <span className="mb-3 text-accent-red text-lg" aria-hidden="true">✗</span>
      <h3 className="mb-2" style={{ fontSize: 14, fontWeight: 600 }}>{title}</h3>
      <p className="mb-6 max-w-sm" style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{message}</p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
