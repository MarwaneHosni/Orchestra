"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function BlueprintsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Failed to load blueprints"
      message={error.message}
      onRetry={reset}
    />
  );
}
