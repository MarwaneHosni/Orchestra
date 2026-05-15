"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState title="Failed to load settings" message={error.message} onRetry={reset} />;
}
