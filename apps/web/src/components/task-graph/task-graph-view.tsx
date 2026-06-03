"use client";

import { useState, useEffect, useCallback } from "react";
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
  ideation: "Ideation",
  requirements: "Requirements",
  architecture: "Architecture",
  security: "Security",
  database: "Database",
  backend: "Backend",
  frontend: "Frontend",
  "core-features": "Core Features",
  "ai-systems": "AI Systems",
  testing: "Testing",
  deployment: "Deployment",
  monitoring: "Monitoring",
};

interface GraphData {
  tasks: TaskData[];
  dependencies: { taskId: string; dependsOnTaskId: string; dependencyType: string }[];
}

function useCollapsedPhases(): [Set<string>, (phase: string) => void] {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("task-graph-collapsed");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggle = useCallback((phase: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      try { localStorage.setItem("task-graph-collapsed", JSON.stringify([...next])); } catch { /* noop */ }
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

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/plans/plan-${sessionId}/tasks`);
        if (!res.ok) throw new Error("Failed to load task graph");
        setGraph(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await updateTaskStatus(`plan-${sessionId}`, taskId, newStatus);
      setGraph((prev) => prev ? {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      } : prev);
      setSelectedTask((prev) => (prev?.id === taskId ? { ...prev, status: newStatus } : prev));
    } catch (e) {
      console.error("Failed to update task status", e);
    }
  };

  if (loading) {
    return <div className="flex flex-col items-center justify-center gap-3 py-20"><ThinkingLoader /></div>;
  }

  if (error) {
    return (
      <div style={{ borderRadius: 3, border: "1px solid var(--color-accent-red-dim)", background: "var(--color-accent-red-dim)", padding: "20px", textAlign: "center" }}>
        <p style={{ color: "var(--color-accent-red)", fontSize: 14 }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: 14, borderRadius: 3, padding: "8px 18px", fontSize: 13, fontFamily: "inherit" }} className="bg-accent-purple text-white border border-accent-purple font-medium hover:opacity-88 active:scale-[0.98]">
          Retry
        </button>
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
    setExporting(true);
    setExportError("");
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/plans/plan-${sessionId}/prompts/export`);
      if (!res.ok) throw new Error("Export failed");
      const bundle = await res.json();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prompts-${sessionId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const needsReviewCount = graph.tasks.filter((t) => t.status === "needs_review").length;

  const activePhases = PHASES.filter((p) => graph.tasks.some((t) => t.phaseType === p));

  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", minWidth: 0 }}>
      <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: "Task Graph" }]} />

      {/* Top bar */}
      <div style={{ borderBottom: "1px solid var(--color-border-subtle)", padding: "20px 0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)" }}>Task Graph</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => router.push(`/projects/${sessionId}/versions`)}
              style={{ borderRadius: 3, padding: "6px 14px", fontSize: 12, fontFamily: "inherit", border: "1px solid var(--color-border-default)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}
              className="hover:border-border-strong hover:bg-bg-hover transition-[color,background-color,border-color] duration-150"
            >
              [ version history ]
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{ borderRadius: 3, padding: "6px 14px", fontSize: 12, fontFamily: "inherit", border: "1px solid var(--color-border-default)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}
              className="hover:border-border-strong hover:bg-bg-hover transition-[color,background-color,border-color] duration-150 disabled:opacity-50"
            >
              {exporting ? "[ exporting... ]" : "[ ↑ export bundle ]"}
            </button>
          </div>
        </div>

        {/* Metadata row */}
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--color-text-muted)" }}>
          {graph.tasks.length} tasks · {graph.dependencies.length} dependencies · v1
          {needsReviewCount > 0 && (
            <>
              {" · "}
              <code style={{ color: "var(--color-accent-amber)", background: "var(--color-accent-amber-dim)", padding: "1px 5px", borderRadius: 2, fontFamily: "inherit" }}>
                {needsReviewCount} needs_review
              </code>
            </>
          )}
        </div>
      </div>

      {exportError && (
        <div style={{ borderRadius: 3, border: "1px solid var(--color-accent-red-dim)", background: "var(--color-accent-red-dim)", padding: "8px 12px", fontSize: 12, color: "var(--color-accent-red)", marginTop: 16 }}>
          {exportError}
        </div>
      )}

      {/* Warning banner */}
      {needsReviewCount > 0 && (
        <div style={{
          border: "1px solid var(--color-accent-amber)",
          borderLeft: "3px solid var(--color-accent-amber)",
          background: "var(--color-accent-amber-dim)",
          borderRadius: 3,
          padding: "10px 14px",
          fontSize: 13,
          color: "var(--color-accent-amber)",
          marginTop: 16,
        }}>
          <span style={{ marginRight: 8 }}>▲</span>
          {needsReviewCount} task{needsReviewCount !== 1 ? "s" : ""} need{needsReviewCount === 1 ? "s" : ""} review due to insufficient phase detail.
        </div>
      )}

      {/* Master/Detail layout */}
      <div style={{ display: "flex", gap: 0, marginTop: 8 }}>
        {/* Left column: Task list */}
        <div style={{ flex: selectedTask ? "0 0 calc(100% - 440px)" : "1 1 auto", minWidth: 0, maxWidth: selectedTask ? "calc(100% - 440px)" : "none", overflowY: "auto", paddingRight: selectedTask ? 0 : 0 }}>
          {activePhases.map((phase) => {
            const phaseTasks = graph.tasks.filter((t) => t.phaseType === phase).sort((a, b) => a.order - b.order);
            const isCollapsed = collapsedPhases.has(phase);

            return (
              <div key={phase} style={{ marginBottom: 8 }}>
                {/* Phase header */}
                <button
                  onClick={() => togglePhase(phase)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "24px 0 8px",
                    fontFamily: "inherit",
                    color: "var(--color-text-muted)",
                    fontSize: 11,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase" as const,
                    fontWeight: 500,
                  }}
                >
                  <span style={{ color: "var(--color-border-strong)", width: "2ch", flexShrink: 0 }}>
                    {isCollapsed ? "▸ " : "▾ "}
                  </span>
                  <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>
                    {PHASE_LABELS[phase] ?? phase}
                  </span>
                  <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>
                    ({phaseTasks.length})
                  </span>
                  <span style={{ flex: 1, borderTop: "1px solid var(--color-border-subtle)", alignSelf: "center" }} />
                </button>

                {/* Task rows */}
                {!isCollapsed && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {phaseTasks.map((task) => (
                      <TaskNodeView
                        key={task.id}
                        task={task}
                        isSelected={selectedTask?.id === task.id}
                        onSelect={setSelectedTask}
                        hasDependencies={task.dependencies.length > 0}
                        indent={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right column: Detail panel */}
        {selectedTask && (
          <div
            style={{
              flex: "0 0 440px",
              width: 440,
              borderLeft: "1px solid var(--color-border-default)",
              background: "var(--color-bg-elevated)",
              position: "sticky",
              top: 48,
              height: "calc(100vh - 48px)",
              overflowY: "auto",
              zIndex: 10,
            }}
          >
            <TaskDetail
              task={selectedTask}
              allTasks={graph.tasks}
              onClose={() => { setSelectedTask(null); setPromptTaskId(null); }}
              onShowPrompt={(id) => { setPromptTaskId(id); }}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}

        {/* Empty right panel */}
        {!selectedTask && (
          <div style={{
            width: 440,
            flexShrink: 0,
            borderLeft: "1px solid var(--color-border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "sticky",
            top: 48,
            height: "calc(100vh - 48px)",
          }}>
            <div style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.8, fontFamily: "'JetBrains Mono', monospace" }}>
              <div style={{ color: "var(--color-border-strong)", marginBottom: 8, fontSize: 16 }}>│</div>
              <div>select a task to inspect</div>
              <div style={{ color: "var(--color-text-muted)" }}>← click any row to begin</div>
            </div>
          </div>
        )}
      </div>

      {/* Prompt preview (full-screen overlay) */}
      {promptTaskId && (
        <PromptPreview
          taskId={promptTaskId}
          sessionId={sessionId}
          onClose={() => { setPromptTaskId(null); }}
        />
      )}
    </div>
  );
}
