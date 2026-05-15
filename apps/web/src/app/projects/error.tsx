"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState title="Failed to load projects" message={error.message} onRetry={reset} />;
}
