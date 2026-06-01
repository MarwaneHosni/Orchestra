"use client";

import { useMemo } from "react";

const PHASE_GROUP_LABELS: Record<string, { short: string; group: string }> = {
  ideation: { short: "Ideation", group: "Foundation" },
  requirements: { short: "Requirements", group: "Foundation" },
  architecture: { short: "Architecture", group: "Foundation" },
  security: { short: "Security", group: "Foundation" },
  database: { short: "Database", group: "Core" },
  backend: { short: "Backend", group: "Core" },
  frontend: { short: "Frontend", group: "Core" },
  "core-features": { short: "Features", group: "Core" },
  "ai-systems": { short: "AI", group: "Core" },
  testing: { short: "Testing", group: "Infrastructure" },
  deployment: { short: "Deployment", group: "Infrastructure" },
  monitoring: { short: "Monitoring", group: "Operations" },
};

const GROUP_ORDER = ["Foundation", "Core", "Infrastructure", "Operations"];

interface ProgressBarProps {
  currentPhaseIndex: number;
  total: number;
  answered: number;
}

function estimateMinutesRemaining(total: number, answered: number): string {
  const remaining = total - answered;
  if (remaining <= 0) return "Complete";
  if (remaining <= 5) return "~1 min left";
  if (remaining <= 10) return "~2 min left";
  if (remaining <= 15) return "~3 min left";
  if (remaining <= 24) return "~5 min left";
  return `${Math.ceil(remaining * 0.4)} min left`;
}

export function ProgressBar({ currentPhaseIndex, total, answered }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  const currentGroup = PHASE_GROUP_LABELS[Object.keys(PHASE_GROUP_LABELS)[currentPhaseIndex] ?? ""]?.group ?? "";

  const groupProgress = useMemo(() => {
    const phases = Object.entries(PHASE_GROUP_LABELS);
    const groups: { name: string; total: number; count: number }[] = GROUP_ORDER.map((name) => ({ name, total: 0, count: 0 }));
    for (const [phase, info] of phases) {
      const g = groups.find((g) => g.name === info.group);
      if (g) g.total++;
    }
    return groups;
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-text-primary">
          {currentGroup ? `${currentGroup}` : "Getting started"}
        </span>
        <span className="text-xs text-text-secondary">
          {answered}/{total} &middot; {estimateMinutesRemaining(total, answered)}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={answered}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuetext={`${pct} percent complete`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className="h-full rounded-full bg-orchestra-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-1" aria-label="Phase groups">
        {groupProgress.map((g) => {
          const isActive = g.name === currentGroup;
          return (
            <span
              key={g.name}
              className={`whitespace-nowrap text-xs font-medium ${
                isActive ? "text-orchestra-700" : "text-gray-400"
              }`}
            >
              {g.name}
              <span className="ml-1 font-normal text-gray-400">({g.total})</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
