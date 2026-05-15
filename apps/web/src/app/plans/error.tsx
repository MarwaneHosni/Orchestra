"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function PlansError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState title="Failed to load plans" message={error.message} onRetry={reset} />;
}
