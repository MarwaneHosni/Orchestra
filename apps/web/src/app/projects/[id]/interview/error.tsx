"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function InterviewError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Interview Error" message={error.message} onRetry={reset} />;
}
