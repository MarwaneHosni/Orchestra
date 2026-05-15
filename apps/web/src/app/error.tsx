"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Dashboard error"
      message={error.message || "Failed to load the dashboard."}
      onRetry={reset}
    />
  );
}
