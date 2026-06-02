"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function SummaryError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Failed to Load Plan" message={error.message} onRetry={reset} />;
}
