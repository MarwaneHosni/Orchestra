"use client";

import { cn } from "@/lib/utils";
import { useId } from "react";

const PHASES = [
  "ideation",
  "requirements",
  "architecture",
  "security",
  "database",
  "backend",
  "frontend",
  "core-features",
  "ai-systems",
  "testing",
  "deployment",
  "monitoring",
];

const PHASE_LABELS: Record<string, string> = {
  ideation: "Ideation",
  requirements: "Requirements",
  architecture: "Architecture",
  security: "Security",
  database: "Database",
  backend: "Backend",
  frontend: "Frontend",
  "core-features": "Core",
  "ai-systems": "AI",
  testing: "Testing",
  deployment: "Deployment",
  monitoring: "Monitoring",
};

const PHASE_ABBR: Record<string, string> = {
  ideation: "Id",
  requirements: "Req",
  architecture: "Arch",
  security: "Sec",
  database: "DB",
  backend: "BE",
  frontend: "FE",
  "core-features": "Core",
  "ai-systems": "AI",
  testing: "Test",
  deployment: "Deploy",
  monitoring: "Mon",
};

interface PhaseStatus {
  phaseType: string;
  status: "sufficient" | "insufficient" | "missing" | "pending" | "in_progress";
}

interface ProgressBarProps {
  currentPhaseIndex: number;
  total: number;
  answered: number;
  phaseStatuses?: PhaseStatus[];
}

export function ProgressBar({ currentPhaseIndex, total, answered, phaseStatuses }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const statusMap = new Map(phaseStatuses?.map((ps) => [ps.phaseType, ps.status]));
  const labelId = useId();

  return (
    <div className="space-y-3" role="group" aria-labelledby={labelId}>
      <div className="flex items-center justify-between text-sm">
        <span id={labelId} className="font-medium text-text-primary">
          Progress
        </span>
        <span className="text-text-secondary" aria-hidden="true">
          {answered} of {total} questions
        </span>
        <span className="sr-only">
          {answered} of {total} questions answered
        </span>
      </div>

      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuenow={answered}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuetext={`${pct} percent complete`}
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className="h-full rounded-full bg-orchestra-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="flex gap-1 overflow-x-auto pb-1" aria-label="Phase list">
        {PHASES.map((phase, i) => {
          const isCurrent = i === currentPhaseIndex;
          const isPast = i < currentPhaseIndex;
          const phaseStatus = statusMap.get(phase);

          let dotColor: string;
          let bgColor: string;
          let textColor: string;
          let statusLabel: string;

          if (phaseStatus === "insufficient" || phaseStatus === "missing") {
            dotColor = phaseStatus === "missing" ? "bg-red-500" : "bg-amber-500";
            bgColor = phaseStatus === "missing" ? "bg-red-50" : "bg-amber-50";
            textColor = phaseStatus === "missing" ? "text-red-700" : "text-amber-700";
            statusLabel = phaseStatus === "missing" ? "Missing input" : "Needs more detail";
          } else if (isCurrent) {
            dotColor = "bg-orchestra-500";
            bgColor = "bg-orchestra-100";
            textColor = "text-orchestra-700";
            statusLabel = "In progress";
          } else if (isPast || phaseStatus === "sufficient") {
            dotColor = "bg-green-500";
            bgColor = "bg-green-100";
            textColor = "text-green-700";
            statusLabel = "Complete";
          } else {
            dotColor = "bg-gray-300";
            bgColor = "bg-gray-100";
            textColor = "text-gray-400";
            statusLabel = "Not started";
          }

          const label = PHASE_LABELS[phase] ?? phase;

          return (
            <li key={phase} className="shrink-0">
              <div
                className={cn(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                  bgColor,
                  textColor,
                )}
                aria-label={`${label}: ${statusLabel}`}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{PHASE_ABBR[phase] ?? phase}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
