"use client";

import { useState, useEffect } from "react";
import { TaskNodeView } from "./task-node";
import { TaskDetail } from "./task-detail";
import { PromptPreview } from "./prompt-preview";
import { StepIndicator } from "@/components/ui/step-indicator";
import { Breadcrumb } from "@/components/ui/breadcrumb";
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
        const res = await fetch(`http://localhost:3000/api/v1/plans/${sessionId}/tasks`);
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-800">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-orchestra-600 px-4 py-2 text-sm text-white hover:bg-orchestra-700"
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
        <div className="rounded-xl border-2 border-dashed border-border bg-surface-secondary p-12 text-center">
          <p className="text-lg font-medium text-text-primary">No tasks generated yet</p>
          <p className="mt-1 text-sm text-text-secondary">
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
      const res = await fetch(`http://localhost:3000/api/v1/plans/${sessionId}/prompts/export`);
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
          <h1 className="text-2xl font-semibold text-text-primary">Task Graph</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {graph.tasks.length} task{graph.tasks.length !== 1 ? "s" : ""} &middot;{" "}
            {graph.dependencies.length} dependenc{graph.dependencies.length !== 1 ? "ies" : "y"} &middot; v{1}
            {needsReviewCount > 0 && ` · ${needsReviewCount} needs review`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => (window.location.href = `/projects/${sessionId}/versions`)}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50"
          >
            Version history
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="rounded-lg bg-orchestra-600 px-4 py-2 text-sm font-medium text-white hover:bg-orchestra-700 disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export bundle"}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {exportError}
        </div>
      )}

      {needsReviewCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {needsReviewCount} task{needsReviewCount !== 1 ? "s" : ""} need{needsReviewCount === 1 ? "s" : ""}{" "}
          review due to insufficient phase detail. These are marked with an amber border.
        </div>
      )}

      <div className="space-y-6">
        {PHASES.filter((p) => graph.tasks.some((t) => t.phaseType === p)).map((phase) => {
          const phaseTasks = graph.tasks
            .filter((t) => t.phaseType === phase)
            .sort((a, b) => a.order - b.order);

          return (
            <div key={phase}>
              <h3 className="mb-3 text-sm font-semibold text-text-primary">
                {PHASE_LABELS[phase] ?? phase}
                <span className="ml-2 font-normal text-text-secondary">
                  {phaseTasks.length} task{phaseTasks.length !== 1 ? "s" : ""}
                </span>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {phaseTasks.map((task) => (
                  <TaskNodeView
                    key={task.id}
                    task={task}
                    phaseIndex={PHASES.indexOf(phase)}
                    isSelected={selectedTask?.id === task.id}
                    onSelect={setSelectedTask}
                  />
                ))}
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
