"use client";

import { useState, useEffect } from "react";
import { TaskNodeView } from "./task-node";
import { TaskDetail } from "./task-detail";
import { PromptPreview } from "./prompt-preview";
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
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
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
      </div>
    );
  }

  if (!graph || graph.tasks.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
        <p className="text-lg font-medium text-text-primary">No tasks generated yet</p>
        <p className="mt-1 text-sm text-text-secondary">Generate a plan to see the task graph.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Task Graph</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {graph.tasks.length} tasks &middot; {graph.dependencies.length} dependencies &middot; v{1}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {PHASES.filter((p) => graph.tasks.some((t) => t.phaseType === p)).map((phase) => {
          const phaseTasks = graph.tasks
            .filter((t) => t.phaseType === phase)
            .sort((a, b) => a.order - b.order);

          return (
            <div key={phase}>
              <h3 className="mb-3 text-sm font-semibold text-text-primary">{PHASE_LABELS[phase] ?? phase}</h3>
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
          onClose={() => setSelectedTask(null)}
          onShowPrompt={(id) => {
            setPromptTaskId(id);
            setSelectedTask(null);
          }}
        />
      )}

      {promptTaskId && <PromptPreview taskId={promptTaskId} onClose={() => setPromptTaskId(null)} />}

      {graph.tasks.length > 30 && (
        <p className="text-xs text-text-secondary">
          This project has {graph.tasks.length} tasks. Scroll to see all phases.
        </p>
      )}
    </div>
  );
}
