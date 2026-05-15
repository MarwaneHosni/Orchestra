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
        "block w-full rounded-lg border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary",
        "focus:outline-none focus:ring-2 focus:ring-orchestra-500 focus:border-orchestra-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        hasError ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-border",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
