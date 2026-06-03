import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { TerminalTitle } from "@/components/ui/terminal-title";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={{ borderRadius: 3, padding: "18px 20px" }} className={cn("border border-border-subtle bg-bg-elevated", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <TerminalTitle as="h3" className={cn("text-sm font-semibold text-text-primary", className)} {...props}>
      {children as string}
    </TerminalTitle>
  );
}

export function CardDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mt-2 text-xs text-text-secondary", className)} {...props}>
      {children}
    </p>
  );
}
