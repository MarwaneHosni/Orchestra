"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateBlueprint } from "@/lib/api";
import type { BlueprintResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StepIndicator } from "@/components/ui/step-indicator";
import { Breadcrumb } from "@/components/ui/breadcrumb";

interface SummaryViewProps {
  sessionId: string;
}

export function SummaryView({ sessionId }: SummaryViewProps) {
  const router = useRouter();
  const [blueprint, setBlueprint] = useState<BlueprintResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const result = await generateBlueprint(sessionId);
        setBlueprint(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load plan");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  const hasInsufficientPhases = blueprint?.phases.some(
    (p) => p.status === "insufficient" || p.status === "missing",
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6" role="status" aria-label="Loading blueprint">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
        <div className="h-64 w-full animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-orchestra-600 px-4 py-2 text-sm text-white hover:bg-orchestra-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!blueprint) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-text-secondary">No blueprint found for this project.</p>
      </div>
    );
  }

  const confidenceColor =
    blueprint.overallConfidence >= 0.7
      ? "text-green-600"
      : blueprint.overallConfidence >= 0.4
        ? "text-amber-600"
        : "text-red-600";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: blueprint.projectName }]} />

      <StepIndicator current="review" complete={["interview"]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{blueprint.projectName}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Plan v{blueprint.planVersion} &middot; Generated{" "}
            {new Date(blueprint.generatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {hasInsufficientPhases && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Some phases have insufficient detail. The task graph will include <strong>needs_review</strong>{" "}
          markers for these areas. You can revisit the interview to add more detail.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Overall Confidence"
          value={`${Math.round(blueprint.overallConfidence * 100)}%`}
          className={confidenceColor}
        />
        <MetricCard label="Phases" value={`${blueprint.phases.length}`} />
        <MetricCard
          label="Flags"
          value={`${(blueprint.ambiguityFlags ?? []).length}`}
          sub="ambiguity items"
        />
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Phase Progress</h2>
        <div className="space-y-2">
          {(blueprint.phases ?? []).map((phase) => (
            <div
              key={phase.phaseType}
              className={cn(
                "flex items-center justify-between rounded-lg border px-4 py-3",
                phase.status === "sufficient" && "border-green-200 bg-green-50",
                phase.status === "insufficient" && "border-amber-200 bg-amber-50",
                phase.status === "missing" && "border-gray-200 bg-gray-50",
              )}
            >
              <div className="flex items-center gap-3">
                <PhaseIcon status={phase.status} />
                <div>
                  <p className="text-sm font-medium text-text-primary">{phase.phaseName}</p>
                  <p className="text-xs text-text-secondary">
                    Confidence: {Math.round(phase.confidence * 100)}%
                    {phase.ambiguityFlags?.length > 0 && ` · ${phase.ambiguityFlags.length} flag(s)`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(phase.status === "insufficient" || phase.status === "missing") && (
                  <span
                    className={cn(
                      "text-xs font-medium",
                      phase.status === "insufficient" && "text-amber-700",
                      phase.status === "missing" && "text-gray-400",
                    )}
                  >
                    {phase.status}
                  </span>
                )}
                {phase.status === "sufficient" && (
                  <span className="text-xs font-medium text-green-700">Ready</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {blueprint.assumptions?.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text-primary">
            Assumptions ({blueprint.assumptions.length})
          </h2>
          <div className="space-y-2">
            {blueprint.assumptions.map((a, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-sm text-text-primary">{a.description}</p>
                <p className="mt-1 text-xs text-text-secondary">Source: {a.source}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {blueprint.constraints?.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text-primary">
            Constraints ({blueprint.constraints.length})
          </h2>
          <div className="space-y-2">
            {blueprint.constraints.map((c, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-sm text-text-primary">{c.description}</p>
                <p className="mt-1 text-xs text-text-secondary">Source: {c.source}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {blueprint.risks?.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text-primary">Risks ({blueprint.risks.length})</h2>
          <div className="space-y-2">
            {blueprint.risks.map((r, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-sm text-text-primary">{r.description}</p>
                <p className="mt-1 text-xs text-text-secondary">Source: {r.source}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(blueprint.ambiguityFlags ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text-primary">
            Flags ({blueprint.ambiguityFlags.length})
          </h2>
          <div className="space-y-2">
            {blueprint.ambiguityFlags.map((f, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-4",
                  f.severity === "high" && "border-red-200 bg-red-50",
                  f.severity === "medium" && "border-amber-200 bg-amber-50",
                  f.severity === "low" && "border-gray-200 bg-gray-50",
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm">{f.type}</span>
                  <p className="text-sm text-text-primary">{f.message}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <button
          onClick={() => router.push(`/projects/${sessionId}/tasks`)}
          className="rounded-lg bg-orchestra-600 px-6 py-2 text-sm font-medium text-white hover:bg-orchestra-700"
        >
          View task graph
        </button>
        <button
          onClick={() => router.push(`/projects/${sessionId}/versions`)}
          className="rounded-lg border border-border bg-white px-6 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50"
        >
          Exports &amp; versions
        </button>
        <button
          onClick={() => router.push(`/projects/${sessionId}/interview`)}
          className="rounded-lg border border-border bg-white px-6 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50"
        >
          Return to interview
        </button>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold", className ?? "text-text-primary")}>{value}</p>
      {sub && <p className="text-xs text-text-secondary">{sub}</p>}
    </div>
  );
}

function PhaseIcon({ status }: { status: string }) {
  if (status === "sufficient") return <span className="text-green-600">✓</span>;
  if (status === "insufficient") return <span className="text-amber-600">~</span>;
  return <span className="text-gray-300">○</span>;
}
