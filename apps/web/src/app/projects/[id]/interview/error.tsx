"use client";

export default function InterviewError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-16 text-center">
      <h2 className="text-sm font-semibold text-accent-red">Interview Error</h2>
      <p className="mt-2 text-xs text-text-secondary">{error.message}</p>
      <button
        onClick={reset}
        className="mt-6 rounded bg-accent-purple px-4 py-2 text-sm text-white hover:opacity-90"
      >
        Retry
      </button>
    </div>
  );
}
