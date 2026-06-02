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

function confidenceColor(pct: number): string {
  if (pct >= 60) return "var(--color-accent-green)";
  if (pct >= 40) return "var(--color-accent-amber)";
  return "var(--color-accent-red)";
}

export function ProgressBar({ currentPhaseIndex, total, answered }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  const currentGroup = PHASE_GROUP_LABELS[Object.keys(PHASE_GROUP_LABELS)[currentPhaseIndex] ?? ""]?.group ?? "";

  const groupProgress = useMemo(() => {
    const phases = Object.entries(PHASE_GROUP_LABELS);
    const groups: { name: string; total: number; count: number }[] = GROUP_ORDER.map((name) => ({
      name,
      total: 0,
      count: 0,
    }));
    for (const [, info] of phases) {
      const g = groups.find((g) => g.name === info.group);
      if (g) g.total++;
    }
    return groups;
  }, []);

  return (
    <div className="space-y-1.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
      <div className="flex items-center justify-between">
        <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
          {currentGroup || "Getting started"}
        </span>
        <span style={{ color: confidenceColor(pct), fontWeight: 600 }}>
          {pct}%
        </span>
        <span style={{ color: "var(--color-text-secondary)" }}>
          {answered}/{total} · {estimateMinutesRemaining(total, answered)}
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Phase groups">
        {groupProgress.map((g) => {
          const isActive = g.name === currentGroup;
          return (
            <span
              key={g.name}
              style={{
                color: isActive ? "var(--color-accent-purple)" : "var(--color-text-muted)",
                fontWeight: isActive ? 500 : 400,
                whiteSpace: "nowrap",
                fontSize: 10,
              }}
            >
              {g.name}<span style={{ color: "var(--color-text-muted)", fontWeight: 400, marginLeft: 4 }}>({g.total})</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
