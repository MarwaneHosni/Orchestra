"use client";

import { cn } from "@/lib/utils";
import type { VersionDiff } from "@/lib/api";

interface VersionCompareProps {
  diff: VersionDiff;
}

const PHASE_LABELS: Record<string, string> = {
  ideation: "Ideation",
  requirements: "Requirements",
  architecture: "Architecture",
  security: "Security",
  database: "Database",
  backend: "Backend",
  frontend: "Frontend",
  "core-features": "Core Features",
  "ai-systems": "AI Systems",
  testing: "Testing",
  deployment: "Deployment",
  monitoring: "Monitoring",
};

export function VersionCompare({ diff }: VersionCompareProps) {
  const changedTasks = diff.tasks.filter((t) => t.changeType !== "unchanged");
  const changedPrompts = diff.prompts.filter((p) => p.changeType !== "unchanged");
  const hasBlueprint = diff.blueprint !== null;
  const hasBlueprintChanges = diff.summary.blueprintChanges > 0;

  return (
    <div className="space-y-8">
      <div className="rounded border border-border-default bg-bg-elevated p-4">
        <h2 className="text-sm font-semibold text-text-primary">Comparison</h2>
        <div className="mt-2 flex items-center gap-4 text-sm">
          <span className="text-text-secondary">v{diff.left.version}</span>
          <span className="text-text-secondary">→</span>
          <span className="font-medium text-text-primary">v{diff.right.version}</span>
          <ScopeBadge scope={diff.summary.regenerationScope} />
        </div>
        <div className="mt-2 flex gap-3 text-xs text-text-secondary">
          <span>{diff.left.reason}</span>
          <span>·</span>
          <span>{diff.right.reason}</span>
          <span>·</span>
          <span>{new Date(diff.right.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="Tasks" value={diff.summary.taskChanges} />
        <SummaryCard label="Prompts" value={diff.summary.promptChanges} />
        <SummaryCard label="Blueprint" value={diff.summary.blueprintChanges} />
        <SummaryCard label="Phases" value={diff.summary.phaseChanges} />
      </div>

      {diff.summary.regenerationScope !== "none" && (
        <div
          className={cn(
            "rounded border p-3 text-sm",
            diff.summary.regenerationScope === "full"
              ? "border-accent-purple-dim bg-accent-purple-dim/30 text-accent-purple"
              : "border-accent-amber-dim bg-accent-amber-dim/30 text-accent-amber",
          )}
        >
          <p className="font-medium">
            {diff.summary.regenerationScope === "full" ? "Full regeneration" : "Partial regeneration"}
          </p>
          {diff.summary.affectedPhaseTypes.length > 0 && (
            <p className="mt-1 text-xs">
              Affected phases: {diff.summary.affectedPhaseTypes.map((p) => PHASE_LABELS[p] ?? p).join(", ")}
            </p>
          )}
        </div>
      )}

      {changedTasks.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-text-primary">
            Tasks ({changedTasks.length} changed)
          </h3>
          <div className="space-y-1.5">
            {changedTasks.map((t, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-4 rounded border px-3 py-2 text-sm",
                  t.changeType === "added" && "border-accent-green-dim bg-accent-green-dim/30",
                  t.changeType === "removed" && "border-accent-red-dim bg-accent-red-dim/30",
                  t.changeType === "modified" && "border-accent-amber-dim bg-accent-amber-dim/30",
                )}
              >
                <ChangeIcon type={t.changeType} />
                <span className="text-xs text-text-secondary">
                  {PHASE_LABELS[t.phaseType] ?? t.phaseType}
                </span>
                <span className="text-text-primary">{t.right?.title ?? t.left?.title}</span>
                {t.changeType === "modified" && t.left && t.right && (
                  <span className="ml-auto text-xs text-text-secondary">
                    {t.left.status} → {t.right.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {hasBlueprint && hasBlueprintChanges && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-text-primary">
            Blueprint ({diff.summary.blueprintChanges} changes)
          </h3>

          {diff.blueprint!.assumptions.filter((a) => a.changeType !== "unchanged").length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-text-secondary">Assumptions</p>
              <div className="space-y-1.5">
                {diff
                  .blueprint!.assumptions.filter((a) => a.changeType !== "unchanged")
                  .map((a, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-3 rounded border px-3 py-2 text-sm",
                        a.changeType === "added" && "border-accent-green-dim bg-accent-green-dim/30",
                        a.changeType === "removed" && "border-accent-red-dim bg-accent-red-dim/30",
                      )}
                    >
                      <ChangeIcon type={a.changeType} />
                      <span className="text-text-primary">{a.description}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {diff.blueprint!.phaseSummaries.filter(
            (p) => p.summaryChanged || p.confidenceChanged || p.statusChanged,
          ).length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">Phase summaries</p>
              <div className="space-y-1.5">
                {diff
                  .blueprint!.phaseSummaries.filter(
                    (p) => p.summaryChanged || p.confidenceChanged || p.statusChanged,
                  )
                  .map((p, i) => (
                    <div
                      key={i}
                       className="flex items-center gap-4 rounded border border-accent-amber-dim bg-accent-amber-dim/30 px-3 py-2 text-sm"
                    >
                      <span className="text-accent-amber">~</span>
                      <span className="text-xs text-text-secondary">
                        {PHASE_LABELS[p.phaseType] ?? p.phaseType}
                      </span>
                      <span className="text-text-primary">{p.leftSummary ?? "(empty)"}</span>
                      <span className="text-text-secondary">→</span>
                      <span className="text-text-primary">{p.rightSummary ?? "(empty)"}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

      {!hasBlueprintChanges && !changedTasks.length && !changedPrompts.length && (
        <div className="rounded border-2 border-dashed border-border-default p-12 text-center">
          <p className="text-sm text-text-secondary">No meaningful differences between these versions.</p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border-default bg-bg-elevated p-3 text-center">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold", value > 0 ? "text-accent-amber" : "text-text-primary")}>
        {value}
      </p>
    </div>
  );
}

function ScopeBadge({ scope }: { scope: string }) {
  if (scope === "full")
    return (
      <span className="rounded bg-accent-purple-dim px-2 py-0.5 text-xs font-medium text-accent-purple">
        Full
      </span>
    );
  if (scope === "partial")
    return (
      <span className="rounded bg-accent-amber-dim px-2 py-0.5 text-xs font-medium text-accent-amber">
        Partial
      </span>
    );
  return (
    <span className="rounded bg-bg-hover px-2 py-0.5 text-xs font-medium text-text-muted">No changes</span>
  );
}

function ChangeIcon({ type }: { type: string }) {
  if (type === "added") return <span className="text-accent-green">+</span>;
  if (type === "removed") return <span className="text-accent-red">−</span>;
  if (type === "modified") return <span className="text-accent-amber">~</span>;
  return null;
}
