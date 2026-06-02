"use client";

import { cn } from "@/lib/utils";

interface PhaseNoticeProps {
  type: "insufficient" | "missing";
  phaseName: string;
  details: string[];
  onProvideMore?: () => void;
  onContinue?: () => void;
  className?: string;
}

export function PhaseNotice({
  type,
  phaseName,
  details,
  onProvideMore,
  onContinue,
  className,
}: PhaseNoticeProps) {
  const colors =
    type === "insufficient"
      ? { border: "border-accent-amber-dim", bg: "bg-accent-amber-dim/30", text: "text-accent-amber", textStrong: "text-accent-amber" }
      : { border: "border-accent-red-dim", bg: "bg-accent-red-dim/30", text: "text-accent-red", textStrong: "text-accent-red" };

  return (
    <div className={cn("rounded border p-4", colors.border, colors.bg, className)} role="alert">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 text-sm ${colors.text}`} aria-hidden="true">
          {type === "insufficient" ? "~" : "✗"}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${colors.textStrong}`}>
            Phase &ldquo;{phaseName}&rdquo;{" "}
            {type === "insufficient" ? "could use more detail" : "needs input"}
          </p>
          {details.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {details.map((d, i) => (
                <li key={i} className={`text-xs ${colors.text}`}>
                  {d}
                </li>
              ))}
            </ul>
          )}
          {(onProvideMore || onContinue) && (
            <div className="mt-4 flex gap-3">
              {onProvideMore && (
                <button
                  onClick={onProvideMore}
                  className={cn(
                    "rounded px-3 py-1 text-xs font-medium transition-colors",
                    type === "insufficient" && "bg-accent-amber text-gray-900 hover:opacity-90",
                    type === "missing" && "bg-accent-red text-white hover:opacity-90",
                  )}
                >
                  {type === "insufficient" ? "Provide more detail" : "Answer questions"}
                </button>
              )}
              {onContinue && (
                <button
                  onClick={onContinue}
                  className="rounded border border-border-default bg-bg-surface px-3 py-1 text-xs font-medium text-text-secondary hover:bg-bg-hover"
                >
                  Continue as-is
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
