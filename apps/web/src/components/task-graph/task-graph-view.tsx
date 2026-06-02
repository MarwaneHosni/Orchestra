"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TaskChain } from "./task-node";
import { TaskDetail } from "./task-detail";
import { PromptPreview } from "./prompt-preview";
import { getApiBaseUrl } from "@/lib/api-config";
import { updateTaskStatus } from "@/lib/api";
import { StepIndicator } from "@/components/ui/step-indicator";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ThinkingLoader } from "@/components/ui/skeleton";
import { SectionDivider } from "@/components/ui/badge";
import type { TaskData } from "./task-node";

const PHASES = [
  "ideation",
  "requirements",
  "architecture",
  "security",
  "database",
  "backend",
  "frontend",
  "core-features",
  "ai-systems",
  "testing",
  "deployment",
  "monitoring",
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

export function TaskGraphView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [promptTaskId, setPromptTaskId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/plans/plan-${sessionId}/tasks`);
        if (!res.ok) throw new Error("Failed to load task graph");
        const data = await res.json();
        setGraph(data);
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
      setGraph((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
        };
      });
      setSelectedTask((prev) => (prev?.id === taskId ? { ...prev, status: newStatus } : prev));
    } catch (e) {
      console.error("Failed to update task status", e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3">
        <ThinkingLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ borderRadius: 3, border: "1px solid var(--color-accent-red-dim)", background: "var(--color-accent-red-dim)", padding: "20px", textAlign: "center" }}>
        <p style={{ color: "var(--color-accent-red)", fontSize: 14 }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 14, borderRadius: 3, padding: "8px 18px", fontSize: 13, fontFamily: "inherit" }}
          className="bg-accent-purple text-white border border-accent-purple font-medium hover:opacity-88 active:scale-[0.98] transition-[color,background-color,border-color,opacity,transform] duration-150"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!graph || graph.tasks.length === 0) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: "Task Graph" }]} />
        <StepIndicator current="tasks" complete={["interview", "review"]} />
        <div style={{ borderRadius: 3, border: "2px dashed var(--color-border-default)", background: "var(--color-bg-surface)", padding: "48px", textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>No tasks generated yet</p>
          <p style={{ marginTop: 4, fontSize: 12, color: "var(--color-text-secondary)" }}>
            Complete the interview and generate a plan to see the task graph.
          </p>
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

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: "Task Graph" }]} />

      <StepIndicator current="tasks" complete={["interview", "review"]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }} className="text-text-primary">Task Graph</h1>
          <p style={{ marginTop: 4, fontSize: 12, color: "var(--color-text-secondary)", fontFamily: "'JetBrains Mono', monospace" }}>
            {graph.tasks.length} task{graph.tasks.length !== 1 ? "s" : ""} ·{" "}
            {graph.dependencies.length} dependenc{graph.dependencies.length !== 1 ? "ies" : "y"} · v{1}
            {needsReviewCount > 0 && ` · ${needsReviewCount} needs review`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/projects/${sessionId}/versions`)}
            style={{ borderRadius: 3, padding: "8px 14px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
            className="border border-border-default bg-transparent text-text-secondary font-medium hover:border-border-strong hover:bg-bg-hover transition-[color,background-color,border-color] duration-150"
          >
            Version history
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{ borderRadius: 3, padding: "8px 14px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
            className="bg-accent-purple text-white border border-accent-purple font-medium hover:opacity-88 active:scale-[0.98] disabled:opacity-50 transition-[color,background-color,border-color,opacity,transform] duration-150"
          >
            {exporting ? "Exporting..." : "Export bundle"}
          </button>
        </div>
      </div>

      {exportError && (
        <div style={{ borderRadius: 3, border: "1px solid var(--color-accent-red-dim)", background: "var(--color-accent-red-dim)", padding: "8px 12px", fontSize: 14, color: "var(--color-accent-red)" }}>
          {exportError}
        </div>
      )}

      {needsReviewCount > 0 && (
        <div style={{ borderRadius: 3, border: "1px solid var(--color-accent-amber-dim)", background: "var(--color-accent-amber-dim)", padding: "8px 12px", fontSize: 12, color: "var(--color-accent-amber)", fontFamily: "'JetBrains Mono', monospace" }}>
          {needsReviewCount} task{needsReviewCount !== 1 ? "s" : ""} need{needsReviewCount === 1 ? "s" : ""}{" "}
          review due to insufficient phase detail.
        </div>
      )}

      <div className="space-y-10">
        {PHASES.filter((p) => graph.tasks.some((t) => t.phaseType === p)).map((phase) => {
          const phaseTasks = graph.tasks
            .filter((t) => t.phaseType === phase)
            .sort((a, b) => a.order - b.order);

          return (
            <div key={phase}>
              <SectionDivider title={PHASE_LABELS[phase] ?? phase} count={phaseTasks.length} />
              <div style={{ marginTop: 14, paddingLeft: 4 }}>
                <TaskChain
                  tasks={phaseTasks}
                  dependencies={graph.dependencies}
                  selectedId={selectedTask?.id}
                  onSelect={setSelectedTask}
                />
              </div>
            </div>
          );
        })}
      </div>

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          allTasks={graph.tasks}
          onClose={() => {
            setSelectedTask(null);
            setPromptTaskId(null);
          }}
          onShowPrompt={(id) => {
            setPromptTaskId(id);
            setSelectedTask(null);
          }}
          onStatusChange={handleStatusChange}
        />
      )}

      {promptTaskId && (
        <PromptPreview
          taskId={promptTaskId}
          sessionId={sessionId}
          onClose={() => {
            setPromptTaskId(null);
          }}
        />
      )}
    </div>
  );
}
