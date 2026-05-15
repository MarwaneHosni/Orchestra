"use client";

import { useState, useEffect } from "react";

interface PromptPreviewProps {
  taskId: string;
  onClose: () => void;
}

export function PromptPreview({ taskId, onClose }: PromptPreviewProps) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:3000/api/v1/plans/dummy/tasks/${taskId}/prompt`);
        if (!res.ok) throw new Error(`Failed to load prompt`);
        const data = await res.json();
        setPrompt(data.promptText);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [taskId]);

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-[36rem] flex-col border-l border-border bg-surface shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Execution Prompt</h2>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-32 w-full animate-pulse rounded bg-gray-100" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : (
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-text-primary">
            {prompt}
          </pre>
        )}
      </div>
    </div>
  );
}
