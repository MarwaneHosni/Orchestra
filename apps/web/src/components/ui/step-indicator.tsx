"use client";

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
    <nav aria-label="Flow progress" style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
      <span>
        {STEPS.map((step, i) => {
          const isComplete = i < currentIdx || completeSet.has(step.id);
          const isCurrent = step.id === current;
          const isLocked = i > currentIdx && !completeSet.has(step.id);

          return (
            <span key={step.id} aria-current={isCurrent ? "step" : undefined}>
              {i > 0 && (
                <span className="mx-2" style={{ color: "var(--color-text-muted)" }}>──</span>
              )}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: `1px solid ${
                    isCurrent ? "var(--color-accent-purple)" :
                    isComplete ? "var(--color-accent-green)" :
                    "var(--color-border-default)"
                  }`,
                  fontSize: 10,
                  fontWeight: 700,
                  opacity: isLocked ? 0.5 : 1,
                  background: isCurrent ? "var(--color-accent-purple)" :
                              isComplete ? "var(--color-accent-green)" : "transparent",
                  color: (isCurrent || isComplete) ? "#fff" : "var(--color-text-muted)",
                }}
              >
                {isComplete && !isCurrent ? "✓" : i + 1}
              </span>
              {!compact && (
                <span
                  className="ml-1.5"
                  style={{
                    color: isCurrent ? "var(--color-accent-purple)" :
                           isComplete ? "var(--color-accent-green)" :
                           isLocked ? "var(--color-text-muted)" : "var(--color-text-secondary)",
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {step.label}
                </span>
              )}
            </span>
          );
        })}
      </span>
    </nav>
  );
}
