import Link from "next/link";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}

function StyledLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors"
    >
      {children}
    </Link>
  );
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded border-2 border-dashed border-border-default bg-bg-surface px-6 py-16 text-center",
        className,
      )}
    >
      <h3 className="mb-2 text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mb-6 max-w-sm text-xs text-text-secondary">{description}</p>
      {action &&
        (action.href ? (
          <StyledLink href={action.href}>{action.label}</StyledLink>
        ) : (
          <button
            onClick={action.onClick}
            className="inline-flex items-center justify-center gap-2 rounded bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
