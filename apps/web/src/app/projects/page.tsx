"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listProjects } from "@/lib/api";
import type { ProjectRecord } from "@/lib/api";

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-600" },
  active: { label: "Active", className: "bg-blue-100 text-blue-700" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
  blueprint_ready: { label: "Blueprint Ready", className: "bg-green-100 text-green-700" },
  complete: { label: "Complete", className: "bg-orchestra-100 text-orchestra-700" },
};

const STATUS_DOTS: Record<string, string> = {
  draft: "bg-gray-400",
  active: "bg-blue-500",
  in_progress: "bg-blue-500",
  blueprint_ready: "bg-green-500",
  complete: "bg-orchestra-600",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listProjects()
      .then((res) => setProjects(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Projects</h1>
            <p className="mt-1 text-sm text-text-secondary">Loading projects...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Projects</h1>
            <p className="mt-1 text-sm text-text-secondary">
              All your software ideas, organised as projects.
            </p>
          </div>
          <Button asChild>
            <Link href="/projects/new">New project</Link>
          </Button>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
          <p className="text-red-800">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Projects</h1>
            <p className="mt-1 text-sm text-text-secondary">
              All your software ideas, organised as projects.
            </p>
          </div>
          <Button asChild>
            <Link href="/projects/new">New project</Link>
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-secondary px-6 py-16 text-center">
          <h3 className="mb-2 text-lg font-semibold text-text-primary">No projects yet</h3>
          <p className="mb-6 max-w-sm text-sm text-text-secondary">
            Create your first project to start transforming an idea into a structured development plan.
          </p>
          <Button asChild>
            <Link href="/projects/new">Create project</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Projects</h1>
          <p className="mt-1 text-sm text-text-secondary">All your software ideas, organised as projects.</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">New project</Link>
        </Button>
      </div>

      <ul className="space-y-2">
        {projects.map((project) => {
          const badge = STATUS_BADGES[project.status] ?? STATUS_BADGES.draft;
          const dotColor = STATUS_DOTS[project.status] ?? "bg-gray-400";
          const statusLabel = STATUS_BADGES[project.status]?.label ?? "Draft";
          return (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}/interview`}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4 transition-colors hover:bg-gray-50"
                aria-label={`${project.name}, ${statusLabel}`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} aria-hidden="true" />
                <span className="sr-only">Status: {statusLabel}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{project.name}</p>
                  <p className="text-xs text-text-secondary">{formatDate(project.createdAt)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
                <span className="text-sm text-orchestra-600" aria-hidden="true">
                  {project.status === "draft" ? "Start interview" : "Continue"}
                  &nbsp;&rarr;
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
