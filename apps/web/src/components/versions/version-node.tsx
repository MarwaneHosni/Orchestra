"use client";

import { cn } from "@/lib/utils";
import type { SnapshotInfo } from "@/lib/api";

interface VersionNodeProps {
  snapshot: SnapshotInfo;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isCompareTarget: boolean;
  parentVersion: number | null;
  isFirst: boolean;
  isLast: boolean;
}

const REASON_LABELS: Record<string, string> = {
  initial: "Project created",
  interview_complete: "Interview completed",
  plan_regenerated: "Plan regenerated",
  phase_edited: "Answers edited",
  task_graph_regenerated: "Task graph regenerated",
  manual: "Manual snapshot",
};

export function VersionNode({
  snapshot,
  isSelected,
  onSelect,
  isCompareTarget,
  parentVersion,
  isFirst,
  isLast,
}: VersionNodeProps) {
  const isPartial = snapshot.affectedPhaseTypes !== null && snapshot.affectedPhaseTypes.length > 0;
  const isFailed = snapshot.status === "failed";
  const reasonLabel = REASON_LABELS[snapshot.reason] ?? snapshot.reason;

  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        {!isFirst && <div className="h-2 w-0.5 bg-border-default" />}
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
            isFailed && "bg-accent-red text-white",
            isPartial && "bg-accent-amber text-white",
            !isFailed && !isPartial && "bg-accent-purple text-white",
          )}
        >
          {snapshot.version}
        </span>
        {!isLast && <div className="flex-1 w-0.5 min-h-[8px] bg-border-default" />}
      </div>

      <div className="min-w-0 flex-1 pb-4">
        <button
          onClick={() => onSelect(snapshot.id)}
          className={cn(
            "w-full rounded border-2 px-4 py-3 text-left transition-colors",
            isSelected && "ring-2 ring-accent-purple ring-offset-1 ring-offset-bg-base",
            isCompareTarget && "ring-2 ring-accent-purple ring-offset-1 ring-offset-bg-base",
            isFailed
              ? "border-accent-red-dim bg-accent-red-dim/30"
              : isPartial
                ? "border-accent-amber-dim bg-accent-amber-dim/30"
                : "border-border-default bg-bg-elevated",
          )}
          aria-label={`Version ${snapshot.version}: ${reasonLabel}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-sm font-medium text-text-primary">{reasonLabel}</span>
              {parentVersion !== null && (
                <span className="ml-2 text-xs text-text-secondary">(derived from v{parentVersion})</span>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {parentVersion === null && snapshot.version === 1 && (
                <span className="rounded bg-accent-purple-dim px-2 py-0.5 text-xs font-medium text-accent-purple">
                  Initial
                </span>
              )}
              {isPartial && (
                <span className="rounded bg-accent-amber-dim px-2 py-0.5 text-xs font-medium text-accent-amber">
                  Partial
                </span>
              )}
              {isFailed && (
                <span className="rounded bg-accent-red-dim px-2 py-0.5 text-xs font-medium text-accent-red">
                  Failed
                </span>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-text-secondary">
            <span>{new Date(snapshot.createdAt).toLocaleDateString()}</span>
            {snapshot.planVersion && <span>Plan v{snapshot.planVersion}</span>}
            {snapshot.answerCount > 0 && <span>{snapshot.answerCount} answers</span>}
          </div>
          {snapshot.changeSummary && (
            <p className="mt-1 text-xs text-text-secondary truncate">{snapshot.changeSummary}</p>
          )}
          {snapshot.failureReason && <p className="mt-1 text-xs text-accent-red">{snapshot.failureReason}</p>}
        </button>
      </div>
    </div>
  );
}
