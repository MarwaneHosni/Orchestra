import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ hasError, className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      aria-invalid={hasError ? "true" : undefined}
      className={cn(
        "block w-full rounded border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted",
        "focus:outline-none focus:ring-2 focus:ring-accent-purple focus:border-accent-purple",
        "disabled:cursor-not-allowed disabled:opacity-50",
        hasError ? "border-accent-red focus:ring-accent-red focus:border-accent-red" : "border-border-default",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
