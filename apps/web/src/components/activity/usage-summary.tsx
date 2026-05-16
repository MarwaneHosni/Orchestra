"use client";

import { useState, useEffect } from "react";
import { getProjectSummary, getSnapshots } from "@/lib/api";
import type { ProjectSummary, SnapshotInfo } from "@/lib/api";

interface UsageSummaryProps {
  projectId: string;
}

export function UsageSummary({ projectId }: UsageSummaryProps) {
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [summaryResult, snapshotsResult] = await Promise.all([
          getProjectSummary(projectId).catch(() => null),
          getSnapshots(projectId).catch(() => ({ data: [] as SnapshotInfo[] })),
        ]);
        setSummary(summaryResult);
        setSnapshots(snapshotsResult.data ?? []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  const fullSnapshotCount = snapshots.length;
  const partialCount = snapshots.filter(
    (s) => s.affectedPhaseTypes && s.affectedPhaseTypes.length > 0,
  ).length;
  const exportCount = summary?.exportCount ?? 0;
  const compareCount = summary?.compareCount ?? 0;
  const failedCount = summary?.failedCount ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Snapshots" value={fullSnapshotCount} sub={`${partialCount} partial`} />
        <MetricCard label="Exports" value={exportCount} />
        <MetricCard label="Comparisons" value={compareCount} />
        <MetricCard label="Failed" value={failedCount} variant={failedCount > 0 ? "warning" : "default"} />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  variant = "default",
}: {
  label: string;
  value: number;
  sub?: string;
  variant?: "default" | "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${variant === "warning" && value > 0 ? "text-red-600" : "text-text-primary"}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-text-secondary">{sub}</p>}
    </div>
  );
}
