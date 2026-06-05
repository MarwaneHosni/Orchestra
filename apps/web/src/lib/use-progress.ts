"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getApiBaseUrl } from "./api-config";
import { cancelGeneration } from "./api";

export interface ProgressEvent {
  schemaVersion: number;
  eventId: string;
  eventType: string;
  workflowId: string;
  stage: string;
  sequence: number;
  createdAt: string;
  payload: Record<string, unknown>;
}

export type GenerationStatus = "starting" | "running" | "retrying" | "warning" | "failed" | "cancelled" | "completed";

export interface StageSnapshot {
  stage: string;
  label: string;
  status: "pending" | "active" | "done" | "failed";
  attempt: number;
}

export interface ProgressState {
  stages: StageSnapshot[];
  status: GenerationStatus;
  progressFraction: number;
  statusMessage: string;
  completed: boolean;
  cancel: () => Promise<void>;
  detail: string;
  elapsed: number;
  subtask?: string;
  progressValue?: number;
}

const STAGE_LABELS: Record<string, string> = {
  synthesis: "Analyzing your answers",
  analysis: "Building project analysis",
  blueprint: "Generating project plan with AI",
  roadmap: "Creating roadmap",
  taskGraph: "Decomposing into tasks",
  promptGen: "Assembling execution prompts",
  complete: "Done",
};

const STAGE_ORDER = ["synthesis", "analysis", "blueprint", "roadmap", "taskGraph", "promptGen"];

function emptyStages(): StageSnapshot[] {
  return STAGE_ORDER.map((s) => ({
    stage: s,
    label: STAGE_LABELS[s] ?? s,
    status: "pending" as const,
    attempt: 0,
  }));
}

export function useProgress(workflowId: string | null): ProgressState {
  const [stages, setStages] = useState<StageSnapshot[]>(emptyStages);
  const [status, setStatus] = useState<GenerationStatus>("starting");
  const [statusMessage, setStatusMessage] = useState("Starting...");
  const [detail, setDetail] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [subtask, setSubtask] = useState<string | undefined>(undefined);
  const [progressValue, setProgressValue] = useState<number | undefined>(undefined);
  const eventSourceRef = useRef<EventSource | null>(null);
  const workflowIdRef = useRef<string | null>(null);

  const cancel = useCallback(async () => {
    const wfId = workflowIdRef.current;
    if (!wfId) return;
    try {
      await cancelGeneration(wfId);
      setStatus("cancelled");
      setStatusMessage("Cancelled");
    } catch {
      // already cancelled or completed
    }
  }, []);

  useEffect(() => {
    if (!workflowId) {
      setStages(emptyStages());
      setStatus("starting");
      setStatusMessage("Starting...");
      return;
    }

    // Reset state for new workflow
    setStages(emptyStages());
    setStatus("starting");
    setStatusMessage("Starting...");
    workflowIdRef.current = workflowId;

    const baseUrl = getApiBaseUrl() || "";
    const url = `${baseUrl}/api/v1/progress/${workflowId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    let lastEventTime = Date.now();
    let receivedFirstEvent = false;

    const resetStallTimer = () => {
      lastEventTime = Date.now();
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        const elapsed = Date.now() - lastEventTime;
        // Only warn about stall if we were receiving events and they stopped.
        // Never warn if no events arrived yet (initial connection race).
        if (elapsed >= 30000 && receivedFirstEvent && status !== "completed" && status !== "failed" && status !== "cancelled") {
          setStatusMessage("Still working... (takes longer than usual)");
        }
      }, 30000);
    };

    const updateStage = (stage: string, upd: Partial<StageSnapshot>) => {
      setStages((prev) =>
        prev.map((s) => (s.stage === stage ? { ...s, ...upd } : s)),
      );
    };

    const handleEvent = (event: MessageEvent) => {
      receivedFirstEvent = true;
      resetStallTimer();
      try {
        const ev: ProgressEvent = JSON.parse(event.data);
        const stageLabel = (ev.payload?.stageLabel as string) ?? STAGE_LABELS[ev.stage] ?? ev.stage;

        switch (ev.eventType) {
          case "stage_started":
            setStatus("running");
            setStatusMessage(stageLabel);
            updateStage(ev.stage, {
              status: "active",
              attempt: (ev.payload?.attempt as number) ?? 1,
            });
            break;

          case "stage_completed":
            setStatus("running");
            updateStage(ev.stage, { status: "done" });
            break;

          case "stage_failed":
            updateStage(ev.stage, { status: "failed" });
            if ((ev.payload as { retryable?: boolean })?.retryable) {
              setStatusMessage(`Failed: ${stageLabel} — will retry`);
            } else {
              setStatus("failed");
              setStatusMessage(`Failed: ${(ev.payload as { message?: string })?.message ?? stageLabel}`);
            }
            break;

          case "retrying":
            setStatus("retrying");
            setStatusMessage((ev.payload?.message as string) ?? "Retrying with different model...");
            updateStage(ev.stage, { status: "active", attempt: (ev.payload?.nextAttempt as number) ?? 1 });
            break;

          case "warning":
            setStatus("warning");
            setStatusMessage((ev.payload?.message as string) ?? "Something unexpected happened");
            break;

          case "completed":
            setStatus("completed");
            setStatusMessage("Done");
            setStages((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
            es.close();
            break;

          case "cancelled":
            setStatus("cancelled");
            setStatusMessage(`Cancelled: ${(ev.payload?.reason as string) ?? ""}`);
            es.close();
            break;

          case "progress":
            setDetail((ev.payload?.detail as string) ?? "");
            setElapsed((ev.payload?.elapsed as number) ?? 0);
            if (ev.payload?.subtask) setSubtask(ev.payload.subtask as string);
            if (ev.payload?.progress !== undefined) setProgressValue(ev.payload.progress as number);
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    // Listen for all event types
    for (const et of ["stage_started", "stage_completed", "stage_failed", "retrying", "warning", "completed", "cancelled", "progress"]) {
      es.addEventListener(et, handleEvent);
    }

    es.onerror = () => {
      // Connection lost — try polling as fallback
      es.close();
    };

    resetStallTimer();

    return () => {
      if (stallTimer) clearTimeout(stallTimer);
      es.close();
      eventSourceRef.current = null;
    };
  }, [workflowId]);

  const doneCount = stages.filter((s) => s.status === "done").length;
  const progressFraction = stages.length > 0 ? doneCount / stages.length : 0;

  return {
    stages,
    status,
    progressFraction,
    statusMessage,
    completed: status === "completed",
    cancel,
    detail,
    elapsed,
    subtask,
    progressValue,
  };
}
