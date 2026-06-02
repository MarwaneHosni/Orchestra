"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getLatestBlueprint } from "@/lib/api";
import type { BlueprintResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StepIndicator } from "@/components/ui/step-indicator";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ThinkingLoader } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/badge";

interface SummaryViewProps {
  sessionId: string;
}

const MAX_POLL_RETRIES = 60;
const POLL_INTERVAL_MS = 2000;

export function SummaryView({ sessionId }: SummaryViewProps) {
  const router = useRouter();
  const [blueprint, setBlueprint] = useState<BlueprintResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pollRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    pollRef.current = 0;

    const poll = async () => {
      while (!cancelled) {
        try {
          const result = await getLatestBlueprint(sessionId);
          if (cancelled) return;
          if (result) {
            setBlueprint(result);
            setLoading(false);
            return;
          }
        } catch (e) {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "Failed to load blueprint");
          setLoading(false);
          return;
        }

        pollRef.current++;
        if (pollRef.current >= MAX_POLL_RETRIES) {
          if (!cancelled) {
            setError("Blueprint generation timed out. Please try again.");
            setLoading(false);
          }
          return;
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const hasInsufficientPhases = blueprint?.phases.some(
    (p) => p.status === "insufficient" || p.status === "missing",
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3" role="status" aria-label="Loading blueprint">
        <ThinkingLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16">
        <div className="rounded border border-accent-red-dim bg-accent-red-dim/30 p-6 text-center">
          <p className="text-accent-red">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded bg-accent-purple px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!blueprint) {
    return (
      <div className="py-16 text-center">
        <p className="text-text-secondary">No blueprint found for this project.</p>
      </div>
    );
  }

  const confidenceColor =
    blueprint.overallConfidence >= 0.6
      ? "text-accent-green"
      : blueprint.overallConfidence >= 0.4
        ? "text-accent-amber"
        : "text-accent-red";

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: blueprint.projectName }]} />

      <StepIndicator current="review" complete={["interview"]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{blueprint.projectName}</h1>
          <p className="mt-1 text-xs text-text-secondary">
            Plan v{blueprint.planVersion} · Generated{" "}
            {new Date(blueprint.generatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {hasInsufficientPhases && (
        <div className="rounded border border-accent-amber-dim bg-accent-amber-dim/30 p-4 text-xs text-accent-amber">
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
        <h2 className="mb-4 text-sm font-semibold text-text-primary">Phase Progress</h2>
        <div className="space-y-2">
          {(blueprint.phases ?? []).map((phase) => (
            <div
              key={phase.phaseType}
              className={cn(
                "flex items-center justify-between rounded border px-4 py-3",
                phase.status === "sufficient" && "border-accent-green-dim bg-accent-green-dim/30",
                phase.status === "insufficient" && "border-accent-amber-dim bg-accent-amber-dim/30",
                phase.status === "missing" && "border-border-subtle bg-bg-surface",
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
                  <StatusBadge status={phase.status} />
                )}
                {phase.status === "sufficient" && (
                  <StatusBadge status="sufficient" />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {blueprint.assumptions?.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">
            Assumptions ({blueprint.assumptions.length})
          </h2>
          <div className="space-y-2">
            {blueprint.assumptions.map((a, i) => (
              <div key={i} className="rounded border border-border-default bg-bg-elevated p-4">
                <p className="text-sm text-text-primary">{a.description}</p>
                <p className="mt-1 text-xs text-text-secondary">Source: {a.source}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {blueprint.constraints?.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">
            Constraints ({blueprint.constraints.length})
          </h2>
          <div className="space-y-2">
            {blueprint.constraints.map((c, i) => (
              <div key={i} className="rounded border border-border-default bg-bg-elevated p-4">
                <p className="text-sm text-text-primary">{c.description}</p>
                <p className="mt-1 text-xs text-text-secondary">Source: {c.source}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {blueprint.risks?.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Risks ({blueprint.risks.length})</h2>
          <div className="space-y-2">
            {blueprint.risks.map((r, i) => (
              <div key={i} className="rounded border border-border-default bg-bg-elevated p-4">
                <p className="text-sm text-text-primary">{r.description}</p>
                <p className="mt-1 text-xs text-text-secondary">Source: {r.source}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(blueprint.ambiguityFlags ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">
            Flags ({blueprint.ambiguityFlags.length})
          </h2>
          <div className="space-y-2">
            {blueprint.ambiguityFlags.map((f, i) => (
              <div
                key={i}
                className={cn(
                  "rounded border p-4",
                  f.severity === "high" && "border-accent-red-dim bg-accent-red-dim/30",
                  f.severity === "medium" && "border-accent-amber-dim bg-accent-amber-dim/30",
                  f.severity === "low" && "border-border-subtle bg-bg-surface",
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs">{f.type}</span>
                  <p className="text-sm text-text-primary">{f.message}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3 border-t border-border-subtle pt-6">
        <button
          onClick={() => router.push(`/projects/${sessionId}/tasks`)}
          className="rounded bg-accent-purple px-6 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          View task graph
        </button>
        <button
          onClick={() => router.push(`/projects/${sessionId}/versions`)}
          className="rounded border border-border-default bg-bg-surface px-6 py-2 text-sm font-medium text-text-secondary hover:bg-bg-hover"
        >
          Exports &amp; versions
        </button>
        <button
          onClick={() => router.push(`/projects/${sessionId}/interview`)}
          className="rounded border border-border-default bg-bg-surface px-6 py-2 text-sm font-medium text-text-secondary hover:bg-bg-hover"
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
    <div className="rounded border border-border-subtle bg-bg-elevated" style={{ padding: "14px 16px" }}>
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold", className ?? "text-text-primary")}>{value}</p>
      {sub && <p className="text-xs text-text-secondary">{sub}</p>}
    </div>
  );
}

function PhaseIcon({ status }: { status: string }) {
  if (status === "sufficient") return <span className="text-accent-green">✓</span>;
  if (status === "insufficient") return <span className="text-accent-amber">~</span>;
  return <span className="text-text-muted">○</span>;
}
