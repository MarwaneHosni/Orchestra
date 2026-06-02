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
      style={{ borderRadius: 3, padding: "8px 12px" }}
      className={cn(
        "block w-full bg-bg-elevated text-sm text-text-primary placeholder:text-text-muted",
        "focus:outline-none focus:shadow-[0_0_0_2px_var(--color-accent-purple-dim)] focus:border-accent-purple",
        "disabled:cursor-not-allowed disabled:opacity-50",
        hasError ? "border-accent-red focus:shadow-[0_0_0_2px_var(--color-accent-red-dim)] focus:border-accent-red" : "border-border-default",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
