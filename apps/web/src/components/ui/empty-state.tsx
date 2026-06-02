import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  const boxTop = `┌${"─".repeat(50)}┐`;
  const boxMid1 = `│  ${title.padEnd(46)}│`;
  const boxMid2 = `│  ${description.slice(0, 46).padEnd(46)}│`;
  const boxBot = `└${"─".repeat(50)}┘`;

  return (
    <div className={`flex flex-col items-center py-8 gap-4 ${className ?? ""}`}>
      <pre className="text-text-muted text-xs leading-relaxed" aria-hidden="true">
        {boxTop}{"\n"}
        {boxMid1}{"\n"}
        {description && boxMid2}{"\n"}
        {boxBot}
      </pre>
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            style={{ borderRadius: 3, padding: "8px 18px" }}
            className="inline-flex items-center justify-center gap-2 bg-accent-purple text-white text-[13px] font-medium border border-accent-purple hover:opacity-88 active:scale-[0.98] transition-[color,background-color,border-color,opacity,transform] duration-150"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            style={{ borderRadius: 3, padding: "8px 18px" }}
            className="inline-flex items-center justify-center gap-2 bg-accent-purple text-white text-[13px] font-medium border border-accent-purple hover:opacity-88 active:scale-[0.98] transition-[color,background-color,border-color,opacity,transform] duration-150"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
