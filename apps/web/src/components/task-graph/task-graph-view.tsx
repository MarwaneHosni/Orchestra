"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { TaskNodeView } from "./task-node";
import { TaskDetail } from "./task-detail";
import { PromptPreview } from "./prompt-preview";
import { getApiBaseUrl } from "@/lib/api-config";
import { updateTaskStatus } from "@/lib/api";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ThinkingLoader } from "@/components/ui/skeleton";
import type { TaskData } from "./task-node";

const PHASES = [
  "ideation", "requirements", "architecture", "security",
  "database", "backend", "frontend", "core-features",
  "ai-systems", "testing", "deployment", "monitoring",
];

const PHASE_LABELS: Record<string, string> = {
  ideation: "Ideation", requirements: "Requirements", architecture: "Architecture",
  security: "Security", database: "Database", backend: "Backend", frontend: "Frontend",
  "core-features": "Core Features", "ai-systems": "AI Systems", testing: "Testing",
  deployment: "Deployment", monitoring: "Monitoring",
};

interface GraphData {
  tasks: TaskData[];
  dependencies: { taskId: string; dependsOnTaskId: string; dependencyType: string }[];
}

function useCollapsedPhases(): [Set<string>, (phase: string) => void] {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { const s = localStorage.getItem("task-graph-collapsed"); return s ? new Set(JSON.parse(s)) : new Set(); }
    catch { return new Set(); }
  });
  const toggle = useCallback((phase: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase); else next.add(phase);
      try { localStorage.setItem("task-graph-collapsed", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);
  return [collapsed, toggle];
}

export function TaskGraphView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [promptTaskId, setPromptTaskId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [collapsedPhases, togglePhase] = useCollapsedPhases();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/plans/plan-${sessionId}/tasks`);
        if (!res.ok) throw new Error("Failed to load task graph");
        setGraph(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally { setLoading(false); }
    })();
  }, [sessionId]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await updateTaskStatus(`plan-${sessionId}`, taskId, newStatus);
      setGraph((prev) => prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)) } : prev);
      setSelectedTask((prev) => (prev?.id === taskId ? { ...prev, status: newStatus } : prev));
    } catch (e) { console.error("Failed to update task status", e); }
  };

  // Flat list of all visible tasks for keyboard nav
  const flatTasks = useMemo(() => {
    if (!graph) return [];
    return PHASES.filter((p) => !collapsedPhases.has(p) && graph.tasks.some((t) => t.phaseType === p))
      .flatMap((p) => graph.tasks.filter((t) => t.phaseType === p).sort((a, b) => a.order - b.order));
  }, [graph, collapsedPhases]);

  // Keyboard navigation
  useEffect(() => {
    if (!graph || flatTasks.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const idx = selectedTask ? flatTasks.findIndex((t) => t.id === selectedTask.id) : -1;

      switch (e.key) {
        case "j": case "ArrowDown": {
          e.preventDefault();
          const next = idx < flatTasks.length - 1 ? flatTasks[idx + 1] : flatTasks[0];
          setSelectedTask(next!); setPromptTaskId(null);
          break;
        }
        case "k": case "ArrowUp": {
          e.preventDefault();
          const prev = idx > 0 ? flatTasks[idx - 1] : flatTasks[flatTasks.length - 1];
          setSelectedTask(prev!); setPromptTaskId(null);
          break;
        }
        case "Enter": case " ": {
          e.preventDefault();
          if (!selectedTask && flatTasks.length > 0) setSelectedTask(flatTasks[0]!);
          break;
        }
        case "p": {
          e.preventDefault();
          if (selectedTask) setPromptTaskId(selectedTask.id);
          break;
        }
        case "Escape": {
          e.preventDefault();
          if (promptTaskId) { setPromptTaskId(null); }
          else if (promptTaskId === null && selectedTask) { setSelectedTask(null); setPromptTaskId(null); }
          break;
        }
        case "[": {
          e.preventDefault();
          const currentPhase = selectedTask?.phaseType ?? flatTasks[0]?.phaseType;
          if (!currentPhase) break;
          const phaseIdx = PHASES.indexOf(currentPhase);
          const prevPhase = PHASES[phaseIdx > 0 ? phaseIdx - 1 : PHASES.length - 1]!;
          const firstInPhase = flatTasks.find((t) => t.phaseType === prevPhase);
          if (firstInPhase) { setSelectedTask(firstInPhase); setPromptTaskId(null); }
          break;
        }
        case "]": {
          e.preventDefault();
          const currentPhase = selectedTask?.phaseType ?? flatTasks[0]?.phaseType;
          if (!currentPhase) break;
          const phaseIdx = PHASES.indexOf(currentPhase);
          const nextPhase = PHASES[phaseIdx < PHASES.length - 1 ? phaseIdx + 1 : 0]!;
          const firstInPhase = flatTasks.find((t) => t.phaseType === nextPhase);
          if (firstInPhase) { setSelectedTask(firstInPhase); setPromptTaskId(null); }
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [graph, flatTasks, selectedTask, promptTaskId]);

  if (loading) return <div className="flex flex-col items-center justify-center gap-3 py-20"><ThinkingLoader /></div>;
  if (error) {
    return (
      <div style={{ borderRadius: 3, border: "1px solid var(--color-accent-red-dim)", background: "var(--color-accent-red-dim)", padding: "20px", textAlign: "center" }}>
        <p style={{ color: "var(--color-accent-red)", fontSize: 14 }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: 14, borderRadius: 3, padding: "8px 18px", fontSize: 13, fontFamily: "inherit" }} className="bg-accent-purple text-white border border-accent-purple font-medium hover:opacity-88 active:scale-[0.98]">Retry</button>
      </div>
    );
  }
  if (!graph || graph.tasks.length === 0) {
    return (
      <div style={{ minWidth: 0 }}>
        <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: "Task Graph" }]} />
        <div style={{ borderRadius: 3, border: "2px dashed var(--color-border-default)", background: "var(--color-bg-surface)", padding: "48px", textAlign: "center", marginTop: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>No tasks generated yet</p>
          <p style={{ marginTop: 4, fontSize: 12, color: "var(--color-text-secondary)" }}>Complete the interview and generate a plan to see the task graph.</p>
        </div>
      </div>
    );
  }

  const handleExport = async () => {
    setExporting(true); setExportError("");
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/plans/plan-${sessionId}/prompts/export`);
      if (!res.ok) throw new Error("Export failed");
      const bundle = await res.json();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `prompts-${sessionId.slice(0, 8)}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setExportError(e instanceof Error ? e.message : "Export failed"); }
    finally { setExporting(false); }
  };

  const needsReviewCount = graph.tasks.filter((t) => t.status === "needs_review").length;
  const activePhases = PHASES.filter((p) => graph.tasks.some((t) => t.phaseType === p));
  const showRightPanel = selectedTask !== null;
  const ff = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", minWidth: 0 }}>
      <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: "Task Graph" }]} />

      {/* Top bar */}
      <div style={{ borderBottom: "1px solid var(--color-border-subtle)", padding: "20px 0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)" }}>Task Graph</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }} className="graph-header-btns">
            <button onClick={() => router.push(`/projects/${sessionId}/versions`)}
              style={{ borderRadius: 3, padding: "6px 14px", fontSize: 12, fontFamily: "inherit", border: "1px solid var(--color-border-default)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}
              className="hover:border-border-strong hover:bg-bg-hover transition-[color,background-color,border-color] duration-150"
            >[ version history ]</button>
            <button onClick={handleExport} disabled={exporting}
              style={{ borderRadius: 3, padding: "6px 14px", fontSize: 12, fontFamily: "inherit", border: "1px solid var(--color-border-default)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}
              className="hover:border-border-strong hover:bg-bg-hover transition-[color,background-color,border-color] duration-150 disabled:opacity-50"
            >{exporting ? "[ exporting... ]" : "[ ↑ export bundle ]"}</button>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--color-text-muted)" }}>
          {graph.tasks.length} tasks · {graph.dependencies.length} dependencies · v1
          {needsReviewCount > 0 && <><span> · </span><code style={{ color: "var(--color-accent-amber)", background: "var(--color-accent-amber-dim)", padding: "1px 5px", borderRadius: 2, fontFamily: "inherit" }}>{needsReviewCount} needs_review</code></>}
        </div>
      </div>

      {exportError && (
        <div style={{ borderRadius: 3, border: "1px solid var(--color-accent-red-dim)", background: "var(--color-accent-red-dim)", padding: "8px 12px", fontSize: 12, color: "var(--color-accent-red)", marginTop: 16 }}>{exportError}</div>
      )}

      {needsReviewCount > 0 && (
        <div style={{ border: "1px solid var(--color-accent-amber)", borderLeft: "3px solid var(--color-accent-amber)", background: "var(--color-accent-amber-dim)", borderRadius: 3, padding: "10px 14px", fontSize: 13, color: "var(--color-accent-amber)", marginTop: 16 }}>
          <span style={{ marginRight: 8 }}>▲</span>{needsReviewCount} task{needsReviewCount !== 1 ? "s" : ""} need{needsReviewCount === 1 ? "s" : ""} review due to insufficient phase detail.
        </div>
      )}

      {/* Master/Detail layout */}
      <div className="graph-layout" style={{ display: "flex", gap: 0, marginTop: 8 }}>
        {/* Left: Task list */}
        <div ref={listRef} className="graph-list" style={{ flex: showRightPanel ? "0 0 calc(100% - 440px)" : "1 1 auto", minWidth: 0, overflowY: "auto", paddingRight: 0 }}>
          {activePhases.map((phase) => {
            const phaseTasks = graph.tasks.filter((t) => t.phaseType === phase).sort((a, b) => a.order - b.order);
            const isCollapsed = collapsedPhases.has(phase);
            return (
              <div key={phase} style={{ marginBottom: 8 }}>
                <button onClick={() => togglePhase(phase)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: "24px 0 8px", fontFamily: "inherit", color: "var(--color-text-muted)", fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 500 }}
                  className="graph-phase-header"
                >
                  <span style={{ color: "var(--color-border-strong)", width: "2ch", flexShrink: 0 }}>{isCollapsed ? "▸ " : "▾ "}</span>
                  <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>{PHASE_LABELS[phase] ?? phase}</span>
                  <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>({phaseTasks.length})</span>
                  <span style={{ flex: 1, borderTop: "1px solid var(--color-border-subtle)", alignSelf: "center" }} />
                </button>
                {!isCollapsed && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {phaseTasks.map((task) => (
                      <TaskNodeView key={task.id} task={task} isSelected={selectedTask?.id === task.id} onSelect={(t) => { setSelectedTask(t); setPromptTaskId(null); }} indent={false} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Panel */}
        <div className={`graph-panel ${showRightPanel ? "graph-panel-visible" : ""}`}
          style={{
            width: 440, flexShrink: 0, borderLeft: showRightPanel ? "1px solid var(--color-border-default)" : "1px solid var(--color-border-default)",
            background: showRightPanel ? "var(--color-bg-elevated)" : "transparent",
            position: "sticky", top: 48, height: "calc(100vh - 48px)", overflow: "hidden", zIndex: 10,
          }}>
          {showRightPanel ? (
            promptTaskId ? (
              <PromptPreview taskId={promptTaskId} sessionId={sessionId}
                onClose={() => { setPromptTaskId(null); }} />
            ) : (
              <TaskDetail task={selectedTask!} allTasks={graph.tasks}
                onClose={() => { setSelectedTask(null); setPromptTaskId(null); }}
                onShowPrompt={(id) => { setPromptTaskId(id); }}
                onStatusChange={handleStatusChange}
                onSelectTask={(t) => { setSelectedTask(t); setPromptTaskId(null); }} />
            )
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <div style={{
                border: "1px solid var(--color-border-subtle)", borderRadius: 3,
                padding: "24px 28px", margin: "40px 20px", textAlign: "center",
                color: "var(--color-text-muted)", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", lineHeight: 2,
              }}>
                <div>no task selected</div>
                <div>← click a task to inspect it</div>
                <div>or view its execution prompt</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard hints */}
      <div style={{ position: "fixed", bottom: 12, left: 16, fontSize: 11, color: "var(--color-text-muted)", fontFamily: "'JetBrains Mono', monospace", zIndex: 5, pointerEvents: "none" }}>
        j/k navigate · enter select · p prompt · esc close
      </div>

      {/* Responsive: <900px bottom sheet via CSS */}
      <style>{`
        @media (max-width: 900px) {
          .graph-layout { flex-direction: column; }
          .graph-list { flex: 1 1 auto !important; max-width: none !important; }
          .graph-panel { width: 100% !important; flex-shrink: 1 !important; height: auto !important;
            position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important; top: auto !important;
            border-top: 1px solid var(--color-border-strong) !important; border-radius: 4px 4px 0 0 !important;
            background: var(--color-bg-surface) !important; overflow-y: auto !important; z-index: 50 !important;
            max-height: 60vh !important; display: ${showRightPanel ? "block" : "none"} !important; }
          .graph-panel-visible { display: block !important; }
          .graph-header-btns { display: none; }
        }
        .graph-phase-header:hover span:nth-child(4) { border-top-color: var(--color-border-default) !important; }
      `}</style>
    </div>
  );
}
