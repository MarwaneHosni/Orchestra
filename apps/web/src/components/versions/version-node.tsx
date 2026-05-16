"use client";

import { cn } from "@/lib/utils";
import type { SnapshotInfo } from "@/lib/api";

interface VersionNodeProps {
  snapshot: SnapshotInfo;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isCompareTarget: boolean;
}

const REASON_LABELS: Record<string, string> = {
  initial: "Project created",
  interview_complete: "Interview completed",
  plan_regenerated: "Plan regenerated",
  phase_edited: "Answers edited",
  task_graph_regenerated: "Task graph regenerated",
  manual: "Manual snapshot",
};

export function VersionNode({ snapshot, isSelected, onSelect, isCompareTarget }: VersionNodeProps) {
  const isPartial = snapshot.affectedPhaseTypes !== null && snapshot.affectedPhaseTypes.length > 0;
  const isFailed = snapshot.status === "failed";
  const reasonLabel = REASON_LABELS[snapshot.reason] ?? snapshot.reason;

  return (
    <button
      onClick={() => onSelect(snapshot.id)}
      className={cn(
        "w-full rounded-lg border-2 px-4 py-3 text-left transition-all hover:shadow-sm",
        isSelected && "ring-2 ring-orchestra-500 ring-offset-1",
        isCompareTarget && "ring-2 ring-blue-500 ring-offset-1",
        isFailed
          ? "border-red-200 bg-red-50"
          : isPartial
            ? "border-amber-200 bg-amber-50"
            : "border-border bg-surface",
      )}
      aria-label={`Version ${snapshot.version}: ${reasonLabel}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
              isFailed && "bg-red-500 text-white",
              isPartial && "bg-amber-500 text-white",
              !isFailed && !isPartial && "bg-orchestra-600 text-white",
            )}
          >
            {snapshot.version}
          </span>
          <span className="text-sm font-medium text-text-primary">{reasonLabel}</span>
        </div>
        {isPartial && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Partial
          </span>
        )}
        {isFailed && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Failed</span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-xs text-text-secondary">
        <span>{new Date(snapshot.createdAt).toLocaleDateString()}</span>
        {snapshot.planVersion && <span>Plan v{snapshot.planVersion}</span>}
        {snapshot.answerCount > 0 && <span>{snapshot.answerCount} answers</span>}
      </div>
      {snapshot.changeSummary && (
        <p className="mt-1 text-xs text-text-secondary line-clamp-1">{snapshot.changeSummary}</p>
      )}
      {snapshot.failureReason && <p className="mt-1 text-xs text-red-600">{snapshot.failureReason}</p>}
    </button>
  );
}
