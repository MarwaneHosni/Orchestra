"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusTrap, useEscapeToClose } from "@/lib/use-focus-trap";
import { LiveAnnouncer } from "@/components/ui/live-announcer";
import { getApiBaseUrl } from "@/lib/api-config";

interface PromptPreviewProps {
  taskId: string;
  sessionId: string;
  onClose: () => void;
}

export function PromptPreview({ taskId, sessionId, onClose }: PromptPreviewProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const close = useCallback(() => onClose(), [onClose]);
  useFocusTrap(panelRef, true);
  useEscapeToClose(close, true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/plans/plan-${sessionId}/tasks/${taskId}/prompt`);
        if (!res.ok) throw new Error("Failed to load prompt");
        const data = await res.json();
        console.log("[DEBUG] prompt-preview response", {
          sessionId,
          taskId,
          status: res.status,
          promptLength: data.promptText?.length,
          preview: data.promptText?.slice(0, 200),
        });
        setPrompt(data.promptText);
        setAnnouncement("Prompt loaded");
      } catch (e) {
        console.error("[DEBUG] prompt-preview error", {
          sessionId,
          taskId,
          error: e instanceof Error ? e.message : e,
        });
        setError(e instanceof Error ? e.message : "Failed to load");
        setAnnouncement("Failed to load prompt");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [taskId, sessionId]);

  const handleCopy = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setAnnouncement("Prompt copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setAnnouncement("Could not copy prompt");
    }
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Execution prompt"
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-surface shadow-xl sm:w-[36rem]"
    >
      <LiveAnnouncer message={announcement} />

      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Execution Prompt</h2>
        <div className="flex items-center gap-2">
          {prompt && (
            <button
              onClick={handleCopy}
              aria-label="Copy prompt to clipboard"
              className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-text-secondary hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orchestra-500"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close prompt preview"
            className="rounded-lg p-1 text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-orchestra-500"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="space-y-3" role="status" aria-label="Loading prompt">
            <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-32 w-full animate-pulse rounded bg-gray-100" />
          </div>
        )}
        {!loading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
        {!loading && !error && prompt && (
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-text-primary">
            {prompt}
          </pre>
        )}
      </div>
    </div>
  );
}
