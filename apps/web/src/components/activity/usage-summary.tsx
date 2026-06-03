"use client";

import { useState, useEffect } from "react";
import { getProjectSummary } from "@/lib/api";
import type { ProjectSummary } from "@/lib/api";
import { ThinkingLoader } from "@/components/ui/skeleton";

interface UsageSummaryProps {
  projectId: string;
}

export function UsageSummary({ projectId }: UsageSummaryProps) {
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await getProjectSummary(projectId).catch(() => null);
        setSummary(result);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3">
        <ThinkingLoader />
      </div>
    );
  }

  const exportCount = summary?.exportCount ?? 0;
  const compareCount = summary?.compareCount ?? 0;
  const failedCount = summary?.failedCount ?? 0;
  const totalEvents = summary?.totalEvents ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Events" value={totalEvents} />
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
    <div className="rounded border border-border-default bg-bg-elevated p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${variant === "warning" && value > 0 ? "text-accent-red" : "text-text-primary"}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-text-secondary">{sub}</p>}
    </div>
  );
}
