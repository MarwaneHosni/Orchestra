"use client";

export default function InterviewError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <h2 className="text-lg font-semibold text-red-800">Interview Error</h2>
      <p className="mt-2 text-sm text-red-600">{error.message}</p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-orchestra-600 px-4 py-2 text-sm text-white hover:bg-orchestra-700"
      >
        Retry
      </button>
    </div>
  );
}
