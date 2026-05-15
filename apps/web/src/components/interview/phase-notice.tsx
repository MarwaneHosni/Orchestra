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
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        type === "insufficient" && "border-amber-200 bg-amber-50",
        type === "missing" && "border-red-200 bg-red-50",
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 text-sm",
            type === "insufficient" && "text-amber-600",
            type === "missing" && "text-red-600",
          )}
          aria-hidden="true"
        >
          {type === "insufficient" ? "⚠" : "✕"}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-medium",
              type === "insufficient" && "text-amber-800",
              type === "missing" && "text-red-800",
            )}
          >
            Phase &ldquo;{phaseName}&rdquo;{" "}
            {type === "insufficient" ? "could use more detail" : "needs input"}
          </p>
          {details.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {details.map((d, i) => (
                <li
                  key={i}
                  className={cn(
                    "text-xs",
                    type === "insufficient" && "text-amber-700",
                    type === "missing" && "text-red-700",
                  )}
                >
                  {d}
                </li>
              ))}
            </ul>
          )}
          {(onProvideMore || onContinue) && (
            <div className="mt-3 flex gap-2">
              {onProvideMore && (
                <button
                  onClick={onProvideMore}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    type === "insufficient" && "bg-amber-600 text-white hover:bg-amber-700",
                    type === "missing" && "bg-red-600 text-white hover:bg-red-700",
                  )}
                >
                  {type === "insufficient" ? "Provide more detail" : "Answer questions"}
                </button>
              )}
              {onContinue && (
                <button
                  onClick={onContinue}
                  className="rounded-md border border-border bg-white px-3 py-1 text-xs font-medium text-text-secondary hover:bg-gray-50"
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
