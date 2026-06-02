"use client";

import { cn } from "@/lib/utils";

export type StepId = "interview" | "review" | "tasks";

interface Step {
  id: StepId;
  label: string;
}

const STEPS: Step[] = [
  { id: "interview", label: "Interview" },
  { id: "review", label: "Review" },
  { id: "tasks", label: "Tasks" },
];

interface StepIndicatorProps {
  current: StepId;
  complete?: StepId[];
  compact?: boolean;
}

export function StepIndicator({ current, complete = [], compact }: StepIndicatorProps) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  const completeSet = new Set(complete);

  return (
    <nav aria-label="Flow progress" className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const isComplete = i < currentIdx || completeSet.has(step.id);
        const isCurrent = step.id === current;
        const isLocked = i > currentIdx && !completeSet.has(step.id);
        const isActive = isCurrent || isComplete;

        return (
          <div key={step.id} className="flex items-center">
            {i > 0 && (
              <div
                className={cn(
                  "mx-1 h-px w-6 sm:w-10",
                  isActive ? "bg-accent-purple" : "bg-border-subtle",
                )}
              />
            )}
            <div className={cn(isLocked && "opacity-50")} aria-current={isCurrent ? "step" : undefined}>
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    isCurrent && "bg-accent-purple text-white",
                    isComplete && !isCurrent && "bg-accent-green text-white",
                    isLocked && "bg-border-subtle text-text-muted",
                  )}
                >
                  {isComplete && !isCurrent ? "✓" : i + 1}
                </span>
                {!compact && (
                  <span
                    className={cn(
                      "text-xs",
                      isCurrent && "font-semibold text-accent-purple",
                      isComplete && !isCurrent && "text-accent-green",
                      isLocked && "text-text-muted",
                    )}
                  >
                    {step.label}
                  </span>
                )}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
