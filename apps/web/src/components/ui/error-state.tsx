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
        "flex flex-col items-center justify-center rounded border border-accent-red-dim bg-accent-red-dim/30 px-6 py-16 text-center",
        className,
      )}
      role="alert"
    >
      <span className="mb-3 text-accent-red text-lg" aria-hidden="true">✗</span>
      <h3 className="mb-2 text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mb-6 max-w-sm text-xs text-text-secondary">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
