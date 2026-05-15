"use client";

import { cn } from "@/lib/utils";

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

interface ProgressBarProps {
  currentPhaseIndex: number;
  total: number;
  answered: number;
}

export function ProgressBar({ currentPhaseIndex, total, answered }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-text-primary">Progress</span>
        <span className="text-text-secondary">
          {answered} of {total} questions
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-orchestra-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {PHASES.map((phase, i) => {
          const isCurrent = i === currentPhaseIndex;
          const isPast = i < currentPhaseIndex;
          return (
            <div
              key={phase}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                isCurrent && "bg-orchestra-100 text-orchestra-700",
                isPast && "bg-green-100 text-green-700",
                !isCurrent && !isPast && "bg-gray-100 text-gray-400",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isPast && "bg-green-500",
                  isCurrent && "bg-orchestra-500",
                  !isCurrent && !isPast && "bg-gray-300",
                )}
              />
              {PHASE_LABELS[phase] ?? phase}
            </div>
          );
        })}
      </div>
    </div>
  );
}
